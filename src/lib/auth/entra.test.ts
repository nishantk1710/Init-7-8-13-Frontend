import { describe, expect, it, vi } from "vitest"

import {
  entraSettings,
  logoutUrl,
  missingEntraSettings,
  needsRefresh,
  refreshAccessToken,
  REFRESH_MARGIN_MS,
  signInScopes,
  tokenEndpoint,
} from "@/lib/auth/entra"

const ISSUER = "https://login.microsoftonline.com/4caa88ff-4f97-498f-91de-d1f1dde90a6c/v2.0"
const SETTINGS = {
  clientId: "web-client",
  clientSecret: "secret",
  issuer: ISSUER,
  apiScope: "api://c730ed46-ff8a-464a-a276-c9312fbc0162/access_as_user",
}

describe("Entra settings", () => {
  it("reads the App Service settings and trims a trailing slash off the issuer", () => {
    const settings = entraSettings({
      AUTH_MICROSOFT_ENTRA_ID_ID: " web-client ",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: `${ISSUER}/`,
      AUTH_API_SCOPE: SETTINGS.apiScope,
    })
    expect(settings).toEqual(SETTINGS)
  })

  it("names every missing setting", () => {
    expect(missingEntraSettings(entraSettings({}), {})).toEqual([
      "AUTH_MICROSOFT_ENTRA_ID_ID",
      "AUTH_MICROSOFT_ENTRA_ID_SECRET",
      "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
      "AUTH_API_SCOPE",
      "AUTH_SECRET",
    ])
    expect(missingEntraSettings(SETTINGS, { AUTH_SECRET: "x" })).toEqual([])
  })

  it("asks for OpenID's scopes and the backend's, and nothing from Graph", () => {
    expect(signInScopes(SETTINGS.apiScope)).toBe(`openid profile email offline_access ${SETTINGS.apiScope}`)
  })

  it("derives the tenant's endpoints from the issuer", () => {
    const base = "https://login.microsoftonline.com/4caa88ff-4f97-498f-91de-d1f1dde90a6c"
    expect(tokenEndpoint(ISSUER)).toBe(`${base}/oauth2/v2.0/token`)
    expect(logoutUrl(ISSUER)).toBe(`${base}/oauth2/v2.0/logout`)
  })
})

describe("token refresh", () => {
  it("refreshes only near expiry", () => {
    const now = 1_000_000_000
    expect(needsRefresh(undefined, now)).toBe(true)
    expect(needsRefresh(now + REFRESH_MARGIN_MS + 1000, now)).toBe(false)
    expect(needsRefresh(now + REFRESH_MARGIN_MS - 1000, now)).toBe(true)
  })

  it("exchanges the refresh token and keeps a rotated one", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "new-at", expires_in: 3600, refresh_token: "new-rt" }), { status: 200 })
    )
    const result = await refreshAccessToken("old-rt", SETTINGS, fetchFn as unknown as typeof fetch, 1000)
    expect(result).toEqual({ accessToken: "new-at", accessTokenExpires: 1000 + 3600 * 1000, refreshToken: "new-rt" })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(tokenEndpoint(ISSUER))
    const form = new URLSearchParams(String(init.body))
    expect(form.get("grant_type")).toBe("refresh_token")
    expect(form.get("refresh_token")).toBe("old-rt")
    expect(form.get("scope")).toContain(SETTINGS.apiScope)
  })

  it("keeps the old refresh token when Entra does not rotate it", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ access_token: "at", expires_in: 60 }), { status: 200 }))
    const result = await refreshAccessToken("rt", SETTINGS, fetchFn as unknown as typeof fetch, 0)
    expect(result.refreshToken).toBe("rt")
  })

  it("throws on a refusal, so the user is sent to sign in again", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))
    await expect(refreshAccessToken("rt", SETTINGS, fetchFn as unknown as typeof fetch)).rejects.toThrow("invalid_grant")
  })
})
