import type { JustificationEntry } from "@demo/features/initiative-8/types/repair"

/**
 * Deterministic mock data — no live SAP connection. Anchored at 3 Sep 2026.
 *
 * The other half of the Exception Queue's record: these are the new-unit
 * purchases where somebody WAS told a repairable unit already existed and
 * recorded why they bought anyway. The ones with no reason on file are the
 * `UNJUSTIFIED_ACQUISITION` rows in `data/exceptions.ts` — the two files are
 * disjoint on purpose, and together they cover every acquisition the check
 * looked at.
 *
 * `source` says which moment the reason was captured in:
 *
 * - `ASSISTANT` — written at reservation time, when the Spares Assistant
 *   raised the open repair and asked before the request went through.
 * - `EXCEPTION` — written weeks later, when somebody chased the exception.
 *
 * They are different kinds of evidence about the same person's reasoning, and
 * a log that flattened them would invite a reader to treat the second as the
 * first. Benefit attribution counts only avoided purchases, so this log is the
 * denominator: it is how anyone finds out whether the advice is landing.
 */
export const JUSTIFICATIONS: JustificationEntry[] = [
  {
    id: "J-7001",
    material: {
      materialId: "800-14201",
      materialCode: "800-14201",
      description: "Gearbox Bearing Housing Assy — SAG Mill",
    },
    plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
    source: "ASSISTANT",
    reasonCategory: "PRODUCTION_CRITICAL",
    freeText:
      "SAG mill is the only path for Gamsberg feed. Repair returns 10 Sep at the earliest and we have one unit on the floor — a second failure before then stops the plant. Buying one new as standing cover; the repaired pair still comes back to stores.",
    author: "R. Kruger",
    recordedAt: "22 Aug 2026, 10:42",
    acquisitionLine: { type: "PO", documentNumber: "PO-94477", line: "20" },
    sessionId: "SES-4471",
  },
  {
    id: "J-7002",
    material: {
      materialId: "800-27340",
      materialCode: "800-27340",
      description: "Screen Deck Vibrator Motor",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    source: "ASSISTANT",
    reasonCategory: "REPAIR_NOT_ECONOMICAL",
    freeText:
      "Vendor quoted R41k against R52k new, with no warranty on the rewind. Third time this unit has been back in eighteen months. Buying new and scrapping the core.",
    author: "N. Shivute",
    recordedAt: "27 Aug 2026, 14:05",
    acquisitionLine: { type: "PO", documentNumber: "PO-94701", line: "10" },
    sessionId: "SES-4488",
  },
  {
    id: "J-7003",
    material: {
      materialId: "800-22110",
      materialCode: "800-22110",
      description: "Crusher Liner Set — Primary Crusher",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    source: "EXCEPTION",
    reasonCategory: "REPAIR_OVERDUE",
    freeText:
      "Metso has held this set for 61 days against a 30-day turnaround and will not commit to a return date. Bought a replacement set to get the crusher back. Chasing the repair separately for credit.",
    author: "T. Nkosi",
    recordedAt: "1 Sep 2026, 08:20",
    acquisitionLine: { type: "PO", documentNumber: "PO-94812", line: "10" },
    exceptionId: "EX-8002",
  },
  {
    id: "J-7004",
    material: {
      materialId: "500-14892",
      materialCode: "500-14892",
      description: "Seal Assy, Mech Type XR-200",
    },
    plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
    source: "ASSISTANT",
    reasonCategory: "SPECIFICATION_CHANGE",
    freeText:
      "Pump was re-impellered in June and now needs the XR-200H face. The units at SEW are the old spec and will not fit the rebuilt casing — they go back to stores for the two unmodified pumps.",
    author: "A. de Villiers",
    recordedAt: "14 Aug 2026, 11:58",
    acquisitionLine: { type: "PO", documentNumber: "PO-93980", line: "10" },
    sessionId: "SES-4402",
  },
  {
    id: "J-7005",
    material: {
      materialId: "800-31090",
      materialCode: "800-31090",
      description: "Hydraulic Power Pack — Apron Feeder",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    source: "EXCEPTION",
    reasonCategory: "BEYOND_ECONOMICAL_REPAIR",
    freeText:
      "Voith stripped the pack and found the manifold cracked through. Declared BER on inspection, after the order was already placed. Repair PO being cancelled.",
    author: "J. Louw",
    recordedAt: "29 Aug 2026, 16:33",
    acquisitionLine: { type: "PO", documentNumber: "PO-94655", line: "10" },
    exceptionId: "EX-8004",
  },
  {
    id: "J-7006",
    material: {
      materialId: "800-39950",
      materialCode: "800-39950",
      description: "Thickener Rake Drive Gearbox",
    },
    plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
    source: "ASSISTANT",
    reasonCategory: "SHUTDOWN_COVER",
    freeText:
      "October shutdown needs two units on site on day one. One is at SEW with no firm return date. Holding a new unit as shutdown cover — it stays in stores if the repair lands in time.",
    author: "M. Botha",
    recordedAt: "2 Sep 2026, 07:15",
    acquisitionLine: { type: "PR", documentNumber: "PR-90640", line: "10" },
    sessionId: "SES-4512",
  },
]
