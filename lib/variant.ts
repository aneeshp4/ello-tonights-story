// STUB: replaced by the analytics/A-B agent (cookie assignment + ?ask= / ?h= overrides).
import type { Variant } from "./contracts";

export function getVariant(): Variant {
  if (typeof window !== "undefined") {
    const p = new URLSearchParams(window.location.search);
    return { ask: p.get("ask") === "mid" ? "mid" : "end", h: p.get("h") === "b" ? "b" : "a" };
  }
  return { ask: "end", h: "a" };
}
