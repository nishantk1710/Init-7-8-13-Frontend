/**
 * The summary report client: what it sends, and what a switched-off backend
 * looks like to its callers.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/client"
import { generateSummaryReport, listSummaryReports } from "@/lib/api/i13-report"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const RAW = {
  id: "abc123",
  generated_at: "2026-10-13T10:00:00Z",
  generated_by: "chinmay",
  plant: "1300",
  data_as_of: "2026-10-13",
  headline: "750 of 1,200 OAR materials are non-moving.",
  narrative_source: "MODEL",
  facts: { scope: { plant: "1300", label: "Black Mountain (1300)" } },
  narrative: {
    headline: "750 of 1,200 OAR materials are non-moving.",
    findings: ["One."],
    risks: [],
    actions: [{ action: "Chase.", owner: "HOD" }],
    source: "MODEL",
    model: "gpt-4o",
    prompt_version: 1,
    notes: [],
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("generateSummaryReport", () => {
  it("POSTs once with the plant and maps the saved report", async () => {
    const calls: { url: string; method: string }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method ?? "GET" })
        return json(RAW, 201)
      })
    )

    const report = await generateSummaryReport("1300")

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe("POST")
    expect(new URL(calls[0].url).searchParams.get("plant")).toBe("1300")
    expect(report.narrativeSource).toBe("MODEL")
    expect(report.narrative.promptVersion).toBe(1)
    expect(report.narrative.actions).toEqual([{ action: "Chase.", owner: "HOD" }])
    expect(report.facts.scope.label).toBe("Black Mountain (1300)")
  })

  it("sends no plant for all plants", async () => {
    const urls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return json(RAW, 201)
      })
    )
    await generateSummaryReport()
    expect(new URL(urls[0]).searchParams.has("plant")).toBe(false)
  })
})

describe("listSummaryReports", () => {
  it("surfaces a switched-off backend as a 404 ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "The I13 summary report is not enabled." }, 404)))
    await expect(listSummaryReports()).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.status === 404
    )
  })

  it("reads an unknown wording source as the standard template", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([{ ...RAW, narrative_source: "SOMETHING_NEW" }])))
    const [item] = await listSummaryReports()
    expect(item.narrativeSource).toBe("DETERMINISTIC")
  })
})
