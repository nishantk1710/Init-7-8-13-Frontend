// What src/auth.ts adds to Auth.js's session and token.

import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    /** Access token for the backend (audience spares-ai-api-<env>). */
    accessToken?: string
    /** Epoch milliseconds. */
    accessTokenExpires?: number
    /** "RefreshTokenError" when the session can no longer be renewed: sign in again. */
    error?: string
    /** Entra's sign-out page for this tenant. */
    logoutUrl?: string
    /** Entra object ID -- what the backend records as the author of a write. */
    oid?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    accessTokenExpires?: number
    refreshToken?: string
    oid?: string
    error?: string
  }
}
