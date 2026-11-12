// Server-only OpenRouter helpers: chat() for chat completions, decide() for the Jev decisions API.
// See AGENT_PLAN.md §6. Never log request bodies here: they contain the real hero name.

const BASE = "https://openrouter.ai/api";

function headers(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.PUBLIC_URL || "https://ello-tonights-story.onrender.com",
    "X-Title": "Tonight's Story",
  };
}

// Running total of usage.cost for this process (dev/eval visibility only).
export const spend = { total: 0, calls: 0 };
function addCost(c: unknown) {
  if (typeof c === "number" && Number.isFinite(c)) spend.total += c;
  spend.calls++;
}

async function post(path: string, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(BASE + path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`openrouter ${path} ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatOptions {
  models: string[];                 // [primary, fallback]; OpenRouter falls back automatically
  messages: ChatMessage[];
  schema?: { name: string; schema: Record<string, unknown> }; // strict json_schema output
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}
export interface ChatResult<T> { data: T; raw: string; model: string; cost: number; ms: number }

interface ChatResponse {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { cost?: number };
}

/** Chat completion returning parsed JSON (when `schema` is set) plus cost and the model that answered. */
export async function chat<T = unknown>(o: ChatOptions): Promise<ChatResult<T>> {
  const t0 = Date.now();
  const models = o.models.filter(Boolean);
  const body: Record<string, unknown> = {
    models,
    stream: false,
    temperature: o.temperature ?? 0.8,
    max_tokens: o.maxTokens ?? 250,
    reasoning: { enabled: false },
    usage: { include: true },
    messages: o.messages,
  };
  if (o.schema) {
    body.response_format = { type: "json_schema", json_schema: { name: o.schema.name, strict: true, schema: o.schema.schema } };
  }
  const r = (await post("/v1/chat/completions", body, o.timeoutMs ?? 8000, o.signal)) as ChatResponse;
  addCost(r.usage?.cost);
  const raw = r.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new Error("empty completion");
  let data: T;
  if (o.schema) {
    // Some providers wrap JSON in code fences despite json_schema; strip defensively.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    data = JSON.parse(cleaned) as T;
  } else {
    data = raw as unknown as T;
  }
  return { data, raw, model: r.model ?? models[0], cost: r.usage?.cost ?? 0, ms: Date.now() - t0 };
}

// ---- Decisions (Jev) ---------------------------------------------------------

export type DecisionQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string }
  | { type: "score"; instructions: string; criteria: unknown[] }
  | { type: "box"; instructions: string };

export interface DecisionAnswer {
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
  noul?: number;
  [k: string]: unknown;
}
export interface DecideResult { answers: Record<string, DecisionAnswer>; model: string; cost: number; ms: number }

/** POST /api/alpha/decisions (Jev). Throws on HTTP error or timeout. */
export async function decide(o: {
  model: string; state: string; questions: Record<string, DecisionQuestion>; timeoutMs?: number; signal?: AbortSignal;
}): Promise<DecideResult> {
  const t0 = Date.now();
  const r = (await post("/alpha/decisions", { model: o.model, state: o.state, questions: o.questions }, o.timeoutMs ?? 1500, o.signal)) as {
    answers?: Record<string, DecisionAnswer>; model?: string; usage?: { cost?: number };
  };
  addCost(r.usage?.cost);
  if (!r.answers) throw new Error("decision response missing answers");
  return { answers: r.answers, model: r.model ?? o.model, cost: r.usage?.cost ?? 0, ms: Date.now() - t0 };
}
