import { describe, expect, it } from "vitest"

import { adjustFieldsFrom, checkAdjustedValues } from "@/features/initiative-7/utils/adjust-values"

const current = { rop: 27, safetyStock: 14, maxStock: 32 }

describe("adjust values", () => {
  it("starts from the current values", () => {
    expect(adjustFieldsFrom(current)).toEqual({ rop: "27", safetyStock: "14", maxStock: "32" })
  })

  it("accepts a changed, ordered set", () => {
    expect(checkAdjustedValues({ rop: "30", safetyStock: "15", maxStock: "36" }, current)).toEqual({
      ok: true,
      values: { rop: 30, safetyStock: 15, maxStock: 36 },
    })
  })

  it("refuses unchanged values", () => {
    expect(checkAdjustedValues(adjustFieldsFrom(current), current).ok).toBe(false)
  })

  it("refuses values out of order", () => {
    expect(checkAdjustedValues({ rop: "10", safetyStock: "15", maxStock: "36" }, current).ok).toBe(false)
    expect(checkAdjustedValues({ rop: "30", safetyStock: "15", maxStock: "20" }, current).ok).toBe(false)
  })

  it("refuses blanks, decimals and negatives", () => {
    for (const bad of ["", "2.5", "-3", "abc"]) {
      expect(checkAdjustedValues({ rop: bad, safetyStock: "15", maxStock: "36" }, current).ok).toBe(false)
    }
  })
})
