// Output safety: Jev decision model, then a chat-model fallback (AGENT_PLAN.md §6b). Server-only.
import { chat, decide, type DecisionQuestion } from "../openrouter";

export const PAGE_QUESTIONS: Record<string, DecisionQuestion> = {
  verdict: {
    type: "choice",
    instructions: "Classify this page of a bedtime story for children aged 4-9.",
    criteria: {
      safe: "Gentle, kid-appropriate. Mild resolved tension like a lost toy that is found is fine.",
      scary: "Monsters attacking, being lost or abandoned, darkness as a threat, kidnapping, nightmares.",
      violence: "Violence, injury, blood, death, weapons.",
      suggestive: "Anything sexual, romantic or suggestive.",
      profanity: "Swearing, slurs or insults.",
      dangerous: "Dangerous imitable acts like knives, fire, matches, medicine, running into roads.",
      cruelty: "Bullying or cruelty.",
    },
  },
  ok: { type: "noul", instructions: "Is this page appropriate to show a 5-year-old at bedtime?" },
};

export const OK_THRESHOLD = 0.8;
// Rescue band (deviation from the plan's plain rule, see PR): on generated pages Jev's `ok` score for
// clearly harmless text is noisy (0.55-0.8 on "the egg is stuck in a pit"), while every unsafe test page
// scored <= 0.16 and was also classified non-safe. So a page whose verdict is "safe" with p(safe) >= 0.95
// passes at ok >= 0.5. Everything else still needs ok >= 0.8.
export const OK_RESCUE = 0.5;
export const P_SAFE_RESCUE = 0.95;

export function jevPass(verdict: string, ok: number, pSafe: number): boolean {
  if (verdict !== "safe") return false;
  return ok >= OK_THRESHOLD || (ok >= OK_RESCUE && pSafe >= P_SAFE_RESCUE);
}

const VERDICTS = Object.keys((PAGE_QUESTIONS.verdict as { criteria: Record<string, string> }).criteria);

export interface SafetyResult {
  pass: boolean;
  verdict: string;
  ok: number;
  pSafe?: number;             // Jev's probability for the "safe" verdict
  model: string;
  ms: number;
  cost: number;
  error?: string;
}

/** Jev with a 1.5s timeout; on error falls back to SAFETY_MODEL_FALLBACK; both failing ⇒ unsafe. */
export async function checkPage(text: string, opts: { signal?: AbortSignal; jevTimeoutMs?: number; fallbackTimeoutMs?: number } = {}): Promise<SafetyResult> {
  const t0 = Date.now();
  let jevErr = "";
  try {
    const r = await decide({
      model: process.env.SAFETY_MODEL || "typesafe/jev-1.14",
      state: text,
      questions: PAGE_QUESTIONS,
      timeoutMs: opts.jevTimeoutMs ?? 1500,
      signal: opts.signal,
    });
    const verdict = String(r.answers.verdict?.choice ?? "unknown");
    const ok = Number(r.answers.ok?.noul ?? 0);
    const pSafe = Number(r.answers.verdict?.probabilities?.safe ?? 0);
    return { pass: jevPass(verdict, ok, pSafe), verdict, ok, pSafe, model: r.model, ms: Date.now() - t0, cost: r.cost };
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    jevErr = (e as Error).message;
  }
  try {
    return { ...(await fallbackCheck(text, opts.fallbackTimeoutMs ?? 2500, opts.signal)), ms: Date.now() - t0, error: `jev: ${jevErr}` };
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    return { pass: false, verdict: "error", ok: 0, model: "none", ms: Date.now() - t0, cost: 0, error: `jev: ${jevErr}; fallback: ${(e as Error).message}` };
  }
}

async function fallbackCheck(text: string, timeoutMs: number, signal?: AbortSignal): Promise<Omit<SafetyResult, "ms">> {
  const criteria = (PAGE_QUESTIONS.verdict as { criteria: Record<string, string> }).criteria;
  const r = await chat<{ verdict: string; ok: number }>({
    models: [process.env.SAFETY_MODEL_FALLBACK || "google/gemini-3.1-flash-lite"],
    temperature: 0,
    maxTokens: 60,
    timeoutMs,
    signal,
    schema: {
      name: "safety",
      schema: {
        type: "object", additionalProperties: false, required: ["verdict", "ok"],
        properties: { verdict: { type: "string", enum: VERDICTS }, ok: { type: "number" } },
      },
    },
    messages: [
      {
        role: "system",
        content: `You are a strict children's content safety classifier. Classify one page of a bedtime story for children aged 4-9.
Verdict categories:
${Object.entries(criteria).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
"ok" is a probability from 0 to 1 answering: is this page appropriate to show a 5-year-old at bedtime?
Reply only with JSON {"verdict": category, "ok": number}.`,
      },
      { role: "user", content: text },
    ],
  });
  const verdict = VERDICTS.includes(r.data.verdict) ? r.data.verdict : "unknown";
  const ok = Math.max(0, Math.min(1, Number(r.data.ok) || 0));
  return { pass: verdict === "safe" && ok >= OK_THRESHOLD, verdict, ok, model: r.model, cost: r.cost };
}

/** Topic check for a custom interest (AGENT_PLAN.md §8). Errors ⇒ not ok. */
export async function checkTopic(topic: string, signal?: AbortSignal): Promise<{ pass: boolean; ok: number; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const r = await decide({
      model: process.env.SAFETY_MODEL || "typesafe/jev-1.14",
      state: `A parent wants a bedtime story for their 4-9 year old child about: ${topic}`,
      questions: { ok: { type: "noul", instructions: "Is this a fine topic for a kids' bedtime story?" } },
      timeoutMs: 1500,
      signal,
    });
    const ok = Number(r.answers.ok?.noul ?? 0);
    return { pass: ok >= OK_THRESHOLD, ok, ms: Date.now() - t0 };
  } catch (e) {
    return { pass: false, ok: 0, ms: Date.now() - t0, error: (e as Error).message };
  }
}
