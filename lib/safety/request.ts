// Server-side validation of POST /api/story bodies: pure input guards + Jev topic check for custom interests.
import type { StoryRequest, Stage, Variant } from "../contracts";
import { checkAgeBand, checkHero, checkInterest, closestChip, hasProfanity } from "./input";
import { checkTopic } from "./output";

export type GuardOutcome =
  | { ok: true; req: StoryRequest }
  | { ok: false; kind: "rejected"; field: "hero" | "interest"; suggestion?: string; reason: string }
  | { ok: false; kind: "invalid"; message: string };

export async function guardStoryRequest(body: unknown, signal?: AbortSignal): Promise<GuardOutcome> {
  if (!body || typeof body !== "object") return { ok: false, kind: "invalid", message: "body must be a JSON object" };
  const b = body as Record<string, unknown>;

  const stage = Number(b.stage);
  if (!Number.isInteger(stage) || stage < 0 || stage > 4) return { ok: false, kind: "invalid", message: "stage" };
  if (!checkAgeBand(b.age_band)) return { ok: false, kind: "invalid", message: "age_band" };

  const hero = checkHero(b.hero);
  if (!hero.ok) return { ok: false, kind: "rejected", field: "hero", reason: hero.reason };

  const funName = typeof b.fun_name === "string" ? b.fun_name.trim().slice(0, 24) : "";
  const safeFun = funName && /^[\p{L}][\p{L} '\-]*$/u.test(funName) && !hasProfanity(funName) ? funName : "Pip";

  const custom = b.interest_custom === true;
  const interest = checkInterest(b.interest, custom);
  if (!interest.ok) return { ok: false, kind: "rejected", field: "interest", reason: interest.reason, suggestion: interest.suggestion };
  if (custom) {
    const t = await checkTopic(interest.value, signal);
    if (!t.pass) return { ok: false, kind: "rejected", field: "interest", reason: t.error ? "topic_check_error" : "topic", suggestion: closestChip(interest.value) };
  }

  const v = (b.variant ?? {}) as Partial<Variant>;
  const variant: Variant = { ask: "end", h: v.h === "b" ? "b" : "a" };
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");

  return {
    ok: true,
    req: {
      hero: hero.value,
      fun_name: safeFun,
      age_band: b.age_band as StoryRequest["age_band"],
      interest: interest.value,
      interest_custom: custom,
      stage: stage as Stage,
      session_id: str(b.session_id, 64) || "anon",
      variant,
      ref: str(b.ref, 32) || null,
    },
  };
}
