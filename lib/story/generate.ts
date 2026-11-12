// Page loop (AGENT_PLAN.md §8.3): generate → decodable check + Jev in parallel → regenerate once → fallback page.
// Server-only. Yields each page as soon as it is ready. Text over the wire uses the real hero name;
// callers must redact with redactHero() before persisting or logging.
import { SCENES, type Scene, type Stage, type StoryPage } from "../contracts";
import { chat } from "../openrouter";
import { checkPage, type SafetyResult } from "../safety/output";
import { fallbackStory } from "../../content/fallback";
import { checkDecodable } from "./decodable";
import { PAGE_SCHEMA, systemPrompt, userPrompt } from "./prompt";
import { interestLabel } from "./stages";

export const PAGES = 5;

export interface GenerateOptions {
  hero: string;
  stage: Stage;
  interest: string;
  interestCustom: boolean;
  themeWords: string[];
  signal?: AbortSignal;
  pageBudgetMs?: number;     // default 8000
}

export interface PageMeta {
  n: number;
  latency_ms: number;
  attempts: number;
  regenerated: boolean;
  fallback: boolean;
  safety_blocked: boolean;
  decodable_failed: boolean;
  offlist: string[];          // from the accepted (or last) attempt
  words: number;
  model: string | null;
  cost: number;
  safety: { verdict: string; ok: number; model: string; ms: number } | null;
  safety_failures: { category: string; ok: number | null; model: string | null }[]; // one per failed safety check (any attempt)
  reason?: string;            // why it fell back
}
export interface GeneratedPage { page: StoryPage; meta: PageMeta }

const SCENE_SET = new Set<string>(SCENES);

function clean(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "").trim();
}

export function fallbackPage(stage: Stage, interest: string, n: number, hero: string): StoryPage {
  const p = fallbackStory(stage, interest).pages[n - 1];
  return { n, text: fillHero(p.text, hero), scene: p.scene, source: "fallback" };
}

export function fillHero(text: string, hero: string): string {
  return text.replace(/\{\{hero\}\}/g, hero);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace the real hero name with {{hero}} (case-insensitive, whole word). Also redacts each part of a multi-word name. */
export function redactHero(text: string, hero: string): string {
  const name = hero.trim();
  if (!name) return text;
  const parts = [name, ...name.split(/[\s\-]+/).filter((p) => p.length >= 2 && p !== name)];
  let out = text;
  for (const p of parts) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p)}(?![\\p{L}\\p{N}])`, "giu"), "{{hero}}");
  }
  return out;
}

export async function* generateStory(o: GenerateOptions): AsyncGenerator<GeneratedPage> {
  const budget = o.pageBudgetMs ?? 8000;
  const models = [process.env.STORY_MODEL || "google/gemini-3.1-flash-lite", process.env.STORY_MODEL_FALLBACK || ""].filter(Boolean);
  const system = systemPrompt({ stage: o.stage, hero: o.hero, interestLabel: interestLabel(o.interest, o.interestCustom), themeWords: o.themeWords });
  const prior: string[] = [];
  let apiFailures = 0;          // consecutive pages that fell back because generation itself errored

  for (let n = 1; n <= PAGES; n++) {
    if (o.signal?.aborted) return;
    const t0 = Date.now();
    const deadline = t0 + budget;
    const meta: PageMeta = {
      n, latency_ms: 0, attempts: 0, regenerated: false, fallback: false, safety_blocked: false, decodable_failed: false,
      offlist: [], words: 0, model: null, cost: 0, safety: null, safety_failures: [],
    };
    let accepted: StoryPage | null = null;

    // Two fallbacks in a row usually means the API is down: finish with the pre-written story so it stays coherent.
    if (apiFailures >= 2) meta.reason = "api_degraded";
    else {
      let avoid: string[] | undefined;
      let tooLong = false;
      let lastTry: string | undefined;
      for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < 800) { meta.reason = "budget"; break; }
        meta.attempts++;
        meta.regenerated = attempt > 0;
        let text: string, scene: Scene;
        try {
          const r = await chat<{ text: string; scene: string }>({
            models,
            messages: [{ role: "system", content: system }, { role: "user", content: userPrompt({ n, prior, lastTry, avoid, tooLong }) }],
            schema: PAGE_SCHEMA,
            temperature: o.stage === 1 || o.stage === 2 ? 0.6 : 0.8,
            maxTokens: 250,
            timeoutMs: Math.min(remaining - 300, 4500),
            signal: o.signal,
          });
          meta.cost += r.cost;
          meta.model = r.model;
          text = clean(r.data.text);
          scene = (SCENE_SET.has(r.data.scene) ? r.data.scene : "outdoors-day") as Scene;
          if (!text) throw new Error("empty text");
        } catch (e) {
          if (o.signal?.aborted) return;
          meta.reason = `generate: ${(e as Error).message.slice(0, 120)}`;
          continue;
        }

        // Decodable check (sync) and safety (async) in parallel; a decodable miss cancels the safety call.
        const safetyCtrl = new AbortController();
        const onAbort = () => safetyCtrl.abort();
        o.signal?.addEventListener("abort", onAbort, { once: true });
        const left = deadline - Date.now();
        const safetyP: Promise<SafetyResult | null> = checkPage(text, {
          signal: safetyCtrl.signal,
          jevTimeoutMs: Math.max(300, Math.min(1500, left - 200)),
          fallbackTimeoutMs: Math.max(300, Math.min(2500, left - 1700)),
        }).catch(() => null);
        const dec = checkDecodable(text, o.stage, { hero: o.hero, themeWords: o.themeWords });
        meta.offlist = dec.offList;
        meta.words = dec.words;
        if (!dec.ok) {
          safetyCtrl.abort();
          o.signal?.removeEventListener("abort", onAbort);
          meta.decodable_failed = true;
          meta.reason = dec.tooLong ? "too_long" : dec.tooShort ? "too_short" : "decodable";
          avoid = dec.offList.length ? dec.offList : undefined;
          tooLong = dec.tooLong;
          lastTry = text;
          continue;
        }
        const s = await safetyP;
        o.signal?.removeEventListener("abort", onAbort);
        if (o.signal?.aborted) return;
        if (s) {
          meta.cost += s.cost;
          meta.safety = { verdict: s.verdict, ok: s.ok, model: s.model, ms: s.ms };
        }
        if (!s || !s.pass) {
          meta.safety_blocked = true;
          // A "safe" verdict can still fail on a low ok score; both checks failing (no result) is "error".
          meta.safety_failures.push(s
            ? { category: s.verdict === "safe" ? "low_ok" : s.verdict, ok: s.ok, model: s.model }
            : { category: "error", ok: null, model: null });
          meta.reason = `safety: ${s ? s.verdict : "error"}`;
          avoid = undefined;
          tooLong = false;
          continue;
        }
        accepted = { n, text, scene, source: "model" };
      }
    }

    if (!accepted) {
      meta.fallback = true;
      accepted = fallbackPage(o.stage, o.interestCustom ? "generic" : o.interest, n, o.hero);
      if (meta.reason?.startsWith("generate") || meta.reason === "budget" || meta.reason === "api_degraded") apiFailures++; else apiFailures = 0;
    } else {
      apiFailures = 0;
      meta.reason = undefined;
    }
    prior.push(accepted.text);
    meta.latency_ms = Date.now() - t0;
    yield { page: accepted, meta };
  }
}
