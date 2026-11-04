// H2: the approval calls name no user. The backend identifies the actor from the request's own identity.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

type Call = { url: string; init?: RequestInit }

function stubFetch(): Call[] {
  const calls: Call[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(
      JSON.stringify({
        recommendation_id: "REC-1", status: "PENDING_APPROVAL", pending_role: "End User", route: [],
        chain_index: 0, adjustment_count: 0, current_version: 1,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  })
  return calls
}

const bodyOf = (call: Call) => JSON.parse(String(call.init?.body))
const headerOf = (call: Call, name: string) => new Headers(call.init?.headers).get(name)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the approval writes send no actor id", () => {
  it("submit sends an empty body", async () => {
    const calls = stubFetch()
    const { submitForApproval } = await import("@/features/initiative-7/services/i7-api")
    await submitForApproval("REC-1")
    expect(calls[0].url).toContain("/recommendations/REC-1/submit")
    expect(bodyOf(calls[0])).toEqual({})
  })

  it("approve / send back / hold send the role, action and comment -- and no user", async () => {
    const calls = stubFetch()
    const { applyApprovalAction } = await import("@/features/initiative-7/services/i7-api")
    await applyApprovalAction("REC-1", "End User", "APPROVE")
    await applyApprovalAction("REC-1", "End User", "SEND_BACK", "check the lead time")
    expect(bodyOf(calls[0])).toEqual({ actor_role: "End User", action: "APPROVE", comment: null })
    expect(bodyOf(calls[1])).toEqual({ actor_role: "End User", action: "SEND_BACK", comment: "check the lead time" })
    for (const call of calls) expect(bodyOf(call)).not.toHaveProperty("actor_id")
  })

  it("reject sends only the reason", async () => {
    const calls = stubFetch()
    const { rejectRecommendation } = await import("@/features/initiative-7/services/i7-api")
    await rejectRecommendation("REC-1", "not needed")
    expect(bodyOf(calls[0])).toEqual({ comment: "not needed" })
  })
})

describe("one identity for every action", () => {
  it("submit, approve and reject carry the same identity header, set by the client and not the screen", async () => {
    const calls = stubFetch()
    const { applyApprovalAction, rejectRecommendation, submitForApproval } = await import(
      "@/features/initiative-7/services/i7-api"
    )
    await submitForApproval("REC-1")
    await applyApprovalAction("REC-1", "End User", "APPROVE")
    await rejectRecommendation("REC-1", "no")

    // With sign-in off the client sends X-Actor-Id; with Entra it sends the bearer token instead.
    const identities = calls.map((call) => headerOf(call, "X-Actor-Id") ?? headerOf(call, "Authorization"))
    expect(identities.every(Boolean)).toBe(true)
    expect(new Set(identities).size).toBe(1)
    // ...and it is not the old hard-coded demo user.
    expect(identities[0]).not.toBe("end-user")
  })
})

describe("the screen cannot name a user", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
  const PANEL = "src/features/initiative-7/components/live-decision-panel.tsx"
  const HOOK = "src/features/initiative-7/hooks/use-live-approval.ts"

  it.each([PANEL, HOOK])("%s has no hard-coded actor and sends no actor id", (path) => {
    const text = source(path)
    expect(text).not.toContain("DEMO_ACTOR_ID")
    expect(text).not.toContain('"end-user"')
    expect(text).not.toMatch(/actor_id\s*:/)
  })

  it("the panel calls submit, act and reject without a user", () => {
    const text = source(PANEL)
    expect(text).toContain("await submit()")
    expect(text).toContain("await act(actingRole(), action")
    expect(text).toContain("await reject(rejectReason.trim())")
  })

  it("the hook's submit, reject and act take no actor id", () => {
    expect(source(HOOK)).not.toMatch(/\(\s*actorId/)
  })

  it("the API functions take no actor id", () => {
    const text = source("src/features/initiative-7/services/i7-api.ts")
    const approvals = text.slice(
      text.indexOf("export async function submitForApproval"),
      text.indexOf("export async function fetchApprovalHistory"),
    )
    expect(approvals).not.toMatch(/actorId|actor_id\s*:/)
  })
})
