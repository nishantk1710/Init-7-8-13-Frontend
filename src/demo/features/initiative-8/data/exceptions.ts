import { JUSTIFICATIONS } from "@demo/features/initiative-8/data/justifications"
import { REPAIR_CHAINS } from "@demo/features/initiative-8/data/repair-chains"
import type { RepairException } from "@demo/features/initiative-8/types/repair"

/**
 * Deterministic mock data — no live SAP connection. "Today" is anchored at
 * 3 Sep 2026, the same reference date the repair chains use.
 *
 * Two checks raise everything here, and the rows are chosen to show both
 * halves of each one:
 *
 * - `MISSING_ATTESTATION` — a repair line went to a vendor with no
 *   condition-to-repair declaration recorded within the ±14-day window. Some
 *   of these predate Spares Automation, which is a reason rather than a
 *   violation, and they carry `preAutomation` so the queue can say so.
 * - `UNJUSTIFIED_ACQUISITION` — a new unit was bought while a repair for the
 *   same material was still open, and nobody recorded why. The ones that WERE
 *   justified are not here; they are in `data/justifications.ts`, which is the
 *   other half of the same record.
 *
 * `repairId` points at a chain in `data/repair-chains.ts` so every row can
 * link through to the register detail page.
 */
export const EXCEPTIONS: RepairException[] = [
  {
    id: "EX-8001",
    type: "UNJUSTIFIED_ACQUISITION",
    severity: "critical",
    material: {
      materialId: "800-14201",
      materialCode: "800-14201",
      description: "Gearbox Bearing Housing Assy — SAG Mill",
    },
    plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
    repairLine: { type: "PO", documentNumber: "PO-81001", line: "10" },
    repairId: "RC-8001",
    acquisitionLine: { type: "PO", documentNumber: "PO-94477", line: "20" },
    title: "New unit bought while 2 units were at the vendor",
    detail:
      "PO-94477/20 ordered 1 new housing on 22 Aug 2026. PO-81001/10 was still open with 2 units at Weir Minerals, expected back 10 Sep 2026. No justification recorded within ±14 days of the order.",
    raisedAt: "22 Aug 2026",
    isOpenRepair: true,
    preAutomation: false,
  },
  {
    id: "EX-8002",
    type: "MISSING_ATTESTATION",
    severity: "warning",
    material: {
      materialId: "800-22110",
      materialCode: "800-22110",
      description: "Crusher Liner Set — Primary Crusher",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    repairLine: { type: "PO", documentNumber: "PO-81003", line: "10" },
    repairId: "RC-8003",
    title: "Repair sent out with no condition declaration",
    detail:
      "The line was released to Metso Outotec on 12 Aug 2026. No condition-to-repair attestation exists for 800-22110 at Black Mountain within ±14 days of that date. D-90078 is still awaiting engineer sign-off.",
    raisedAt: "12 Aug 2026",
    isOpenRepair: true,
    preAutomation: false,
  },
  {
    id: "EX-8003",
    type: "UNJUSTIFIED_ACQUISITION",
    severity: "critical",
    material: {
      materialId: "800-18830",
      materialCode: "800-18830",
      description: "Slurry Pump Impeller Assembly",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    repairLine: { type: "PO", documentNumber: "PO-81006", line: "10" },
    repairId: "RC-8006",
    acquisitionLine: { type: "PR", documentNumber: "PR-90112", line: "10" },
    title: "MRP raised a new-unit PR against an open repair",
    detail:
      "PR-90112 was auto-generated on 1 Sep 2026 without checking repair status. PO-81006/10 has 3 units at Bosch Rexroth. MRP cannot record a justification, so the line reaches the buyer with nothing attached.",
    raisedAt: "1 Sep 2026",
    isOpenRepair: true,
    preAutomation: false,
  },
  {
    id: "EX-8004",
    type: "MISSING_ATTESTATION",
    severity: "warning",
    material: {
      materialId: "800-31090",
      materialCode: "800-31090",
      description: "Hydraulic Power Pack — Apron Feeder",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    repairLine: { type: "PO", documentNumber: "PO-81004", line: "10" },
    repairId: "RC-8004",
    title: "Repair sent out with no condition declaration",
    detail:
      "Released to Voith Industrial Rebuild on 3 Jul 2026, before the declaration workflow went live at Black Mountain Mining. Nothing could have been recorded against this line at the time.",
    raisedAt: "3 Jul 2026",
    isOpenRepair: false,
    preAutomation: true,
  },
  {
    id: "EX-8005",
    type: "MISSING_ATTESTATION",
    severity: "info",
    material: {
      materialId: "800-27340",
      materialCode: "800-27340",
      description: "Screen Deck Vibrator Motor",
    },
    plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
    repairLine: { type: "PO", documentNumber: "PO-81007", line: "10" },
    repairId: "RC-8007",
    title: "Attestation recorded outside the ±14-day window",
    detail:
      "A declaration exists for 800-27340 at Black Mountain Mining, dated 19 days after the line was released. It covers the part but not the decision — raised as information rather than as a breach.",
    raisedAt: "28 Jul 2026",
    isOpenRepair: true,
    preAutomation: false,
  },
  {
    id: "EX-8006",
    type: "MISSING_ATTESTATION",
    severity: "warning",
    material: {
      materialId: "800-45210",
      materialCode: "800-45210",
      description: "Conveyor Gearmotor — Overland Conveyor",
    },
    plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
    repairLine: { type: "PO", documentNumber: "PO-81005", line: "10" },
    repairId: "RC-8005",
    title: "Repair sent out with no condition declaration",
    detail:
      "D-90045 is still open against PR-90045 — the declaration was never completed, and the unit went to Weir Minerals anyway on 18 Aug 2026.",
    raisedAt: "18 Aug 2026",
    isOpenRepair: true,
    preAutomation: false,
  },
  {
    id: "EX-8007",
    type: "UNJUSTIFIED_ACQUISITION",
    severity: "warning",
    material: {
      materialId: "500-14892",
      materialCode: "500-14892",
      description: "Seal Assy, Mech Type XR-200",
    },
    plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
    repairLine: { type: "PO", documentNumber: "PO-81002", line: "10" },
    repairId: "RC-8002",
    acquisitionLine: { type: "PO", documentNumber: "PO-93120", line: "10" },
    title: "New seal set ordered against an open repair",
    detail:
      "PO-93120/10 ordered 2 seal assemblies on 14 Jun 2026, while PO-81002/10 was at SEW-Eurodrive. Predates the justification capture, so no reason was ever asked for.",
    raisedAt: "14 Jun 2026",
    isOpenRepair: true,
    preAutomation: true,
  },
]

/**
 * What the two checks looked at, so a small count reads as a small count and
 * not as a check that never ran. Every acquisition checked is either justified
 * (`data/justifications.ts`) or raised here as unjustified.
 */
export const EXCEPTION_CHECKS = {
  linesChecked: REPAIR_CHAINS.length,
  attestationWindowDays: 14,
  acquisitionsChecked:
    JUSTIFICATIONS.length + EXCEPTIONS.filter((e) => e.type === "UNJUSTIFIED_ACQUISITION").length,
  justificationWindowDays: 14,
  attestationCutoverDate: "15 Jul 2026",
  justificationCutoverDate: "1 Jul 2026",
}
