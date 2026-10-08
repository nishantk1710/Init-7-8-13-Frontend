import { REPAIR_CHAINS } from "@demo/features/initiative-8/data/repair-chains"
import type { DeclarationItem } from "@demo/features/initiative-8/types/repair"

// Deterministic mock data. The Declaration Queue is the mandatory workflow,
// separate from the advisory duplicate check the Spares Assistant runs at
// reservation time — these rows are never merged with the RC-80xx repair
// chains, only cross-referenced via `relatedRepairId` for navigation.
//
// A line released with no completed declaration is what the Exception Queue's
// MISSING_ATTESTATION rows are counting.
//
// D-90112 is Scenario D from the master spec: an MRP-generated PR that still
// needs declaration follow-up.

const SCENARIO_DECLARATIONS: DeclarationItem[] = [
  {
    id: "D-90045",
    pr: { type: "PR", documentNumber: "PR-90045" },
    material: {
      materialId: "800-45210",
      materialCode: "800-45210",
      description: "Conveyor Gearmotor — Overland Conveyor",
    },
    requester: "Riaan Kruger",
    hasActiveRepair: true,
    relatedRepairId: "RC-8005",
    status: "Required",
    nextAction: "Declare condition before this PR can be released.",
    createdAt: "31 Aug 2026",
  },
  {
    id: "D-90112",
    pr: { type: "PR", documentNumber: "PR-90112" },
    material: {
      materialId: "800-18830",
      materialCode: "800-18830",
      description: "Slurry Pump Impeller Assembly",
    },
    requester: "Pieter Steyn",
    hasActiveRepair: true,
    relatedRepairId: "RC-8006",
    status: "Required",
    nextAction: "MRP auto-generated this PR without checking repair status — confirm condition before PO release.",
    createdAt: "1 Sep 2026",
  },
  {
    id: "D-90078",
    pr: { type: "PR", documentNumber: "PR-90078" },
    material: {
      materialId: "800-22110",
      materialCode: "800-22110",
      description: "Crusher Liner Set — Primary Crusher",
    },
    requester: "Thabo Nkosi",
    hasActiveRepair: true,
    relatedRepairId: "RC-8003",
    status: "Required",
    nextAction: "Awaiting maintenance engineer sign-off on condition.",
    createdAt: "29 Aug 2026",
  },
  {
    id: "D-90031",
    pr: { type: "PR", documentNumber: "PR-90031" },
    material: {
      materialId: "800-31090",
      materialCode: "800-31090",
      description: "Hydraulic Cylinder Assy — Stacker Reclaimer",
    },
    requester: "Sarah van Wyk",
    hasActiveRepair: false,
    relatedRepairId: "RC-8004",
    status: "Completed",
    declaredBy: "Sarah van Wyk",
    declaredAt: "26 Aug 2026",
    condition: "Repairable",
    nextAction: "None — repair closed and receipted.",
    createdAt: "2 Jul 2026",
  },
  {
    id: "D-90099",
    pr: { type: "PR", documentNumber: "PR-90099" },
    material: {
      materialId: "800-39950",
      materialCode: "800-39950",
      description: "Control Valve Actuator — Flotation Circuit",
    },
    requester: "Amanda Petersen",
    hasActiveRepair: true,
    relatedRepairId: "RC-8008",
    status: "Flagged",
    nextAction: "Discrepancy — a new-unit PR was raised while a repair PO is already open. Reconcile with buyer.",
    createdAt: "23 Aug 2026",
  },
  {
    id: "D-90205",
    pr: { type: "PR", documentNumber: "PR-90205" },
    material: {
      materialId: "800-27340",
      materialCode: "800-27340",
      description: "Vibrating Screen Motor — Screening Plant",
    },
    requester: "Nomvula Dlamini",
    hasActiveRepair: true,
    relatedRepairId: "RC-8007",
    status: "Required",
    nextAction: "Declare condition — repair unit currently in transit for return.",
    createdAt: "26 Jul 2026",
  },
]

/** The controlled fault-category list the declaration form offers (the backend's default). */
export const FAULT_CATEGORIES = [
  "BEARING_FAILURE",
  "SEAL_LEAK",
  "WEAR",
  "IMPACT_DAMAGE",
  "ELECTRICAL_FAULT",
  "CORROSION",
  "VIBRATION_DAMAGE",
  "OVERHEATING",
  "CONTAMINATION",
  "UNKNOWN",
]

/** Each row carries the quantity still out on its repair line, the form's default. */
export const DECLARATIONS: DeclarationItem[] = SCENARIO_DECLARATIONS.map((d) => {
  const quantity = REPAIR_CHAINS.find((c) => c.id === d.relatedRepairId)?.qtyUnderRepair
  return quantity !== undefined && quantity > 0 ? { ...d, quantityUnderRepair: quantity } : d
})
