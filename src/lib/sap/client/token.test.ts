import { describe, expect, it } from "vitest"
import { TokenProvider } from "./token"
import { AuthError, TransientError } from "./errors"
import type { CpiConfig } from "./config"

const config: CpiConfig = {
  baseUrl: "https://cpi.example",
  tokenUrl: "https://auth.example/oauth/token",
  clientId: "id",
  clientSecret: "secret",
  cpiPath: "/http/SAPECC/OdataConsumption",
  pageSize: 1000,
}

function tokenResponse(token: string, expiresIn = 3600) {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), { status: 200 })
}

describe("TokenProvider", () => {
  it("fetches a token and returns it", async () => {
    let calls = 0
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        calls++
        return tokenResponse("token-1")
      },
    })
    expect(await provider.getToken()).toBe("token-1")
    expect(calls).toBe(1)
  })

  it("reuses the cached token within its expiry", async () => {
    let calls = 0
    let now = 0
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        calls++
        return tokenResponse(`token-${calls}`)
      },
      now: () => now,
    })

    expect(await provider.getToken()).toBe("token-1")
    now = 60_000 // a minute later, well inside a 1h token
    expect(await provider.getToken()).toBe("token-1")
    expect(calls).toBe(1)
  })

  it("refreshes after expiry", async () => {
    let calls = 0
    let now = 0
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        calls++
        return tokenResponse(`token-${calls}`, 3600)
      },
      now: () => now,
    })

    expect(await provider.getToken()).toBe("token-1")
    now = 3_600_000 // exactly at stated expiry — the safety margin has already passed
    expect(await provider.getToken()).toBe("token-2")
    expect(calls).toBe(2)
  })

  it("refreshes slightly BEFORE stated expiry, so a call never races the boundary", async () => {
    let calls = 0
    let now = 0
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        calls++
        return tokenResponse(`token-${calls}`, 3600)
      },
      now: () => now,
    })

    await provider.getToken()
    now = 3_600_000 - 10_000 // 10s before expiry, inside the 30s margin
    expect(await provider.getToken()).toBe("token-2")
  })

  it("invalidate() forces the next call to re-fetch", async () => {
    let calls = 0
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        calls++
        return tokenResponse(`token-${calls}`)
      },
    })

    await provider.getToken()
    provider.invalidate()
    expect(await provider.getToken()).toBe("token-2")
  })

  it("concurrent callers share a single token fetch", async () => {
    let calls = 0
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        calls++
        await new Promise((r) => setTimeout(r, 5))
        return tokenResponse("token-1")
      },
    })

    const [a, b, c] = await Promise.all([provider.getToken(), provider.getToken(), provider.getToken()])
    expect([a, b, c]).toEqual(["token-1", "token-1", "token-1"])
    expect(calls).toBe(1)
  })

  it("raises AuthError on a rejected credential, without echoing the response body", async () => {
    const provider = new TokenProvider(config, {
      fetchImpl: async () => new Response("client_secret=hunter2 is wrong", { status: 401 }),
    })
    await expect(provider.getToken()).rejects.toBeInstanceOf(AuthError)
    await expect(provider.getToken()).rejects.not.toThrow(/hunter2/)
  })

  it("raises TransientError when the token endpoint is unreachable", async () => {
    const provider = new TokenProvider(config, {
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED")
      },
    })
    await expect(provider.getToken()).rejects.toBeInstanceOf(TransientError)
  })

  it("raises AuthError when the response carries no access_token", async () => {
    const provider = new TokenProvider(config, {
      fetchImpl: async () => new Response(JSON.stringify({ token_type: "bearer" }), { status: 200 }),
    })
    await expect(provider.getToken()).rejects.toBeInstanceOf(AuthError)
  })
})
