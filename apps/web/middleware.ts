import { NextResponse, type NextRequest } from "next/server";

/**
 * Canonical profile URLs are lowercase: 301 `/John` → `/john`. The matcher
 * only covers single-segment paths, i.e. profile handles (usernames are
 * lowercase by schema, so anything with uppercase is non-canonical).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lowered = pathname.toLowerCase();
  if (pathname !== lowered) {
    const url = request.nextUrl.clone();
    url.pathname = lowered;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = { matcher: "/:path" };
