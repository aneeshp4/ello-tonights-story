import { NextResponse, type NextRequest } from "next/server";
import {
  ATTR_COOKIE,
  ATTR_MAX_AGE,
  VARIANT_COOKIE,
  VARIANT_MAX_AGE,
  applyOverrides,
  parseVariantCookie,
  randomVariant,
  serializeVariant,
} from "./lib/variant";
import { attributionFromParams } from "./lib/attribution";

// Next 16 "proxy" (formerly middleware). On every page request:
// 1. A/B: assign `ello_v` = {ask, h} 50/50 each on first visit; `?ask=` / `?h=`
//    override and are persisted.
// 2. Attribution: `?ref=` / `utm_*` saved to `ello_attr` (last touch with params).
// 3. Landing: `/` is rewritten to the statically-prerendered `/landing/{h}` so the
//    headline is correct in the first byte of HTML (no flash, still static).
// Cookies are also written onto the *request* so server components rendering this
// same request see the freshly assigned values.

export function proxy(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;

  const existing = parseVariantCookie(request.cookies.get(VARIANT_COOKIE)?.value);
  const variant = applyOverrides(existing ?? randomVariant(), searchParams);
  const variantChanged =
    !existing || existing.ask !== variant.ask || existing.h !== variant.h;

  const attr = attributionFromParams(searchParams);

  if (variantChanged) request.cookies.set(VARIANT_COOKIE, serializeVariant(variant));
  if (attr) request.cookies.set(ATTR_COOKIE, JSON.stringify(attr));
  const init = { request: { headers: request.headers } };

  const response =
    pathname === "/"
      ? NextResponse.rewrite(new URL(`/landing/${variant.h}${request.nextUrl.search}`, request.url), init)
      : NextResponse.next(init);

  const common = { path: "/", sameSite: "lax" as const, secure: request.nextUrl.protocol === "https:" };
  if (variantChanged) {
    response.cookies.set(VARIANT_COOKIE, serializeVariant(variant), { ...common, maxAge: VARIANT_MAX_AGE });
  }
  if (attr) {
    response.cookies.set(ATTR_COOKIE, JSON.stringify(attr), { ...common, maxAge: ATTR_MAX_AGE });
  }
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip API routes, Next internals, metadata images and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|opengraph-image|twitter-image|.*\\.[\\w]+$).*)",
  ],
};
