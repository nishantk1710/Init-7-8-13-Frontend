// W2.4 — scope configuration. This is the ONLY file (besides
// `data-generator/generate.py`, which mirrors it for synthetic data) allowed
// to name a scope's underlying SAP fields or values. Everything else reaches
// scope decisions through `isInScope` / `isMaterialInScope` / `toODataFilter`.
//
// Status as of 2026-09-18: the OAR field rule is confirmed as
// `Dismm in {ND, PD}` alone -- the MSTAE/material-status exclusion carried
// over from an earlier draft has been dropped (matches the backend's
// app/initiatives/i7/policy/oar.py::current_oar_policy). Still open: a live
// full-scan of MaterialPlantSet.Dismm found ND+PD = 46.4% of the catalogue
// (the plan's own rule of thumb wanted <40% to call it "a clear minority"),
// 47% of rows have no Dismm at all, and six MRP Type codes (V1, M0, RP, VI,
// VH, V2) appear that no prior ruling mentions -- none of that changes the
// field rule itself. Roll-up (material vs. per-plant) remains a team-lead
// call, not decided yet. Nothing here blocks on that answer: changing it is
// a one-line edit to `rollup`, by design.

import type { ScopeDefinition, ScopeEntitySet } from "./types"

/** MRP Type (`MARC.DISMM`) values that identify an OAR material-plant row. */
export const OAR_MRP_TYPES = ["ND", "PD"] as const

/** MRP Type for normally reorder-point-planned stock — must never appear in OAR_MRP_TYPES. */
export const PLANNED_MRP_TYPE = "VB"

/** A blank Dismm means "MRP type not maintained", not "not OAR" — see Phase 0 finding above. */
const DISMM_UNKNOWN_VALUES = [""]

if ((OAR_MRP_TYPES as readonly string[]).includes(PLANNED_MRP_TYPE)) {
  throw new Error(
    "Invariant violated: PLANNED_MRP_TYPE must not appear in OAR_MRP_TYPES — " +
      "this would silently select every reorder-point-planned material as OAR."
  )
}

/** Which entity set each field used by a scope rule lives on — drives the two-set pushdown join.
 * Mstae is kept mapped even though no active scope rule references it any more
 * (the OAR rule's MSTAE exclusion was dropped) -- it is still a real MaterialSet
 * field other scope rules or filter tests may legitimately reference. */
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
      ],
    },
    // §1.6(a): plant-vs-material roll-up is the team lead's call, not decided yet.
    // "per-plant-only" is the conservative default — it never invents a material-level
    // answer the team lead hasn't ruled on.
    rollup: "per-plant-only",
    // MRP type alone (Dismm in {ND, PD}) is confirmed as the OAR rule -- the
    // MSTAE/material-status exclusion carried over from an earlier draft has
    // been dropped, matching the backend's app/initiatives/i7/policy/oar.py.
    confirmed: true,
    notes:
      "MRP-type value set confirmed as the sole OAR predicate. Roll-up policy " +
      "still pending team-lead confirmation — see docs-eng/phase_summary.md Phase 0.",
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
