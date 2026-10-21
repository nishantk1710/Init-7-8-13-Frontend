import type { PlantReference } from "@demo/lib/domain/contracts"

/**
 * The Snapshot's settings — the same knobs live keeps in backend
 * configuration (`app/initiatives/i8/config.py`), with live's values where
 * live has one.
 *
 * Deterministic mock data, no SAP connection. "Today" for every day count in
 * this module is REFERENCE_DATE.
 */

export const REFERENCE_DATE = "3 Sep 2026"

/** Days past EKET.EINDT before a repair reads Overdue (FR-9). Live: 7, ruled 21-Sep. */
export const OVERDUE_GRACE_DAYS = 7

/** Aging band upper bounds, days. Live's placeholders, pending VZI calibration. */
export const AGING_BAND_BOUNDS = [15, 30, 45, 60] as const

/** The declaration control went live. A line raised earlier could not have one. */
export const ATTESTATION_CUTOVER = "15 Jul 2026"

/** The Spares Assistant went live: session ids and justifications from here. */
export const ASSISTANT_CUTOVER = "1 Jul 2026"

/** How long an assistant session stays valid with no answer. Live: 72 hours. */
export const SESSION_VALIDITY_HOURS = 72

/** Coding candidates at or above this confidence meet the threshold (FR-2). */
export const CODING_CONFIDENCE_THRESHOLD = "medium"

/** Who screened the coding candidates — the banner's "Screened by …" line. */
export const CODING_SCREEN = { provider: "foundry", model: "gpt-4o" }

/** The two in-scope plants (FRS §8 item 10), with their SAP plant codes. */
export const I8_PLANTS: (PlantReference & { sapPlantCode: string })[] = [
  { plantId: "PLANT-BMM", name: "Black Mountain Mining", sapPlantCode: "1300" },
  { plantId: "PLANT-GBG", name: "Gamsberg", sapPlantCode: "1500" },
]

export function plantRef(plantId: string): PlantReference {
  const plant = I8_PLANTS.find((p) => p.plantId === plantId)
  return { plantId, name: plant?.name ?? plantId }
}
