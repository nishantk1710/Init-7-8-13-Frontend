"use client"

// Loads lib/auth/browser-session.ts on every page, which registers the browser's
// access-token provider for lib/api/client.ts. Renders nothing. Mounted once in
// the root layout; in mock mode the provider simply returns no token.
import "@/lib/auth/browser-session"

export function AuthBridge() {
  return null
}
