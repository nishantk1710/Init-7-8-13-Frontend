// The editable Overview KPI formulas -- the only place the KPI formulas page and the Overview's
// information cards talk to the backend about them. Mounted at /v1/i7/kpi-formulas.

import { apiFetch, apiPost, ApiError } from "@/lib/api/client"
import type {
  ActiveFormulas,
  ApiActiveFormulas,
  ApiFigures,
  ApiFormulaField,
  ApiFormulasPage,
  ApiPreview,
  ApiStatus,
  ApiVersion,
  ApplyStatus,
  FormulaField,
  FormulaPreview,
  FormulasPage,
  FormulaVersion,
  KpiKey,
  PortfolioFigures,
} from "@/features/initiative-7/types/kpi-formulas"

const BASE = "/v1/i7/kpi-formulas"

export function mapActive(active: ApiActiveFormulas): ActiveFormulas {
  return {
    version: active.version,
    isDefault: active.is_default,
    windowDays: active.settings.window_days,
    lookbackDays: active.settings.lookback_days,
    formulaLines: active.formula_lines as ActiveFormulas["formulaLines"],
    examples: Object.fromEntries(
      Object.entries(active.examples).map(([kpi, example]) => [
        kpi,
        example
          ? {
              material: example.material,
              plant: example.plant,
              inputs: example.inputs,
              substitution: example.substitution,
              result: example.result,
            }
          : null,
      ])
    ) as ActiveFormulas["examples"],
  }
}

function mapField(field: ApiFormulaField): FormulaField {
  return {
    key: field.key,
    kpi: field.kpi as KpiKey,
    label: field.label,
    kind: field.kind,
    help: field.help,
    defaultValue: field.default,
    value: field.value,
    allowed: field.allowed,
    minimum: field.minimum,
    maximum: field.maximum,
    needsRebuild: field.needs_rebuild,
  }
}

function mapVersion(version: ApiVersion): FormulaVersion {
  return {
    version: version.version,
    status: version.status,
    createdBy: version.created_by,
    createdAt: version.created_at,
    appliedAt: version.applied_at,
    note: version.note,
    error: version.error,
    rebuildNeeded: version.rebuild_needed,
    rowsBuilt: version.rows_built,
  }
}

function mapStatus(status: ApiStatus): ApplyStatus {
  return { state: status.state, version: status.version, message: status.message }
}

function mapFigures(figures: ApiFigures): PortfolioFigures {
  return {
    stockoutAtRisk: figures.stockout_at_risk,
    stockoutEvaluated: figures.stockout_evaluated,
    stockoutInsufficient: figures.stockout_insufficient,
    excessCount: figures.excess_count,
    excessOpportunity: figures.excess_opportunity,
    workingCapital: figures.working_capital,
  }
}

/** The formulas the Overview is using now -- what its information cards are written from. */
export async function fetchActiveFormulas(): Promise<ActiveFormulas> {
  return mapActive(await apiFetch<ApiActiveFormulas>(`${BASE}/active`))
}

/** Everything the KPI formulas page shows. */
export async function fetchFormulasPage(): Promise<FormulasPage> {
  const page = await apiFetch<ApiFormulasPage>(BASE)
  return {
    active: mapActive(page.active),
    kpis: page.kpis as FormulasPage["kpis"],
    fields: page.fields.map(mapField),
    status: mapStatus(page.status),
    history: page.history.map(mapVersion),
  }
}

export async function fetchApplyStatus(): Promise<ApplyStatus> {
  return mapStatus(await apiFetch<ApiStatus>(`${BASE}/status`))
}

/** What the portfolio would show under a draft. Saves nothing. */
export async function previewFormulas(fields: Record<string, string | number>): Promise<FormulaPreview> {
  const preview = await apiPost<ApiPreview>(`${BASE}/preview`, { fields })
  return {
    current: mapFigures(preview.current),
    draft: mapFigures(preview.draft),
    windowNeedsRebuild: preview.window_needs_rebuild,
    formulaLines: preview.formula_lines as FormulaPreview["formulaLines"],
  }
}

/** Save the draft as a new version and apply it. `applying` means the usage data is being rebuilt. */
export async function applyFormulas(fields: Record<string, string | number>, note?: string): Promise<ApplyStatus> {
  return mapStatus(await apiPost<ApiStatus>(`${BASE}/apply`, { fields, note: note?.trim() || undefined }))
}

export async function resetFormulas(): Promise<ApplyStatus> {
  return mapStatus(await apiPost<ApiStatus>(`${BASE}/reset`))
}

/** Per-field messages of a refused formula (HTTP 422, code FORMULA_INVALID), keyed by field. Empty for any
 * other failure -- those belong in `ApiError.detailText()`. */
export function formulaErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== "FORMULA_INVALID") return {}
  const raw = error.rawDetail as { details?: { fields?: Record<string, unknown> } } | null
  const fields = raw?.details?.fields
  if (!fields) return {}
  return Object.fromEntries(Object.entries(fields).filter(([, message]) => typeof message === "string")) as Record<
    string,
    string
  >
}
