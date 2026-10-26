// The editable Overview calculations: what the backend sends (snake_case, `Api*`) and what the page
// uses (camelCase). See app/schemas/i7/kpi_formulas.py.

export type ApiExample = {
  kpi: string
  material: string
  plant: string
  inputs: { label: string; value: string }[]
  substitution: string[]
  result: string
  at_risk?: boolean | null
}

export type ApiActiveFormulas = {
  version: number | null
  is_default: boolean
  settings: { window_days: number; lookback_days: number }
  formula_lines: Record<string, string[]>
  examples: Record<string, ApiExample | null>
}

export type ApiFormulaField = {
  key: string
  kpi: string
  label: string
  kind: "number" | "condition" | "setting"
  help: string
  default: string | number
  value: string | number
  data_set: string
  helpers: { name: string; label: string }[]
  example: string
  minimum: number | null
  maximum: number | null
  needs_rebuild: boolean
}

export type ApiDataItem = { name: string; label: string; description: string; group: string; unit: string }

export type ApiVersion = {
  version: number
  status: string
  created_by: string
  created_at: string
  applied_at: string | null
  note: string | null
  error: string | null
  rebuild_needed: boolean
  rows_built: number | null
}

export type ApiStatus = { state: "idle" | "applying" | "failed"; version: number | null; message: string | null }

export type ApiFormulasPage = {
  active: ApiActiveFormulas
  kpis: { key: string; title: string; data_set: string; controls: string[] }[]
  fields: ApiFormulaField[]
  data: Record<string, ApiDataItem[]>
  functions: string[]
  status: ApiStatus
  history: ApiVersion[]
}

export type ApiFigures = {
  stockout_at_risk: number
  stockout_evaluated: number
  stockout_insufficient: number
  excess_count: number
  excess_opportunity: number | null
  working_capital: number | null
  adoption_rate: number | null
  counted_as_adopted: number | null
}

export type ApiPreview = {
  current: ApiFigures
  draft: ApiFigures
  window_needs_rebuild: boolean
  formula_lines: Record<string, string[]>
}

// --- What the page uses ---------------------------------------------------------------------------

export type KpiKey = "stockout" | "excess" | "working_capital" | "adoption"

export type FormulaExample = {
  material: string
  plant: string
  inputs: { label: string; value: string }[]
  substitution: string[]
  result: string
}

export type ActiveFormulas = {
  /** The saved version in force; `null` for the built-in formulas. */
  version: number | null
  isDefault: boolean
  windowDays: number
  lookbackDays: number
  formulaLines: Partial<Record<KpiKey, string[]>>
  examples: Partial<Record<KpiKey, FormulaExample | null>>
}

export type FormulaField = {
  key: string
  kpi: KpiKey
  label: string
  kind: "number" | "condition" | "setting"
  help: string
  defaultValue: string | number
  value: string | number
  /** Which list of data this formula draws on (`FormulasPage.data`); empty for a plain number. */
  dataSet: string
  /** Values built by earlier formulas of the same card that this one may also use. */
  helpers: { name: string; label: string }[]
  /** One line showing what a formula here could look like. */
  example: string
  minimum: number | null
  maximum: number | null
  needsRebuild: boolean
}

/** One fact a formula can use: a stored figure, in plain words. */
export type DataItem = { name: string; label: string; description: string; group: string; unit: string }

export type FormulaVersion = {
  version: number
  status: string
  createdBy: string
  createdAt: string
  appliedAt: string | null
  note: string | null
  error: string | null
  rebuildNeeded: boolean
  rowsBuilt: number | null
}

export type ApplyStatus = { state: "idle" | "applying" | "failed"; version: number | null; message: string | null }

export type FormulasPage = {
  active: ActiveFormulas
  kpis: { key: KpiKey; title: string; dataSet: string; controls: string[] }[]
  fields: FormulaField[]
  /** Every fact a formula may use, by data set. */
  data: Record<string, DataItem[]>
  /** The functions a formula may call, as written: `max(a, b)`. */
  functions: string[]
  status: ApplyStatus
  history: FormulaVersion[]
}

export type PortfolioFigures = {
  stockoutAtRisk: number
  stockoutEvaluated: number
  stockoutInsufficient: number
  excessCount: number
  excessOpportunity: number | null
  workingCapital: number | null
  /** As a percentage: 75 means 75%. */
  adoptionRate: number | null
  countedAsAdopted: number | null
}

export type FormulaPreview = {
  current: PortfolioFigures
  draft: PortfolioFigures
  windowNeedsRebuild: boolean
  formulaLines: Partial<Record<KpiKey, string[]>>
}
