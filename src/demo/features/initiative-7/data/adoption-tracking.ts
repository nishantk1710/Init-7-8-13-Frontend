// Adoption Tracking — mock dataset. Whether an approved I07 recommendation's
// values were actually changed in SAP, checked against CDHDR/CDPOS change
// documents. This is a standalone mockup: no live backend endpoint for a
// per-material-plant adoption check list exists yet (see
// use-live-adoption's own scope, which only returns a portfolio summary, not
// this row-level detail) -- deliberately raw SAP-shaped identities (material
// number, plant code), not the app's own MaterialReference catalog, since
// this table's whole point is comparing against SAP change documents.

export type AdoptionStatus = "ADOPTED" | "PARTIALLY_ADOPTED" | "NOT_ADOPTED" | "UNKNOWN"

export interface AdoptionCheckRow {
  material: string
  plant: string
  checkType: string
  status: AdoptionStatus
  detail: string
}

const PLANTS = ["1300", "1500", "1200"]

const CHECK_TYPES = [
  "Planning-field parameters",
  "Reorder point change",
  "Safety stock change",
  "Max stock change",
]

const DETAIL_BY_STATUS: Record<AdoptionStatus, (rop: number) => string> = {
  UNKNOWN: () => "No SAP change-document evidence is available for this material-plant.",
  ADOPTED: (rop) =>
    `Matching MM02 change document found within 3 days of approval — value updated to ${rop}.`,
  PARTIALLY_ADOPTED: () =>
    "Some recommended fields were updated in SAP, but not all of them match.",
  NOT_ADOPTED: () => "Approved over 14 days ago — no matching change document found in the review window.",
}

/** Deterministic pseudo-random pick, seeded by index, so this fixture data
 * is stable across renders/reloads (no Math.random -- a filter test or
 * screenshot must not change between runs). */
function pick<T>(options: T[], seed: number): T {
  return options[seed % options.length]
}

const STATUS_CYCLE: AdoptionStatus[] = [
  "UNKNOWN",
  "UNKNOWN",
  "UNKNOWN",
  "ADOPTED",
  "PARTIALLY_ADOPTED",
  "NOT_ADOPTED",
]

/** ~60 rows spanning every plant, check type and status so the search box
 * and status filter both have real, varied data to narrow down -- not just
 * a handful of identical UNKNOWN rows. Material numbers follow the same
 * 10-digit SAP-style numbering seen in the real extract (see
 * i7_recommendation.sap_material_number), counting down from a realistic
 * high value. */
export const ADOPTION_CHECK_ROWS: AdoptionCheckRow[] = Array.from({ length: 60 }, (_, i) => {
  const material = String(5000092269 - i * 37).padStart(10, "0")
  const plant = pick(PLANTS, i)
  const checkType = pick(CHECK_TYPES, i + 1)
  const status = pick(STATUS_CYCLE, i)
  const rop = 5 + (i % 12)
  return {
    material,
    plant,
    checkType,
    status,
    detail: DETAIL_BY_STATUS[status](rop),
  }
})
