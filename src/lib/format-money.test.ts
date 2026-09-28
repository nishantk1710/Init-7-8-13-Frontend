import { describe, expect, it } from "vitest"

import { commonCurrency, currencyPrefix, formatMoney } from "./utils"

describe("formatMoney -- the currency the data states, never assumed", () => {
  it("keeps the house Rand style for ZAR and for records with no currency field", () => {
    expect(formatMoney(38500, "ZAR")).toBe("R 38,500")
    expect(formatMoney(38500)).toBe("R 38,500")
  })

  it("uses the stated currency's own symbol otherwise", () => {
    expect(formatMoney(38500, "USD")).toBe("$38,500")
    expect(formatMoney(38500, "INR")).toBe("₹38,500")
  })

  it("shows no symbol when SAP supplied no currency", () => {
    expect(formatMoney(38500, null)).toBe("38,500")
  })

  it("falls back to the code as written for a code Intl does not know", () => {
    expect(formatMoney(38500, "XX1")).toBe("XX1 38,500")
  })
})

describe("currencyPrefix / commonCurrency", () => {
  it("prefixes compact figures the same way", () => {
    expect(currencyPrefix(undefined)).toBe("R ")
    expect(currencyPrefix("ZAR")).toBe("R ")
    expect(currencyPrefix("NAD")).toBe("NAD ")
    expect(currencyPrefix(null)).toBe("")
  })

  it("finds the one shared currency, or reports none / mixed", () => {
    expect(commonCurrency(["ZAR", "ZAR", undefined])).toBe("ZAR")
    expect(commonCurrency(["ZAR", "NAD"])).toBeNull()
    expect(commonCurrency([undefined, undefined])).toBeUndefined()
    expect(commonCurrency([null, undefined])).toBeNull()
  })
})
