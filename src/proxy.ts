import { NextResponse, type NextRequest } from "next/server"

import { isPublicPath, SESSION_COOKIE } from "@/lib/auth/mock-auth"

/**
 * Sends a visitor without a session to /login first (lib/auth/mock-auth.ts --
 * a test sign-in, not authentication). Everything else goes through untouched
 * to app/(live)/: the app is live only.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname)) return NextResponse.next()

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Pages only: not Next's own assets, not files with an extension.
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
}
