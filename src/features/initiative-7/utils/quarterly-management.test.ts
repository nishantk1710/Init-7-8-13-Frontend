import { describe, expect, it } from "vitest"

import type { ApiActivityRow, ApiAdoptionQuarter, ApiKpiCard, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import {
  activityCell,
  adoptionSummaryOf,
  cardCaption,
  moneyExact,
  cardTitle,
  kpiValueText,
  num,
  orderedKpis,
  plantPositionsOf,
  rowAddsUp,
  seriesGaps,
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
    status: "UNKNOWN",
    confirmed_adoptions: null,
    pending_approvals: 0,
    reason: "r",
    tracked: 100,
    adopted: 10,
    partially_adopted: 5,
    not_adopted: 5,
    pending: 80,
    ...overrides,
  })

  it("is the Overview's adoption card shape, with the rate over those with SAP evidence", () => {
    expect(adoptionSummaryOf(adoption())).toEqual({
      totalEvaluated: 100,
      adoptedCount: 10,
      partiallyAdoptedCount: 5,
      notAdoptedCount: 5,
      unknownCount: 80,
      adoptionRatePercentage: 75,
    })
  })

  it("has no rate while nothing has SAP evidence -- never a 0%", () => {
    expect(
      adoptionSummaryOf(adoption({ adopted: 0, partially_adopted: 0, not_adopted: 0, pending: 100 }))?.adoptionRatePercentage,
    ).toBeNull()
  })

  it("is null when the backend sent no counts, so the page says so instead of drawing zeros", () => {
    expect(adoptionSummaryOf(adoption({ tracked: undefined }))).toBeNull()
    expect(adoptionSummaryOf(adoption({ tracked: null }))).toBeNull()
  })
})

describe("the activity table", () => {
  const row = (months: (number | string | null)[], total: number | string | null): ApiActivityRow => ({
    key: "k",
    label: "L",
    unit: "u",
    kind: "EVENT",
    months,
    quarter_total: total,
    status: "AVAILABLE",
    reconciles: null,
    note: null,
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
    key,
    title: key,
    unit: "u",
    value: "5",
    status: "AVAILABLE",
    explanation: "e",
    kind: "EVENT",
    measured_on: null,
    period_label: "p",
    denominator: null,
    denominator_label: null,
    basis: "current_calculation",
    unavailable_reason: null,
    note: null,
    ...overrides,
  })

  it("come in the order the page shows them, leaving out any the report does not carry", () => {
    const ordered = orderedKpis([card("pending_approval"), card("materials_assessed"), card("working_capital_oar"), card("unknown")])
    expect(ordered.map((c) => c.key)).toEqual(["working_capital_oar", "pending_approval"]) // materials_assessed is no longer a card
  })

  it("show a count as a number, and Not available -- never 0 -- when there is no value", () => {
    expect(kpiValueText(card("materials_assessed", { value: "18627" }))).toBe("18,627")
    expect(kpiValueText(card("critical_stockout_risk", { value: null, status: "NOT_AVAILABLE" }))).toBe("Not available")
    expect(kpiValueText(card("critical_stockout_risk", { value: "0", status: "NOT_AVAILABLE" }))).toBe("Not available")
  })

  it("show money as the exact amount with its sign, and no currency prefix when none is stated", () => {
    expect(kpiValueText(card("working_capital_impact", { value: "-2397304441.43", unit: "amount (currency not stated)" }))).toBe(
      "+2,397,304,441", // stored negative (cash tied up) shows as a plus: the page flips the stored sign
    )
    expect(kpiValueText(card("working_capital_impact", { value: "2500000", unit: "USD" }))).toBe("−USD 2,500,000") // stored positive (cash released) shows as a minus, like the Recommendations page
    expect(kpiValueText(card("excess_inventory_opportunity", { value: "1500000", unit: "USD" }))).toBe("USD 1,500,000")
  })

  it("show a money figure under a million in full on a card, never as 0.00M or 103.9K", () => {
    expect(kpiValueText(card("excess_inventory_opportunity", { value: "1200", unit: "amount (currency not stated)" }))).toBe("1,200")
    expect(kpiValueText(card("working_capital_impact", { value: "-300", unit: "amount (currency not stated)" }))).toBe("+300")
    expect(kpiValueText(card("working_capital_impact", { value: "560", unit: "USD" }))).toBe("−USD 560")
    expect(kpiValueText(card("working_capital_impact", { value: "-103950", unit: "ZAR" }))).toBe("+ZAR 103,950")
  })

  it("never abbreviate a money figure with M, K or B", () => {
    for (const value of ["103950", "850000", "1000000", "1048500", "12500000", "2397304441", "-87660000"]) {
      expect(kpiValueText(card("working_capital_impact", { value, unit: "ZAR" }))).not.toMatch(/[MKB]$/)
      expect(kpiValueText(card("excess_inventory_opportunity", { value, unit: "ZAR" }))).not.toMatch(/[MKB]$/)
    }
  })

  it("leave a count that is not money alone", () => {
    expect(kpiValueText(card("materials_assessed", { value: "21343", unit: "recommendations" }))).toBe("21,343")
  })

  describe("moneyExact", () => {
    it("writes an amount below a million in full", () => {
      expect(moneyExact(103_950, "ZAR")).toBe("ZAR 103,950")
      expect(moneyExact(850_000, "ZAR")).toBe("ZAR 850,000")
      expect(moneyExact(999_999, "ZAR")).toBe("ZAR 999,999")
    })

    it("writes exactly one million, and more, in full too", () => {
      expect(moneyExact(1_000_000, "ZAR")).toBe("ZAR 1,000,000")
      expect(moneyExact(1_048_500, "ZAR")).toBe("ZAR 1,048,500")
      expect(moneyExact(12_500_000, "ZAR")).toBe("ZAR 12,500,000")
      expect(moneyExact(3_468_610_000, "ZAR")).toBe("ZAR 3,468,610,000")
    })

    it("keeps the sign: a minus for a negative amount, a plus only when asked", () => {
      expect(moneyExact(-103_950, "ZAR", true)).toBe("−ZAR 103,950")
      expect(moneyExact(-103_950, "ZAR")).toBe("−ZAR 103,950")
      expect(moneyExact(103_950, "ZAR", true)).toBe("+ZAR 103,950")
      expect(moneyExact(103_950, "ZAR")).toBe("ZAR 103,950")
      expect(moneyExact(-87_660_000, "ZAR", true)).toBe("−ZAR 87,660,000")
    })

    it("writes zero without a sign, even when a plus is asked for", () => {
      expect(moneyExact(0, "ZAR", true)).toBe("ZAR 0")
      expect(moneyExact(0, "ZAR")).toBe("ZAR 0")
      expect(moneyExact(-0.2, "ZAR")).toBe("ZAR 0") // an amount that rounds to nothing has no minus sign
    })

    it("rounds a decimal to the whole unit, without carrying into an abbreviation", () => {
      expect(moneyExact(103_950.49, "ZAR")).toBe("ZAR 103,950")
      expect(moneyExact(103_950.5, "ZAR")).toBe("ZAR 103,951")
      expect(moneyExact(999_999.6, "ZAR")).toBe("ZAR 1,000,000")
      expect(moneyExact(-2_397_304_441.43, "ZAR")).toBe("−ZAR 2,397,304,441")
    })

    it("uses the currency as stated, and no prefix when none is stated", () => {
      expect(moneyExact(2_500_000, "USD", true)).toBe("+USD 2,500,000")
      expect(moneyExact(2_500_000, null)).toBe("2,500,000")
    })

    it("says not measured, never 0, when there is no value", () => {
      expect(moneyExact(null, "ZAR")).toBe("—")
    })
  })

  it("list the months a series has no figure for, in order, and none when every month has one", () => {
    const point = (label: string, stockout: number | null) => ({
      label,
      state: "FINAL" as const,
      stockout,
      excessOpportunity: 1,
      workingCapital: 1,
    })
    const points = [point("Oct 2026", 3), point("Nov 2026", null), point("Dec 2026", null)]
    expect(seriesGaps(points, "stockout")).toEqual(["Nov 2026", "Dec 2026"])
    expect(seriesGaps(points, "excessOpportunity")).toEqual([])
  })

  it("call the stockout card High Stockout Risk, even in a report saved under its old title", () => {
    expect(cardTitle(card("critical_stockout_risk", { title: "Critical stockout risk" }))).toBe("High Stockout Risk")
    expect(cardTitle(card("critical_stockout_risk", { title: "High Stockout Risk" }))).toBe("High Stockout Risk")
  })

  it("keep the report's own title for a card that was not renamed", () => {
    expect(cardTitle(card("pending_approval", { title: "Pending approval" }))).toBe("Pending approval")
    expect(cardTitle(card("something_new", { title: "Something new" }))).toBe("Something new")
  })

  it("carry one plain line each, and fall back to the report's explanation for a card with no wording", () => {
    for (const key of [
      "materials_assessed",
      "recommendations_generated",
      "critical_stockout_risk",
      "excess_inventory_opportunity",
      "working_capital_impact",
      "pending_approval",
    ]) {
      const caption = cardCaption(card(key, { explanation: "A long explanation that belongs behind the (i)." }))
      expect(caption).not.toContain("belongs behind")
      expect(caption.length).toBeLessThanOrEqual(50) // one line on an Overview-sized card
    }
    expect(cardCaption(card("something_new", { explanation: "Its own explanation." }))).toBe("Its own explanation.")
  })
})

// --- trends -----------------------------------------------------------------------------------

import type { ApiQuarterTrends, ApiTrendMonth } from "@/features/initiative-7/types/api"
import { hasPoints, monthBasisLabel, trendPoints } from "./quarterly-management"

function month(overrides: Partial<ApiTrendMonth> = {}): ApiTrendMonth {
  return {
    month: "2026-10-01",
    label: "Oct 2026",
    state: "FINAL",
    measured_on: "2026-11-03",
    month_end_valid: true,
    stockout_valid: true,
    population: 10,
    stockout_at_risk: 5,
    stockout_evaluated: 50,
    stockout_insufficient: 2,
    excess_count: 3,
    excess_opportunity: "1000.00",
    net_rop_value_impact: "-500.00",
    net_rop_change_from_previous: null,
    currency: null,
    revision: 1,
    calc_version: "1",
    note: null,
    ...overrides,
  }
}

const trends = (months: ApiTrendMonth[]): ApiQuarterTrends => ({ months, quarter_end: {} as ApiQuarterTrends["quarter_end"], notes: [] })

describe("trendPoints", () => {
  it("makes one point per month, with the figures as numbers", () => {
    expect(trendPoints(trends([month()]))).toEqual([
      { label: "Oct 2026", state: "FINAL", stockout: 5, excessOpportunity: 1000, workingCapital: -500 },
    ])
  })

  it("leaves a gap -- not a zero -- for a month with no snapshot or an untrusted stockout reading", () => {
    const missing = month({ state: "MISSING", stockout_at_risk: null, excess_opportunity: null, net_rop_value_impact: null })
    const staleStockout = month({ stockout_valid: false, stockout_at_risk: null })
    const [a, b] = trendPoints(trends([missing, staleStockout]))
    expect(a).toMatchObject({ stockout: null, excessOpportunity: null, workingCapital: null })
    expect(b).toMatchObject({ stockout: null, excessOpportunity: 1000 })
  })

  it("knows whether a series has anything to draw", () => {
    const points = trendPoints(trends([month({ stockout_at_risk: null })]))
    expect(hasPoints(points, "stockout")).toBe(false)
    expect(hasPoints(points, "excessOpportunity")).toBe(true)
  })
})

describe("monthBasisLabel", () => {
  it("says how each month was measured", () => {
    expect(monthBasisLabel(month({ state: "MISSING" }))).toBe("No snapshot")
    expect(monthBasisLabel(month({ state: "OPEN", month_end_valid: false }))).toBe("Rolling reading")
    expect(monthBasisLabel(month())).toBe("Month-end snapshot")
    expect(monthBasisLabel(month({ month_end_valid: false }))).toBe("Snapshot, not month-end")
  })
})
