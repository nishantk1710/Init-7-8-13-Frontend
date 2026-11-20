import { describe, expect, it } from "vitest"

import { uploadErrors, type ApiUploadResult } from "@/lib/api/assistant-requests"
import { ApiError } from "@/lib/api/client"
import { bareMaterial, checkAgainstRequest, type UploadContext } from "@/lib/assistant/request/upload"

const EMPTY: UploadContext = { maxLines: 20, requestPlant: null, existing: [] }

function file(materials: string[], overrides: Partial<ApiUploadResult> = {}): ApiUploadResult {
  return {
    plant: "1300",
    materials,
    rowCount: materials.length,
    duplicates: [],
    maxLines: 20,
    ...overrides,
  }
}

describe("checkAgainstRequest", () => {
  it("passes an empty request the file as the backend read it", () => {
    expect(checkAgainstRequest(file(["1000000123", "1000000456"]), EMPTY)).toEqual({
      ok: true,
      plant: "1300",
      materials: ["1000000123", "1000000456"],
      rowCount: 2,
      duplicates: [],
      alreadyAdded: [],
    })
  })

  it("must agree with the request's plant", () => {
    const context = {
      ...EMPTY,
      requestPlant: "1500",
      existing: [{ materialId: "1000000934", plant: "1500" }],
    }
    const check = checkAgainstRequest(file(["1000000123"]), context)
    expect(check.ok).toBe(false)
    const errors = check.ok ? [] : check.errors
    expect(errors.some((e) => /request is for plant 1500/.test(e))).toBe(true)
  })

  it("skips materials already on the request, leading zeros or not", () => {
    const context = { ...EMPTY, requestPlant: "1300", existing: [{ materialId: "000000001000000123", plant: "1300" }] }
    const check = checkAgainstRequest(file(["1000000123", "1000000456"]), context)
    expect(check.ok && check.materials).toEqual(["1000000456"])
    expect(check.ok && check.alreadyAdded).toEqual(["1000000123"])
  })

  it("counts the rows on screen against the cap", () => {
    const existing = Array.from({ length: 19 }, (_, i) => ({ materialId: String(2000000000 + i), plant: "1300" }))
    const check = checkAgainstRequest(file(["1000000123", "1000000456"]), { ...EMPTY, requestPlant: "1300", existing })
    expect(check.ok ? [] : check.errors).toEqual([
      "The request has 19 materials and the file adds 2: a request holds up to 20. Submit this one and upload the rest as another request.",
    ])
  })

  it("says so when every material is already on the request", () => {
    const context = { ...EMPTY, requestPlant: "1300", existing: [{ materialId: "1000000123", plant: "1300" }] }
    expect(checkAgainstRequest(file(["1000000123"]), context)).toEqual({
      ok: false,
      errors: ["Every material in the file is already on this request."],
    })
  })
})

describe("uploadErrors", () => {
  it("lists every problem the backend found", () => {
    const error = new ApiError("POST failed with 422", 422, undefined, "Two plants. Two departments.", {
      message: "Two plants. Two departments.",
      errors: ["Two plants.", "Two departments."],
    })
    expect(uploadErrors(error)).toEqual(["Two plants.", "Two departments."])
  })

  it("is null for anything but a refused file", () => {
    expect(uploadErrors(new ApiError("POST failed with 500", 500))).toBeNull()
    expect(uploadErrors(new Error("network"))).toBeNull()
  })
})

describe("bareMaterial", () => {
  it("drops leading zeros only", () => {
    expect(bareMaterial(" 0001000 ")).toBe("1000")
    expect(bareMaterial("0")).toBe("0")
  })
})
