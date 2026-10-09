// Content tests for the quarterly report PDF (print view).
//
// Rendered to static markup with react-dom/server rather than mounted: this
// project's vitest runs in the `node` environment with no DOM library (see
// vitest.config.mts), and the assertions worth making here are about what the
// PDF *says* -- which sections it carries, which numbers, and which claims it
// makes about its own data -- none of which needs a DOM.
//
// The point of this file is that a section cannot be dropped from the PDF
// silently: all 16 of the report schema's sections are asserted by name.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ReportPrintView } from "./report-print-view"
import type {
  ApiAvailabilityStatus,
  ApiDecimal,
  ApiPopulationCount,
  ApiQuarterlyReport,
} from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

function pop(populated: number, total: number, pct: ApiDecimal): ApiPopulationCount {
  return {
    populated_count: populated,
    missing_count: total - populated,
    total_count: total,
    percentage_populated: pct,
  }
}

function metric(status: ApiAvailabilityStatus, value: ApiDecimal) {
  return { status, value, populated_count: 10, total_count: 20 }
}

function undefinedMetric(reason: string) {
  return { status: "NOT_CONFIGURED" as const, reason }
}

function reportFixture(overrides: Partial<ApiQuarterlyReport> = {}): ApiQuarterlyReport {
  return {
    metadata: {
      quarter: "Q3 2026",
      period_start: "2026-07-01",
      period_end: "2026-09-30",
      generated_at: "2026-10-09T04:30:00Z",
      report_version: "1.0",
      feature_run_id: 11,
      forecast_run_id: 22,
      inventory_run_id: null,
      oar_run_id: null,
    },
    executive_summary: {
      total_material_plants: 4321,
      classified_percentage: "62.5",
      total_recommendations: 777,
      ready_for_review_count: 12,
      pending_approval_count: 34,
      pending_approval_percentage: "4.4",
      not_evaluable_count: 5,
      oar_count: 999,
      approval_ledger_entries: 6,
    },
    management_summary: {
      critical_stockout_risk: undefinedMetric("No stockout-risk severity rule defined"),
      excess_inventory_candidates: undefinedMetric("No excess-inventory rule defined"),
      working_capital_impact: undefinedMetric("No working-capital rule defined"),
      stockout_risk_distribution: undefinedMetric("No distribution rule defined"),
      stockout_risk_trend: undefinedMetric("No trend rule defined"),
    },
    scope_and_data_quality: {
      total_records: 4321,
      classified_count: 2700,
      classified_percentage: "62.5",
      unclassified_count: 1621,
      unclassified_percentage: "37.5",
      history_status_breakdown: [{ history_status: "SUFFICIENT", count: 2700 }],
      criticality_populated_count: 0,
      criticality_populated_percentage: null,
      lead_time_populated_count: 1200,
      lead_time_populated_percentage: "27.8",
    },
    demand_classification: {
      total: 2700,
      by_class: [{ demand_class: "LUMPY", count: 1500, percentage: "55.6" }],
    },
    forecasting: {
      total_forecasts: 888,
      mean_absolute_error: metric("AVAILABLE", "12.5"),
      pinball_loss: metric("NOT_AVAILABLE", null),
      bias_percentage: metric("AVAILABLE", "-3.2"),
      fill_rate: metric("AVAILABLE", "95.1"),
      holding_cost: metric("NOT_AVAILABLE", null),
      champion_challenger: { champion_count: 5, challenger_count: 3, baseline_count: 1 },
      mape_status: "NOT_AVAILABLE",
    },
    safety_stock: {
      current: pop(100, 200, "50.0"),
      recommended: pop(150, 200, "75.0"),
      both_available_count: 90,
      mean_delta: "4.5",
      service_level_status: "NOT_CONFIGURED",
    },
    reorder_point: {
      current: pop(110, 200, "55.0"),
      recommended: pop(160, 200, "80.0"),
      both_available_count: 95,
      mean_delta: "6.5",
      current_sap_value_reused_note: "Current SAP value reused.",
    },
    max_stock: {
      current: pop(120, 200, "60.0"),
      recommended: pop(170, 200, "85.0"),
      both_available_count: 99,
      mean_delta: "7.5",
      strategy_labeled_count: 10,
      strategy_production_resolved_count: 8,
      strategy_unresolved_fixture_count: 2,
      strategy_policy_status: "NOT_CONFIGURED",
      current_sap_value_reused_note: "Max stock note.",
    },
    material_criticality: {
      total: 4321,
      by_tier: [{ criticality: "CRITICAL", count: 0 }],
      populated_count: 0,
      populated_percentage: null,
    },
    oar: {
      is_oar_true_count: 999,
      is_oar_false_count: 2000,
      is_oar_null_count: 1322,
      conversion_eligibility_breakdown: [{ conversion_eligibility: "ELIGIBLE", count: 400 }],
    },
    recommendations: {
      total: 777,
      by_status: [{ status: "READY_FOR_REVIEW", count: 12 }],
    },
    approval: {
      ledger_entry_count: 6,
      distinct_recommendations_in_approval: 5,
      pending_count: 3,
      approved_count: 2,
      rejected_count: 1,
    },
    baseline_comparison: {
      baseline_lead_time_source: "I11 baseline",
      i07_lead_time_source: "I07 computed",
      rows: [
        {
          metric: "Reorder Point",
          baseline_value: "100",
          recommendation_value: "140",
          delta: "40",
          delta_percentage: "40.0",
          both_available_count: 95,
          baseline_missing_count: 1,
          recommendation_missing_count: 2,
          not_evaluable_count: 3,
          availability_status: "AVAILABLE",
        },
      ],
    },
    sap_adoption: { status: "NOT_AVAILABLE", reason: "Adoption not tracked for this quarter" },
    limitations: { items: ["MARC holds plant 1300 and 1200 only."] },
    ...overrides,
  } as ApiQuarterlyReport
}

function recommendationFixture(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "REC-1",
    material: { materialId: "M-1", materialCode: "1000000000", description: "Bearing" },
    plantId: "1300",
    circuit: "Mill" as Recommendation["circuit"],
    criticality: "Critical" as Recommendation["criticality"],
    demandPattern: "Lumpy" as Recommendation["demandPattern"],
    risk: "High" as Recommendation["risk"],
    status: "Ready for Review" as Recommendation["status"],
    current: { rop: 100, safetyStock: 20, maxStock: 300 },
    recommended: { rop: 140, safetyStock: 35, maxStock: 380 },
    avgDailyConsumption: 2,
    leadTimeDays: 30,
    leadTimeVarianceDays: 5,
    serviceLevelTarget: 95,
    unitPrice: 10,
    annualConsumption: 730,
    workingCapitalImpact: 400,
    consumptionHistory: [],
    factors: [],
    ...overrides,
  } as Recommendation
}

function render(
  report: ApiQuarterlyReport = reportFixture(),
  materials: Recommendation[] = [recommendationFixture()],
  materialsTotal = 113_000,
) {
  return renderToStaticMarkup(
    createElement(ReportPrintView, { report, materials, materialsTotal, chartSampleSize: 200 }),
  )
}

/** Every section of ApiQuarterlyReport, by the heading the PDF prints. */
const EXPECTED_SECTIONS = [
  "Quarterly Deep-Dive Report", // 1. metadata (cover)
  "Executive Summary",
  "Management Summary",
  "Scope &amp; Data Quality",
  "Demand Classification",
  "Forecasting",
  "Safety Stock",
  "Reorder Point",
  "Max Stock",
  "Material Criticality",
  "OAR / Min-Max",
  "Recommendations",
  "Approval",
  "Current / I11 Baseline vs I07 Recommendation",
  "SAP Adoption",
  "Limitations &amp; Dependencies",
]

describe("ReportPrintView — section coverage", () => {
  it("renders all 16 report sections, so none can be dropped silently", () => {
    const html = render()
    for (const heading of EXPECTED_SECTIONS) {
      expect(html, `missing section: ${heading}`).toContain(heading)
    }
    expect(EXPECTED_SECTIONS).toHaveLength(16)
  })

  it("numbers the sections 2 through 16 after the cover", () => {
    const html = render()
    for (let n = 2; n <= 16; n++) {
      expect(html).toContain(`${n}.</span>`)
    }
  })
})

describe("ReportPrintView — the selected quarter", () => {
  it("prints the quarter and its reporting period from the report's own metadata", () => {
    const html = render()
    expect(html).toContain("Q3 2026")
    expect(html).toContain("2026-07-01")
    expect(html).toContain("2026-09-30")
  })

  it("carries the quarter as a data attribute, so a stale render is detectable", () => {
    expect(render()).toContain('data-quarter="Q3 2026"')
  })

  it("prints a different quarter's values when given a different report", () => {
    const html = render(
      reportFixture({
        metadata: { ...reportFixture().metadata, quarter: "Q1 2027", period_start: "2027-01-01" },
      }),
    )
    expect(html).toContain("Q1 2027")
    expect(html).not.toContain("Q3 2026")
  })
})

describe("ReportPrintView — report values", () => {
  it("prints figures from the report rather than recomputing them", () => {
    const html = render()
    expect(html).toContain("4,321") // total_material_plants
    expect(html).toContain("777") // total_recommendations
    expect(html).toContain("999") // oar_count
  })

  it("prints the backend's own reason for a metric with no defined rule", () => {
    expect(render()).toContain("No working-capital rule defined")
  })

  it("prints limitations verbatim", () => {
    expect(render()).toContain("MARC holds plant 1300 and 1200 only.")
  })
})

describe("ReportPrintView — unavailable data is never printed as zero", () => {
  it("renders a null percentage as a dash, not 0", () => {
    // criticality_populated_percentage is null in the fixture.
    const html = render()
    expect(html).toContain("—")
  })

  it("says criticality is unpopulated rather than letting zeros read as a measurement", () => {
    const html = render()
    expect(html).toContain("not populated for this quarter")
  })

  it("keeps the explanation when populated_percentage is null", () => {
    const html = render()
    expect(html).toContain("absence of source data, not a measurement of zero")
  })
})

describe("ReportPrintView — disclosures", () => {
  it("states the material table is a subset and says what of", () => {
    const html = render()
    expect(html).toContain("113,000")
    expect(html).toContain("most recent first")
  })

  it("denies any reorder-point ranking, which the backend cannot produce", () => {
    expect(render()).toContain("not ranked by reorder-point change")
  })

  it("says the material rows are not quarter-scoped", () => {
    expect(render()).toContain("not scoped to this quarter")
  })

  it("labels SAP adoption as current and platform-wide, not quarter-specific", () => {
    const html = render()
    expect(html).toContain("current and platform-wide")
    expect(html).toContain("not scoped to Q3 2026")
  })

  it("discloses the chart sample size against the full population", () => {
    expect(render()).toContain("sample of 200 recommendation rows")
  })
})

describe("ReportPrintView — material table", () => {
  it("prints the material code, plant and the current-to-recommended ROP pair", () => {
    const html = render()
    expect(html).toContain("1000000000")
    expect(html).toContain("1300")
    expect(html).toContain("100") // current rop
    expect(html).toContain("140") // recommended rop
  })

  it("renders every supplied row", () => {
    const rows = [
      recommendationFixture({ id: "A", material: { materialId: "A", materialCode: "AAA1", description: "a" } }),
      recommendationFixture({ id: "B", material: { materialId: "B", materialCode: "BBB2", description: "b" } }),
    ]
    const html = render(reportFixture(), rows)
    expect(html).toContain("AAA1")
    expect(html).toContain("BBB2")
  })

  it("handles an empty material list without claiming rows exist", () => {
    const html = render(reportFixture(), [], 0)
    expect(html).toContain("No recommendation rows were returned.")
    expect(html).not.toContain("most recent first")
  })
})

describe("ReportPrintView — empty and edge states", () => {
  it("renders with no limitations recorded", () => {
    const html = render(reportFixture({ limitations: { items: [] } }))
    expect(html).toContain("No limitations recorded.")
  })

  it("renders when every upstream run id is missing", () => {
    const html = render(
      reportFixture({
        metadata: {
          ...reportFixture().metadata,
          feature_run_id: null,
          forecast_run_id: null,
          inventory_run_id: null,
          oar_run_id: null,
        },
      }),
    )
    expect(html).toContain("feature —")
  })

  it("renders an empty table body as 'No rows.' rather than an empty table", () => {
    const html = render(reportFixture({ demand_classification: { total: 0, by_class: [] } }))
    expect(html).toContain("No rows.")
  })
})
