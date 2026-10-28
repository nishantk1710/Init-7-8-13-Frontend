/**
 * Which identity lib/api/client.ts sends: the user's access token when a
 * provider has one (Microsoft sign-in), the X-Actor-Id header otherwise -- the
 * test sign-in, exactly as before.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError, apiFetch } from "@/lib/api/client"
import { registerAccessTokenProvider } from "@/lib/api/token"

function captureFetch(status = 200, body: unknown = { ok: true }) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  // These tests run in node, where client.ts uses the "server" provider.
  registerAccessTokenProvider("server", async () => null)
})

describe("identity on every request", () => {
  it("sends X-Actor-Id and no Authorization without a token (test sign-in)", async () => {
    const calls = captureFetch()
    await apiFetch("/i8/register")
    expect(calls[0].headers["X-Actor-Id"]).toBeTruthy()
    expect(calls[0].headers.Authorization).toBeUndefined()
  })

  it("sends the bearer token and no X-Actor-Id when signed in with Microsoft", async () => {
    registerAccessTokenProvider("server", async () => "token-abc")
    const calls = captureFetch()
    await apiFetch("/i8/register")
    expect(calls[0].headers.Authorization).toBe("Bearer token-abc")
    expect(calls[0].headers["X-Actor-Id"]).toBeUndefined()
  })

  it("falls back to the header when the provider fails", async () => {
    registerAccessTokenProvider("server", async () => {
      throw new Error("session unreadable")
    })
    const calls = captureFetch()
    await apiFetch("/i8/register")
    expect(calls[0].headers.Authorization).toBeUndefined()
    expect(calls[0].headers["X-Actor-Id"]).toBeTruthy()
  })
})

describe("a role refusal (403)", () => {
  it("reaches the caller as the backend's sentence, with the roles", async () => {
    captureFetch(403, {
      detail: {
        message: "This action requires one of these roles: Spares.Stores.",
        requiredRoles: ["Spares.Stores"],
      },
    })
    const error = await apiFetch("/i8/attestations", { method: "POST" }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(403)
    expect((error as ApiError).detailText()).toBe("This action requires one of these roles: Spares.Stores.")
    expect((error as ApiError).rawDetail).toMatchObject({ requiredRoles: ["Spares.Stores"] })
  })
})
