// Microsoft Entra ID details for src/auth.ts, kept free of Auth.js so they can
// be unit-tested: the settings, the scopes asked for, and the token refresh.
//
// Settings (App Service application settings on the web app, read at runtime):
//   AUTH_MICROSOFT_ENTRA_ID_ID       Application (client) ID of spares-ai-web-<env>
//   AUTH_MICROSOFT_ENTRA_ID_SECRET   its client secret                  (secret)
//   AUTH_MICROSOFT_ENTRA_ID_ISSUER   https://login.microsoftonline.com/<tenant id>/v2.0
//   AUTH_API_SCOPE                   api://<spares-ai-api-<env> client id>/access_as_user
//   AUTH_SECRET                      random 32 bytes; encrypts the session cookie (secret)
//
// Entra issues an access token for ONE API per request. Asking for the API's
// scope (plus OpenID's own) makes the access token Auth.js receives the one the
// backend expects -- audience spares-ai-api-<env>, the user's app roles inside.
// Microsoft Graph is never called, so no Graph permission beyond sign-in is used.

export interface EntraSettings {
  clientId: string
  clientSecret: string
  /** https://login.microsoftonline.com/<tenant id>/v2.0 */
  issuer: string
  apiScope: string
}

export function entraSettings(env: Record<string, string | undefined> = process.env): EntraSettings {
  return {
    clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ?? "",
    clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ?? "",
    issuer: (env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim() ?? "").replace(/\/+$/, ""),
    apiScope: env.AUTH_API_SCOPE?.trim() ?? "",
  }
}

/** The settings that are missing, by name -- empty when sign-in can work. */
export function missingEntraSettings(settings: EntraSettings, env: Record<string, string | undefined> = process.env): string[] {
  const missing: string[] = []
  if (!settings.clientId) missing.push("AUTH_MICROSOFT_ENTRA_ID_ID")
  if (!settings.clientSecret) missing.push("AUTH_MICROSOFT_ENTRA_ID_SECRET")
  if (!settings.issuer) missing.push("AUTH_MICROSOFT_ENTRA_ID_ISSUER")
  if (!settings.apiScope) missing.push("AUTH_API_SCOPE")
  if (!env.AUTH_SECRET?.trim()) missing.push("AUTH_SECRET")
  return missing
}

/** OpenID's scopes plus the backend's; offline_access brings the refresh token. */
export function signInScopes(apiScope: string): string {
  return ["openid", "profile", "email", "offline_access", apiScope].filter(Boolean).join(" ")
}

/** https://login.microsoftonline.com/<tenant>/v2.0 -> https://login.microsoftonline.com/<tenant> */
function authority(issuer: string): string {
  return issuer.replace(/\/v2\.0$/, "")
}

export function tokenEndpoint(issuer: string): string {
  return `${authority(issuer)}/oauth2/v2.0/token`
}

/** Entra's sign-out page, which ends the Microsoft session too. */
export function logoutUrl(issuer: string): string {
  return `${authority(issuer)}/oauth2/v2.0/logout`
}

/** Refresh this long before the access token expires, so no request carries one about to lapse. */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000

export function needsRefresh(expiresAtMs: number | undefined, nowMs: number = Date.now()): boolean {
  return !expiresAtMs || nowMs >= expiresAtMs - REFRESH_MARGIN_MS
}

export interface TokenSet {
  accessToken: string
  /** Epoch milliseconds. */
  accessTokenExpires: number
  refreshToken?: string
}

/**
 * Exchange a refresh token for a new access token (OAuth refresh_token grant).
 * Throws on any failure; src/auth.ts turns that into "sign in again".
 */
export async function refreshAccessToken(
  refreshToken: string,
  settings: EntraSettings,
  fetchFn: typeof fetch = fetch,
  nowMs: number = Date.now()
): Promise<TokenSet> {
  const response = await fetchFn(tokenEndpoint(settings.issuer), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: signInScopes(settings.apiScope),
    }),
  })
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    error?: string
  }
  if (!response.ok || !body.access_token) {
    throw new Error(`token refresh failed: ${response.status} ${body.error ?? ""}`.trim())
  }
  return {
    accessToken: body.access_token,
    accessTokenExpires: nowMs + Number(body.expires_in ?? 3600) * 1000,
    // Entra may rotate the refresh token; keep the old one when it does not.
    refreshToken: body.refresh_token ?? refreshToken,
  }
}
