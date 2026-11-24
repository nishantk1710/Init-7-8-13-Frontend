import { describe, expect, it } from "vitest"

import { formatQuantity } from "@/lib/utils"

// SAP quantities as written, never rounded (UAT, 23-Nov-2026): a whole number
// loses SAP's ".000", a real fraction keeps its digits.
describe("formatQuantity", () => {
  it("drops the trailing zeros of a whole number", () => {
    expect(formatQuantity("15.000")).toBe("15")
    expect(formatQuantity(15)).toBe("15")
    expect(formatQuantity("0")).toBe("0")
  })

  it("keeps a real fraction as it is", () => {
    expect(formatQuantity("694.906")).toBe("694.906")
    expect(formatQuantity("2.500")).toBe("2.5")
  })

  it("groups thousands", () => {
    expect(formatQuantity("70476.523")).toBe("70,476.523")
    expect(formatQuantity(1250)).toBe("1,250")
  })

  it("shows nothing for no value and anything else as it came", () => {
    expect(formatQuantity(null)).toBe("")
    expect(formatQuantity(undefined)).toBe("")
    expect(formatQuantity("n/a")).toBe("n/a")
  })
})
