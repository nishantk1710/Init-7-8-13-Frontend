// W2.6b — where every view-model field comes from.
//
// The plan is explicit (§7.5): "Where a fixture holds data no SAP field can
// produce, that is a finding: log it as a gap, do not invent a source."
//
// So each initiative declares a source for EVERY field of its view model as
// `Record<keyof ViewModel, FieldSource>`. TypeScript refuses to compile if a
// field is missing, which means a new UI field cannot be added without
// someone stating where its data comes from — or admitting there is nowhere.

export type FieldSource =
  /** A real SAP property. Asserted against the generated contract in tests. */
  | { from: "sap"; entitySet: string; property: string; note?: string }
  /** A column in data our own platform owns (data-generator/generated/platform). */
  | { from: "platform"; file: string; column: string; note?: string }
  /** Computed from other mapped fields. The note says how. */
  | { from: "derived"; note: string }
  /**
   * Nothing can produce this. A finding, not a TODO: either the UI field is
   * decoration that should go, or something upstream has to start producing
   * it. Never invent a source to make a gap disappear.
   */
  | { from: "gap"; note: string }
  /**
   * A real SAP field that exists but currently returns no rows (§1.3), or is
   * not yet exposed (§1.7). Mapped, but it will be empty until SAP is fixed.
   */
  | { from: "blocked"; entitySet: string; property?: string; note: string }

export type FieldSourceMap<T> = Record<keyof T, FieldSource>

export interface GapReportRow {
  initiative: string
  viewModel: string
  field: string
  source: FieldSource["from"]
  detail: string
}

function describe(source: FieldSource): string {
  switch (source.from) {
    case "sap":
      return `${source.entitySet}.${source.property}${source.note ? ` — ${source.note}` : ""}`
    case "platform":
      return `${source.file}:${source.column}${source.note ? ` — ${source.note}` : ""}`
    case "derived":
      return source.note
    case "gap":
      return source.note
    case "blocked":
      return `${source.entitySet}${source.property ? `.${source.property}` : ""} — ${source.note}`
  }
}

export function toGapReportRows<T>(
  initiative: string,
  viewModel: string,
  sources: FieldSourceMap<T>
): GapReportRow[] {
  return Object.entries(sources).map(([field, source]) => ({
    initiative,
    viewModel,
    field,
    source: (source as FieldSource).from,
    detail: describe(source as FieldSource),
  }))
}
