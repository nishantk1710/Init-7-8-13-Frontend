import type { DeclarationItem } from "@/features/initiative-8/types/repair"

// Deterministic mock data. The Declaration Queue is a separate, mandatory
// workflow from the advisory Duplicate Guard check — these rows are never
// merged with the RC-80xx repair chains, only cross-referenced via
// `relatedRepairId` for navigation.
//
// D-90112 is Scenario D from the master spec: an MRP-generated PR that still
// needs declaration follow-up.

export const DECLARATIONS: DeclarationItem[] = [
  {
    id: "D-90045",
    pr: { type: "PR", documentNumber: "PR-90045" },
    material: {
      materialId: "800-45210",
      materialCode: "800-45210",
      description: "Conveyor Gearmotor — Overland Conveyor",
    },
    requester: "Riaan Kruger",
    source: "Manual",
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
    source: "MRP-generated",
    hasActiveRepair: true,
    relatedRepairId: "RC-8006",
    status: "Pending",
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
    source: "Manual",
    hasActiveRepair: true,
    relatedRepairId: "RC-8003",
    status: "Pending",
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
    source: "Manual",
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
    source: "Manual",
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
    source: "Manual",
    hasActiveRepair: true,
    relatedRepairId: "RC-8007",
    status: "Required",
    nextAction: "Declare condition — repair unit currently in transit for return.",
    createdAt: "26 Jul 2026",
  },
]

export function getDeclarationById(id: string): DeclarationItem | undefined {
  return DECLARATIONS.find((d) => d.id === id)
}
