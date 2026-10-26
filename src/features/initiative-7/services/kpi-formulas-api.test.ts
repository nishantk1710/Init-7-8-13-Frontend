import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/client"
import { formulaErrors, mapActive } from "./kpi-formulas-api"

describe("mapActive", () => {
  it("maps the settings, the lines and the examples", () => {
    const active = mapActive({
      version: 2,
      is_default: false,
      settings: { window_days: 60, lookback_days: 365 },
      formula_lines: { stockout: ["a"] },
      examples: {
        stockout: { kpi: "stockout", material: "M", plant: "1300", inputs: [], substitution: ["x"], result: "r" },
        excess: null,
      },
    })
    expect(active.windowDays).toBe(60)
    expect(active.lookbackDays).toBe(365)
    expect(active.isDefault).toBe(false)
    expect(active.examples.stockout?.material).toBe("M")
    expect(active.examples.excess).toBeNull()
  })
})

describe("formulaErrors", () => {
  const refusal = (code: string, fields: unknown) =>
    new ApiError("bad", 422, code, "bad", { code, message: "bad", details: { fields } })

  it("reads the per-field sentences of a refused formula", () => {
    expect(formulaErrors(refusal("FORMULA_INVALID", { at_risk: "The formula is empty." }))).toEqual({
      at_risk: "The formula is empty.",
    })
  })

  it("is empty for any other failure, which belongs in the banner", () => {
    expect(formulaErrors(refusal("APPLY_IN_PROGRESS", {}))).toEqual({})
    expect(formulaErrors(new Error("network"))).toEqual({})
    expect(formulaErrors(new ApiError("x", 500))).toEqual({})
  })

  it("ignores anything that is not a sentence", () => {
    expect(formulaErrors(refusal("FORMULA_INVALID", { a: "ok", b: 3, c: null }))).toEqual({ a: "ok" })
  })
})

describe("fetchFormulasPage against a backend that predates the data list", () => {
  it("opens with empty lists instead of crashing", async () => {
    const { fetchFormulasPage } = await import("./kpi-formulas-api")
    const client = await import("@/lib/api/client")
    const spy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      active: { version: null, is_default: true, settings: { window_days: 90, lookback_days: 730 }, formula_lines: {}, examples: {} },
      kpis: [{ key: "stockout", title: "High Stockout Risk" }],
      fields: [{ key: "at_risk", kpi: "stockout", label: "At risk when", kind: "condition", help: "", default: "a < b", value: "a < b", minimum: null, maximum: null, needs_rebuild: false }],
      status: { state: "idle", version: null, message: null },
      history: [],
    })
    const page = await fetchFormulasPage()
    spy.mockRestore()
    expect(page.data).toEqual({})
    expect(page.functions).toEqual([])
    expect(page.kpis[0]?.controls).toEqual([])
    expect(page.fields[0]?.helpers).toEqual([])
    expect(page.fields[0]?.dataSet).toBe("")
  })
})
