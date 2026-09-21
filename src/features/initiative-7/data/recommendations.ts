// Mock recommendation dataset — deterministic, built against real Initiative
// 9 catalog materials (REFERENCE_MATERIAL_IDS) so Material 360 and
// cross-initiative links land on real entries. No SAP/backend calls; this is
// the single source of truth the rest of Initiative 7 reads from.

import type { MaterialReference } from "@/lib/domain/contracts"
import { getMaterialById } from "@/lib/shared-data/material-catalog"
import { formatZAR } from "@/lib/utils"
import { buildWorkflow } from "@/features/initiative-7/data/approval-chain"
import {
  DEMAND_PATTERN_NOTE,
  type Circuit,
  type Criticality,
  type DemandPattern,
  type Recommendation,
  type RecommendationFactor,
} from "@/features/initiative-7/types/inventory"
import type { RiskLevel } from "@/components/shared/risk-badge"
function materialRef(materialId: string): MaterialReference {
  const mat = getMaterialById(materialId)
  if (!mat) throw new Error(`Initiative 7: unknown material ${materialId}`)
  return { materialId: mat.id, materialCode: mat.id, description: mat.description }
}

/** Expected demand consumed while waiting on a replenishment lead time. */
export function expectedLeadTimeDemand(rec: Pick<Recommendation, "avgDailyConsumption" | "leadTimeDays">): number {
  return Math.ceil(rec.avgDailyConsumption * rec.leadTimeDays)
}

function buildFactors(input: {
  consumptionSummary: string
  demandPattern: DemandPattern
  leadTimeDays: number
  leadTimeVarianceDays: number
  criticality: Criticality
  unitPrice: number
  serviceLevelTarget: number
}): RecommendationFactor[] {
  return [
    { label: "Consumption history", detail: input.consumptionSummary },
    {
      label: "Demand variability",
      detail: `Classified as ${input.demandPattern} demand — ${DEMAND_PATTERN_NOTE[input.demandPattern]}.`,
    },
    {
      label: "Lead-time mean / variance",
      detail: `${input.leadTimeDays}-day mean replenishment lead time, ±${input.leadTimeVarianceDays} days observed variance.`,
    },
    {
      label: "Criticality",
      detail: `${input.criticality} — equipment downtime impact drives the safety-stock weighting for this position.`,
    },
    {
      label: "Unit price",
      detail: `${formatZAR(input.unitPrice)} per unit, weighed against holding cost vs. stockout cost.`,
    },
    {
      label: "Service-level target",
      detail: `${Math.round(input.serviceLevelTarget * 100)}% target fill rate for this criticality tier.`,
    },
  ]
}

const SCENARIO_RECOMMENDATIONS: Recommendation[] = [
  // Scenario A — critical material, long/variable lead time, low current ROP,
  // high criticality: recommendation significantly increases safety stock.
  {
    id: "REC-1001",
    material: materialRef("500-14892"),
    plantId: "PLANT-GBG",
    circuit: "Milling",
    criticality: "Critical",
    demandPattern: "Intermittent",
    risk: "critical",
    status: "In Approval",
    current: { rop: 2, safetyStock: 1, maxStock: 4 },
    recommended: { rop: 7, safetyStock: 4, maxStock: 12 },
    avgDailyConsumption: 0.12,
    leadTimeDays: 24,
    leadTimeVarianceDays: 8,
    serviceLevelTarget: 0.98,
    unitPrice: 48200,
    annualConsumption: 44,
    workingCapitalImpact: -385_600,
    consumptionHistory: [
      { period: "Mar", qty: 1 },
      { period: "Apr", qty: 0 },
      { period: "May", qty: 2 },
      { period: "Jun", qty: 1 },
      { period: "Jul", qty: 0 },
      { period: "Aug", qty: 2 },
    ],
    factors: buildFactors({
      consumptionSummary:
        "6 units consumed over the last 12 months against only 2 units on hand at last count — two stockouts logged against the milling pump train.",
      demandPattern: "Intermittent",
      leadTimeDays: 24,
      leadTimeVarianceDays: 8,
      criticality: "Critical",
      unitPrice: 48200,
      serviceLevelTarget: 0.98,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 71,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 89,
      },
      selected: "challenger",
      rationale:
        "Intermittent, high-criticality demand is where the baseline underweights tail risk — the challenger's higher hit rate on rare-but-severe stockouts won selection.",
    },
    workflow: buildWorkflow([
      ["done", "Approved 6d ago"],
      ["done", "Approved 4d ago"],
      ["active", "Escalated to HOD — critical stockout risk", "danger"],
      ["pending"],
    ]),
    generatedAt: "18 Aug 2026 · 09:05 AM",
    scenarioNote:
      "Scenario A — critical material, long/variable lead time, low current ROP: recommendation raises safety stock materially.",
  },

  // Scenario B — slow-moving, expensive material with excessive Max Stock:
  // recommendation reduces inventory and releases working capital.
  {
    id: "REC-1002",
    material: materialRef("500-55210"),
    plantId: "PLANT-BMM",
    circuit: "Conveying",
    criticality: "Medium",
    demandPattern: "Slow-Moving",
    risk: "low",
    status: "Approved",
    current: { rop: 3, safetyStock: 2, maxStock: 10 },
    recommended: { rop: 2, safetyStock: 1, maxStock: 3 },
    avgDailyConsumption: 0.02,
    leadTimeDays: 25,
    leadTimeVarianceDays: 5,
    serviceLevelTarget: 0.9,
    unitPrice: 98_700,
    annualConsumption: 1,
    workingCapitalImpact: 690_900,
    consumptionHistory: [
      { period: "Mar", qty: 0 },
      { period: "Apr", qty: 0 },
      { period: "May", qty: 1 },
      { period: "Jun", qty: 0 },
      { period: "Jul", qty: 0 },
      { period: "Aug", qty: 0 },
    ],
    factors: buildFactors({
      consumptionSummary:
        "Only 1 unit consumed in the trailing 12 months against 10 units carried at max stock — 9 units have sat idle for over 6 months.",
      demandPattern: "Slow-Moving",
      leadTimeDays: 25,
      leadTimeVarianceDays: 5,
      criticality: "Medium",
      unitPrice: 98_700,
      serviceLevelTarget: 0.9,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 84,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 85,
      },
      selected: "champion",
      rationale:
        "The two models are within 1pt of each other on this slow-moving position — the simpler, more explainable baseline was preferred for a working-capital release decision.",
    },
    workflow: buildWorkflow([
      ["done", "Approved 12d ago"],
      ["done", "Approved 9d ago"],
      ["done", "Approved 5d ago"],
      ["done", "Approved 2d ago"],
    ]),
    generatedAt: "3 Aug 2026 · 11:20 AM",
    scenarioNote:
      "Scenario B — slow-moving, expensive material with excessive Max Stock: recommendation reduces inventory and releases working capital.",
  },

  {
    id: "REC-1003",
    material: materialRef("500-15134"),
    plantId: "PLANT-GBG",
    circuit: "Milling",
    criticality: "High",
    demandPattern: "Lumpy",
    risk: "high",
    status: "Pending Review",
    current: { rop: 2, safetyStock: 1, maxStock: 5 },
    recommended: { rop: 5, safetyStock: 3, maxStock: 9 },
    avgDailyConsumption: 0.05,
    leadTimeDays: 35,
    leadTimeVarianceDays: 11,
    serviceLevelTarget: 0.95,
    unitPrice: 61_300,
    annualConsumption: 18,
    workingCapitalImpact: -245_200,
    consumptionHistory: [
      { period: "Mar", qty: 0 },
      { period: "Apr", qty: 2 },
      { period: "May", qty: 0 },
      { period: "Jun", qty: 0 },
      { period: "Jul", qty: 3 },
      { period: "Aug", qty: 0 },
    ],
    factors: buildFactors({
      consumptionSummary:
        "Demand arrives in occasional multi-unit bursts (2-3 at a time) rather than steadily — 5 units consumed across 2 events in the last 6 months.",
      demandPattern: "Lumpy",
      leadTimeDays: 35,
      leadTimeVarianceDays: 11,
      criticality: "High",
      unitPrice: 61_300,
      serviceLevelTarget: 0.95,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 68,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 86,
      },
      selected: "challenger",
      rationale:
        "Lumpy demand breaks the baseline's normal-distribution assumption — the challenger's event-based model tracks the burst pattern far better.",
    },
    workflow: buildWorkflow([
      ["done", "Submitted 3d ago"],
      ["active", "Reminder sent 2d ago"],
      ["pending"],
      ["pending"],
    ]),
    generatedAt: "27 Aug 2026 · 02:40 PM",
  },

  {
    id: "REC-1004",
    material: materialRef("500-08823"),
    plantId: "PLANT-GBG",
    circuit: "Pumping",
    criticality: "High",
    demandPattern: "Erratic",
    risk: "high",
    status: "In Approval",
    current: { rop: 3, safetyStock: 1, maxStock: 6 },
    recommended: { rop: 8, safetyStock: 3, maxStock: 12 },
    avgDailyConsumption: 0.15,
    leadTimeDays: 30,
    leadTimeVarianceDays: 9,
    serviceLevelTarget: 0.96,
    unitPrice: 74_500,
    annualConsumption: 55,
    workingCapitalImpact: -447_000,
    consumptionHistory: [
      { period: "Mar", qty: 3 },
      { period: "Apr", qty: 6 },
      { period: "May", qty: 2 },
      { period: "Jun", qty: 7 },
      { period: "Jul", qty: 3 },
      { period: "Aug", qty: 5 },
    ],
    factors: buildFactors({
      consumptionSummary:
        "Wear-driven demand on the slurry pump train swings between 2 and 7 units a month — high month-to-month variability at a steady frequency.",
      demandPattern: "Erratic",
      leadTimeDays: 30,
      leadTimeVarianceDays: 9,
      criticality: "High",
      unitPrice: 74_500,
      serviceLevelTarget: 0.96,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 73,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 91,
      },
      selected: "challenger",
      rationale: "High month-to-month variability at steady frequency is exactly the pattern the challenger was trained to track.",
    },
    workflow: buildWorkflow([
      ["done", "Approved 5d ago"],
      ["done", "Approved 3d ago"],
      ["active"],
      ["pending"],
    ]),
    generatedAt: "22 Aug 2026 · 08:15 AM",
  },

  {
    id: "REC-1005",
    material: materialRef("500-22140"),
    plantId: "PLANT-BMM",
    circuit: "Conveying",
    criticality: "Medium",
    demandPattern: "Smooth",
    risk: "medium",
    status: "Pending Review",
    current: { rop: 6, safetyStock: 3, maxStock: 14 },
    recommended: { rop: 5, safetyStock: 2, maxStock: 10 },
    avgDailyConsumption: 0.4,
    leadTimeDays: 7,
    leadTimeVarianceDays: 2,
    serviceLevelTarget: 0.92,
    unitPrice: 8_400,
    annualConsumption: 146,
    workingCapitalImpact: 33_600,
    consumptionHistory: [
      { period: "Mar", qty: 12 },
      { period: "Apr", qty: 13 },
      { period: "May", qty: 11 },
      { period: "Jun", qty: 12 },
      { period: "Jul", qty: 14 },
      { period: "Aug", qty: 12 },
    ],
    factors: buildFactors({
      consumptionSummary: "Steady 11-14 units/month withdrawal on the idler bearing pool — one of the most predictable positions in the catalog.",
      demandPattern: "Smooth",
      leadTimeDays: 7,
      leadTimeVarianceDays: 2,
      criticality: "Medium",
      unitPrice: 8_400,
      serviceLevelTarget: 0.92,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 92,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 93,
      },
      selected: "champion",
      rationale: "Smooth, short-lead-time demand is the baseline's best case — the marginal ML gain doesn't justify the added complexity here.",
    },
    workflow: buildWorkflow([
      ["active", "Awaiting acknowledgement"],
      ["pending"],
      ["pending"],
      ["pending"],
    ]),
    generatedAt: "29 Aug 2026 · 10:50 AM",
  },

  {
    id: "REC-1006",
    material: materialRef("500-31005"),
    plantId: "PLANT-GBG",
    circuit: "Flotation",
    criticality: "Medium",
    demandPattern: "Intermittent",
    risk: "medium",
    status: "Pending Review",
    current: { rop: 2, safetyStock: 1, maxStock: 5 },
    recommended: { rop: 4, safetyStock: 2, maxStock: 7 },
    avgDailyConsumption: 0.1,
    leadTimeDays: 14,
    leadTimeVarianceDays: 4,
    serviceLevelTarget: 0.95,
    unitPrice: 18_900,
    annualConsumption: 36,
    workingCapitalImpact: -37_800,
    consumptionHistory: [
      { period: "Mar", qty: 1 },
      { period: "Apr", qty: 0 },
      { period: "May", qty: 1 },
      { period: "Jun", qty: 2 },
      { period: "Jul", qty: 0 },
      { period: "Aug", qty: 1 },
    ],
    factors: buildFactors({
      consumptionSummary: "Repeated calibration drift on the reagent-dosing loop is driving more frequent transmitter swaps than the original stocking plan assumed.",
      demandPattern: "Intermittent",
      leadTimeDays: 14,
      leadTimeVarianceDays: 4,
      criticality: "Medium",
      unitPrice: 18_900,
      serviceLevelTarget: 0.95,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 70,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 84,
      },
      selected: "challenger",
      rationale: "The challenger picked up the recent drift-driven swap frequency faster than the baseline's trailing average.",
    },
    workflow: buildWorkflow([
      ["active", "Flagged by OAR Utilization for reclassification review"],
      ["pending"],
      ["pending"],
      ["pending"],
    ]),
    generatedAt: "30 Aug 2026 · 03:10 PM",
  },

  {
    id: "REC-1007",
    material: materialRef("500-40011"),
    plantId: "PLANT-BMM",
    circuit: "Milling",
    criticality: "Critical",
    demandPattern: "Lumpy",
    risk: "critical",
    status: "In Approval",
    current: { rop: 1, safetyStock: 0, maxStock: 2 },
    recommended: { rop: 4, safetyStock: 2, maxStock: 6 },
    avgDailyConsumption: 0.03,
    leadTimeDays: 40,
    leadTimeVarianceDays: 14,
    serviceLevelTarget: 0.98,
    unitPrice: 142_000,
    annualConsumption: 11,
    workingCapitalImpact: -568_000,
    consumptionHistory: [
      { period: "Mar", qty: 0 },
      { period: "Apr", qty: 1 },
      { period: "May", qty: 0 },
      { period: "Jun", qty: 0 },
      { period: "Jul", qty: 1 },
      { period: "Aug", qty: 0 },
    ],
    factors: buildFactors({
      consumptionSummary: "Mill trunnion bearing failures are rare but severe — 2 replacements in 6 months, each preceded by an unplanned mill stoppage.",
      demandPattern: "Lumpy",
      leadTimeDays: 40,
      leadTimeVarianceDays: 14,
      criticality: "Critical",
      unitPrice: 142_000,
      serviceLevelTarget: 0.98,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 66,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 88,
      },
      selected: "challenger",
      rationale: "Zero safety stock on a 40-day-lead-time, mill-stopping component is the highest-severity gap in the catalog — the challenger's tail-risk handling was decisive.",
    },
    workflow: buildWorkflow([
      ["done", "Approved 4d ago"],
      ["done", "Approved 2d ago"],
      ["active"],
      ["pending"],
    ]),
    generatedAt: "25 Aug 2026 · 07:30 AM",
  },

  {
    id: "REC-1008",
    material: materialRef("500-19560"),
    plantId: "PLANT-BMM",
    circuit: "Filtration",
    criticality: "Low",
    demandPattern: "Smooth",
    risk: "low",
    status: "Implemented",
    current: { rop: 1, safetyStock: 0, maxStock: 3 },
    recommended: { rop: 3, safetyStock: 1, maxStock: 4 },
    avgDailyConsumption: 0.06,
    leadTimeDays: 28,
    leadTimeVarianceDays: 6,
    serviceLevelTarget: 0.9,
    unitPrice: 89_400,
    annualConsumption: 22,
    workingCapitalImpact: -89_400,
    consumptionHistory: [
      { period: "Mar", qty: 2 },
      { period: "Apr", qty: 1 },
      { period: "May", qty: 2 },
      { period: "Jun", qty: 1 },
      { period: "Jul", qty: 2 },
      { period: "Aug", qty: 1 },
    ],
    factors: buildFactors({
      consumptionSummary: "Steady low-volume consumption on the reagent-dosing control valve, already trending toward the new reorder point since implementation.",
      demandPattern: "Smooth",
      leadTimeDays: 28,
      leadTimeVarianceDays: 6,
      criticality: "Low",
      unitPrice: 89_400,
      serviceLevelTarget: 0.9,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 90,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 90,
      },
      selected: "champion",
      rationale: "Dead heat on accuracy — the baseline was kept for its simplicity and easier SAP MRP-view explainability.",
    },
    workflow: buildWorkflow([
      ["done", "Approved 18d ago"],
      ["done", "Approved 15d ago"],
      ["done", "Approved 11d ago"],
      ["done", "Approved 9d ago"],
    ]),
    generatedAt: "10 Aug 2026 · 09:00 AM",
  },

  {
    id: "REC-1009",
    material: materialRef("500-31048"),
    plantId: "PLANT-GBG",
    circuit: "Filtration",
    criticality: "Medium",
    demandPattern: "Intermittent",
    risk: "medium",
    status: "Returned",
    current: { rop: 2, safetyStock: 1, maxStock: 5 },
    recommended: { rop: 3, safetyStock: 1, maxStock: 5 },
    avgDailyConsumption: 0.08,
    leadTimeDays: 18,
    leadTimeVarianceDays: 5,
    serviceLevelTarget: 0.9,
    unitPrice: 21_400,
    annualConsumption: 4,
    workingCapitalImpact: 0,
    consumptionHistory: [
      { period: "Mar", qty: 0 },
      { period: "Apr", qty: 0 },
      { period: "May", qty: 1 },
      { period: "Jun", qty: 0 },
      { period: "Jul", qty: 0 },
      { period: "Aug", qty: 0 },
    ],
    factors: buildFactors({
      consumptionSummary: "This alternate transmitter part number was only introduced at this plant 3 months ago — the catalog has a single consumption event to learn from.",
      demandPattern: "Intermittent",
      leadTimeDays: 18,
      leadTimeVarianceDays: 5,
      criticality: "Medium",
      unitPrice: 21_400,
      serviceLevelTarget: 0.9,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 58,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 61,
      },
      selected: "champion",
      rationale: "Neither model has enough history to be trusted yet — treated as provisional pending the cold-start review below.",
    },
    workflow: buildWorkflow([
      ["active", "Re-submission requested 6d ago"],
      ["returned", "Returned 7d ago — insufficient consumption history to confirm ROP"],
      ["pending"],
      ["pending"],
    ]),
    oarColdStart: {
      similarMaterials: ["500-31005 (Pressure Transmitter, Cerabar PMC21)", "500-31090 (Pressure Transmitter, 2600T)"],
      suggestedRop: 2,
      suggestedSafetyStock: 1,
      confidence: "Low",
      factors: [
        "Analogous transmitter family at the same plant provides an initial demand proxy",
        "Manufacturer-quoted MTBF used in place of observed failure history",
        "Single consumption event to date — statistically insufficient sample",
      ],
      note: "Requires human review before this recommendation is approved past Engineering Manager.",
    },
    generatedAt: "21 Aug 2026 · 01:25 PM",
  },

  {
    id: "REC-1010",
    material: materialRef("500-08841"),
    plantId: "PLANT-BMM",
    circuit: "Pumping",
    criticality: "High",
    demandPattern: "Erratic",
    risk: "high",
    status: "Rejected",
    current: { rop: 4, safetyStock: 2, maxStock: 8 },
    recommended: { rop: 5, safetyStock: 2, maxStock: 6 },
    avgDailyConsumption: 0.1,
    leadTimeDays: 24,
    leadTimeVarianceDays: 7,
    serviceLevelTarget: 0.95,
    unitPrice: 58_200,
    annualConsumption: 30,
    workingCapitalImpact: 116_400,
    consumptionHistory: [
      { period: "Mar", qty: 2 },
      { period: "Apr", qty: 4 },
      { period: "May", qty: 1 },
      { period: "Jun", qty: 3 },
      { period: "Jul", qty: 5 },
      { period: "Aug", qty: 2 },
    ],
    factors: buildFactors({
      consumptionSummary: "Impeller wear rate has increased since a recent ore-blend change — 17 units consumed in the last 6 months, up from a prior average of 10.",
      demandPattern: "Erratic",
      leadTimeDays: 24,
      leadTimeVarianceDays: 7,
      criticality: "High",
      unitPrice: 58_200,
      serviceLevelTarget: 0.95,
    }),
    championChallenger: {
      champion: {
        name: "Statistical Baseline",
        description: "(s, S) reorder-point model with normal-demand safety stock at target service level.",
        accuracyPct: 72,
      },
      challenger: {
        name: "Challenger Model",
        description: "Gradient-boosted demand-sensing model trained on work-order and failure-code history.",
        accuracyPct: 87,
      },
      selected: "challenger",
      rationale: "The challenger correctly flagged the ore-blend-driven wear-rate shift the baseline's trailing average was still smoothing out.",
    },
    workflow: buildWorkflow([
      ["done", "Approved 7d ago"],
      ["done", "Approved 5d ago"],
      ["rejected", "Rejected — max-stock reduction not justified against current wear-rate trend"],
      ["skipped"],
    ]),
    generatedAt: "19 Aug 2026 · 04:45 PM",
  },
]

export const RECOMMENDATIONS: Recommendation[] = SCENARIO_RECOMMENDATIONS

export function getRecommendationById(id: string): Recommendation | undefined {
  return RECOMMENDATIONS.find((r) => r.id === id)
}

export function getRecommendationsForMaterial(materialId: string): Recommendation[] {
  return RECOMMENDATIONS.filter((r) => r.material.materialId === materialId)
}

export const CIRCUIT_LIST: Circuit[] = Array.from(new Set(RECOMMENDATIONS.map((r) => r.circuit)))

export type { RiskLevel }
