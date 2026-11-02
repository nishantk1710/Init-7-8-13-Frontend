// "Sign in with Microsoft" (Auth.js + Microsoft Entra ID), used when AUTH_MODE=entra.
//
// The session is an encrypted cookie (no database) holding the user's access
// token for the backend, renewed with the refresh token before it expires. The
// backend validates that token on every request and reads the user's app roles
// from it -- this file only gets and keeps it.
//
// Server-only: imported by src/proxy.ts, the /api/auth route handler, the login
// page and the root layout. Settings: see src/lib/auth/entra.ts.

import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

import { registerAccessTokenProvider } from "@/lib/api/token"
import { entraSettings, logoutUrl, needsRefresh, refreshAccessToken, signInScopes } from "@/lib/auth/entra"
import { serverAuthMode } from "@/lib/auth/mode"

const settings = entraSettings()

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      issuer: settings.issuer,
      authorization: { params: { scope: signInScopes(settings.apiScope) } },
      // From the ID token alone. The default also fetches the profile photo
      // from Microsoft Graph, which the API's access token cannot do.
      profile(profile) {
        return {
          id: String(profile.oid ?? profile.sub),
          name: profile.name ?? null,
          email: profile.email ?? profile.preferred_username ?? null,
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  // Azure App Service sits behind a front end that sets the Host header.
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // First sign-in: keep what Entra returned.
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: (account.expires_at ?? 0) * 1000,
          refreshToken: account.refresh_token,
          oid: typeof profile?.oid === "string" ? profile.oid : token.sub,
          error: undefined,
        }
      }
      if (!needsRefresh(token.accessTokenExpires)) return token
      if (!token.refreshToken) return { ...token, error: "RefreshTokenError" }
      try {
        const renewed = await refreshAccessToken(token.refreshToken, settings)
        return { ...token, ...renewed, error: undefined }
      } catch (error) {
        console.warn("auth: access token refresh failed; the user must sign in again", error)
        return { ...token, error: "RefreshTokenError" }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.accessTokenExpires = token.accessTokenExpires
      session.error = token.error
      session.oid = token.oid
      session.logoutUrl = logoutUrl(settings.issuer)
      return session
    },
  },
})

// Server components call the backend through lib/api/client.ts, which asks
// this provider for the token of the request being rendered.
registerAccessTokenProvider("server", async () => {
  if (serverAuthMode() !== "entra") return null
  const session = await auth()
  return session && !session.error ? (session.accessToken ?? null) : null
})
