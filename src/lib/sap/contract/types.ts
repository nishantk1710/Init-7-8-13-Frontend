// W2.5 — the SAP data contract. See docs-eng/WS2_INTEGRATION_PLAN.md §6.
//
// This is what SAP actually exposes, measured — not what we hoped it exposes.
// `generated-contract.ts` is produced from the committed discovery sweep by
// `scripts/generate-sap-contract.mts` and checked into git deliberately: it is
// the baseline every drift check diffs against.

/** OData v2 scalar types this system actually uses. Anything else is a finding, not a default. */
export type EdmType =
  | "Edm.String"
  | "Edm.DateTime"
  | "Edm.Time"
  | "Edm.Decimal"
  | "Edm.Boolean"
  | "Edm.Byte"
  | "Edm.SByte"
  | "Edm.Int16"
  | "Edm.Int32"
  | "Edm.Int64"
  | "Edm.Double"
  | "Edm.Single"
  | "Edm.Guid"
  | "Edm.Binary"
  | "Edm.DateTimeOffset"

export interface PropertyContract {
  name: string
  type: EdmType
  nullable: boolean
  isKey: boolean
}

export interface EntitySetContract {
  service: string
  entitySet: string
  entityType: string
  /** Declared OData key. Not necessarily row-unique — see ChangeDocItemSet (§1.2). */
  keys: string[]
  properties: PropertyContract[]
}

/** Keyed by entity set name, which is unique across both services (asserted in tests). */
export type SapContract = Record<string, EntitySetContract>
