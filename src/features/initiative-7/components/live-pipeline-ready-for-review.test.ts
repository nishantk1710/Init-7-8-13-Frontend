// The Pipeline's Ready for Review: it counts, and lists, the recommendations that propose a change in SAP (the `actionable` rule) -- not
// those whose values SAP already holds, and not OAR materials that are not eligible for Min-Max -- while the total computed stays
// available beside it. Only the Pipeline page changes; the summary field is added, never substituted.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchRecommendationSummary, fetchRecommendations } from "@/features/initiative-7/services/i7-api"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const pipeline = read("src/features/initiative-7/components/live-pipeline-workspace.tsx")

afterEach(() => vi.unstubAllGlobals())

function stubFetch(body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const summaryBody = (over: Record<string, unknown> = {}) => ({
  total: 1704,
  by_status: [{ status: "READY_FOR_REVIEW", count: 1704 }],
  by_criticality: [],
  by_circuit: [],
  by_risk: [],
  by_plant: [],
  oar_count: 0,
  normal_count: 0,
  awaiting_approval_count: 1,
  ready_for_review_count: 1704,
  ready_for_review_actionable_count: 1228,
  not_evaluable_count: 0,
  ...over,
})

describe("the summary the Pipeline reads", () => {
  it("keeps the total computed and adds the part that proposes a change, side by side", async () => {
    stubFetch(summaryBody())
    const stats = await fetchRecommendationSummary()
    expect(stats.readyForReviewCount).toBe(1704) // the total, still available for reporting
    expect(stats.readyForReviewActionableCount).toBe(1228)
    expect(stats.readyForReviewCount - (stats.readyForReviewActionableCount ?? 0)).toBe(476) // those with nothing to adopt
  })

  it("reads a backend that does not send the new count as null, so the total is kept rather than a made-up 0", async () => {
    stubFetch(summaryBody({ ready_for_review_actionable_count: undefined }))
    expect((await fetchRecommendationSummary()).readyForReviewActionableCount).toBeNull()
  })

  it("keeps a real 0 as 0", async () => {
    stubFetch(summaryBody({ ready_for_review_actionable_count: 0 }))
    expect((await fetchRecommendationSummary()).readyForReviewActionableCount).toBe(0)
  })
})

describe("the Ready for Review list", () => {
  it("is asked for actionable recommendations, with the same filter the count uses", async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, page_size: 50 })
    await fetchRecommendations({ status: "READY_FOR_REVIEW", actionable: true })
    expect(String(fetchMock.mock.calls[0][0])).toContain("status=READY_FOR_REVIEW")
    expect(String(fetchMock.mock.calls[0][0])).toContain("actionable=true")
  })

  it("leaves every other status unfiltered, and the filter off unless asked for", async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, page_size: 50 })
    await fetchRecommendations({ status: "APPROVED" })
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("actionable")
  })
})

describe("the Pipeline workspace", () => {
  it("applies the actionable filter to Ready for Review only", () => {
    expect(pipeline).toContain('raw === "READY_FOR_REVIEW" ? { actionable: true } : {}')
    expect(pipeline).toContain("...actionable")
  })

  it("counts the stage and the tab from the actionable figure, keeping the total when the backend sends none", () => {
    expect(pipeline).toContain("summary?.readyForReviewActionableCount ?? row.count")
    expect(pipeline).toContain("countOf(row)")
    expect(pipeline).not.toMatch(/counts\.set\(status, \(counts\.get\(status\) \?\? 0\) \+ row\.count\)/)
  })

  it("says how many computed recommendations are not listed, and why, so the total is not lost", () => {
    expect(pipeline).toContain("summary.readyForReviewCount - summary.readyForReviewActionableCount")
    expect(pipeline).toContain("SAP already holds the recommended values")
    expect(pipeline).toContain("not eligible for the Min-Max conversion")
  })

  it("still leaves NOT_EVALUABLE out, as before", () => {
    expect(pipeline).toContain('row.status === "NOT_EVALUABLE"')
  })
})
