import { describe, expect, it } from "vitest"

import type { ApiActivityRow, ApiAdoptionQuarter, ApiKpiCard, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import {
  activityCell,
  adoptionSummaryOf,
  kpiValueText,
  num,
  orderedKpis,
  plantPositionsOf,
  rowAddsUp,
  stockoutUsable,
} from "./quarterly-management"

function stockout(overrides: Partial<ApiQuarterManagement["position"]["stockout"]> = {}) {
  return { at_risk: 90, evaluated: 800, insufficient_data: 40, as_of: "2026-12-31", stale: false, stale_note: null, ...overrides }
}

function management(overrides: Partial<ApiQuarterManagement["position"]["stockout"]> = {}): ApiQuarterManagement {
  const figures = (population: number, atRisk: number, excess: number) => ({
    population,
    stockout: stockout({ at_risk: atRisk, ...overrides }),
    excess_count: excess,
    excess_opportunity: "100.00",
    net_rop_value_impact: "-50.00",
    priced_count: population,
    currency: null,
  })
  return {
    position: figures(10, 90, 3),
    plant_positions: [
      { plant: null, figures: figures(10, 90, 3) },
      { plant: "1300", figures: figures(6, 50, 2) },
      { plant: "1500", figures: figures(4, 40, 1) },
    ],
  } as unknown as ApiQuarterManagement
}

describe("num", () => {
  it("reads a decimal string, a number and a count", () => {
    expect(num("12.50")).toBe(12.5)
    expect(num(7)).toBe(7)
  })

  it("is null for a figure that is not there, never 0", () => {
    expect(num(null)).toBeNull()
    expect(num(undefined)).toBeNull()
    expect(num("")).toBeNull()
    expect(num("n/a")).toBeNull()
  })
})

describe("plantPositionsOf", () => {
  it("gives All plants, then each plant, as the Overview's plant charts take them", () => {
    expect(plantPositionsOf(management()).map((p) => [p.scope, p.total, p.stockoutRisk, p.stockoutEvaluated, p.excess])).toEqual([
      ["ALL", 10, 90, 800, 3],
      ["1300", 6, 50, 800, 2],
      ["1500", 4, 40, 800, 1],
    ])
  })

  it("carries the date the stockout was measured, and drops it when that measurement is stale", () => {
    expect(plantPositionsOf(management())[0].stockoutAsOf).toBe("2026-12-31")
    expect(plantPositionsOf(management({ stale: true }))[0].stockoutAsOf).toBeNull()
  })
})

describe("stockoutUsable", () => {
  it("is true only for a measurement that is there and not stale", () => {
    expect(stockoutUsable(management())).toBe(true)
    expect(stockoutUsable(management({ stale: true }))).toBe(false)
    expect(stockoutUsable(management({ as_of: null }))).toBe(false)
  })
})

describe("adoptionSummaryOf", () => {
  const adoption = (overrides: Partial<ApiAdoptionQuarter> = {}): ApiAdoptionQuarter => ({
    status: "UNKNOWN", confirmed_adoptions: null, pending_approvals: 0, reason: "r",
    tracked: 100, adopted: 10, partially_adopted: 5, not_adopted: 5, pending: 80, ...overrides,
  })

  it("is the Overview's adoption card shape, with the rate over those with SAP evidence", () => {
    expect(adoptionSummaryOf(adoption())).toEqual({
      totalEvaluated: 100, adoptedCount: 10, partiallyAdoptedCount: 5, notAdoptedCount: 5, unknownCount: 80,
      adoptionRatePercentage: 75,
    })
  })

  it("has no rate while nothing has SAP evidence -- never a 0%", () => {
    expect(adoptionSummaryOf(adoption({ adopted: 0, partially_adopted: 0, not_adopted: 0, pending: 100 }))?.adoptionRatePercentage).toBeNull()
  })

  it("is null when the backend sent no counts, so the page says so instead of drawing zeros", () => {
    expect(adoptionSummaryOf(adoption({ tracked: undefined }))).toBeNull()
    expect(adoptionSummaryOf(adoption({ tracked: null }))).toBeNull()
  })
})

describe("the activity table", () => {
  const row = (months: (number | string | null)[], total: number | string | null): ApiActivityRow => ({
    key: "k", label: "L", unit: "u", kind: "EVENT", months, quarter_total: total, status: "AVAILABLE", reconciles: null, note: null,
  })

  it("shows a count, and a dash for a month that is not available -- never 0", () => {
    expect(activityCell(12345)).toBe("12,345")
    expect(activityCell("8")).toBe("8")
    expect(activityCell(0)).toBe("0")
    expect(activityCell(null)).toBe("—")
  })

  it("checks that the months add up to the total, skipping the months that are not available", () => {
    expect(rowAddsUp(row([2, 1, 1], 4))).toBe(true)
    expect(rowAddsUp(row([2, 1, null], 3))).toBe(true)
    expect(rowAddsUp(row([2, 1, 1], 5))).toBe(false)
    expect(rowAddsUp(row([null, null, null], null))).toBeNull()
  })
})

describe("the KPI cards", () => {
  const card = (key: string, overrides: Partial<ApiKpiCard> = {}): ApiKpiCard => ({
    key, title: key, unit: "u", value: "5", status: "AVAILABLE", explanation: "e", kind: "EVENT", measured_on: null,
    period_label: "p", denominator: null, denominator_label: null, basis: "current_calculation", unavailable_reason: null,
    note: null, ...overrides,
  })

  it("come in the order the page shows them, leaving out any the report does not carry", () => {
    const ordered = orderedKpis([card("pending_approval"), card("materials_assessed"), card("working_capital_impact"), card("unknown")])
    expect(ordered.map((c) => c.key)).toEqual(["materials_assessed", "working_capital_impact", "pending_approval"])
  })

  it("show a count as a number, and Not available -- never 0 -- when there is no value", () => {
    expect(kpiValueText(card("materials_assessed", { value: "18627" }))).toBe("18,627")
    expect(kpiValueText(card("critical_stockout_risk", { value: null, status: "NOT_AVAILABLE" }))).toBe("Not available")
    expect(kpiValueText(card("critical_stockout_risk", { value: "0", status: "NOT_AVAILABLE" }))).toBe("Not available")
  })

  it("show money in millions with its sign, and no currency prefix when none is stated", () => {
    expect(kpiValueText(card("working_capital_impact", { value: "-2397304441.43", unit: "amount (currency not stated)" }))).toBe("−2,397.30M")
    expect(kpiValueText(card("working_capital_impact", { value: "2500000", unit: "USD" }))).toBe("+USD 2.50M")
    expect(kpiValueText(card("excess_inventory_opportunity", { value: "1500000", unit: "USD" }))).toBe("USD 1.50M")
  })
})
