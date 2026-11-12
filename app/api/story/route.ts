// POST /api/story: generate a 5-page story and stream it as NDJSON (AGENT_PLAN.md §8).
// Privacy: the real hero name is only used for generation and the wire. It is never persisted or logged;
// stored pages/title use the {{hero}} token (redactHero), and logs carry no page text.
import type { StoryPage, StreamMsg } from "@/lib/contracts";
import { createStory, updateStory } from "@/lib/db/stories";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { guardStoryRequest } from "@/lib/safety/request";
import { themeWordsFor } from "@/lib/story/decodable";
import { fillHero, generateStory, redactHero } from "@/lib/story/generate";
import { titleFor } from "@/lib/story/stages";

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
function storyId(len = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

const HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  // no-transform stops compression middleware from buffering; X-Accel-Buffering disables proxy buffering.
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
};

const enc = new TextEncoder();
const line = (m: StreamMsg) => enc.encode(JSON.stringify(m) + "\n");

function oneShot(msg: StreamMsg, status = 200): Response {
  return new Response(line(msg), { status, headers: HEADERS });
}

function log(evt: string, data: Record<string, unknown>) {
  // Structured server log; the /api/events pipeline (another PR) can ingest these later.
  console.log(JSON.stringify({ evt, ts: new Date().toISOString(), ...data }));
}

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);
  if (!rateLimit(`story:${ip}`, 10, 60 * 60 * 1000)) {
    return oneShot({ type: "error", message: "rate_limited" }, 429);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return oneShot({ type: "error", message: "invalid_json" }, 400); }

  const g = await guardStoryRequest(body, req.signal);
  if (!g.ok) {
    if (g.kind === "invalid") return oneShot({ type: "error", message: `invalid_${g.message}` }, 400);
    log("input_rejected", { field: g.field, reason: g.reason });
    return oneShot({ type: "rejected", field: g.field, ...(g.suggestion ? { suggestion: g.suggestion } : {}) });
  }
  const r = g.req;
  const hero = r.hero;
  const id = storyId();
  const themeWords = themeWordsFor(r.interest, r.stage, r.interest_custom);
  const titleToken = titleFor(r.interest, r.interest_custom);
  const t0 = Date.now();

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  // Insert runs concurrently with page 1 so it doesn't add to time-to-first-page.
  const created = createStory({
    id, session_id: r.session_id, variant: r.variant, age_band: r.age_band, stage: r.stage, interest: r.interest,
    interest_custom: r.interest_custom, fun_name: r.fun_name, title: titleToken, theme_words: themeWords, ref: r.ref ?? null,
  }).then(() => true, (e) => { log("story_db_error", { story_id: id, op: "create", error: String(e?.message ?? e).slice(0, 200) }); return false; });

  const stored: StoryPage[] = [];
  const safety: unknown[] = [];
  const models = new Set<string>();
  let anyFallback = false;
  let persist: Promise<unknown> = created;
  const save = (patch: Parameters<typeof updateStory>[1]) => {
    persist = persist.then(async (ok) => {
      if (ok === false) return false;
      try { await updateStory(id, patch); } catch (e) { log("story_db_error", { story_id: id, op: "update", error: String((e as Error)?.message ?? e).slice(0, 200) }); }
      return true;
    });
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (m: StreamMsg) => { try { controller.enqueue(line(m)); } catch { /* client gone */ } };
      send({ type: "story", id, title: fillHero(titleToken, hero), theme_words: themeWords });
      try {
        for await (const { page, meta } of generateStory({
          hero, stage: r.stage, interest: r.interest, interestCustom: r.interest_custom, themeWords, signal: abort.signal,
        })) {
          send({ type: "page", ...page });
          anyFallback ||= page.source === "fallback";
          if (meta.model) models.add(meta.model);
          stored.push({ ...page, text: redactHero(page.text, hero) });
          safety.push({ n: page.n, verdict: meta.safety?.verdict ?? null, ok: meta.safety?.ok ?? null, model: meta.safety?.model ?? null, regenerated: meta.regenerated, fallback: meta.fallback });
          save({ pages: [...stored], safety: [...safety] });
          log("page_ready", {
            story_id: id, session_id: r.session_id, page: page.n, stage: r.stage, interest: r.interest_custom ? "custom" : r.interest,
            latency_ms: meta.latency_ms, since_start_ms: Date.now() - t0, attempts: meta.attempts, regenerated: meta.regenerated,
            fallback: meta.fallback, safety_blocked: meta.safety_blocked, decodable_failed: meta.decodable_failed,
            offlist_count: meta.offlist.length, words: meta.words, model: meta.model, cost: meta.cost,
            reason: meta.reason ? redactHero(meta.reason, hero) : undefined,
          });
        }
        if (abort.signal.aborted) {
          save({ status: "failed" });
          log("story_aborted", { story_id: id, pages: stored.length });
        } else {
          const status = anyFallback ? "fallback" : "complete";
          save({ status, model: [...models].join(",") || undefined });
          send({ type: "done", status });
          log("story_done", { story_id: id, status, total_ms: Date.now() - t0 });
        }
      } catch (e) {
        log("story_failed", { story_id: id, error: redactHero(String((e as Error)?.message ?? e), hero).slice(0, 200) });
        save({ status: "failed" });
        send({ type: "error", message: "generation_failed" });
      } finally {
        await persist.catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers: HEADERS });
}
