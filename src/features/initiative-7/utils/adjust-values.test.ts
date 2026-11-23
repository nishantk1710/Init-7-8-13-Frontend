import { describe, expect, it } from "vitest"

import { adjustFieldsFrom, checkAdjustedValues, hasAdjustSafetyStock } from "@/features/initiative-7/utils/adjust-values"

const current = { rop: 27, safetyStock: 14, maxStock: 32 }
const noSafetyStock = { rop: 27, safetyStock: null, maxStock: 32 }

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

  it("keeps a safety stock input only when the recommendation has one", () => {
    expect(hasAdjustSafetyStock(current)).toBe(true)
    expect(hasAdjustSafetyStock(noSafetyStock)).toBe(false)
    expect(hasAdjustSafetyStock({ ...current, safetyStock: 0 })).toBe(true) // a real 0 is a value
  })
})

describe("adjust values for a recommendation without a safety stock", () => {
  it("starts from ROP and Max only, with no safety stock field -- not '0'", () => {
    const fields = adjustFieldsFrom(noSafetyStock)
    expect(fields).toEqual({ rop: "27", maxStock: "32" })
    expect(fields).not.toHaveProperty("safetyStock")
  })

  it("accepts a changed ROP <= Max and returns no safety stock (null, never 0)", () => {
    expect(checkAdjustedValues({ rop: "30", maxStock: "36" }, noSafetyStock)).toEqual({
      ok: true,
      values: { rop: 30, safetyStock: null, maxStock: 36 },
    })
  })

  it("accepts ROP equal to Max", () => {
    expect(checkAdjustedValues({ rop: "36", maxStock: "36" }, noSafetyStock).ok).toBe(true)
  })

  it("refuses ROP above Max, with a message that does not mention safety stock", () => {
    const result = checkAdjustedValues({ rop: "40", maxStock: "36" }, noSafetyStock)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.toLowerCase()).not.toContain("safety")
  })

  it("refuses unchanged values and blanks", () => {
    expect(checkAdjustedValues(adjustFieldsFrom(noSafetyStock), noSafetyStock).ok).toBe(false)
    expect(checkAdjustedValues({ rop: "", maxStock: "36" }, noSafetyStock).ok).toBe(false)
    expect(checkAdjustedValues({ rop: "2.5", maxStock: "36" }, noSafetyStock).ok).toBe(false)
  })

  it("does not ask for a safety stock the recommendation never had", () => {
    // An ignored safety stock text must not make a valid ROP/Max set fail or sneak into the values.
    const result = checkAdjustedValues({ rop: "30", safetyStock: "999", maxStock: "36" }, noSafetyStock)
    expect(result).toEqual({ ok: true, values: { rop: 30, safetyStock: null, maxStock: 36 } })
  })
})

