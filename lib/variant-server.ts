import { cookies } from "next/headers";
import type { Variant } from "./contracts";
import { ATTR_COOKIE, DEFAULT_VARIANT, VARIANT_COOKIE, parseVariantCookie } from "./variant";
import { parseAttribution, type Attribution } from "./attribution";

// Server-component / route-handler helpers. `cookies()` is a request-time API:
// with cacheComponents on, call these inside a <Suspense> boundary (or from a
// route handler). proxy.ts injects the cookie into the request on first visit,
// so this sees the assigned variant even before the browser stores it.

export async function getServerVariant(): Promise<Variant> {
  const store = await cookies();
  return parseVariantCookie(store.get(VARIANT_COOKIE)?.value) ?? DEFAULT_VARIANT;
}

export async function getServerAttribution(): Promise<Attribution> {
  const store = await cookies();
  return parseAttribution(store.get(ATTR_COOKIE)?.value);
}
