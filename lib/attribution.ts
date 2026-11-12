// Attribution: `?ref=` (share-loop story id) and `utm_*` params. proxy.ts saves
// them in the `ello_attr` cookie (last touch with params wins) so they survive
// navigation to /make, /story, etc. Isomorphic.
import { ATTR_COOKIE, readCookie } from "./variant";

export interface Attribution {
  ref?: string;
  utm?: Record<string, string>; // e.g. { utm_source: "fb", utm_campaign: "x" }
}

const MAX_LEN = 100;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function clean(v: string | null): string | undefined {
  if (!v) return undefined;
  const s = v.trim().slice(0, MAX_LEN);
  return s || undefined;
}

/** Extract ref/utm from URL params. Returns null when none present. */
export function attributionFromParams(params: URLSearchParams): Attribution | null {
  const ref = clean(params.get("ref"));
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = clean(params.get(k));
    if (v) utm[k] = v;
  }
  if (!ref && Object.keys(utm).length === 0) return null;
  return { ...(ref ? { ref } : {}), ...(Object.keys(utm).length ? { utm } : {}) };
}

export function parseAttribution(raw: string | null | undefined): Attribution {
  if (!raw) return {};
  for (const candidate of [raw, safeDecode(raw)]) {
    try {
      const o = JSON.parse(candidate) as Attribution;
      if (o && typeof o === "object") {
        const out: Attribution = {};
        if (typeof o.ref === "string") out.ref = o.ref.slice(0, MAX_LEN);
        if (o.utm && typeof o.utm === "object") {
          const utm: Record<string, string> = {};
          for (const k of UTM_KEYS) {
            const v = (o.utm as Record<string, unknown>)[k];
            if (typeof v === "string") utm[k] = v.slice(0, MAX_LEN);
          }
          if (Object.keys(utm).length) out.utm = utm;
        }
        return out;
      }
    } catch {
      /* try next */
    }
  }
  return {};
}

/** Client: URL params (if any) > cookie. On the server returns {}; use getServerAttribution(). */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  return (
    attributionFromParams(new URLSearchParams(window.location.search)) ??
    parseAttribution(readCookie(ATTR_COOKIE))
  );
}

/** Flat props for events: { ref, utm_source, ... }. */
export function attributionProps(a: Attribution = getAttribution()): Record<string, string> {
  return { ...(a.ref ? { ref: a.ref } : {}), ...(a.utm ?? {}) };
}

/** Query string carrying ref/utm forward (e.g. landing CTA → /make). Leading "?" or "". */
export function attributionQuery(a: Attribution = getAttribution()): string {
  const qs = new URLSearchParams(attributionProps(a)).toString();
  return qs ? `?${qs}` : "";
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
