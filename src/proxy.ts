import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

import { auth } from "@/auth"
import { AUTH_MODE_COOKIE, serverAuthMode, type AuthMode } from "@/lib/auth/mode"
import { isPublicPath, SESSION_COOKIE } from "@/lib/auth/mock-auth"

/**
 * Every page needs a signed-in user; anyone without one goes to /login with
 * `next` = where they were going.
 *
 * Which sign-in decides that is the AUTH_MODE setting, read here on every
 * request (lib/auth/mode.ts):
 *
 *   mock   the test sign-in's SESSION_COOKIE, exactly as before;
 *   entra  an Auth.js session ("Sign in with Microsoft"). /signup does not
 *          exist in this mode -- accounts and roles are managed in Entra ID --
 *          and a session that can no longer be renewed counts as signed out.
 *
 * Every response also carries the mode in AUTH_MODE_COOKIE, the only way the
 * browser can learn a runtime setting.
 */

function toLogin(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  if (pathname !== "/" && pathname !== "/login") url.searchParams.set("next", `${pathname}${search}`)
  return NextResponse.redirect(url)
}

function stamp(response: Response, mode: AuthMode): Response {
  if (response instanceof NextResponse) {
    response.cookies.set(AUTH_MODE_COOKIE, mode, { path: "/", sameSite: "lax" })
    return response
  }
  // Auth.js's guard hands back a plain Response, whose headers may be
  // immutable (a redirect's are): copy it with the cookie added. Its
  // x-middleware-* headers come along, so "continue" and "rewrite" still work.
  const headers = new Headers(response.headers)
  headers.append("Set-Cookie", `${AUTH_MODE_COOKIE}=${mode}; Path=/; SameSite=Lax`)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

const entraGuard = auth((request) => {
  const { pathname } = request.nextUrl
  if (pathname === "/signup" || pathname.startsWith("/signup/")) {
    return NextResponse.redirect(new URL("/login", request.nextUrl))
  }
  if (isPublicPath(pathname)) return NextResponse.next()
  if (!request.auth || request.auth.error === "RefreshTokenError") return toLogin(request)
  return NextResponse.next()
})

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const mode = serverAuthMode()

  if (mode === "entra") {
    // Auth.js's own endpoints answer for themselves.
    if (request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next()
    const response = await entraGuard(request, event as never)
    return stamp(response ?? NextResponse.next(), mode)
  }

  const { pathname } = request.nextUrl
  if (isPublicPath(pathname)) return stamp(NextResponse.next(), mode)
  if (!request.cookies.get(SESSION_COOKIE)?.value) return stamp(toLogin(request), mode)
  return stamp(NextResponse.next(), mode)
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
}
