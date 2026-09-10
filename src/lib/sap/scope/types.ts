// W2.4 — material-scope predicate types. See docs-eng/WS2_INTEGRATION_PLAN.md §5.
//
// Nothing outside `lib/sap/scope/*` may reference a scope's underlying SAP
// field names or values directly — everything is expressed through this
// module's public API (`isInScope`, `isMaterialInScope`, `toODataFilter`).

export type ScopeOperator = "eq" | "ne" | "in" | "notIn" | "startsWith"

/**
 * One leaf comparison against a single SAP field. `unknownValues` lists
 * values that mean "we cannot determine this" rather than true or false —
 * e.g. a blank MRP Type is not the same claim as "not OAR" (see
 * docs-eng/phase_summary.md Phase 0: 47% of live MaterialPlantSet rows have
 * no Dismm at all).
 */
export interface ScopeCondition {
  field: string
  op: ScopeOperator
  value?: string
  values?: string[]
  unknownValues?: string[]
}

export interface ScopeAnd {
  and: ScopeRule[]
}

export interface ScopeOr {
  or: ScopeRule[]
}

export type ScopeRule = ScopeCondition | ScopeAnd | ScopeOr

export type RollupMode = "any-plant" | "all-plants" | "per-plant-only"

export interface ScopeDefinition {
  name: string
  rule: ScopeRule
  rollup: RollupMode
  /** False while the rule or rollup policy is still an assumption, not a confirmed team-lead ruling. */
  confirmed: boolean
  notes?: string
}

/**
 * Three-way result, never collapsed to a boolean. A data outage or an
 * unmaintained field must never render as a confident "not in scope".
 */
export type ScopeVerdict = "in-scope" | "not-in-scope" | "cannot-determine"

/**
 * Row shape the predicate evaluates against — a field bag from one SAP entity
 * set. Values are `unknown` because rows arrive both raw (strings, from CSV)
 * and decoded (numbers, Dates, booleans, from the client). The predicate
 * compares as text and treats null/undefined as "cannot determine".
 */
export type FieldRow = Record<string, unknown>

/** Which entity set a field's row data comes from (spans MaterialSet + MaterialPlantSet). */
export type ScopeEntitySet = "MaterialSet" | "MaterialPlantSet"
