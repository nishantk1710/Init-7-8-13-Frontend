// Pure helpers for the KPI formulas page: turning the form's text boxes into the request, and saying
// what differs from what is in force.

import type { FormulaField, FormulaVersion, KpiKey } from "@/features/initiative-7/types/kpi-formulas"

export type Draft = Record<string, string>

export const KPI_ORDER: KpiKey[] = ["stockout", "excess", "working_capital"]

export const KPI_BLURB: Record<KpiKey, string> = {
  stockout: "Which materials are likely to run out before a new order could arrive?",
  excess: "Where does SAP allow more stock than the recommendation says is needed?",
  working_capital: "If every recommendation were adopted, how much cash would be released or tied up?",
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
