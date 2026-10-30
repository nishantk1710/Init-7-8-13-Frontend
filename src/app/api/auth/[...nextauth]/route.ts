// Auth.js's endpoints (/api/auth/signin, /callback/microsoft-entra-id, /session,
// /signout ...). The callback here is the Redirect URI registered on
// spares-ai-web-<env>. With AUTH_MODE other than "entra" the endpoints do not
// exist, so the test sign-in cannot be bypassed or confused with them.

import type { NextRequest } from "next/server"

import { handlers } from "@/auth"
import { serverAuthMode } from "@/lib/auth/mode"

function notFound(): Response {
  return new Response("Not found", { status: 404 })
}

export function GET(request: NextRequest): Promise<Response> | Response {
  return serverAuthMode() === "entra" ? handlers.GET(request) : notFound()
}

export function POST(request: NextRequest): Promise<Response> | Response {
  return serverAuthMode() === "entra" ? handlers.POST(request) : notFound()
}
