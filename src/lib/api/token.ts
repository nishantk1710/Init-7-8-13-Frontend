// Where lib/api/client.ts gets the user's access token for the backend.
//
// client.ts runs in two places -- server components and the browser -- and the
// token lives somewhere different in each: the Auth.js session read on the
// server (src/auth.ts), and the session fetched by the browser
// (src/lib/auth/browser-token.ts). Each of those registers a provider here when
// its module loads, so client.ts needs no import of either, and none of the
// Auth.js server code can end up in the browser bundle.
//
// No provider (AUTH_MODE=mock, or a test) means no token: client.ts then sends
// the X-Actor-Id header exactly as before sign-in existed.

export type AccessTokenProvider = () => Promise<string | null>

const providers: { server: AccessTokenProvider | null; browser: AccessTokenProvider | null } = {
  server: null,
  browser: null,
}

export function registerAccessTokenProvider(where: "server" | "browser", provider: AccessTokenProvider): void {
  providers[where] = provider
}

/** The current user's access token for the backend, or null when there is none. */
export async function currentAccessToken(): Promise<string | null> {
  const provider = typeof window === "undefined" ? providers.server : providers.browser
  if (!provider) return null
  try {
    return await provider()
  } catch {
    // A token we cannot get is a missing token: the backend answers 401 and
    // the caller sees that, rather than a crash in this helper.
    return null
  }
}
