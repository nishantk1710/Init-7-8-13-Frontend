/**
 * Typed client for the I13 summary report — `/api/i13/reports/*`.
 *
 * Its own module rather than more of `i13.ts`: the report is one self-contained
 * feature behind its own backend switch (`I13_REPORT_ENABLED`), and while that
 * switch is off every route here answers 404. Callers treat 404 as "not
 * offered", the same rule the dashboard's optional sections use.
 *
 * The report's top-level fields are mapped to camelCase like the rest of the
 * I13 client. `facts` is NOT mapped: it is a stored document, saved once and
 * read back verbatim, so it is typed exactly as the backend writes it
 * (`app/initiatives/i13/report/facts.py`) instead of being copied field by
 * field into a second shape that could drift from it.
 */

import { API_BASE_URL, ApiError, apiFetch, apiPost } from "@/lib/api/client"

type RawRecord = Record<string, unknown>

export type ReportNarrativeSource = "MODEL" | "DETERMINISTIC"

export type ReportFacts = {
  scope: { plant: string | null; label: string }
  data_as_of: string
  snapshot_version: number
  snapshot_built_at: string | null
  valuation_is_mocked: boolean
  positions: {
    total: number
    FAST: number
    SLOW: number
    NON_MOVING: number
    fast_pct: number | null
    slow_pct: number | null
    non_moving_pct: number | null
  }
  plans: {
    plan_breach_count: number
    no_plan_count: number
    reference_plan_count: number
    acquired_vs_plan: Record<string, number>
  }
  gr_not_issued: {
    threshold_days: number
    position_count: number
    open_line_count: number
    longest_waiting: {
      material: string
      description: string | null
      plant: string
      reservation: string
      po_number: string | null
      outstanding_quantity: number | null
      days_since_gr: number
    }[]
  }
  exceptions: {
    total: number
    unresolved: number
    by_status: Record<string, number>
    by_type: Record<string, number>
    oldest_unresolved: {
      exception_id: string
      type: string
      status: string
      material: string
      description: string | null
      plant: string
      reservation: string | null
      days_open: number | null
    }[]
  }
}

export type ReportNarrative = {
  headline: string
  findings: string[]
  risks: string[]
  actions: { action: string; owner: string }[]
  source: ReportNarrativeSource
  model: string | null
  promptVersion: number | null
  /** Why the standard wording was used, when it was. */
  notes: string[]
}

export type SummaryReportListItem = {
  id: string
  generatedAt: string
  generatedBy: string
  plant: string | null
  dataAsOf: string | null
  headline: string
  narrativeSource: ReportNarrativeSource
}

export type SummaryReport = SummaryReportListItem & {
  facts: ReportFacts
  narrative: ReportNarrative
}

function source(value: unknown): ReportNarrativeSource {
  return value === "MODEL" ? "MODEL" : "DETERMINISTIC"
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function toListItem(raw: RawRecord): SummaryReportListItem {
  return {
    id: String(raw.id),
    generatedAt: String(raw.generated_at),
    generatedBy: String(raw.generated_by ?? ""),
    plant: typeof raw.plant === "string" && raw.plant ? raw.plant : null,
    dataAsOf: typeof raw.data_as_of === "string" ? raw.data_as_of : null,
    headline: String(raw.headline ?? ""),
    narrativeSource: source(raw.narrative_source),
  }
}

function toReport(raw: RawRecord): SummaryReport {
  const n = (raw.narrative ?? {}) as RawRecord
  return {
    ...toListItem(raw),
    facts: raw.facts as ReportFacts,
    narrative: {
      headline: String(n.headline ?? ""),
      findings: strings(n.findings),
      risks: strings(n.risks),
      actions: Array.isArray(n.actions)
        ? (n.actions as RawRecord[]).map((a) => ({ action: String(a.action ?? ""), owner: String(a.owner ?? "") }))
        : [],
      source: source(n.source),
      model: typeof n.model === "string" ? n.model : null,
      promptVersion: typeof n.prompt_version === "number" ? n.prompt_version : null,
      notes: strings(n.notes),
    },
  }
}

/** `GET /i13/reports` — newest first. 404 means the feature is switched off. */
export function listSummaryReports(params?: { limit?: number }): Promise<SummaryReportListItem[]> {
  const limit = params?.limit ?? 20
  return apiFetch<RawRecord[]>(`/i13/reports?limit=${limit}`).then((rows) => rows.map(toListItem))
}

export function getSummaryReport(id: string): Promise<SummaryReport> {
  return apiFetch<RawRecord>(`/i13/reports/${encodeURIComponent(id)}`).then(toReport)
}

/**
 * `POST /i13/reports/summary` — generate and save one report. Takes as long as
 * the AI provider does (typically 10–30 s). No retry: every call saves a row.
 */
export function generateSummaryReport(plant?: string): Promise<SummaryReport> {
  const query = plant ? `?plant=${encodeURIComponent(plant)}` : ""
  return apiPost<RawRecord>(`/i13/reports/summary${query}`).then(toReport)
}

/** The saved report as an Excel workbook: a blob URL and the server's filename. */
export async function fetchSummaryReportWorkbook(id: string): Promise<{ blobUrl: string; filename: string }> {
  const url = `${API_BASE_URL}/i13/reports/${encodeURIComponent(id)}/export.xlsx`
  const response = await fetch(url)
  if (!response.ok) {
    throw new ApiError(`GET ${url} failed with ${response.status}`, response.status)
  }
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")
  const blob = await response.blob()
  return { blobUrl: URL.createObjectURL(blob), filename: match?.[1] ?? `oar-utilization-report-${id.slice(0, 8)}.xlsx` }
}
