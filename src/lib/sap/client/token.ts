// W2.1 — OAuth client-credentials token handling.
//
// Two behaviours that matter, both copied from cpi_discovery.py, which has
// now completed several live sweeps against this exact endpoint:
//   1. Cache the token and reuse it until shortly before it expires.
//   2. On a 401, fetch a new token and retry the call ONCE — a token can be
//      invalidated server-side before its stated expiry.

import type { CpiConfig } from "./config"
import { AuthError, TransientError } from "./errors"

/** Refresh this far before stated expiry, so a call never races the boundary. */
const EXPIRY_MARGIN_MS = 30_000

export interface TokenProviderOptions {
  fetchImpl?: typeof fetch
  now?: () => number
}

export class TokenProvider {
  private token: string | null = null
  private expiresAt = 0
  private inFlight: Promise<string> | null = null

  private readonly fetchImpl: typeof fetch
  private readonly now: () => number

  constructor(
    private readonly config: CpiConfig,
    options: TokenProviderOptions = {}
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? Date.now
  }

  /** A valid token, from cache when possible. Concurrent callers share one fetch. */
  async getToken(): Promise<string> {
    if (this.token && this.now() < this.expiresAt) return this.token
    this.inFlight ??= this.fetchToken().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  /** Discard the cached token, so the next getToken() fetches a fresh one. */
  invalidate(): void {
    this.token = null
    this.expiresAt = 0
  }

  private async fetchToken(): Promise<string> {
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")

    let response: Response
    try {
      response = await this.fetchImpl(this.config.tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      })
    } catch (cause) {
      throw new TransientError(`Token endpoint unreachable: ${(cause as Error).message}`)
    }

    if (!response.ok) {
      // Never include the response body — it can echo back credentials.
      throw new AuthError(`Token request failed with HTTP ${response.status}`, { status: response.status })
    }

    const payload = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!payload.access_token) {
      throw new AuthError("Token response contained no access_token")
    }

    this.token = payload.access_token
    const lifetimeMs = (payload.expires_in ?? 3600) * 1000
    this.expiresAt = this.now() + Math.max(lifetimeMs - EXPIRY_MARGIN_MS, 0)
    return this.token
  }

  /** Stated expiry as an epoch ms value. For the smoke test to print — never the token itself. */
  get expiryTimestamp(): number {
    return this.expiresAt
  }
}
