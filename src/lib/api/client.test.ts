/**
 * The snapshot 503 — "building" and "failed" must not read the same.
 *
 * Both arrive as 503 with Retry-After. Before this, both rendered as "still
 * preparing after a restart", so an I08 build that failed on every attempt
 * (a SQL Server query timeout, 28-Sep) looked like a page that would clear on
 * its own. The bodies below are the ones the deployed backend sent.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import { API_GET_TIMEOUT_MS, ApiError, SLOW_GET_TIMEOUT_MS, apiFetch } from "@/lib/api/client"

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
    // Shown without the initiative number the backend puts in front of it.
    expect(error.message).toContain(reason.replace("I08 data", "This data"))
    expect(error.message).not.toContain("I08")
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

/**
 * The per-route timeout override.
 *
 * Coding Candidates reads free text across the whole purchase-order and
 * requisition extract and is slow in a way no other screen is, so it opts into
 * a longer budget. The risk worth a test is not the abort -- it is the MESSAGE:
 * the reported number used to be read from the default constant whatever
 * budget actually applied, so a route that waited 60s would tell the user the
 * backend failed to answer in 20. That reads as a different, faster failure
 * than the one that happened.
 */
describe("a route that asks for a longer timeout", () => {
  afterEach(() => vi.unstubAllGlobals())

  function timeOut() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError")
      })
    )
  }

  it("reports the budget it actually waited, not the default", async () => {
    timeOut()
    try {
      await apiFetch("/i8/coding-candidates", { timeoutMs: SLOW_GET_TIMEOUT_MS })
      expect.unreachable("the request should have timed out")
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).message).toContain(
        `within ${Math.round(SLOW_GET_TIMEOUT_MS / 1000)} seconds`
      )
    }
  })

  it("still reports the default for a route that did not opt in", async () => {
    timeOut()
    try {
      await apiFetch("/i8/snapshot")
      expect.unreachable("the request should have timed out")
    } catch (error) {
      expect((error as ApiError).message).toContain(
        `within ${Math.round(API_GET_TIMEOUT_MS / 1000)} seconds`
      )
    }
  })

  it("leaves the two budgets distinguishable", () => {
    // If these ever converge the tests above still pass while asserting
    // nothing, so the premise is checked rather than assumed.
    expect(SLOW_GET_TIMEOUT_MS).toBeGreaterThan(API_GET_TIMEOUT_MS)
  })
})
