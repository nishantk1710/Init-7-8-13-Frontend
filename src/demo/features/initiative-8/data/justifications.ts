import { plantRef } from "@demo/features/initiative-8/data/config"
import { materialRef } from "@demo/features/initiative-8/data/materials"
import type { JustificationEntry } from "@demo/features/initiative-8/types/repair"

/**
 * New-acquisition justifications (FR-7): the purchases where somebody was told
 * a repairable unit already existed and recorded why they bought new anyway.
 *
 * Each names the purchase it justifies, so the unjustified-acquisition check
 * can tell a justified purchase from an unjustified one without a date window.
 *
 * `source` says which moment the reason was captured in:
 *
 * - `ASSISTANT` — at reservation time, when the Spares Assistant raised the
 *   repairable unit and asked before the request went through.
 * - `EXCEPTION` — later, when somebody chased the exception.
 *
 * They are different kinds of evidence about the same person's reasoning, and
 * a log that flattened them would invite a reader to treat the second as the
 * first. Benefit attribution counts only purchases avoided, so this log is the
 * other side of it: how anyone finds out whether the advice is landing.
 */

/** The reason categories the form offers. VZI's own list is still awaited. */
export const JUSTIFICATION_REASONS = [
  "PRODUCTION_CRITICAL",
  "REPAIR_OVERDUE",
  "REPAIR_NOT_ECONOMICAL",
  "BEYOND_ECONOMICAL_REPAIR",
  "SPECIFICATION_CHANGE",
  "SHUTDOWN_COVER",
]

type Seed = Omit<JustificationEntry, "material" | "plant"> & { materialId: string; plantId: string }

const SEEDS: Seed[] = [
  {
    id: "J-7001",
    materialId: "800-14201",
    plantId: "PLANT-GBG",
    source: "ASSISTANT",
    reasonCategory: "PRODUCTION_CRITICAL",
    freeText:
      "SAG mill is the only path for Gamsberg feed. The repair returns 10 Sep at the earliest and we have one unit on the floor — a second failure before then stops the plant. Buying one new as standing cover; the repaired pair still comes back to stores.",
    author: "Riaan Kruger",
    recordedAt: "22 Aug 2026, 10:42",
    acquisitionLine: { type: "PO", documentNumber: "PO-94477", line: "20" },
    sessionId: "SR8N3XJ5PB",
    reservation: { type: "RESERVATION", documentNumber: "0041288", line: "1" },
  },
  {
    id: "J-7002",
    materialId: "800-27340",
    plantId: "PLANT-BMM",
    source: "ASSISTANT",
    reasonCategory: "REPAIR_NOT_ECONOMICAL",
    freeText:
      "Metso quoted R41k against R52k new for the rewind, with no warranty, and this motor is on its third trip back in eighteen months. Buying new for the duty position; the units at Metso come back as shelf spares.",
    author: "Nangula Shivute",
    recordedAt: "27 Aug 2026, 09:41",
    acquisitionLine: { type: "PO", documentNumber: "PO-94701", line: "10" },
    sessionId: "SN4R7TC2XE",
    reservation: { type: "RESERVATION", documentNumber: "0041298", line: "1" },
  },
  {
    id: "J-7003",
    materialId: "800-58830",
    plantId: "PLANT-GBG",
    source: "EXCEPTION",
    reasonCategory: "REPAIR_OVERDUE",
    freeText:
      "Bosch has held this drive for six weeks against a 14-day planned turnaround and will not commit to a return date. Bought a replacement to get the reclaimer back. Chasing the repair separately for credit.",
    author: "Thabo Nkosi",
    recordedAt: "2 Sep 2026, 08:20",
    acquisitionLine: { type: "PO", documentNumber: "PO-94812", line: "10" },
    exceptionId: "EX-UA-94812",
  },
  {
    id: "J-7004",
    materialId: "800-52260",
    plantId: "PLANT-GBG",
    source: "ASSISTANT",
    reasonCategory: "SPECIFICATION_CHANGE",
    freeText:
      "The tailings pump was re-engineered in June and now needs the high-solids face. The two cartridges on the shelf are the old spec and will not fit — they stay for the two unmodified pumps.",
    author: "Anton de Villiers",
    recordedAt: "14 Aug 2026, 11:58",
    acquisitionLine: { type: "PO", documentNumber: "PO-93980", line: "10" },
    sessionId: "SB2Q9LM6TC",
    reservation: { type: "RESERVATION", documentNumber: "0041251", line: "1" },
  },
  {
    id: "J-7005",
    materialId: "800-31090",
    plantId: "PLANT-BMM",
    source: "EXCEPTION",
    reasonCategory: "BEYOND_ECONOMICAL_REPAIR",
    freeText:
      "Voith stripped the pack and found the manifold cracked through. The replacement was ordered on their verbal report, ahead of the formal BER declaration; the repair PO line is cancelled.",
    author: "Jacques Louw",
    recordedAt: "29 Aug 2026, 16:33",
    acquisitionLine: { type: "PO", documentNumber: "PO-94655", line: "10" },
    exceptionId: "EX-UA-94655",
  },
  {
    id: "J-7006",
    materialId: "800-39950",
    plantId: "PLANT-GBG",
    source: "ASSISTANT",
    reasonCategory: "SHUTDOWN_COVER",
    freeText:
      "The October shutdown needs two drives on site on day one. One is going to SEW with no firm return date. Holding a new unit as shutdown cover — it stays in stores if the repair lands in time.",
    author: "Marius Botha",
    recordedAt: "2 Sep 2026, 07:15",
    acquisitionLine: { type: "PR", documentNumber: "PR-90640", line: "10" },
    sessionId: "SW5C2NE9JR",
    reservation: { type: "RESERVATION", documentNumber: "0041330", line: "1" },
  },
]

export const SEED_JUSTIFICATIONS: JustificationEntry[] = SEEDS.map(({ materialId, plantId, ...rest }) => ({
  ...rest,
  material: materialRef(materialId),
  plant: plantRef(plantId),
}))
