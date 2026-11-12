// Server-only Supabase access via PostgREST (plain fetch, no SDK).
// Uses the service role key, which bypasses RLS. NEVER import this from a
// Client Component: the `server-only` import makes that a build error.
// (Plain node scripts: run with `node --conditions=react-server` or tsx with
// the same flag so `server-only` resolves to its no-op export.)
import "server-only";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export class SupabaseError extends Error {
  constructor(public status: number, public body: string) {
    super(`supabase ${status}: ${body.slice(0, 300)}`);
  }
}

type Prefer = "return=representation" | "return=minimal";

async function rest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  { body, prefer, timeoutMs = 5000 }: { body?: unknown; prefer?: Prefer; timeoutMs?: number } = {},
): Promise<unknown> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new SupabaseError(res.status, text);
  return text ? JSON.parse(text) : null;
}

/** Insert one or many rows. Returns inserted rows when `returning` is true. */
export async function sbInsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  opts: { returning?: boolean; select?: string } = {},
): Promise<T[]> {
  const q = opts.returning && opts.select ? `?select=${encodeURIComponent(opts.select)}` : "";
  const out = await rest("POST", `${table}${q}`, {
    body: rows,
    prefer: opts.returning ? "return=representation" : "return=minimal",
  });
  return (out as T[] | null) ?? [];
}

/** Select rows. `query` is a raw PostgREST query string, e.g. "id=eq.abc&select=*". */
export async function sbSelect<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
  return ((await rest("GET", `${table}?${query}`)) as T[] | null) ?? [];
}

/** Update rows matching a PostgREST filter, e.g. "id=eq.abc". */
export async function sbUpdate(table: string, filter: string, patch: Record<string, unknown>): Promise<void> {
  await rest("PATCH", `${table}?${filter}`, { body: patch, prefer: "return=minimal" });
}

/** Delete rows matching a PostgREST filter. Used by maintenance/tests only. */
export async function sbDelete(table: string, filter: string): Promise<void> {
  await rest("DELETE", `${table}?${filter}`, { prefer: "return=minimal" });
}

/** Variant as stored in the `variant` text columns: "ask=end,h=a". */
export function variantText(v: { ask?: unknown; h?: unknown } | null | undefined): string | null {
  if (!v || typeof v !== "object") return null;
  const ask = v.ask === "mid" || v.ask === "end" ? v.ask : null;
  const h = v.h === "a" || v.h === "b" ? v.h : null;
  if (!ask && !h) return null;
  return [ask && `ask=${ask}`, h && `h=${h}`].filter(Boolean).join(",");
}

/** PostgREST `eq` filter value, URL-encoded. */
export function eq(v: string | number): string {
  return `eq.${encodeURIComponent(String(v))}`;
}
