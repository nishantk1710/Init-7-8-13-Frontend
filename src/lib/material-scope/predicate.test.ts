import { describe, expect, it } from "vitest"
import { evaluate } from "./predicate"
import type { ScopeRule } from "./types"

describe("evaluate — single condition", () => {
  it("eq matches", () => {
    expect(evaluate({ field: "Mtart", op: "eq", value: "ERSA" }, { Mtart: "ERSA" })).toBe("in-scope")
    expect(evaluate({ field: "Mtart", op: "eq", value: "ERSA" }, { Mtart: "FERT" })).toBe("not-in-scope")
  })

  it("ne matches", () => {
    expect(evaluate({ field: "Mstae", op: "ne", value: "01" }, { Mstae: "" })).toBe("in-scope")
    expect(evaluate({ field: "Mstae", op: "ne", value: "01" }, { Mstae: "01" })).toBe("not-in-scope")
  })

  it("in matches several values", () => {
    const rule: ScopeRule = { field: "Dismm", op: "in", values: ["ND", "PD"] }
    expect(evaluate(rule, { Dismm: "ND" })).toBe("in-scope")
    expect(evaluate(rule, { Dismm: "PD" })).toBe("in-scope")
    expect(evaluate(rule, { Dismm: "VB" })).toBe("not-in-scope")
  })

  it("notIn matches the complement", () => {
    const rule: ScopeRule = { field: "Dismm", op: "notIn", values: ["ND", "PD"] }
    expect(evaluate(rule, { Dismm: "VB" })).toBe("in-scope")
    expect(evaluate(rule, { Dismm: "ND" })).toBe("not-in-scope")
  })

  it("startsWith matches a prefix", () => {
    const rule: ScopeRule = { field: "Matkl", op: "startsWith", value: "80" }
    expect(evaluate(rule, { Matkl: "8012" })).toBe("in-scope")
    expect(evaluate(rule, { Matkl: "1000" })).toBe("not-in-scope")
  })

  it("a genuinely absent field is cannot-determine, never false", () => {
    const rule: ScopeRule = { field: "Dismm", op: "in", values: ["ND", "PD"] }
    expect(evaluate(rule, {})).toBe("cannot-determine")
  })

  it("a configured unknown value (blank Dismm) is cannot-determine, never false", () => {
    const rule: ScopeRule = { field: "Dismm", op: "in", values: ["ND", "PD"], unknownValues: [""] }
    expect(evaluate(rule, { Dismm: "" })).toBe("cannot-determine")
  })

  it("without an unknownValues entry, blank is just another value (false here)", () => {
    const rule: ScopeRule = { field: "Dismm", op: "in", values: ["ND", "PD"] }
    expect(evaluate(rule, { Dismm: "" })).toBe("not-in-scope")
  })
})

describe("evaluate — and/or combinations", () => {
  const oarLike: ScopeRule = {
    and: [
      { field: "Dismm", op: "in", values: ["ND", "PD"], unknownValues: [""] },
      { field: "Mstae", op: "ne", value: "01" },
    ],
  }

  it("both true -> in-scope", () => {
    expect(evaluate(oarLike, { Dismm: "PD", Mstae: "" })).toBe("in-scope")
  })

  it("one false -> not-in-scope, even if the other is unknown", () => {
    // Mstae absent (unknown) but Dismm definitively VB (false) -> AND is false, not unknown.
    expect(evaluate(oarLike, { Dismm: "VB" })).toBe("not-in-scope")
  })

  it("one unknown, none false -> cannot-determine", () => {
    expect(evaluate(oarLike, { Dismm: "", Mstae: "" })).toBe("cannot-determine")
  })

  it("obsolete ND is excluded (the collision §1.6(d) resolves)", () => {
    expect(evaluate(oarLike, { Dismm: "ND", Mstae: "01" })).toBe("not-in-scope")
  })

  it("or: any true -> in-scope", () => {
    const rule: ScopeRule = { or: [{ field: "A", op: "eq", value: "x" }, { field: "B", op: "eq", value: "y" }] }
    expect(evaluate(rule, { A: "x", B: "z" })).toBe("in-scope")
  })

  it("or: none true, one unknown -> cannot-determine", () => {
    const rule: ScopeRule = { or: [{ field: "A", op: "eq", value: "x" }, { field: "B", op: "eq", value: "y" }] }
    expect(evaluate(rule, { A: "z" })).toBe("cannot-determine") // B absent
  })

  it("or: none true, none unknown -> not-in-scope", () => {
    const rule: ScopeRule = { or: [{ field: "A", op: "eq", value: "x" }, { field: "B", op: "eq", value: "y" }] }
    expect(evaluate(rule, { A: "z", B: "z" })).toBe("not-in-scope")
  })

  it("empty and[] (the 'all' scope) is always in-scope", () => {
    expect(evaluate({ and: [] }, {})).toBe("in-scope")
  })

  it("empty or[] is always not-in-scope", () => {
    expect(evaluate({ or: [] }, {})).toBe("not-in-scope")
  })
})
