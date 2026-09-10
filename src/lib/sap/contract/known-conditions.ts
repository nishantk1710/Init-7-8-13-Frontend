// W2.5 — the known-conditions set (§6).
//
// Each entry records something we have MEASURED about the live system, and
// fails loudly when it changes IN EITHER DIRECTION. A set that starts
// returning rows is as much of a signal as one that stops — "expected 0" that
// silently becomes 40,000 would otherwise look like everything is fine while
// every downstream assumption quietly rots.
//
// These are asserted against the committed discovery sweep, so they run
// offline in CI. The W2.2 smoke test (later) re-asserts the same set against
// live CPI.

/**
 * `$count` currently returns HTTP 500 on these. Empty as of the 09-Sep 2026
 * sweep — SAP fixed both sets that used to be here (`PurchaseRequisitionSet`,
 * `GoodsMovementItemSet`; see COUNT_WORKING_SETS). W2.3's fallback paging
 * still exists for whichever set lands here next; nothing currently uses it
 * by static config, but `auto` mode still demotes into it at runtime if a
 * `$count` call 500s.
 */
export const COUNT_BROKEN_SETS = [] as const

/**
 * `$count` works here and must keep working. PurchaseOrderItemSet,
 * PurchaseRequisitionSet and GoodsMovementItemSet are in this list
 * specifically because each used to be broken — this guards the regression.
 * The latter two were fixed in the 09-Sep 2026 sweep (previously HTTP 500;
 * now 1,553 and 68,616 rows respectively).
 */
export const COUNT_WORKING_SETS = [
  "PurchaseOrderItemSet",
  "PurchaseRequisitionSet",
  "GoodsMovementItemSet",
  "MaterialSet",
  "MaterialPlantSet",
  "MaterialDescriptionSet",
  "StorageLocationStockSet",
  "MaterialDocumentHeaderSet",
  "PurchaseOrderSet",
  "POScheduleLineSet",
  "POHistorySet",
  "InfoRecordSet",
  "InfoRecordOrgSet",
  "VendorSet",
  "ChangeDocHeaderSet",
  "ChangeDocItemSet",
  "BatchStockSet",
  "StockMovementStatisticSet",
] as const

/**
 * Registered, responding, and returning nothing (§1.3). The top blocker in
 * WS2: these look fixed but carry no data, so I07/I08/I13 cannot be validated
 * against live rows. Flip these to a hard failure once SAP answers why.
 *
 * `ReservationItemSet` was fixed in the 09-Sep 2026 sweep (now 1,000 rows)
 * and no longer belongs here — see docs-eng/phase_summary.md.
 */
export const EMPTY_SETS = ["MaterialValuationSet", "MonthlyMovementStatisticSet"] as const

/** Properties that must exist, with the type they must have. */
export const EXPECTED_PROPERTIES = [
  // The OAR identifier. A hard failure if it ever disappears.
  { entitySet: "MaterialPlantSet", property: "Dismm", type: "Edm.String" },
  // The obsolete signal — the second half of the OAR rule.
  { entitySet: "MaterialSet", property: "Mstae", type: "Edm.String" },
  // Evidence Bednr is a real SAP field rather than a guess: it is already live here.
  { entitySet: "PurchaseRequisitionSet", property: "Bednr", type: "Edm.String" },
  { entitySet: "PurchaseOrderItemSet", property: "Bednr", type: "Edm.String" },
  // Asserted deliberately so a revert to Edm.Decimal is caught too — this pair
  // changed type silently once already, in four hours, with no announcement.
  { entitySet: "PurchaseOrderItemSet", property: "Netpr", type: "Edm.String" },
  { entitySet: "PurchaseOrderItemSet", property: "Netwr", type: "Edm.String" },
  // A third date/time type to handle in the parser — not Edm.DateTime.
  { entitySet: "ChangeDocHeaderSet", property: "Utime", type: "Edm.Time" },
  // Corrected assumption: these are underscored, not CamelCase (§1.2).
  { entitySet: "ChangeDocItemSet", property: "Value_old", type: "Edm.String" },
  { entitySet: "ChangeDocItemSet", property: "Value_new", type: "Edm.String" },
  // Found by the sweep, directly useful to I13 redeployment.
  { entitySet: "ReservationItemSet", property: "Umwrk", type: "Edm.String" },
  { entitySet: "ReservationItemSet", property: "Umlgo", type: "Edm.String" },
] as const

/**
 * Properties that are NOT exposed today. Each is a live SAP-side request, and
 * this list failing is GOOD NEWS — it means SAP shipped the exposure and the
 * config behind it can now be switched on.
 */
export const EXPECTED_ABSENT_PROPERTIES = [
  // Only needed for a future serial-grain repair register. Not blocking.
  { entitySet: "MaterialSet", property: "Sernp" },
  // The reservation-time assistant's session field (§1.7). Named by the team
  // lead, real elsewhere in SAP, not yet on this projection. Blocks the
  // deep-link launch path only, not the assistant itself.
  { entitySet: "ReservationItemSet", property: "Bednr" },
  // The old external-material-group OAR identifier is deliberately NOT listed
  // here. It is retired, not pending (§6) — we no longer care whether SAP
  // exposes it, so asserting on it would mean tracking a field nothing wants.
  // The scope leakage guard bans its name outright instead.
] as const

/**
 * The declared OData key is only 3 fields, and it is NOT row-unique: one
 * change document touching several fields returns several rows sharing it.
 * Any dedup or upsert keyed on this will collapse real rows (§1.4).
 */
export const CHANGE_DOC_ITEM_KEY = ["Changenr", "Objectclas", "Objectid"] as const
export const CHANGE_DOC_ITEM_NON_KEY = ["Tabname", "Fname"] as const

/** Filter-only sets — never bulk-extract these (§1.4). */
export const HIGH_VOLUME_SETS = [
  { entitySet: "ChangeDocItemSet", minimumRows: 100_000 },
  { entitySet: "ChangeDocHeaderSet", minimumRows: 100_000 },
] as const

/**
 * The measured value domain of the OAR identifier.
 *
 * NOTE: the plan (§6) expected this to be a subset of {VB, ND, PD}. It is not.
 * The 08-Sep full scan found ten distinct values, of which the most common by
 * far is BLANK — see docs-eng/phase_summary.md Phase 0. This list records what
 * is actually there, so a NEW unseen value still fails the check. Do not
 * "correct" this back to the plan's three values; the plan predates the
 * measurement.
 */
export const DISMM_VALUE_DOMAIN = ["", "PD", "ND", "V1", "VB", "M0", "RP", "VI", "VH", "V2"] as const

/** Same, for the obsolete signal. Blank means "no status maintained", i.e. not obsolete. */
export const MSTAE_VALUE_DOMAIN = ["", "01"] as const
