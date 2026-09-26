import { describe, expect, it, vi } from "vitest"

import { mockKey } from "./key"
import type { RecordedResponse } from "./types"

function recording(key: string, body: unknown, headers: Record<string, string> = {}): RecordedResponse {
  return { key, status: 200, contentType: "application/json", headers, body }
}

const REGISTER = [
  { document: "4500000001", item: "10", plant: "1300", status: "OPEN" },
  { document: "4500000002", item: "10", plant: "1400", status: "OPEN" },
  { document: "4500000003", item: "20", plant: "1300", status: "CLOSED" },
]

const RECORDINGS: RecordedResponse[] = [
  recording("GET /i8/register?page=1", { items: REGISTER, total: 3 }),
  recording("GET /i13/ledger?limit=100", REGISTER, { "x-total-count": "3" }),
  recording("GET /i8/snapshot", { builtAt: "2026-07-31" }),
  {
    key: "GET /v1/i7/reports/quarterly/Q2%202026/export",
    status: 200,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    headers: { "content-disposition": 'attachment; filename="q2.xlsx"' },
    body: Buffer.from("PK-bytes").toString("base64"),
    encoding: "base64",
  },
]

vi.mock("@/mocks/demo-dataset.json", () => ({ default: { recordings: RECORDINGS } }))

const { resolveMock, DEMO_MISSING_MESSAGE, DEMO_WRITE_MESSAGE } = await import("./resolve")

describe("mockKey", () => {
  it("sorts parameters and drops empty ones", () => {
    expect(mockKey("get", "/i8/register?plant=1300&page=1&vendor=")).toBe(
      "GET /i8/register?page=1&plant=1300"
    )
  })

  it("treats a trailing slash as the same route", () => {
    expect(mockKey("GET", "/i8/snapshot/")).toBe("GET /i8/snapshot")
  })
})

describe("resolveMock GET", () => {
  it("answers an exact recording as recorded", async () => {
    const response = await resolveMock("/i8/snapshot")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ builtAt: "2026-07-31" })
  })

  it("narrows the nearest recording to a filter it was not recorded with", async () => {
    const response = await resolveMock("/i8/register?page=1&plant=1300")
    const body = await response.json()
    expect(body.items.map((r: { document: string }) => r.document)).toEqual(["4500000001", "4500000003"])
    expect(body.total).toBe(2)
  })

  it("keeps X-Total-Count consistent with the narrowed rows", async () => {
    const response = await resolveMock("/i13/ledger?limit=100&status=closed")
    expect(await response.json()).toHaveLength(1)
    expect(response.headers.get("x-total-count")).toBe("1")
  })

  it("ignores a filter the rows cannot be matched on", async () => {
    const response = await resolveMock("/i8/register?page=1&overdueOnly=true&agingBucket=90%2B")
    expect((await response.json()).items).toHaveLength(3)
  })

  it("shows no rows for a page beyond the recorded one", async () => {
    const response = await resolveMock("/i8/register?page=2")
    expect((await response.json()).items).toEqual([])
  })

  it("404s with a sentence for a record that was never recorded", async () => {
    const response = await resolveMock("/i8/register/4599999999/10")
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: DEMO_MISSING_MESSAGE })
  })

  it("returns a binary recording as bytes, with its headers", async () => {
    const response = await resolveMock("/v1/i7/reports/quarterly/Q2%202026/export")
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("PK-bytes")
    expect(response.headers.get("content-disposition")).toContain("q2.xlsx")
  })
})

describe("resolveMock writes", () => {
  it("refuses an ordinary write with 403 and a sentence", async () => {
    const response = await resolveMock("/i8/attestations", { method: "POST", body: "{}" })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ detail: DEMO_WRITE_MESSAGE })
  })

  it("opens the I08 script for an 80-series material and I13 otherwise", async () => {
    const i08 = await resolveMock("/assistant/sessions", {
      method: "POST",
      body: JSON.stringify({ materialId: "8000005632", plant: "1300" }),
    })
    const i13 = await resolveMock("/assistant/sessions", {
      method: "POST",
      body: JSON.stringify({ materialId: "1000000123", plant: "1300" }),
    })
    expect((await i08.json()).routing.flow).toBe("i08")
    expect((await i13.json()).routing.flow).toBe("i13")
  })

  it("follows the answer given through a scripted conversation", async () => {
    const start = await (
      await resolveMock("/assistant/sessions", {
        method: "POST",
        body: JSON.stringify({ materialId: "1000000123", plant: "1300" }),
      })
    ).json()
    const turn = (answer: Record<string, unknown>) =>
      resolveMock(`/assistant/sessions/${start.sessionId}/turns`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      })

    const proceed = await turn({ choice: "proceed" })
    expect(proceed.status).toBe(201)
    expect((await proceed.json()).step.id).toBe("i13_capture_plan")
    expect((await (await turn({ purpose: "Shutdown" })).json()).step.id).toBe("i13_quantity")
    expect((await (await turn({ choice: "accept_suggested" })).json()).step.kind).toBe("terminal")
  })

  it("serves the trace of a scripted session", async () => {
    const response = await resolveMock("/assistant/sessions/S7K2M4P8Q1")
    expect((await response.json()).flow).toBe("i08")
  })
})
