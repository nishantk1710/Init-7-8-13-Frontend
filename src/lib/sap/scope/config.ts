// W2.4 — scope configuration. This is the ONLY file (besides
// `data-generator/generate.py`, which mirrors it for synthetic data) allowed
// to name a scope's underlying SAP fields or values. Everything else reaches
// scope decisions through `isInScope` / `isMaterialInScope` / `toODataFilter`.
//
// Status as of 2026-09-08 (see docs-eng/phase_summary.md, Phase 0): the OAR
// rule below is UNCONFIRMED. A live full-scan of MaterialPlantSet.Dismm found
// ND+PD = 46.4% of the catalogue (the plan's own rule of thumb wanted <40% to
// call it "a clear minority"), 47% of rows have no Dismm at all, and six MRP
// Type codes (V1, M0, RP, VI, VH, V2) appear that no prior ruling mentions.
// That is a team-lead judgment call, not a technical one — flip `confirmed`
// to `true` once it lands. Nothing here blocks on the answer: changing it is
// a one-line edit to `OAR_MRP_TYPES`/`rollup`, by design.

import type { ScopeDefinition, ScopeEntitySet } from "./types"

/** MRP Type (`MARC.DISMM`) values that identify an OAR material-plant row. */
export const OAR_MRP_TYPES = ["ND", "PD"] as const

/** MRP Type for normally reorder-point-planned stock — must never appear in OAR_MRP_TYPES. */
export const PLANNED_MRP_TYPE = "VB"

/** MRP Type SAP also uses for obsolete materials — the collision §1.6(d) resolves via MSTAE, not DISMM. */
export const OBSOLETE_MRP_TYPE = "ND"

/** MARA.MSTAE value meaning "obsolete" — the second, orthogonal OAR predicate. */
export const OBSOLETE_MATERIAL_STATUS = "01"

/** A blank Dismm means "MRP type not maintained", not "not OAR" — see Phase 0 finding above. */
const DISMM_UNKNOWN_VALUES = [""]

if ((OAR_MRP_TYPES as readonly string[]).includes(PLANNED_MRP_TYPE)) {
  throw new Error(
    "Invariant violated: PLANNED_MRP_TYPE must not appear in OAR_MRP_TYPES — " +
      "this would silently select every reorder-point-planned material as OAR."
  )
}

/** Which entity set each field used by a scope rule lives on — drives the two-set pushdown join. */
export const FIELD_ENTITY_SET: Record<string, ScopeEntitySet> = {
  Dismm: "MaterialPlantSet",
  Mstae: "MaterialSet",
  Matkl: "MaterialSet",
}

export const SCOPES: Record<string, ScopeDefinition> = {
  // I13's full scope; I07's OAR flag.
  oar: {
    name: "oar",
    rule: {
      and: [
        { field: "Dismm", op: "in", values: [...OAR_MRP_TYPES], unknownValues: DISMM_UNKNOWN_VALUES },
        { field: "Mstae", op: "ne", value: OBSOLETE_MATERIAL_STATUS },
      ],
    },
    // §1.6(a): plant-vs-material roll-up is the team lead's call, not decided yet.
    // "per-plant-only" is the conservative default — it never invents a material-level
    // answer the team lead hasn't ruled on.
    rollup: "per-plant-only",
    confirmed: false,
    notes:
      "MRP-type value set and roll-up policy both pending team-lead confirmation " +
      "— see docs-eng/phase_summary.md Phase 0.",
  },
  // I08 — 80-series repairable materials. A different rule entirely from OAR.
  repairable: {
    name: "repairable",
    rule: { field: "Matkl", op: "startsWith", value: "80" },
    rollup: "per-plant-only",
    confirmed: false,
    notes: "80-series material-group rule from the FRS; not yet reconciled against live Matkl values.",
  },
  // Every material — the non-filtering default.
  all: {
    name: "all",
    rule: { and: [] },
    rollup: "per-plant-only",
    confirmed: true,
  },
}

export type ScopeName = keyof typeof SCOPES
