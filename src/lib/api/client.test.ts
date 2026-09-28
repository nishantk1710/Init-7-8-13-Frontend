/**
 * The snapshot 503 — "building" and "failed" must not read the same.
 *
 * Both arrive as 503 with Retry-After. Before this, both rendered as "still
 * preparing after a restart", so an I08 build that failed on every attempt
 * (a SQL Server query timeout, 28-Sep) looked like a page that would clear on
 * its own. The bodies below are the ones the deployed backend sent.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError, apiFetch } from "@/lib/api/client"

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
      })
    )
  )
}

async function failure(): Promise<ApiError> {
  try {
    await apiFetch("/i8/snapshot")
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error("expected apiFetch to throw")
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a snapshot 503", () => {
  it("says 'still preparing' while the snapshot is building", async () => {
    respond(
      503,
      { detail: { status: "building", message: "I08 data is being prepared. Retry shortly." } },
      { "Retry-After": "10" }
    )
    const error = await failure()
    expect(error.status).toBe(503)
    expect(error.message).toContain("still preparing")
    expect(error.message).toContain("in 10 seconds")
  })

  it("says the build failed, and why, when it failed", async () => {
    const reason =
      "I08 data could not be prepared: OperationalError: (pyodbc.OperationalError) " +
      "('HYT00', '[HYT00] [Microsoft][ODBC Driver 18 for SQL Server]Query timeout expired (0) (SQLExecDirectW)')"
    respond(503, { detail: { status: "failed", message: reason } }, { "Retry-After": "60" })
    const error = await failure()
    expect(error.message).not.toContain("still preparing")
    expect(error.message).toContain(reason)
    expect(error.message).toContain("in 60 seconds")
    expect(error.detailText()).toBe(reason)
  })

  it("keeps the plain status message for a 503 without Retry-After", async () => {
    respond(503, { detail: "database unavailable" })
    const error = await failure()
    expect(error.message).toMatch(/failed with 503$/)
    expect(error.detailText()).toBe("database unavailable")
  })
})
