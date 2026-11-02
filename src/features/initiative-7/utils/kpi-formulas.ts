// Pure helpers for the KPI formulas page: turning the form's text boxes into the request, and saying
// what differs from what is in force.

import type { OverviewInfoId } from "@/features/initiative-7/data/overview-info"
import type { DataItem, FormulaField, FormulaVersion, KpiKey, PortfolioFigures } from "@/features/initiative-7/types/kpi-formulas"

export type Draft = Record<string, string>

export const KPI_ORDER: KpiKey[] = ["stockout", "excess", "working_capital", "adoption"]

export const KPI_BLURB: Record<KpiKey, string> = {
  stockout: "Which materials are likely to run out before a new order could arrive?",
  excess: "Where does SAP allow more stock than the recommendation says is needed?",
  working_capital: "If every recommendation were adopted, how much cash would be released or tied up?",
  adoption: "How many recommendations has SAP actually taken up, and what share is that?",
}

/** The text boxes' starting point: every field as the backend holds it now. */
export function draftFromFields(fields: FormulaField[]): Draft {
  return Object.fromEntries(fields.map((f) => [f.key, String(f.value)]))
}

/** The request body. A setting is sent as a number; a box that is not a whole number is sent as typed so
 * the backend can refuse it with a sentence, rather than the page guessing. */
export function fieldsFromDraft(fields: FormulaField[], draft: Draft): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const field of fields) {
    const text = (draft[field.key] ?? "").trim()
    out[field.key] = field.kind === "setting" && /^\d+$/.test(text) ? Number(text) : text
  }
  return out
}

/** Keys whose box differs from what is in force. Compared as text, ignoring spaces around the ends. */
export function changedKeys(fields: FormulaField[], draft: Draft): string[] {
  return fields.filter((f) => (draft[f.key] ?? "").trim() !== String(f.value).trim()).map((f) => f.key)
}

/** Keys whose box differs from the built-in default. */
export function differsFromDefault(fields: FormulaField[], draft: Draft): string[] {
  return fields.filter((f) => (draft[f.key] ?? "").trim() !== String(f.defaultValue).trim()).map((f) => f.key)
}

/** Appends a name to a formula box, with a space unless the box is empty or already ends in an opener. */
export function insertName(current: string, name: string): string {
  const trimmed = current.trimEnd()
  if (trimmed === "" || /[(+\-*/×÷<>=]$/.test(trimmed)) return `${trimmed}${trimmed === "" ? "" : " "}${name}`
  return `${trimmed} ${name}`
}

export const STATUS_LABEL: Record<string, string> = {
  active: "In use",
  applying: "Applying",
  superseded: "Replaced",
  failed: "Failed",
}

/** "v3 — In use" for the history list. */
export function describeVersion(version: FormulaVersion): string {
  return `v${version.version} — ${STATUS_LABEL[version.status] ?? version.status}`
}

/** Signed difference as the preview prints it: "+12", "−3", "no change". */
export function formatDelta(from: number | null, to: number | null, format: (n: number) => string): string {
  if (from === null || to === null) return "—"
  const diff = to - from
  if (diff === 0) return "no change"
  return `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))}`
}

/** What a unit means to a reader, shown beside a fact. */
export const UNIT_LABEL: Record<string, string> = {
  quantity: "quantity",
  money: "money",
  days: "days",
  count: "count",
  ratio: "0 to 1",
  number: "number",
}

/** The facts whose name, words, description or group contain every word typed. An empty search keeps all. */
export function filterData(items: DataItem[], query: string): DataItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return items
  return items.filter((item) => {
    const haystack = `${item.label} ${item.name} ${item.description} ${item.group}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** The facts under their group headings, in the order the groups first appear. */
export function groupData(items: DataItem[]): { group: string; items: DataItem[] }[] {
  const groups = new Map<string, DataItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups].map(([group, grouped]) => ({ group, items: grouped }))
}

/** The formula boxes of a card -- everything that is typed, not a plain number. */
export function formulaFields(fields: FormulaField[]): FormulaField[] {
  return fields.filter((field) => field.kind !== "setting")
}

// --- The cards / charts toggle ----------------------------------------------------------------------------

/** What the page lists: the Overview's KPI cards, or its charts. A chart always follows its card's rule. */
export type CalcView = "cards" | "charts"

export const CALC_VIEWS: { value: CalcView; label: string }[] = [
  { value: "cards", label: "KPI cards" },
  { value: "charts", label: "Charts" },
]

/** The Overview card each calculation belongs to: its (i) popup and its colour. */
export const KPI_INFO_ID: Record<KpiKey, OverviewInfoId> = {
  stockout: "stockoutRisk",
  excess: "excessInventory",
  working_capital: "workingCapital",
  adoption: "adoptedRecommendation",
}

/** The (i) popup of each chart, by the name the backend lists it under. */
const CHART_INFO_ID: Record<string, OverviewInfoId> = {
  "Stockout Risk Distribution chart": "stockoutDistribution",
  "Stockout risk by plant chart": "stockoutByPlant",
  "Excess inventory by plant chart": "excessByPlant",
  "SAP adoption chart": "sapAdoption",
}

export type CalcSection = {
  kpi: KpiKey
  title: string
  blurb: string
  /** What this section changes on the Overview, in the toggle's own terms. */
  controls: string[]
  infoId: OverviewInfoId
}

/**
 * The sections the toggle shows. Cards: one per card, as the backend names them. Charts: one per calculation
 * that has charts, titled by those charts. Both views edit the same formulas -- a calculation with no chart
 * (Working Capital Impact) simply has no section under Charts.
 */
export function sectionsFor(
  view: CalcView,
  kpis: { key: KpiKey; title: string; controls: string[] }[]
): CalcSection[] {
  const sections: CalcSection[] = []
  for (const kpi of kpis) {
    const cards = kpi.controls.filter((c) => c.endsWith(" card"))
    const charts = kpi.controls.filter((c) => c.endsWith(" chart"))
    if (view === "cards") {
      sections.push({
        kpi: kpi.key,
        title: kpi.title,
        blurb: KPI_BLURB[kpi.key] + (charts.length > 0 ? " Its charts use the same calculation." : ""),
        controls: cards.length > 0 ? cards : kpi.controls,
        infoId: KPI_INFO_ID[kpi.key],
      })
    } else if (charts.length > 0) {
      sections.push({
        kpi: kpi.key,
        title: charts.map((c) => c.replace(/ chart$/, "")).join(" · "),
        blurb: `${charts.length > 1 ? "These charts use" : "This chart uses"} the same calculation as the ${kpi.title} card, so changing it here changes both.`,
        controls: charts,
        infoId: CHART_INFO_ID[charts[0]] ?? KPI_INFO_ID[kpi.key],
      })
    }
  }
  return sections
}

// --- Preview impact (the small panel on each card and chart section) ------------------------------------------

export type ImpactRow = {
  label: string
  now: string
  next: string
  /** Draft minus now, or null when either cannot be worked out. */
  delta: number | null
  /** "+114", "−3", "no change", or "—". */
  deltaText: string
  /** Whether the change is good news for the person reading it: more cash freed is good, more materials at risk is not. */
  tone: "good" | "bad" | "neutral"
}

const countText = (n: number | null) => (n === null ? "Not available" : Math.round(n).toLocaleString("en-US"))
const percentText = (n: number | null) => (n === null ? "Not yet measured" : `${n.toFixed(1)}%`)

function impactRow(
  label: string,
  now: number | null,
  next: number | null,
  format: (n: number | null) => string,
  deltaFormat: (n: number) => string,
  goodWhenUp: boolean
): ImpactRow {
  const delta = now === null || next === null ? null : next - now
  const tone = delta === null || delta === 0 ? "neutral" : delta > 0 === goodWhenUp ? "good" : "bad"
  return { label, now: format(now), next: format(next), delta, deltaText: formatDelta(now, next, deltaFormat), tone }
}

/** The few figures worth a glance for one calculation, now against the draft. Share of judged materials is at-risk
 * divided by those that could be judged, and null when none could be. */
export function impactRows(kpi: KpiKey, current: PortfolioFigures, draft: PortfolioFigures): ImpactRow[] {
  const count = (n: number) => Math.round(n).toLocaleString("en-US")
  const points = (n: number) => `${n.toFixed(1)}%`
  const share = (f: PortfolioFigures) => (f.stockoutEvaluated > 0 ? (f.stockoutAtRisk / f.stockoutEvaluated) * 100 : null)
  switch (kpi) {
    case "stockout":
      return [
        impactRow("Materials at risk", current.stockoutAtRisk, draft.stockoutAtRisk, countText, count, false),
        impactRow("% of judged materials", share(current), share(draft), percentText, points, false),
      ]
    case "excess":
      return [
        impactRow("Excess candidates", current.excessCount, draft.excessCount, countText, count, false),
        impactRow("Excess value", current.excessOpportunity, draft.excessOpportunity, countText, count, false),
      ]
    case "working_capital":
      return [impactRow("Working capital impact", current.workingCapital, draft.workingCapital, countText, count, true)]
    case "adoption":
      return [
        impactRow("Adoption rate", current.adoptionRate, draft.adoptionRate, percentText, points, true),
        impactRow("Counted as adopted", current.countedAsAdopted, draft.countedAsAdopted, countText, count, true),
      ]
  }
}
