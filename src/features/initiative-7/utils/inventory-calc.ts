// Pure aggregate calculations over the mock recommendation dataset — kept
// separate from the data file so pages/selectors can share one source of
// derived numbers instead of recomputing ad hoc.

import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { ConsumptionPoint, Recommendation, RecommendationStatus } from "@/features/initiative-7/types/inventory"

export const OPEN_STATUSES: RecommendationStatus[] = ["Pending Review", "In Approval", "Returned"]

export function isOpenRecommendation(rec: Recommendation): boolean {
  return OPEN_STATUSES.includes(rec.status)
}

export function countByCriticality(recs: Recommendation[] = RECOMMENDATIONS, level: Recommendation["criticality"]) {
  return recs.filter((r) => r.criticality === level).length
}

export function countAtStockoutRisk(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs.filter((r) => r.risk === "high" || r.risk === "critical").length
}

export function countExcessCandidates(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs.filter((r) => r.recommended.maxStock < r.current.maxStock).length
}

export function countAwaitingApproval(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs.filter(isOpenRecommendation).length
}

/** Net ZAR working-capital impact across every recommendation except
 * rejected ones (a rejected recommendation was never applied). */
export function netWorkingCapitalImpact(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs
    .filter((r) => r.status !== "Rejected")
    .reduce((sum, r) => sum + r.workingCapitalImpact, 0)
}

export function formatSignedZAR(amount: number): string {
  const sign = amount >= 0 ? "+" : "-"
  const abs = Math.round(Math.abs(amount))
  return `${sign}R ${abs.toLocaleString("en-US")}`
}

export function statusDistribution(recs: Recommendation[] = RECOMMENDATIONS) {
  const counts = new Map<RecommendationStatus, number>()
  for (const r of recs) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
}

export function circuitExposure(recs: Recommendation[] = RECOMMENDATIONS) {
  const map = new Map<string, { circuit: string; atRisk: number; healthy: number }>()
  for (const r of recs) {
    const entry = map.get(r.circuit) ?? { circuit: r.circuit, atRisk: 0, healthy: 0 }
    if (r.risk === "high" || r.risk === "critical") entry.atRisk += 1
    else entry.healthy += 1
    map.set(r.circuit, entry)
  }
  return Array.from(map.values())
}

export function deriveOverallHealth(recs: Recommendation[] = RECOMMENDATIONS): "healthy" | "attention" | "critical" {
  const criticalOpen = recs.filter(
    (r) => r.risk === "critical" && r.status !== "Implemented" && r.status !== "Rejected"
  ).length
  if (criticalOpen >= 2) return "critical"
  if (countAwaitingApproval(recs) > 0) return "attention"
  return "healthy"
}

// ---------------------------------------------------------------------------
// Dataset clock. Mock dates are pre-formatted strings, so "how long has this
// been waiting" is measured against a fixed reference date rather than the
// real one — otherwise the demo's waiting times drift every day.
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** The dataset's "today". Every waiting/aging figure is measured from here. */
export const REFERENCE_DATE = new Date(2026, 8, 3)

export const REFERENCE_DATE_LABEL = "3 Sept 2026"

/** Parses the leading date out of a label like "18 Aug 2026 · 09:05 AM". */
export function parseDatasetDate(label: string): Date | null {
  const match = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(label.trim())
  if (!match) return null
  const month = MONTHS.indexOf(match[2].slice(0, 3))
  if (month === -1) return null
  return new Date(Number(match[3]), month, Number(match[1]))
}

/** Date portion only, e.g. "18 Aug 2026 · 09:05 AM" -> "18 Aug 2026". */
export function datasetDateLabel(label: string): string {
  const parsed = parseDatasetDate(label)
  if (!parsed) return label
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`
}

/** Whole days between a dataset date label and the reference date. */
export function waitingDays(label: string): number {
  const parsed = parseDatasetDate(label)
  if (!parsed) return 0
  const ms = REFERENCE_DATE.getTime() - parsed.getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** Approval is expected within a week of submission — illustrative, not an
 * agreed SLA. Anything at or past that reads as due today. */
export function approvalDueLabel(submittedLabel: string): { label: string; overdue: boolean } {
  const parsed = parseDatasetDate(submittedLabel)
  if (!parsed) return { label: "—", overdue: false }
  const due = new Date(parsed.getTime() + 7 * 86_400_000)
  if (due.getTime() <= REFERENCE_DATE.getTime()) return { label: "Today", overdue: true }
  return {
    label: `${due.getDate()} ${MONTHS[due.getMonth()]} ${due.getFullYear()}`,
    overdue: false,
  }
}

export type PipelineHealth = "On track" | "Slow" | "Stuck"

/** Illustrative thresholds, not an agreed SLA: slow past 7 days, stuck past 14. */
export function pipelineHealth(days: number): PipelineHealth {
  if (days > 14) return "Stuck"
  if (days > 7) return "Slow"
  return "On track"
}

/**
 * Inverse standard-normal CDF (Acklam's rational approximation, ~1e-9
 * accuracy) — the "safety factor" behind a service-level target, e.g. a 98%
 * target implies holding cover out to roughly 2.05 standard deviations of
 * demand during lead time.
 */
function inverseNormalCdf(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}

/** Z-factor implied by a service-level target, e.g. 0.98 -> 2.05. Rounded to
 * 2 decimal places — illustrative precision, not a certified statistical output. */
export function serviceLevelZFactor(serviceLevelTarget: number): number {
  return Math.round(inverseNormalCdf(serviceLevelTarget) * 100) / 100
}

/** Sums consumptionHistory across recommendations, period-aligned — every
 * material in the mock dataset shares the same six period labels. */
export function aggregateConsumption(recs: Recommendation[] = RECOMMENDATIONS): ConsumptionPoint[] {
  if (recs.length === 0) return []
  return recs[0].consumptionHistory.map((point, i) => ({
    period: point.period,
    qty: recs.reduce((sum, r) => sum + (r.consumptionHistory[i]?.qty ?? 0), 0),
  }))
}

/**
 * One-step-ahead simple exponential smoothing: forecast[i] (i >= 1) is a
 * function of actual[0..i-1] only, never actual[i] itself. forecast[0] has no
 * prior history to draw on, so it is seeded to actual[0].
 */
export function oneStepAheadForecast(values: number[], alpha = 0.5): number[] {
  if (values.length === 0) return []
  const forecast = [values[0]]
  for (let i = 1; i < values.length; i++) {
    forecast.push(alpha * values[i - 1] + (1 - alpha) * forecast[i - 1])
  }
  return forecast
}
