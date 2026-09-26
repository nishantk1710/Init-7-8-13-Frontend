// W2.4 — scope configuration. This is the ONLY file (besides
// `data-generator/generate.py`, which mirrors it for synthetic data) allowed
// to name a scope's underlying SAP fields or values. Everything else reaches
// scope decisions through `isInScope` / `isMaterialInScope` / `toODataFilter`.
//
// Status as of 2026-09-21: the OAR field rule is `Dismm in {ND, PD}`, and
// blank/unmaintained Dismm now ALSO counts as OAR -- business-confirmed. The
// MSTAE/material-status exclusion carried over from an earlier draft was
// already dropped (matches the backend's
// app/initiatives/i7/policy/oar.py::current_oar_policy). A live full-scan of
// MaterialPlantSet.Dismm found ND+PD = 46.4% of the catalogue and 47% of rows
// have no Dismm at all -- the blank exception roughly doubles OAR-scope
// coverage relative to the ND/PD-only rule. Six MRP Type codes (V1, M0, RP,
// VI, VH, V2) still evaluate not-in-scope, not in-scope and not
// cannot-determine -- only blank changed. Roll-up (material vs. per-plant)
// remains a team-lead call, not decided yet. Nothing here blocks on that
// answer: changing it is a one-line edit to `rollup`, by design.

import type { ScopeDefinition, ScopeEntitySet } from "./types"

/** MRP Type (`MARC.DISMM`) values that identify an OAR material-plant row. */
export const OAR_MRP_TYPES = ["ND", "PD"] as const

/** MRP Type for normally reorder-point-planned stock — must never appear in OAR_MRP_TYPES. */
export const PLANNED_MRP_TYPE = "VB"

/** Values meaning "MRP type not maintained" as a literal string (as opposed
 * to the field being entirely absent from the row, which `blankMeansInScope`
 * handles separately). Empty on purpose: an explicit blank string is treated
 * the same as an absent field for OAR — both now count as in-scope, per the
 * same business-confirmed exception (see the module note above) — so there
 * is nothing left for this condition's own `unknownValues` to catch. */
const DISMM_UNKNOWN_VALUES: string[] = []

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
        {
          field: "Dismm",
          op: "in",
          // "" included alongside ND/PD: a literal empty-string Dismm is
          // now in-scope, the same as the field being entirely absent
          // (blankMeansInScope, below, handles that separate case).
          values: [...OAR_MRP_TYPES, ""],
          unknownValues: DISMM_UNKNOWN_VALUES,
          blankMeansInScope: true,
        },
      ],
    },
    // §1.6(a): plant-vs-material roll-up is the team lead's call, not decided yet.
    // "per-plant-only" is the conservative default — it never invents a material-level
    // answer the team lead hasn't ruled on.
    rollup: "per-plant-only",
    // MRP type (Dismm in {ND, PD}), plus blank, is confirmed as the OAR
    // rule -- the MSTAE/material-status exclusion carried over from an
    // earlier draft has been dropped, matching the backend's
    // app/initiatives/i7/policy/oar.py::current_oar_policy.
    confirmed: true,
    notes:
      "MRP-type value set confirmed as the OAR predicate: ND, PD, and blank/unmaintained " +
      "all count as OAR. Roll-up policy still pending team-lead confirmation — " +
      "see docs-eng/phase_summary.md Phase 0.",
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
