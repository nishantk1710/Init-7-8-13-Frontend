// The monthly report's new sections: the month-end position (from a saved snapshot only), excess in money by plant, the
// approval stages kept apart from SAP adoption, the recommendations' status filter and the coverage statuses.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  ApprovalStagesCard,
  CoverageStatusTable,
  ExcessByPlantValues,
  MonthEndPositionCard,
} from "@/features/initiative-7/components/monthly-report-sections"
import type { ApiAdoptionQuarter, ApiPositionFigures, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { adoptionSummaryOf } from "@/features/initiative-7/utils/quarterly-management"
import {
  approvalStageRows,
  coverageItemsOf,
  monthEndPositionOf,
  plantExcessRows,
  STATUS_FILTER_OPTIONS,
} from "@/features/initiative-7/utils/quarterly-sections"

const stockout = (over: object = {}) => ({
  at_risk: 891,
  evaluated: 9916,
  insufficient_data: 503,
  as_of: "2026-10-30",
  stale: false,
  stale_note: null,
  ...over,
})

function figures(over: Partial<ApiPositionFigures> = {}): ApiPositionFigures {
  return {
    population: 1000,
    stockout: stockout(),
    excess_count: 40,
    excess_opportunity: "5000000.00",
    net_rop_value_impact: "-2000000.00",
    priced_count: 900,
    currency: "ZAR",
    working_capital_currency: "ZAR",
    working_capital_excluded_count: 100,
    inventory_value: "120000000.00",
    inventory_priced_count: 800,
    safety_stock_value: "9000000.00",
    safety_stock_priced_count: 850,
    below_reorder_count: 70,
    below_reorder_judged: 600,
    inventory_stock_as_of: "2026-10-30",
    inventory_unavailable_reason: null,
    recommendation_reference_date: "2026-10-31",
    ...over,
  }
}

const end = (over: object = {}) => ({
  status: "AVAILABLE",
  month: "2026-10-01",
  label: "Oct 2026",
  snapshot_state: "FINAL",
  measured_on: "2026-11-02",
  reason: null,
  population: 1000,
  stock_levels: [],
  latest_available_month: null,
  latest_available_label: null,
  latest_available_measured_on: null,
  ...over,
})

function management(
  over: Partial<ApiQuarterManagement> | Record<string, unknown> = {},
  position = figures(),
  quarterEnd: object = end(),
): ApiQuarterManagement {
  return {
    position,
    position_basis: "snapshot",
    plant_positions: [
      { plant: null, figures: position },
      {
        plant: "1300",
        figures: figures({
          excess_count: 25,
          excess_opportunity: "3000000.00",
        }),
      },
      {
        plant: "1500",
        figures: figures({ excess_count: 15, excess_opportunity: null }),
      },
    ],
    trends: { months: [], quarter_end: quarterEnd, notes: [] },
    data_coverage: {
      latest_consumption_date: "2026-05-30",
      latest_consumption_month: "2026-05-01",
      latest_stock_loaded_at: "2026-10-30T10:00:00Z",
      stockout_usage_as_of: "2026-05-31",
      months: [
        {
          month: "2026-10-01",
          label: "Oct 2026",
          consumption_status: "NOT_COVERED",
          recommendations_generated: 5,
        },
      ],
      eligible_recommendations: 21343,
      eligible_material_plants: 1705,
      basis: "current_calculation",
      warnings: [],
    },
    forecast_actual: {
      status: "NOT_AVAILABLE",
      months: [],
      forecast_total: null,
      actual_total: null,
      accuracy: null,
      forecast_run_id: null,
      note: "No forecast for the month.",
    },
    adoption: {
      status: "UNKNOWN",
      confirmed_adoptions: null,
      pending_approvals: 0,
      reason: "r",
    },
    ...over,
  } as unknown as ApiQuarterManagement
}

const html = (component: unknown, props: object) => renderToStaticMarkup(createElement(component as never, props))

describe("the month-end position", () => {
  it("shows the stock held from a valid saved snapshot, with its dates and what each is over", () => {
    const position = monthEndPositionOf(management())
    expect(position.available).toBe(true)
    expect(position.measuredOn).toBe("2026-11-02")
    expect(position.stockAsOf).toBe("2026-10-30")
    const byKey = Object.fromEntries(position.items.map((i) => [i.key, i]))
    expect(byKey.inventory_value.value).toContain("120.00M")
    expect(byKey.inventory_value.basis).toContain("800 material-plants")
    expect(byKey.below_reorder.value).toBe("70")
    expect(byKey.below_reorder.basis).toContain("of 600")
    expect(byKey.stockout.value).toBe("891")
    const out = html(MonthEndPositionCard, { management: management() })
    expect(out).toContain("Total inventory value")
    expect(out).toContain("Month-end snapshot")
  })

  it("says a snapshot saved before stock held was captured did not measure it, and never shows 0", () => {
    const old = figures({
      inventory_value: null,
      safety_stock_value: null,
      below_reorder_count: null,
      below_reorder_judged: 0,
      inventory_stock_as_of: null,
      inventory_priced_count: 0,
    })
    const position = monthEndPositionOf(management({}, old))
    const byKey = Object.fromEntries(position.items.map((i) => [i.key, i]))
    for (const key of ["inventory_value", "safety_stock_value", "below_reorder"]) {
      expect(byKey[key].value).toBeNull()
      expect(byKey[key].reason).toContain("saved before stock held was captured")
    }
    expect(byKey.excess_value.value).not.toBeNull() // what that snapshot did measure is still shown
    expect(html(MonthEndPositionCard, { management: management({}, old) })).toContain("Not measured")
  })

  it("carries the reason when the stock load was too far from the month's end", () => {
    const why =
      "Stock on hand was loaded on 31 May 2026, 153 days from this report's cutoff (31 Oct 2026); it is not shown as the position for the period."
    const stale = figures({
      inventory_value: null,
      safety_stock_value: null,
      below_reorder_count: null,
      inventory_unavailable_reason: why,
    })
    const byKey = Object.fromEntries(monthEndPositionOf(management({}, stale)).items.map((i) => [i.key, i]))
    expect(byKey.inventory_value.reason).toBe(why)
    expect(byKey.below_reorder.value).toBeNull()
  })

  it("does not show a stale stockout reading as the month's risk", () => {
    const stale = figures({
      stockout: stockout({
        as_of: "2026-05-31",
        stale: true,
        stale_note: "Stockout risk was last measured on 31 May 2026.",
      }),
    })
    const item = monthEndPositionOf(management({}, stale)).items.find((i) => i.key === "stockout")!
    expect(item.value).toBeNull()
    expect(item.reason).toContain("31 May 2026")
  })

  it("says Snapshot not available, and why, when there is no valid snapshot -- and shows no figure from today's data", () => {
    const m = management(
      { position_basis: "current_calculation" },
      figures(),
      end({
        status: "NOT_AVAILABLE",
        reason: "No snapshot was captured for Oct 2026, and a past month cannot be rebuilt.",
      }),
    )
    const position = monthEndPositionOf(m)
    expect(position.available).toBe(false)
    expect(position.items).toEqual([])
    const out = html(MonthEndPositionCard, { management: m })
    expect(out).toContain("Snapshot not available")
    expect(out).toContain("No snapshot was captured for Oct 2026")
    expect(out).not.toContain("120.00M") // the current inventory value is not stood in for the month-end
    expect(out).toContain("total inventory value") // what the section will show once a snapshot exists
  })

  it("never presents an earlier month as the month-end", () => {
    const m = management(
      { position_basis: "current_calculation" },
      figures(),
      end({
        status: "NOT_AVAILABLE",
        reason: "x",
        latest_available_label: "Sep 2026",
        latest_available_measured_on: "2026-10-02",
      }),
    )
    expect(html(MonthEndPositionCard, { management: m })).toContain("not shown as the month-end")
  })
})

describe("excess by plant", () => {
  it("keeps material counts and money in separate columns, and a missing value is not zero", () => {
    const rows = plantExcessRows(management(), (code) => code ?? "All plants")
    expect(rows.map((r) => [r.plant, r.count, r.value])).toEqual([
      ["All plants", 40, 5000000],
      ["1300", 25, 3000000],
      ["1500", 15, null],
    ])
    const out = html(ExcessByPlantValues, { management: management() })
    expect(out).toContain("Material-plants with excess")
    expect(out).toContain("Estimated excess value")
    expect(out).toContain("Black Mountain (1300)")
    expect(out).toContain("Not available") // Gamsberg has nothing to value
  })
})

describe("approval stages and SAP adoption", () => {
  const stages = {
    total: 100,
    not_submitted: 60,
    awaiting_approval: 5,
    adjusted_in_chain: 1,
    approved_awaiting_sap: 20,
    implemented_in_sap: 4,
    rejected_or_sent_back: 10,
    other: 0,
  }
  const adoption = (over: Partial<ApiAdoptionQuarter> = {}): ApiAdoptionQuarter => ({
    status: "UNKNOWN",
    confirmed_adoptions: null,
    pending_approvals: 5,
    reason: "r",
    tracked: 50,
    adopted: 0,
    partially_adopted: 0,
    not_adopted: 0,
    pending: 50,
    stages,
    ...over,
  })

  it("lists the stages in order, and adds up to the records generated", () => {
    const rows = approvalStageRows(adoption())!
    expect(rows.map((r) => r.key)).toEqual([
      "not_submitted",
      "awaiting_approval",
      "adjusted_in_chain",
      "approved_awaiting_sap",
      "implemented_in_sap",
      "rejected_or_sent_back",
    ])
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(stages.total)
  })

  it("keeps SAP adoption's pending apart from awaiting approval", () => {
    const out = html(ApprovalStagesCard, { adoption: adoption() })
    expect(out).toContain("Awaiting approval")
    expect(out).toContain("Approved, awaiting SAP")
    expect(out).toContain("Approved is not adopted")
    expect(adoption().pending).toBe(50) // SAP's pending is a different set from the 5 awaiting approval
    expect(adoption().stages!.awaiting_approval).toBe(5)
  })

  it("says so when an older report has no stages, rather than drawing zeros", () => {
    expect(approvalStageRows(adoption({ stages: null }))).toBeNull()
    expect(html(ApprovalStagesCard, { adoption: adoption({ stages: undefined }) })).toContain("were not saved with this report")
  })

  it("takes the adoption rate from the backend's formula, and shows none until SAP has evidence", () => {
    expect(adoptionSummaryOf(adoption({ adoption_rate: null }))!.adoptionRatePercentage).toBeNull()
    expect(
      adoptionSummaryOf(
        adoption({
          adopted: 3,
          partially_adopted: 1,
          not_adopted: 4,
          pending: 42,
          adoption_rate: "0.5",
        }),
      )!.adoptionRatePercentage,
    ).toBe(50)
    // An older report without the field keeps the default formula's shape.
    expect(adoptionSummaryOf(adoption({ adopted: 1, not_adopted: 1, pending: 48 }))!.adoptionRatePercentage).toBe(50)
  })
})

describe("the status filter", () => {
  it("offers the statuses the data model has, each as a display group or one exact status", () => {
    expect(STATUS_FILTER_OPTIONS.map((o) => o.label)).toEqual([
      "All statuses",
      "Pending approval",
      "Approved",
      "Rejected",
      "Sent back",
      "Implemented",
      "Insufficient data",
    ])
    const query = Object.fromEntries(STATUS_FILTER_OPTIONS.map((o) => [o.value, o.query]))
    expect(query.all).toEqual({}) // nothing is left out
    expect(query.pending).toEqual({ statusGroup: "In Approval" })
    expect(query.sent_back).toEqual({ statusGroup: "Returned" })
    expect(query.insufficient).toEqual({ status: "NOT_EVALUABLE" })
  })
})

describe("data coverage", () => {
  // The statuses are the backend's: worked out once, saved with the report, and read as sent by the page, the PDF and the Excel.
  const item = (key: string, status: string, detail: string | null = null, value: string | null = null) => ({
    key,
    label: key,
    value,
    status,
    detail,
  })
  const withItems = (items: ReturnType<typeof item>[]) =>
    management({
      data_coverage: {
        latest_consumption_date: null,
        latest_consumption_month: null,
        latest_stock_loaded_at: null,
        stockout_usage_as_of: null,
        months: [],
        eligible_recommendations: 1,
        eligible_material_plants: 1,
        basis: "current_calculation",
        warnings: [],
        items,
      },
    })

  it("reads each source's status and reason as the backend saved them", () => {
    const items = coverageItemsOf(
      withItems([
        item("stockout", "Stale", "Last measured 31 May 2026.", "31 May 2026"),
        item("snapshot", "Not available", "No snapshot."),
      ]),
    )!
    expect(items.map((i) => i.status)).toEqual(["Stale", "Not available"])
    expect(items[0].detail).toContain("31 May 2026")
  })

  it("draws a status badge and the reason for each, never a blank", () => {
    const html = html2(
      withItems([
        item("Latest stockout measurement", "Stale", "Last measured 31 May 2026."),
        item("Forecast data", "Insufficient history", "Not enough months."),
      ]),
    )
    expect(html).toContain("Stale")
    expect(html).toContain("Insufficient history")
    expect(html).toContain("Last measured 31 May 2026.")
    expect(html).toContain("Not enough months.")
  })

  it("has nothing to show for a report saved before the statuses existed, and says nothing false", () => {
    const old = management()
    expect(coverageItemsOf(old)).toBeNull()
    expect(html2(old)).toBe("")
  })
})

const html2 = (m: ApiQuarterManagement) => renderToStaticMarkup(createElement(CoverageStatusTable, { management: m }))
