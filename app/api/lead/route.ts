// POST /api/lead: LeadRequest -> LeadResponse. Inserts into public.leads.
// Only whitelisted fields are copied. The hero name (first name/nickname) is stored on the
// lead so Chapter 2 emails can use it; it is validated like /api/story and never logged.
// Email sending is mocked: see /preview/email/{lead_id}/{1..4}.
import { AGE_BANDS, type AgeBand, type LeadResponse, type Stage } from "@/lib/contracts";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { checkHero } from "@/lib/safety/input";
import { SupabaseError, supabaseConfigured, variantText } from "@/lib/supabase";
import { insertLead, stageName } from "@/lib/db/leads";

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function reply(body: LeadResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// Hero name: same guard as /api/story (length, letters, profanity). Anything that fails
// is stored as null rather than rejecting the lead. Never logged.
function cleanHeroName(v: unknown): string | null {
  const r = checkHero(v);
  return r.ok ? r.value : null;
}

function cleanUtm(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v).slice(0, 10)) {
    if (/^[a-z0-9_]{1,40}$/i.test(k) && typeof val === "string") out[k] = val.slice(0, 200);
  }
  return out;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(await req.text());
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    body = parsed;
  } catch {
    return reply({ ok: false, error: "invalid_email" }, 400);
  }

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return reply({ ok: true, lead_id: crypto.randomUUID() });
  }

  if (!rateLimit(`lead:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return reply({ ok: false, error: "rate_limited" }, 429);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return reply({ ok: false, error: "invalid_email" }, 400);
  }

  const age_band = AGE_BANDS.includes(body.age_band as AgeBand) ? (body.age_band as AgeBand) : null;
  const stage = typeof body.stage === "number" && Number.isInteger(body.stage) && body.stage >= 0 && body.stage <= 4
    ? (body.stage as Stage) : null;
  const story_id = typeof body.story_id === "string" && ID_RE.test(body.story_id) ? body.story_id : null;
  const ref = typeof body.ref === "string" && ID_RE.test(body.ref) ? body.ref : null;

  if (!supabaseConfigured()) {
    console.warn("[lead] Supabase not configured: lead not stored");
    return reply({ ok: false, error: "server" }, 503);
  }

  try {
    const lead_id = await insertLead({
      email,
      age_band,
      reading_stage: stageName(stage),
      interest: str(body.interest, 40),
      story_id,
      variant: variantText(body.variant as { ask?: unknown; h?: unknown }),
      session_id: str(body.session_id, 64),
      referrer: ref,
      utm: cleanUtm(body.utm),
      consent: body.consent === true,
      hero_name: cleanHeroName(body.hero),
    });
    return reply({ ok: true, lead_id });
  } catch (e) {
    // Don't log the error body: PostgREST can echo the failing row (email, hero name).
    console.error("[lead] insert failed:", e instanceof SupabaseError ? `supabase ${e.status}` : (e as Error)?.name ?? "error");
    return reply({ ok: false, error: "server" }, 500);
  }
}
