// The Overview's information cards under the formulas in force.
//
// `OVERVIEW_INFO` (overview-info.ts) is the text for the built-in formulas and is returned as it is
// when nobody has changed anything -- including its hand-checked real examples. Once a saved version
// is active, the formula lines, the window / lookback wording and the worked example come from the
// backend instead, so a card never describes a rule the numbers are no longer computed with.

import {
  OVERVIEW_INFO,
  type OverviewInfoExample,
  type OverviewInfoId,
  type OverviewInfoSpec,
} from "@/features/initiative-7/data/overview-info"
import type { ActiveFormulas, KpiKey } from "@/features/initiative-7/types/kpi-formulas"

const KPI_OF_INFO: Partial<Record<OverviewInfoId, KpiKey>> = {
  stockoutRisk: "stockout",
  stockoutDistribution: "stockout",
  stockoutByPlant: "stockout",
  excessInventory: "excess",
  excessByPlant: "excess",
  workingCapital: "working_capital",
  adoptedRecommendation: "adoption",
  sapAdoption: "adoption",
}

const NO_EXAMPLE: OverviewInfoExample = {
  kind: "illustrative",
  material: "No example available yet",
  inputs: [],
  substitution: [],
  result: "A worked example appears here once a real material fits the new formula.",
}

/** "2 years" for 730 days, "1 year" for 365, otherwise the days -- the way the card has always said it. */
export function describeSpan(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365
    return years === 1 ? "1 year" : `${years} years`
  }
  return `${days} days`
}

function stockoutSteps(active: ActiveFormulas): string[] {
  return [
    `Only materials issued within ${describeSpan(active.lookbackDays)} are judged (last issue within that time).`,
    "Lead time is how long a new order takes to arrive.",
    "If stock, usage or lead time is missing the material is shown as “need data” — it is never counted as safe or at risk.",
  ]
}

function exampleFor(active: ActiveFormulas, kpi: KpiKey): OverviewInfoExample {
  const example = active.examples[kpi]
  if (!example) return NO_EXAMPLE
  return {
    kind: "real",
    // A plant code reads "plant 1300"; a portfolio-wide example already says "All plants".
    material: `${example.material} · ${/^\d/.test(example.plant) ? `plant ${example.plant}` : example.plant}`,
    inputs: example.inputs,
    substitution: example.substitution,
    result: example.result,
  }
}

/** The information card for `id`, under `active`. Cards with no formula (adoption) are never changed. */
export function overviewInfoFor(id: OverviewInfoId, active: ActiveFormulas | null): OverviewInfoSpec {
  const base = OVERVIEW_INFO[id]
  const kpi = KPI_OF_INFO[id]
  if (!active || active.isDefault || !kpi) return base
  const lines = active.formulaLines[kpi]
  if (!lines || lines.length === 0) return base

  const spec: OverviewInfoSpec = { ...base, formula: lines, example: exampleFor(active, kpi) }

  if (kpi === "stockout") {
    spec.steps =
      id === "stockoutRisk"
        ? [...stockoutSteps(active), "The percentage is at-risk materials ÷ materials that could be judged."]
        : id === "stockoutDistribution"
          ? [
              "High: the at-risk rule is true (the High Stockout Risk card’s count).",
              "Low: the judged materials that are not at risk.",
              "Each share is the count ÷ all judged materials. Materials that need data are named under the chart and are not counted as Low.",
            ]
          : base.steps
    if (id === "stockoutByPlant") spec.formula = [...lines, "Bar height = at-risk materials in that plant"]
    if (id === "stockoutDistribution" || id === "stockoutByPlant") {
      spec.example = {
        ...spec.example,
        result:
          id === "stockoutDistribution"
            ? `${spec.example.result} (This material is counted in the High bar only if it is at risk.)`
            : spec.example.result,
      }
    }
  }
  if (id === "excessByPlant") spec.formula = [...lines, "Bar height = excess candidates in that plant"]
  if (kpi === "excess") {
    spec.steps = [
      "Current maximum is the value held in SAP today; recommended maximum is what Spares AI calculated.",
      "A material whose figures are missing is not counted.",
      id === "excessInventory"
        ? "The percentage is candidates ÷ all recommendations, so it is a minimum."
        : "It counts materials, not money.",
    ]
  }
  if (kpi === "adoption") spec.steps = base.steps
  if (kpi === "working_capital") {
    spec.steps = [
      "Positive: the recommendation lowers the reorder point, so cash is released.",
      "Negative: the recommendation raises it, so more cash is invested in stock.",
      "A material whose figures are missing is not counted.",
      "It adds up every recommendation, whether or not it has been approved.",
    ]
  }
  return spec
}
