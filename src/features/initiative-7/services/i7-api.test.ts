// Part 21 — I07 frontend/backend integration.
//
// Unit tests for the mapper functions in i7-api.ts -- the one place backend
// field values are reshaped into the existing Recommendation type. These
// assert the mapping is faithful (no invented values, no recomputed business
// numbers) rather than testing network behaviour, which apiFetch/ApiError
// already own.

import { describe, expect, it } from "vitest"

import {
  mapDetailToRecommendation,
  mapStatus,
  mapSummaryToRecommendation,
} from "./i7-api"
import type { ApiRecommendationDetail, ApiRecommendationSummary } from "@/features/initiative-7/types/api"

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
})
