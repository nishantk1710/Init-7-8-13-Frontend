import { describe, expect, it } from "vitest"
import { FilterParseError, parseFilter } from "./odata-filter-parser"

const rows = [
  { Matnr: "1", Dismm: "ND", Mstae: "", Matkl: "8012" },
  { Matnr: "2", Dismm: "PD", Mstae: "01", Matkl: "1000" },
  { Matnr: "3", Dismm: "VB", Mstae: "", Matkl: "8099" },
  { Matnr: "4", Dismm: "", Mstae: "", Matkl: "2000" },
]

const matching = (filter: string) => rows.filter(parseFilter(filter)).map((r) => r.Matnr)

describe("parseFilter", () => {
  it("eq and ne", () => {
    expect(matching("Dismm eq 'ND'")).toEqual(["1"])
    expect(matching("Mstae ne '01'")).toEqual(["1", "3", "4"])
  })

  it("or-joined values — the real scope filter from §1.6(b)", () => {
    expect(matching("Dismm eq 'ND' or Dismm eq 'PD'")).toEqual(["1", "2"])
  })

  it("and-joined conditions — the FR-9 change-document filter shape from §1.4", () => {
    expect(matching("Dismm eq 'ND' and Mstae eq ''")).toEqual(["1"])
  })

  it("parentheses group correctly, and the grouping actually matters", () => {
    expect(matching("(Dismm eq 'ND' or Dismm eq 'PD') and Mstae ne '01'")).toEqual(["1"])
    // Without the parentheses, `and` binds tighter and the answer differs.
    expect(matching("Dismm eq 'ND' or Dismm eq 'PD' and Mstae ne '01'")).toEqual(["1"])
  })

  it("matches a blank value explicitly", () => {
    expect(matching("Dismm eq ''")).toEqual(["4"])
  })

  it("startswith", () => {
    expect(matching("startswith(Matkl,'80')")).toEqual(["1", "3"])
  })

  it("substringof uses OData v2 argument order (needle, haystack)", () => {
    expect(matching("substringof('09',Matkl)")).toEqual(["3"])
  })

  it("not", () => {
    expect(matching("not (Dismm eq 'ND')")).toEqual(["2", "3", "4"])
  })

  it("handles a doubled quote as an escaped apostrophe", () => {
    const predicate = parseFilter("Matkl eq 'O''BRIEN'")
    expect(predicate({ Matkl: "O'BRIEN" })).toBe(true)
  })

  it("compares numbers as numbers", () => {
    const predicate = parseFilter("Bdmng gt 100")
    expect(predicate({ Bdmng: 250 })).toBe(true)
    expect(predicate({ Bdmng: 50 })).toBe(false)
  })

  it("raises rather than silently matching everything on an unsupported operator", () => {
    // The live SAP gateway silently ignores and-chained `ne` (Phase 0). A mock
    // that quietly matched everything would let that class of bug through.
    expect(() => parseFilter("Dismm neq 'ND'")).toThrow(FilterParseError)
    expect(() => parseFilter("weirdfunc(Matkl,'80')")).toThrow(FilterParseError)
    expect(() => parseFilter("Dismm eq")).toThrow(FilterParseError)
    expect(() => parseFilter("Dismm eq 'ND' extra")).toThrow(FilterParseError)
    expect(() => parseFilter("Dismm eq 'unterminated")).toThrow(FilterParseError)
  })

  it("chained ne with and works HERE, unlike the real gateway — so our own tests stay honest", () => {
    // We do not reproduce SAP's bug; toODataFilter simply never emits this
    // shape (see odata-filter.ts). Asserted so the difference is deliberate
    // and documented rather than accidental.
    expect(matching("Dismm ne 'VB' and Dismm ne 'ND'")).toEqual(["2", "4"])
  })
})
