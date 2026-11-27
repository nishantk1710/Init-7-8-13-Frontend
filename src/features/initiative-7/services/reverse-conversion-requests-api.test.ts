// The Convert to OAR requests service: the list the Action Center and the Pipeline read.

import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchReverseRequestList } from "@/features/initiative-7/services/reverse-conversion-requests-api"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const LIST = {
  items: [
    {
      id: 7, material: "REC1", plant: "1300", description: "Hose", status: "PENDING_APPROVAL", pending_role: "Inventory Controller",
      route: ["Inventory Controller", "Engineering Head", "Plant Head", "Commercial Head"], chain_index: 0, confidence: "high",
      stock_value: "1500.00", submitted_by: "u", submitted_at: "2026-11-20T08:00:00Z", updated_at: "2026-11-27T09:30:00Z",
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
  counts: [{ status: "PENDING_APPROVAL", count: 1 }],
}

describe("fetchReverseRequestList", () => {
  it("is a GET on the requests list path with the backend's parameter names, and reads the response as sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(LIST), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchReverseRequestList({ status: "PENDING_APPROVAL", page: 2, pageSize: 50 })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/v1/i7/reverse-conversion/requests/list?status=PENDING_APPROVAL&page=2&page_size=50")
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined
    expect(init?.method ?? "GET").toBe("GET")
    expect(result.items[0]).toMatchObject({ id: 7, material: "REC1", pending_role: "Inventory Controller" })
    expect(result.counts).toEqual([{ status: "PENDING_APPROVAL", count: 1 }])
  })

  it("leaves out what is unset: no filter asks for every status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(LIST), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchReverseRequestList()

    expect(String(fetchMock.mock.calls[0][0]).endsWith("/v1/i7/reverse-conversion/requests/list")).toBe(true)
  })

  it("raises the backend's error", async () => {
    const body = { error: { code: "SOMETHING", message: "No.", details: {} } }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 409 })))

    await expect(fetchReverseRequestList({ status: "HELD" })).rejects.toMatchObject({ status: 409, code: "SOMETHING" })
  })
})
