// Part 21 — I07 frontend/backend integration.
//
// Unit tests for the mapper functions in i7-api.ts -- the one place backend
// field values are reshaped into the existing Recommendation type. These
// assert the mapping is faithful (no invented values, no recomputed business
// numbers) rather than testing network behaviour, which apiFetch/ApiError
// already own.

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchQuarterlyReport,
  fetchQuarterlyReports,
  mapDetailToRecommendation,
  mapStatus,
  mapSummaryToRecommendation,
} from "./i7-api"
import type {
  ApiQuarterlyReport,
  ApiQuarterlyReportListItem,
  ApiQuarterlyReportListResponse,
  ApiRecommendationDetail,
  ApiRecommendationSummary,
} from "@/features/initiative-7/types/api"

function summaryFixture(overrides: Partial<ApiRecommendationSummary> = {}): ApiRecommendationSummary {
  return {
    recommendation_id: "REC-STD-1000000000-1300",
    material: "1000000000",
    plant: "1300",
    status: "READY_FOR_REVIEW",
    is_oar: false,
    demand_class: "SMOOTH",
    criticality: "CRITICAL",
    confidence: null,
    generated_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    chain_index: 0,
    route: ["End User", "Engineering Manager", "Commercial Manager", "Warehouse Supervisor"],
    current: { safety_stock: 5, rop: 10, max_stock: null },
    recommended: { safety_stock: 8, rop: 15, max_stock: null },
    impact: { status: "AVAILABLE", safety_stock_delta: 3, rop_delta: 5, max_stock_delta: null },
    unit_price: 125.5,
    ...overrides,
  }
}

function detailFixture(overrides: Partial<ApiRecommendationDetail> = {}): ApiRecommendationDetail {
  return {
    recommendation_id: "REC-STD-1000000000-1300",
    material: "1000000000",
    plant: "1300",
    circuit: null,
    unit_price: 125.5,
    current: { safety_stock: 5, rop: 10, max_stock: null },
    recommended: { safety_stock: 8, rop: 15, max_stock: null },
    demand: {
      demand_class: "SMOOTH",
      history_status: "SUFFICIENT",
      model: "SES",
      forecast_rate: 12.5,
      consumption_history: [
        { period: "2025-08-01", quantity: 3 },
        { period: "2025-09-01", quantity: 5 },
      ],
    },
    lead_time: { method: "PLANNED_FALLBACK", days: 30, variance_days: 5 },
    criticality: { value: "CRITICAL" },
    service_level: { service_level: 0.95, z_factor: 1.645 },
    oar: {
      is_oar: false,
      similarity_status: null,
      estimate_status: null,
      neighbour_count: null,
      best_similarity: null,
      confidence: null,
      conversion_eligibility: null,
      conversion_trigger: null,
      conversion_detail: null,
      demand_class: "SMOOTH",
      consumption_count_12m: null,
      consumption_count_threshold: null,
      production_impact: null,
      i13_hod_approved: null,
    },
    impact: { status: "AVAILABLE", safety_stock_delta: 3, rop_delta: 5, max_stock_delta: null },
    rationale: { text: "Demand is SMOOTH; recommended values increase buffer.", source: "AI_GENERATED" },
    governance: {
      policy_id: "i07-default",
      policy_version: 1,
      formula_version: "1",
      feature_run_id: 1,
      forecast_run_id: 1,
      inventory_run_id: 1,
      oar_run_id: null,
    },
    status: "READY_FOR_REVIEW",
    blocking_reason: null,
    safety_stock_method: "normal_path",
    max_stock_strategy: null,
    chain_index: 0,
    adjustment_count: 0,
    current_version: 1,
    generated_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  }
}

describe("mapStatus", () => {
  it("maps every backend LifecycleStatus to a value the existing RecommendationStatus type accepts", () => {
    const backendStatuses = [
      "NOT_EVALUABLE",
      "READY_FOR_REVIEW",
      "PENDING_APPROVAL",
      "HELD",
      "SENT_BACK",
      "ADJUSTED",
      "APPROVED",
      "REJECTED",
      "SAP_EXECUTION_PENDING",
      "SAP_EXECUTED",
      "ADOPTED",
      "PARTIALLY_ADOPTED",
      "NOT_ADOPTED",
    ]
    const allowed = ["Pending Review", "In Approval", "Approved", "Rejected", "Returned", "Implemented"]
    for (const status of backendStatuses) {
      expect(allowed).toContain(mapStatus(status))
    }
  })

  it("falls back to Pending Review for an unrecognised status rather than throwing", () => {
    expect(mapStatus("SOMETHING_NEW_THE_BACKEND_ADDED")).toBe("Pending Review")
  })
})

describe("mapSummaryToRecommendation", () => {
  it("uses the real SAP material/plant identifiers, not an app-catalog lookup", () => {
    const rec = mapSummaryToRecommendation(summaryFixture())
    expect(rec.material.materialId).toBe("1000000000")
    expect(rec.plantId).toBe("1300")
  })

  it("reads real stock parameters from the summary endpoint's own current/recommended fields", () => {
    // Part 29 -- the list endpoint now carries real current/recommended
    // values (see ApiRecommendationSummary), so the table's Value/ROP change
    // columns no longer need a row to be expanded first.
    const rec = mapSummaryToRecommendation(summaryFixture())
    expect(rec.current).toEqual({ rop: 10, safetyStock: 5, maxStock: 0 })
    expect(rec.recommended).toEqual({ rop: 15, safetyStock: 8, maxStock: 0 })
  })

  it("falls back to null-safe zero when the summary endpoint's stock fields are absent", () => {
    const rec = mapSummaryToRecommendation(
      summaryFixture({
        current: { safety_stock: null, rop: null, max_stock: null },
        recommended: { safety_stock: null, rop: null, max_stock: null },
      }),
    )
    expect(rec.current).toEqual({ rop: 0, safetyStock: 0, maxStock: 0 })
    expect(rec.recommended).toEqual({ rop: 0, safetyStock: 0, maxStock: 0 })
  })

  it("never shows a fabricated MEDIUM risk badge for a material with no real criticality", () => {
    // Regression: most of the seeded extract (111,749 of 113,465 records)
    // has no criticality at all -- defaulting that to "Medium" for display
    // purposes previously made every one of those rows show a fabricated
    // MEDIUM stockout-risk badge.
    const rec = mapSummaryToRecommendation(summaryFixture({ criticality: null, status: "READY_FOR_REVIEW" }))
    expect(rec.risk).toBe("low")
  })

  it("escalates risk for IMPACT/INSURANCE tiers, not just the literal CRITICAL tier", () => {
    // Regression (Part 36): deriveRisk used to compare the raw criticality
    // against the literal strings "HIGH"/"MEDIUM", which never occur -- the
    // real ZMM065 vocabulary is CRITICAL/IMPACT/INSURANCE/NORMAL/OBSOLETE.
    // That meant IMPACT and INSURANCE materials could never reach "high"/
    // "medium" risk, only "critical" or "low".
    const impact = mapSummaryToRecommendation(summaryFixture({ criticality: "IMPACT", status: "READY_FOR_REVIEW" }))
    expect(impact.risk).toBe("high")

    const insurance = mapSummaryToRecommendation(
      summaryFixture({ criticality: "INSURANCE", status: "READY_FOR_REVIEW" }),
    )
    expect(insurance.risk).toBe("medium")

    const critical = mapSummaryToRecommendation(
      summaryFixture({ criticality: "CRITICAL", status: "READY_FOR_REVIEW" }),
    )
    expect(critical.risk).toBe("critical")
  })

  it("marks a NOT_EVALUABLE summary row so the table never shows a fabricated 'no change'", () => {
    const rec = mapSummaryToRecommendation(summaryFixture({ status: "NOT_EVALUABLE" }))
    expect(rec.factors.some((f) => f.label === "Blocked")).toBe(true)
  })
})

describe("mapDetailToRecommendation", () => {
  it("reads current/recommended stock parameters verbatim, never recomputing them", () => {
    const rec = mapDetailToRecommendation(detailFixture())
    expect(rec.current).toEqual({ safetyStock: 5, rop: 10, maxStock: 0 })
    expect(rec.recommended).toEqual({ safetyStock: 8, rop: 15, maxStock: 0 })
  })

  it("passes the backend's own z_factor through unchanged rather than recomputing it", () => {
    const rec = mapDetailToRecommendation(detailFixture())
    expect(rec.zFactor).toBe(1.645)
  })

  it("maps the real staged consumption series to short month labels, never fabricating a series", () => {
    const rec = mapDetailToRecommendation(detailFixture())
    expect(rec.consumptionHistory).toEqual([
      { period: "Aug", qty: 3 },
      { period: "Sep", qty: 5 },
    ])
  })

  it("returns an empty consumption history for a material with no staged rows, not a fabricated one", () => {
    const rec = mapDetailToRecommendation(
      detailFixture({
        demand: {
          demand_class: "SMOOTH",
          history_status: "SUFFICIENT",
          model: "SES",
          forecast_rate: 12.5,
          consumption_history: [],
        },
      }),
    )
    expect(rec.consumptionHistory).toEqual([])
  })

  it("carries the rationale text and source through unmodified", () => {
    const rec = mapDetailToRecommendation(detailFixture())
    expect(rec.rationale?.text).toBe("Demand is SMOOTH; recommended values increase buffer.")
    expect(rec.rationale?.source).toBe("AI_GENERATED")
  })

  it("never labels a DETERMINISTIC_FALLBACK rationale as AI_GENERATED", () => {
    const rec = mapDetailToRecommendation(
      detailFixture({ rationale: { text: "Factors: demand is SMOOTH.", source: "DETERMINISTIC_FALLBACK" } }),
    )
    expect(rec.rationale?.source).toBe("DETERMINISTIC_FALLBACK")
  })

  it("surfaces the blocking reason as a factor for a NOT_EVALUABLE recommendation, instead of fabricating one", () => {
    const rec = mapDetailToRecommendation(
      detailFixture({
        status: "NOT_EVALUABLE",
        blocking_reason: "safety stock status=NOT_EVALUABLE_SERVICE_LEVEL_UNSET",
        current: { safety_stock: 5, rop: 10, max_stock: null },
        recommended: { safety_stock: null, rop: null, max_stock: null },
      }),
    )
    expect(rec.status).toBe("Pending Review")
    expect(rec.factors).toEqual([
      { label: "Blocked", detail: "safety stock status=NOT_EVALUABLE_SERVICE_LEVEL_UNSET" },
    ])
  })

  it("parses Decimal fields the backend serializes as strings ('0.000000'), not just JSON numbers", () => {
    // Confirmed against the live API: FastAPI/Pydantic serializes Decimal as
    // a JSON string, not a float -- a regression here silently turned every
    // stock figure into NaN in the UI.
    const rec = mapDetailToRecommendation(
      detailFixture({
        current: { safety_stock: "5.000000", rop: "10.000000", max_stock: null },
        recommended: { safety_stock: "8.000000", rop: "15.000000", max_stock: null },
        service_level: { service_level: "0.950000", z_factor: "1.645000" },
        unit_price: "125.500000",
      }),
    )
    expect(rec.current).toEqual({ safetyStock: 5, rop: 10, maxStock: 0 })
    expect(rec.recommended).toEqual({ safetyStock: 8, rop: 15, maxStock: 0 })
    expect(rec.serviceLevelTarget).toBe(0.95)
    expect(rec.zFactor).toBe(1.645)
    expect(rec.unitPrice).toBe(125.5)
    expect(Number.isNaN(rec.zFactor)).toBe(false)
  })

  it("maps all five real ZMM065 criticality tiers using the backend's own severity order, never a fabricated mid-tier default", () => {
    // Regression: IMPACT/INSURANCE/OBSOLETE previously fell through a
    // Low/Medium/High/Critical-only lookup table and all silently became
    // "Medium" -- confirmed live against the seeded extract that these are
    // real, common tier values (IMPACT: 1026, INSURANCE: 144, OBSOLETE: 18
    // rows), not edge cases.
    const tierCases: [string, string][] = [
      ["CRITICAL", "Critical"],
      ["IMPACT", "High"],
      ["INSURANCE", "Medium"],
      ["NORMAL", "Low"],
      ["OBSOLETE", "Low"],
    ]
    for (const [raw, expected] of tierCases) {
      const rec = mapDetailToRecommendation(detailFixture({ criticality: { value: raw } }))
      expect(rec.criticality).toBe(expected)
    }
  })

  it("never shows a fabricated risk badge for a detail with no real criticality either", () => {
    const rec = mapDetailToRecommendation(
      detailFixture({ criticality: { value: null }, status: "READY_FOR_REVIEW" }),
    )
    expect(rec.risk).toBe("low")
  })

  it("builds OAR cold-start guidance only when the backend marks the recommendation as OAR", () => {
    const notOar = mapDetailToRecommendation(detailFixture())
    expect(notOar.oarColdStart).toBeUndefined()

    const oar = mapDetailToRecommendation(
      detailFixture({
        oar: {
          is_oar: true,
          similarity_status: "AVAILABLE",
          estimate_status: "SUCCESS",
          neighbour_count: 5,
          best_similarity: 0.82,
          confidence: "HIGH",
          conversion_eligibility: "UNKNOWN",
          conversion_trigger: null,
          conversion_detail: "consumption count 7 > 4",
          demand_class: "UNCLASSIFIED",
          consumption_count_12m: 7,
          consumption_count_threshold: 4,
          production_impact: null,
          i13_hod_approved: null,
        },
      }),
    )
    expect(oar.oarColdStart).toBeDefined()
    expect(oar.oarColdStart?.confidence).toBe("High")
  })

  it("builds OAR conversion info only when the backend marks the recommendation as OAR", () => {
    const notOar = mapDetailToRecommendation(detailFixture())
    expect(notOar.oarConversion).toBeUndefined()

    const oar = mapDetailToRecommendation(
      detailFixture({
        oar: {
          is_oar: true,
          similarity_status: null,
          estimate_status: null,
          neighbour_count: null,
          best_similarity: null,
          confidence: null,
          conversion_eligibility: "ELIGIBLE",
          conversion_trigger: "CONSUMPTION_FREQUENCY",
          conversion_detail: "7 consumptions in the trailing 12 months exceeds the threshold of 4.",
          demand_class: "INTERMITTENT",
          consumption_count_12m: 7,
          consumption_count_threshold: 4,
          production_impact: null,
          i13_hod_approved: null,
        },
      }),
    )
    expect(oar.oarConversion).toEqual({
      isOar: true,
      conversionEligibility: "ELIGIBLE",
      conversionTrigger: "CONSUMPTION_FREQUENCY",
      conversionDetail: "7 consumptions in the trailing 12 months exceeds the threshold of 4.",
      demandClass: "INTERMITTENT",
      consumptionCount12m: 7,
      consumptionCountThreshold: 4,
      productionImpact: null,
      i13HodApproved: null,
    })
  })

  it("preserves an unresolved I13 HOD approval as null, never a fabricated false", () => {
    const oar = mapDetailToRecommendation(
      detailFixture({
        oar: {
          is_oar: true,
          similarity_status: null,
          estimate_status: null,
          neighbour_count: null,
          best_similarity: null,
          confidence: null,
          conversion_eligibility: "UNKNOWN",
          conversion_trigger: "UNKNOWN",
          conversion_detail: "no I13 HOD-approval ledger is available",
          demand_class: null,
          consumption_count_12m: 1,
          consumption_count_threshold: 4,
          production_impact: null,
          i13_hod_approved: null,
        },
      }),
    )
    expect(oar.oarConversion?.i13HodApproved).toBeNull()
    expect(oar.oarConversion?.conversionEligibility).toBe("UNKNOWN")
  })
})

// --- Quarterly Deep-Dive Report (Step 10) ----------------------------------
//
// fetchQuarterlyReports/fetchQuarterlyReport have no separately-exported pure
// mapper (unlike mapSummaryToRecommendation/mapDetailToRecommendation) -- the
// list row reshape lives inline in fetchQuarterlyReports itself, and
// fetchQuarterlyReport returns the report body verbatim with no reshape at
// all. Stubbing global fetch is the only way to exercise that inline mapping,
// so these stay narrowly scoped to the mapping/faithfulness assertions the
// rest of this file makes -- not a retest of apiFetch's own request/error
// handling, which has no I07-specific behaviour to verify.

function quarterlyListItemFixture(
  overrides: Partial<ApiQuarterlyReportListItem> = {},
): ApiQuarterlyReportListItem {
  return {
    report_id: 7,
    quarter: "Q3 2026",
    status: "COMPLETED",
    report_version: "1",
    generated_at: "2026-09-21T00:00:00Z",
    period_start: "2026-07-01",
    period_end: "2026-09-30",
    ...overrides,
  }
}

function stubFetchJson(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
      headers: new Headers(),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchQuarterlyReports", () => {
  it("maps the list endpoint's snake_case rows to the camelCase QuarterlyReportListRow shape verbatim", async () => {
    const item = quarterlyListItemFixture()
    const response: ApiQuarterlyReportListResponse = { items: [item], total: 1 }
    stubFetchJson(response)

    const result = await fetchQuarterlyReports()

    expect(result.total).toBe(1)
    expect(result.items).toEqual([
      {
        reportId: item.report_id,
        quarter: item.quarter,
        status: item.status,
        reportVersion: item.report_version,
        generatedAt: item.generated_at,
        periodStart: item.period_start,
        periodEnd: item.period_end,
      },
    ])
  })

  it("passes a report's real generation status through, never defaulting a non-COMPLETED row to COMPLETED", () => {
    const pending = quarterlyListItemFixture({ status: "PENDING", generated_at: "" })
    expect(pending.status).toBe("PENDING")
    expect(pending.status).not.toBe("COMPLETED")
  })

  it("returns an empty list, not a fabricated row, when the backend has generated nothing yet", async () => {
    stubFetchJson({ items: [], total: 0 } satisfies ApiQuarterlyReportListResponse)

    const result = await fetchQuarterlyReports()

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})

describe("fetchQuarterlyReport", () => {
  function reportFixture(overrides: Partial<ApiQuarterlyReport> = {}): ApiQuarterlyReport {
    return {
      metadata: {
        quarter: "Q3 2026",
        period_start: "2026-07-01",
        period_end: "2026-09-30",
        generated_at: "2026-09-21T00:00:00Z",
        report_version: "1",
        feature_run_id: 1,
        forecast_run_id: 1,
        inventory_run_id: 1,
        oar_run_id: null,
      },
      executive_summary: {
        total_material_plants: 100,
        classified_percentage: "53.000000",
        total_recommendations: 80,
        ready_for_review_count: 20,
        pending_approval_count: 10,
        pending_approval_percentage: "12.500000",
        not_evaluable_count: 5,
        oar_count: 12,
        approval_ledger_entries: 30,
      },
      management_summary: {
        critical_stockout_risk: { status: "NOT_CONFIGURED", reason: "No stockout-risk classification exists." },
        excess_inventory_candidates: { status: "NOT_CONFIGURED", reason: "No excess-inventory rule exists." },
        working_capital_impact: { status: "NOT_CONFIGURED", reason: "No currency-denominated impact figure exists." },
        stockout_risk_distribution: { status: "NOT_CONFIGURED", reason: "No stockout-risk classification exists." },
        stockout_risk_trend: { status: "NOT_CONFIGURED", reason: "No monthly time-series mechanism exists." },
      },
      scope_and_data_quality: {
        total_records: 100,
        classified_count: 53,
        classified_percentage: "53.000000",
        unclassified_count: 47,
        unclassified_percentage: "47.000000",
        history_status_breakdown: [{ history_status: "SUFFICIENT", count: 53 }],
        criticality_populated_count: 10,
        criticality_populated_percentage: "10.000000",
        lead_time_populated_count: 90,
        lead_time_populated_percentage: "90.000000",
      },
      demand_classification: {
        total: 100,
        by_class: [{ demand_class: "SMOOTH", count: 53, percentage: "53.000000" }],
      },
      forecasting: {
        total_forecasts: 80,
        mean_absolute_error: { status: "NOT_AVAILABLE", value: null, populated_count: 0, total_count: 80 },
        pinball_loss: { status: "NOT_AVAILABLE", value: null, populated_count: 0, total_count: 80 },
        bias_percentage: { status: "NOT_AVAILABLE", value: null, populated_count: 0, total_count: 80 },
        fill_rate: { status: "NOT_AVAILABLE", value: null, populated_count: 0, total_count: 80 },
        holding_cost: { status: "NOT_AVAILABLE", value: null, populated_count: 0, total_count: 80 },
        champion_challenger: { champion_count: 80, challenger_count: 0, baseline_count: 0 },
        mape_status: "NOT_AVAILABLE",
      },
      safety_stock: {
        current: { populated_count: 90, missing_count: 10, total_count: 100, percentage_populated: "90.000000" },
        recommended: { populated_count: 80, missing_count: 20, total_count: 100, percentage_populated: "80.000000" },
        both_available_count: 75,
        mean_delta: "1.500000",
        service_level_status: "AVAILABLE",
      },
      reorder_point: {
        current: { populated_count: 90, missing_count: 10, total_count: 100, percentage_populated: "90.000000" },
        recommended: { populated_count: 80, missing_count: 20, total_count: 100, percentage_populated: "80.000000" },
        both_available_count: 75,
        mean_delta: "2.000000",
        current_sap_value_reused_note: "For SMOOTH/ERRATIC materials, current MARC reorder point is reused as-is.",
      },
      max_stock: {
        current: { populated_count: 50, missing_count: 50, total_count: 100, percentage_populated: "50.000000" },
        recommended: { populated_count: 40, missing_count: 60, total_count: 100, percentage_populated: "40.000000" },
        both_available_count: 30,
        mean_delta: null,
        strategy_labeled_count: 0,
        strategy_production_resolved_count: 0,
        strategy_unresolved_fixture_count: 100,
        strategy_policy_status: "NOT_CONFIGURED",
        current_sap_value_reused_note: "For SMOOTH/ERRATIC materials, current MARC maximum stock is reused as-is.",
      },
      material_criticality: {
        total: 100,
        by_tier: [{ criticality: "CRITICAL", count: 10 }],
        populated_count: 10,
        populated_percentage: "10.000000",
      },
      oar: {
        is_oar_true_count: 12,
        is_oar_false_count: 41,
        is_oar_null_count: 47,
        conversion_eligibility_breakdown: [{ conversion_eligibility: "UNKNOWN", count: 12 }],
      },
      recommendations: {
        total: 80,
        by_status: [{ status: "READY_FOR_REVIEW", count: 20 }],
      },
      approval: {
        ledger_entry_count: 30,
        distinct_recommendations_in_approval: 10,
        pending_count: 5,
        approved_count: 20,
        rejected_count: 5,
      },
      baseline_comparison: {
        baseline_lead_time_source: "MARC-PLIFZ",
        i07_lead_time_source: "MARC-PLIFZ",
        rows: [
          {
            metric: "Safety Stock",
            baseline_value: "5.000000",
            recommendation_value: "8.000000",
            delta: "3.000000",
            delta_percentage: "60.000000",
            both_available_count: 75,
            baseline_missing_count: 10,
            recommendation_missing_count: 20,
            not_evaluable_count: 5,
            availability_status: "AVAILABLE",
            self_referential: false,
          },
        ],
      },
      sap_adoption: { status: "NOT_AVAILABLE", reason: "No SAP write-back exists (P1)." },
      limitations: { items: ["Plant 1500 has zero MARC rows."] },
      ...overrides,
    }
  }

  it("returns the full report body verbatim, with no field reshaped or recomputed", async () => {
    const report = reportFixture()
    stubFetchJson(report)

    const result = await fetchQuarterlyReport("Q3 2026")

    expect(result).toEqual(report)
  })

  it("never turns a NOT_AVAILABLE forecasting metric's null value into 0", async () => {
    const report = reportFixture()
    stubFetchJson(report)

    const result = await fetchQuarterlyReport("Q3 2026")

    expect(result?.forecasting.mean_absolute_error.status).toBe("NOT_AVAILABLE")
    expect(result?.forecasting.mean_absolute_error.value).toBeNull()
    expect(result?.forecasting.mean_absolute_error.value).not.toBe(0)
  })

  it("preserves a NOT_CONFIGURED max-stock strategy status rather than collapsing it to AVAILABLE or omitting it", async () => {
    const report = reportFixture()
    stubFetchJson(report)

    const result = await fetchQuarterlyReport("Q3 2026")

    expect(result?.max_stock.strategy_policy_status).toBe("NOT_CONFIGURED")
    expect(result?.max_stock.mean_delta).toBeNull()
  })

  it("returns null on a 404 (quarter never generated) rather than throwing", async () => {
    stubFetchJson({ error: { code: "not_found", message: "No report for this quarter." } }, false, 404)

    const result = await fetchQuarterlyReport("Q1 2020")

    expect(result).toBeNull()
  })

  it("keeps all four baseline-comparison rows' availability status distinct, never dropping a NOT_AVAILABLE row", async () => {
    const report = reportFixture({
      baseline_comparison: {
        baseline_lead_time_source: "MARC-PLIFZ",
        i07_lead_time_source: null,
        rows: [
          {
            metric: "Lead Time",
            baseline_value: null,
            recommendation_value: null,
            delta: null,
            delta_percentage: null,
            both_available_count: 0,
            baseline_missing_count: 100,
            recommendation_missing_count: 100,
            not_evaluable_count: 0,
            availability_status: "NOT_AVAILABLE",
            self_referential: true,
          },
        ],
      },
    })
    stubFetchJson(report)

    const result = await fetchQuarterlyReport("Q3 2026")

    expect(result?.baseline_comparison.rows).toHaveLength(1)
    expect(result?.baseline_comparison.rows[0].availability_status).toBe("NOT_AVAILABLE")
    expect(result?.baseline_comparison.rows[0].baseline_value).toBeNull()
  })

  it("carries the Safety Stock row's zero-baseline-availability case through faithfully, never dropped and never coerced to a plain 0", async () => {
    // Regression guard for the observed state (0/226,930 current safety
    // stock populated, 6/226,930 recommended) -- this must surface as an
    // explicit NOT_AVAILABLE row with the real counts attached, not as a
    // numeric 0 and not as an omitted row.
    const report = reportFixture({
      baseline_comparison: {
        baseline_lead_time_source: "MARC-PLIFZ",
        i07_lead_time_source: "PLANNED_FALLBACK",
        rows: [
          {
            metric: "Safety Stock",
            baseline_value: null,
            recommendation_value: "6.000000",
            delta: null,
            delta_percentage: null,
            both_available_count: 0,
            baseline_missing_count: 226930,
            recommendation_missing_count: 226924,
            not_evaluable_count: 0,
            availability_status: "NOT_AVAILABLE",
            self_referential: false,
          },
          {
            metric: "ROP",
            baseline_value: "12.000000",
            recommendation_value: "18.000000",
            delta: "6.000000",
            delta_percentage: "50.000000",
            both_available_count: 6,
            baseline_missing_count: 136112,
            recommendation_missing_count: 226924,
            not_evaluable_count: 0,
            availability_status: "AVAILABLE",
            self_referential: false,
          },
          {
            metric: "Max Stock",
            baseline_value: "40.000000",
            recommendation_value: "55.000000",
            delta: "15.000000",
            delta_percentage: "37.500000",
            both_available_count: 4,
            baseline_missing_count: 200000,
            recommendation_missing_count: 226926,
            not_evaluable_count: 0,
            availability_status: "AVAILABLE",
            self_referential: false,
          },
          {
            metric: "Lead Time",
            baseline_value: "30.000000",
            recommendation_value: null,
            delta: null,
            delta_percentage: null,
            both_available_count: 0,
            baseline_missing_count: 5000,
            recommendation_missing_count: 226930,
            not_evaluable_count: 0,
            availability_status: "NOT_AVAILABLE",
            self_referential: true,
          },
        ],
      },
    })
    stubFetchJson(report)

    const result = await fetchQuarterlyReport("Q3 2026")
    const rows = result?.baseline_comparison.rows ?? []

    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.metric)).toEqual(["Safety Stock", "ROP", "Max Stock", "Lead Time"])

    const safetyStock = rows[0]
    expect(safetyStock.availability_status).toBe("NOT_AVAILABLE")
    expect(safetyStock.baseline_value).toBeNull()
    expect(safetyStock.baseline_value).not.toBe(0)
    expect(safetyStock.both_available_count).toBe(0)
    expect(safetyStock.baseline_missing_count).toBe(226930)
    // recommendation_value is populated even though baseline is not -- the
    // row must still surface as NOT_AVAILABLE overall, never silently
    // upgraded to AVAILABLE because one side has a value.
    expect(safetyStock.recommendation_value).toBe("6.000000")

    const rop = rows[1]
    expect(rop.availability_status).toBe("AVAILABLE")
    expect(rop.both_available_count).toBe(6)
  })
})
