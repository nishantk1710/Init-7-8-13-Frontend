// The Criticality Reports API client: the wire -> page mapping, and how each
// upload outcome (stored / 409 / refused) reaches the card.

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchCriticalityPlants,
  fetchCriticalityUploads,
  mapUploadResult,
  uploadCriticalityReport,
} from "./criticality-reports-api"
import type { ApiCriticalityUpload, ApiCriticalityUploadResult } from "@/features/initiative-7/types/criticality-reports"

function uploadFixture(overrides: Partial<ApiCriticalityUpload> = {}): ApiCriticalityUpload {
  return {
    id: 7,
    plant: "1300",
    plant_name: "Black Mountain Mining",
    report_month: "2026-08-01",
    file_name: "BMM-ZMM065_Aug 26.xlsx",
    source: "upload",
    uploaded_by: "nishant",
    uploaded_at: "2026-09-02T08:15:00Z",
    row_count: 10521,
    status: "current",
    ...overrides,
  }
}

function resultFixture(): ApiCriticalityUploadResult {
  return {
    upload: uploadFixture(),
    stats: {
      rows_read: 10521,
      tiers: 5,
      duplicates: 0,
      blank_tiers: 12,
      skipped_blank_material: 1,
      file_plant: "1300",
    },
    is_current: true,
    current_month: "2026-08-01",
    replaced_upload_id: null,
    file_stored: true,
  }
}

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("mapping", () => {
  it("carries every stat the result panel shows, unchanged", () => {
    expect(mapUploadResult(resultFixture())).toEqual({
      upload: {
        id: 7,
        plant: "1300",
        reportMonth: "2026-08-01",
        fileName: "BMM-ZMM065_Aug 26.xlsx",
        source: "upload",
        uploadedBy: "nishant",
        uploadedAt: "2026-09-02T08:15:00Z",
        rowCount: 10521,
        status: "current",
      },
      rowsRead: 10521,
      tiers: 5,
      duplicates: 0,
      blankTiers: 12,
      skippedBlankMaterial: 1,
      filePlant: "1300",
      isCurrent: true,
      currentMonth: "2026-08-01",
      replacedUploadId: null,
      fileStored: true,
    })
  })
})

describe("reading", () => {
  it("lists plants and keeps a plant with no report as null, not a made-up month", async () => {
    vi.stubGlobal(
      "fetch",
      respond(200, [
        { code: "1300", name: "Black Mountain Mining", current_month: "2026-08-01", materials: 10521 },
        { code: "1500", name: "Gamsberg", current_month: null, materials: 0 },
      ])
    )
    expect(await fetchCriticalityPlants()).toEqual([
      { code: "1300", name: "Black Mountain Mining", currentMonth: "2026-08-01", materials: 10521 },
      { code: "1500", name: "Gamsberg", currentMonth: null, materials: 0 },
    ])
  })

  it("asks the shared /criticality route, narrowed to a plant when given one", async () => {
    const fetchMock = respond(200, [uploadFixture({ source: "july_delivery", uploaded_by: null })])
    vi.stubGlobal("fetch", fetchMock)
    const [upload] = await fetchCriticalityUploads("1500")
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/criticality\/uploads\?plant=1500$/)
    expect(upload.uploadedBy).toBeNull()
    expect(upload.source).toBe("july_delivery")
  })
})

describe("uploading", () => {
  const file = new File(["xlsx bytes"], "aug.xlsx")

  it("posts the plant, month, replace flag and file as a multipart form", async () => {
    const fetchMock = respond(201, resultFixture())
    vi.stubGlobal("fetch", fetchMock)
    const outcome = await uploadCriticalityReport({ plant: "1300", reportMonth: "2026-08", file, replace: true })
    expect(outcome.kind).toBe("stored")

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/criticality\/uploads$/)
    expect(init.method).toBe("POST")
    const body = init.body as FormData
    expect(body.get("plant")).toBe("1300")
    expect(body.get("report_month")).toBe("2026-08")
    expect(body.get("replace")).toBe("true")
    expect((body.get("file") as File).name).toBe("aug.xlsx")
    // A multipart body sets its own Content-Type; the identity header is sent.
    expect(init.headers["Content-Type"]).toBeUndefined()
    expect(init.headers["X-Actor-Id"]).toBeTruthy()
  })

  it("turns a 409 into a conflict the card can offer to replace", async () => {
    vi.stubGlobal(
      "fetch",
      respond(409, { detail: "Plant 1300 already has a report for August 2026 (aug.xlsx, uploaded by nishant)." })
    )
    expect(await uploadCriticalityReport({ plant: "1300", reportMonth: "2026-08", file })).toEqual({
      kind: "conflict",
      message: "Plant 1300 already has a report for August 2026 (aug.xlsx, uploaded by nishant).",
    })
  })

  it("passes the backend's sentence through for a refused file", async () => {
    vi.stubGlobal(
      "fetch",
      respond(422, { detail: "This file is for plant 1500 (7,449 rows), but you picked 1300." })
    )
    expect(await uploadCriticalityReport({ plant: "1300", reportMonth: "2026-08", file })).toEqual({
      kind: "refused",
      message: "This file is for plant 1500 (7,449 rows), but you picked 1300.",
    })
  })

  it("does not retry: one failed POST is one call", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"))
    vi.stubGlobal("fetch", fetchMock)
    const outcome = await uploadCriticalityReport({ plant: "1300", reportMonth: "2026-08", file })
    expect(outcome).toEqual({ kind: "refused", message: "fetch failed" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
