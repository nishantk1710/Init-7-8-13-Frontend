import { describe, expect, it } from "vitest"

import type { FormulaField } from "@/features/initiative-7/types/kpi-formulas"
import {
  changedKeys,
  differsFromDefault,
  draftFromFields,
  fieldsFromDraft,
  formatDelta,
  insertName,
} from "./kpi-formulas"

const FIELDS: FormulaField[] = [
  {
    key: "window_days",
    kpi: "stockout",
    label: "Window",
    kind: "setting",
    help: "",
    defaultValue: 90,
    value: 90,
    allowed: [],
    minimum: 7,
    maximum: 730,
    needsRebuild: true,
  },
  {
    key: "at_risk",
    kpi: "stockout",
    label: "At risk when",
    kind: "condition",
    help: "",
    defaultValue: "stock_on_hand < stock_needed",
    value: "stock_on_hand < stock_needed",
    allowed: [{ name: "stock_on_hand", label: "stock on hand" }],
    minimum: null,
    maximum: null,
    needsRebuild: false,
  },
]

describe("draft", () => {
  it("starts from what is in force, as text", () => {
    expect(draftFromFields(FIELDS)).toEqual({ window_days: "90", at_risk: "stock_on_hand < stock_needed" })
  })

  it("sends a setting as a number and a formula as typed", () => {
    expect(fieldsFromDraft(FIELDS, { window_days: " 60 ", at_risk: " a < b " })).toEqual({
      window_days: 60,
      at_risk: "a < b",
    })
  })

  it("sends a setting that is not a whole number as typed, for the backend to refuse in words", () => {
    expect(fieldsFromDraft(FIELDS, { window_days: "6o", at_risk: "a < b" }).window_days).toBe("6o")
    expect(fieldsFromDraft(FIELDS, { window_days: "", at_risk: "a < b" }).window_days).toBe("")
  })

  it("names what changed, ignoring spaces at the ends", () => {
    const draft = draftFromFields(FIELDS)
    expect(changedKeys(FIELDS, draft)).toEqual([])
    expect(changedKeys(FIELDS, { ...draft, at_risk: "  stock_on_hand < stock_needed " })).toEqual([])
    expect(changedKeys(FIELDS, { ...draft, window_days: "60" })).toEqual(["window_days"])
  })

  it("compares with the built-in default separately from what is in force", () => {
    const inForce = FIELDS.map((f) => (f.key === "window_days" ? { ...f, value: 60 } : f))
    expect(differsFromDefault(inForce, draftFromFields(inForce))).toEqual(["window_days"])
    expect(changedKeys(inForce, draftFromFields(inForce))).toEqual([])
  })
})

describe("insertName", () => {
  it.each([
    ["", "a", "a"],
    ["a <", "b", "a < b"],
    ["a * (", "b", "a * ( b"],
    ["a", "b", "a b"],
  ])("%j + %s", (current, name, expected) => {
    expect(insertName(current, name)).toBe(expected)
  })
})

describe("formatDelta", () => {
  const f = (n: number) => String(n)
  it("signs the change", () => {
    expect(formatDelta(10, 15, f)).toBe("+5")
    expect(formatDelta(15, 10, f)).toBe("−5")
    expect(formatDelta(10, 10, f)).toBe("no change")
  })
  it("has nothing to say when either side is not available", () => {
    expect(formatDelta(null, 3, f)).toBe("—")
    expect(formatDelta(3, null, f)).toBe("—")
  })
})
