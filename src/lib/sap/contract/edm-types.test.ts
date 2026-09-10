import { describe, expect, it } from "vitest"
import { decodeEdmValue, parseEdmDateTime, parseEdmDecimal, parseEdmTime } from "./edm-types"

describe("Edm.DateTime", () => {
  it("decodes SAP's /Date(ms)/ form", () => {
    expect(parseEdmDateTime("/Date(1757280000000)/").toISOString()).toBe("2025-09-07T21:20:00.000Z")
  })

  it("tolerates the timezone-offset suffix form", () => {
    expect(parseEdmDateTime("/Date(1757280000000+0000)/").getTime()).toBe(1757280000000)
  })

  it("rejects anything else rather than yielding an Invalid Date", () => {
    expect(() => parseEdmDateTime("2025-09-08")).toThrow(/Edm.DateTime/)
    expect(() => parseEdmDateTime("PT14H16M00S")).toThrow(/Edm.DateTime/)
  })
})

describe("Edm.Time", () => {
  it("decodes the ISO-8601 duration form used by ChangeDocHeaderSet.Utime", () => {
    expect(parseEdmTime("PT14H16M00S")).toEqual({ hours: 14, minutes: 16, seconds: 0 })
  })

  it("handles omitted components", () => {
    expect(parseEdmTime("PT9H")).toEqual({ hours: 9, minutes: 0, seconds: 0 })
    expect(parseEdmTime("PT0S")).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })

  it("is never confused for a date", () => {
    expect(() => parseEdmTime("/Date(1757280000000)/")).toThrow(/Edm.Time/)
  })
})

describe("Edm.Decimal", () => {
  it("decodes the string form SAP actually sends", () => {
    expect(parseEdmDecimal("1234.56")).toBe(1234.56)
    expect(parseEdmDecimal("-0.5")).toBe(-0.5)
  })

  it("rejects junk instead of quietly producing NaN", () => {
    expect(() => parseEdmDecimal("")).toThrow(/Edm.Decimal/)
    expect(() => parseEdmDecimal("1,234.56")).toThrow(/Edm.Decimal/)
  })
})

describe("decodeEdmValue — decoding is driven by the declared type, never by the value's shape", () => {
  it("a numeric-looking Edm.String stays a string — the Netpr/Netwr case", () => {
    const decoded = decodeEdmValue("Edm.String", "1234.56")
    expect(decoded).toBe("1234.56")
    expect(typeof decoded).toBe("string")
  })

  it("a zero-padded material number keeps every leading zero", () => {
    expect(decodeEdmValue("Edm.String", "000000000012345")).toBe("000000000012345")
  })

  it("the same value declared Edm.Decimal does become a number", () => {
    expect(decodeEdmValue("Edm.Decimal", "1234.56")).toBe(1234.56)
  })

  it("null stays null — not 0, not an empty string", () => {
    expect(decodeEdmValue("Edm.Decimal", null)).toBeNull()
    expect(decodeEdmValue("Edm.String", null)).toBeNull()
    expect(decodeEdmValue("Edm.DateTime", undefined)).toBeNull()
  })

  it("decodes booleans, dates and times through the same entry point", () => {
    expect(decodeEdmValue("Edm.Boolean", true)).toBe(true)
    expect(decodeEdmValue("Edm.Boolean", "false")).toBe(false)
    expect(decodeEdmValue("Edm.DateTime", "/Date(0)/")).toEqual(new Date(0))
    expect(decodeEdmValue("Edm.Time", "PT14H16M00S")).toEqual({ hours: 14, minutes: 16, seconds: 0 })
  })

  it("strips SAP's fixed-width padding — live Netpr arrives space-padded", () => {
    expect(decodeEdmValue("Edm.String", "                       376.68")).toBe("376.68")
  })

  it("padding-stripping cannot damage a zero-padded identifier", () => {
    expect(decodeEdmValue("Edm.String", " 000000000012345 ")).toBe("000000000012345")
  })

  it("an all-spaces value becomes blank, so the scope rule sees 'not maintained' not a real value", () => {
    expect(decodeEdmValue("Edm.String", "   ")).toBe("")
  })

  it("an empty string stays an empty string — blank is a real, meaningful SAP value", () => {
    // 47% of live Dismm values are exactly this. Coercing it to null would
    // erase the difference between "not maintained" and "not returned".
    expect(decodeEdmValue("Edm.String", "")).toBe("")
  })
})
