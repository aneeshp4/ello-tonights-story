// A/B variant: assigned once per browser by proxy.ts (cookie `ello_v`), with
// `?ask=end|mid` and `?h=a|b` URL overrides that proxy.ts also persists.
// Isomorphic: safe to import from proxy, server components and client code.
// Server components: use getServerVariant() from "@/lib/variant-server".
import type { AskVariant, HeadlineVariant, Variant } from "./contracts";

export const VARIANT_COOKIE = "ello_v";
export const ATTR_COOKIE = "ello_attr";
export const VARIANT_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
export const ATTR_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const DEFAULT_VARIANT: Variant = { ask: "end", h: "a" };

export function parseAsk(v: string | null | undefined): AskVariant | null {
  return v === "end" || v === "mid" ? v : null;
}
export function parseHeadline(v: string | null | undefined): HeadlineVariant | null {
  return v === "a" || v === "b" ? v : null;
}

/** Parse the cookie value (JSON, possibly URI-encoded). Returns null if missing/invalid. */
export function parseVariantCookie(raw: string | null | undefined): Variant | null {
  if (!raw) return null;
  for (const candidate of [raw, safeDecode(raw)]) {
    try {
      const o = JSON.parse(candidate) as Partial<Variant>;
      const ask = parseAsk(o?.ask);
      const h = parseHeadline(o?.h);
      if (ask && h) return { ask, h };
    } catch {
      /* try next */
    }
  }
  return null;
}

export function serializeVariant(v: Variant): string {
  return JSON.stringify({ ask: v.ask, h: v.h });
}

/** 50/50 on each axis, independently. */
export function randomVariant(rand: () => number = Math.random): Variant {
  return { ask: rand() < 0.5 ? "end" : "mid", h: rand() < 0.5 ? "a" : "b" };
}

/** Apply ?ask= / ?h= overrides on top of a base variant. */
export function applyOverrides(base: Variant, params: URLSearchParams): Variant {
  return {
    ask: parseAsk(params.get("ask")) ?? base.ask,
    h: parseHeadline(params.get("h")) ?? base.h,
  };
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return hit ? hit.slice(name.length + 1) : null;
}

/** Client: URL override > cookie > default. On the server returns the default; use getServerVariant(). */
export function getVariant(): Variant {
  if (typeof window === "undefined") return DEFAULT_VARIANT;
  const base = parseVariantCookie(readCookie(VARIANT_COOKIE)) ?? DEFAULT_VARIANT;
  return applyOverrides(base, new URLSearchParams(window.location.search));
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
