// POST /api/events: batched analytics (EventsRequest). Inserts into public.events.
// Accepts navigator.sendBeacon bodies (text/plain JSON). Replies 204 immediately;
// the insert runs in after() so the client never waits on the DB.
import { after } from "next/server";
import { EVENT_NAMES, type EventName } from "@/lib/contracts";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { variantText } from "@/lib/supabase";
import { insertEvents, type EventRow } from "@/lib/db/events";

const MAX_EVENTS = 50;
const MAX_PROPS_BYTES = 2048;
const MAX_BODY_BYTES = 200_000;
const ALLOWED = new Set<string>(EVENT_NAMES);

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

// Variant from the request body, else from the `ello_v` cookie (JSON or "ask=end,h=a").
function variantFrom(bodyVariant: unknown, req: Request): string | null {
  const fromBody = variantText(bodyVariant as { ask?: unknown; h?: unknown });
  if (fromBody) return fromBody;
  const m = /(?:^|;\s*)ello_v=([^;]*)/.exec(req.headers.get("cookie") ?? "");
  if (!m) return null;
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
  try { return variantText(JSON.parse(raw)); } catch { /* not JSON */ }
  const kv = Object.fromEntries(raw.split(/[,&]/).map((p) => p.split("=") as [string, string]));
  return variantText(kv);
}

export async function POST(req: Request) {
  if (!rateLimit(`events:${clientIp(req)}`, 300, 60 * 1000)) {
    return new Response(null, { status: 429 });
  }

  let body: { session_id?: unknown; variant?: unknown; events?: unknown };
  try {
    const text = await req.text(); // works for application/json and sendBeacon's text/plain
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.events)) {
    return new Response(null, { status: 400 });
  }

  const session_id = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "";
  if (!session_id) return new Response(null, { status: 400 });
  const variant = variantFrom(body.variant, req);

  const rows: EventRow[] = [];
  for (const ev of body.events.slice(0, MAX_EVENTS)) {
    if (!ev || typeof ev !== "object") continue;
    const { name, ts, path, props } = ev as { name?: unknown; ts?: unknown; path?: unknown; props?: unknown };
    if (typeof name !== "string" || !ALLOWED.has(name)) continue;
    const p: Record<string, unknown> =
      props && typeof props === "object" && !Array.isArray(props) ? { ...(props as object) } : {};
    if (typeof ts === "number" && Number.isFinite(ts)) p.ts = ts; // client timestamp; created_at is server time
    const json = JSON.stringify(p);
    if (new TextEncoder().encode(json).length > MAX_PROPS_BYTES) continue; // drop oversize
    rows.push({
      session_id,
      name: name as EventName,
      variant,
      path: typeof path === "string" ? path.slice(0, 200) : null,
      props: p,
    });
  }

  if (rows.length) after(() => insertEvents(rows));
  return noContent();
}
