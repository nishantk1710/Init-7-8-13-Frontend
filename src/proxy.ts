import { NextResponse, type NextRequest } from "next/server"

import { DATA_MODE_COOKIE, DEFAULT_DATA_MODE, parseDataMode } from "@/lib/data-mode"

/**
 * Serves one of two frontends per request, by the data-mode cookie
 * (lib/data-mode.ts):
 *
 *   live   the request goes through untouched, to app/(live)/.
 *   demo   the request is REWRITTEN to app/demo/ -- /home renders
 *          /demo/home -- so the browser URL stays /home and main's own links
 *          (which know nothing of /demo) keep working as they always did.
 *
 * /demo/... is never a URL anyone should see: it redirects to the path without
 * the prefix, which then lands in whichever tree the cookie selects.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice("/demo".length) || "/"
    return NextResponse.redirect(url)
  }

  const mode = parseDataMode(request.cookies.get(DATA_MODE_COOKIE)?.value) ?? DEFAULT_DATA_MODE
  if (mode !== "demo") return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = pathname === "/" ? "/demo" : `/demo${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Pages only: not Next's own assets, not files with an extension.
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
}
