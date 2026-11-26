// The Min-Max to OAR service: the requests it makes, and how it reads what comes back.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchReverseCsvBlob,
  fetchReverseRecommendations,
  parseDecimal,
  toReverseQueryString,
} from "@/features/initiative-7/services/reverse-conversion-api"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const EMPTY_RESPONSE = {
  anchor: { month: "2026-10", source: "configured", latest_staged_month: "2026-11", data_loaded_at: null, warnings: [] },
  policy: { version: "reverse-conversion-v1", parameters: {} },
  summary: { by_category: [], by_plant_category: [], by_reason: [] },
  reconciliation: { source_population: 0, excluded: 0, categorised: 0, duplicate_keys: 0, reconciled: true, by_plant: [] },
  items: [],
  total: 0,
  page: 1,
  page_size: 25,
}

describe("the query string", () => {
  it("is empty when nothing is set", () => {
    expect(toReverseQueryString({})).toBe("")
  })

  it("uses the backend's parameter names and leaves out what is unset", () => {
    const query = toReverseQueryString({
      category: "recommended_for_oar",
      plant: "1500",
      reason: "lead_time",
      confidence: "low",
      criticality: "unknown",
      leadTimeBucket: ">90d",
      search: "hose",
      anchor: "2026-10",
      page: 2,
      pageSize: 25,
    })
    const search = new URLSearchParams(query)
    expect(Object.fromEntries(search)).toEqual({
      category: "recommended_for_oar",
      plant: "1500",
      reason: "lead_time",
      confidence: "low",
      criticality: "unknown",
      lead_time_bucket: ">90d",
      search: "hose",
      anchor: "2026-10",
      page: "2",
      page_size: "25",
    })
    expect(toReverseQueryString({ category: "recommended_for_oar", plant: undefined })).toBe("?category=recommended_for_oar")
  })

  it("escapes characters that need it", () => {
    expect(toReverseQueryString({ search: "a&b=c d" })).toBe("?search=a%26b%3Dc+d")
  })
})

describe("the list request", () => {
  it("is a GET on the reverse-conversion path, never on the OAR / Stock item recommendations path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(EMPTY_RESPONSE), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await fetchReverseRecommendations({ category: "recommended_for_oar", page: 1, pageSize: 25 })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/v1/i7/reverse-conversion/recommendations?category=recommended_for_oar&page=1&page_size=25")
    expect(url).not.toMatch(/\/v1\/i7\/recommendations/)
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined
    expect(init?.method ?? "GET").toBe("GET")
    expect(result.anchor.month).toBe("2026-10")
    expect(result.policy.version).toBe("reverse-conversion-v1")
  })

  it("raises the backend's error", async () => {
    const body = { error: { code: "REVERSE_ANCHOR_UNAVAILABLE", message: "Configure the anchor explicitly.", details: {} } }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 409 })))
    await expect(fetchReverseRecommendations({})).rejects.toMatchObject({ status: 409, code: "REVERSE_ANCHOR_UNAVAILABLE" })
  })
})

describe("the CSV export request", () => {
  it("asks the export path with the same filters and no paging, and returns the server's filename", async () => {
    const response = new Response("material,plant\r\n", {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="i7-min-max-to-oar-2026-10.csv"' },
    })
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    const result = await fetchReverseCsvBlob({ category: "not_eligible", plant: "1300" })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/v1/i7/reverse-conversion/recommendations/export?category=not_eligible&plant=1300")
    expect(url).not.toContain("page")
    expect(result).toEqual({ blobUrl: "blob:test", filename: "i7-min-max-to-oar-2026-10.csv" })
  })

  it("falls back to a dated filename when the server sends none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 200 })))
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    const { filename } = await fetchReverseCsvBlob({})
    expect(filename).toMatch(/^i7-min-max-to-oar-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

describe("parseDecimal", () => {
  it("reads the strings Pydantic sends for a Decimal", () => {
    expect(parseDecimal("5000")).toBe(5000)
    expect(parseDecimal("12.5")).toBe(12.5)
    expect(parseDecimal("0")).toBe(0)
    expect(parseDecimal(7)).toBe(7)
  })

  it("is null for nothing, never zero", () => {
    expect(parseDecimal(null)).toBeNull()
    expect(parseDecimal(undefined)).toBeNull()
    expect(parseDecimal("")).toBeNull()
    expect(parseDecimal("n/a")).toBeNull()
  })
})

describe("the consumption request", () => {
  it("asks for one material-plant's series; the month is the stored run's, never sent", async () => {
    const { fetchReverseConsumption } = await import("@/features/initiative-7/services/reverse-conversion-api")
    const source = readFileSync(join(__dirname, "reverse-conversion-api.ts"), "utf8")
    expect(typeof fetchReverseConsumption).toBe("function")
    expect(source).toContain("/recommendations/${encodeURIComponent(material)}/${encodeURIComponent(plant)}/consumption`")
    expect(source).not.toContain("?anchor=")
  })
})
