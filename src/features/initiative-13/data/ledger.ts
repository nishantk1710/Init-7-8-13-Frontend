// Seed dataset for the OAR Utilization Ledger — every line anchored on a
// reservation, carrying the full RR -> Reservation -> PR -> PO -> GR -> GI ->
// Utilization Confirmation document chain. Deterministic mock data only, no
// live SAP reads. "Today" for aging-day math is fixed at 3 Sep 2026.
//
// Seed scenarios (see README for the full mapping):
//   E — OAR-LDG-0001  full happy path, no exceptions
//   F — OAR-LDG-0002  issued, utilization confirmation overdue
//   G — OAR-LDG-0003  no longer required -> feeds Redeployment pool
//   H — OAR-LDG-0004/0005/0006  three reservations consolidated into one PR/PO
//   I — OAR-LDG-0007  frequent-use reclassification candidate (500-31005)
//   fillers — OAR-LDG-0008..0011 (one previously re-planned, one early-stage)

import { getUserById } from "@/lib/shared-data/users"
import { getPlantById } from "@/lib/shared-data/plants"
import type { OARPersonRef, UtilizationLedgerLine } from "@/features/initiative-13/types/oar"
import { materialRef, unitPriceFor } from "@/features/initiative-13/data/materials"
import { USING_GENERATED_DATA } from "@/lib/sap/dataset-mode"
import generatedLedger from "@/features/initiative-13/data/generated/ledger.json"

function person(userId: string): OARPersonRef {
  const user = getUserById(userId)
  if (!user) throw new Error(`Unknown shared user id: ${userId}`)
  return { userId: user.userId, name: user.name, role: user.role }
}

function plant(plantId: string) {
  const p = getPlantById(plantId)
  if (!p) throw new Error(`Unknown plant id: ${plantId}`)
  return { plantId: p.plantId, name: p.name }
}

const RIAAN = person("U-007") // Requester — Maintenance
const AMANDA = person("U-008") // Requester — Projects

const SCENARIO_LEDGER_LINES: UtilizationLedgerLine[] = [
  // ---- Scenario E: full happy path, no exceptions --------------------------
  {
    id: "OAR-LDG-0001",
    trackingId: "OAR-TRK-0001",
    reservation: { type: "RESERVATION", documentNumber: "RES-500114", line: "0010" },
    material: materialRef("500-14892"),
    unitPrice: unitPriceFor("500-14892"),
    requester: RIAAN,
    department: "Milling",
    plant: plant("PLANT-GBG"),
    purpose: "Planned pump seal replacement — Milling Unit 3",
    project: "MIL-SHUT-2026",
    jobWorkOrder: "WO-88213",
    equipment: "Warman 8/6 AH slurry pump",
    plannedConsumptionDate: "15 Jul 2026",
    qtyRequested: 2,
    qtyReceived: 2,
    qtyIssued: 2,
    qtyConfirmedUsed: 2,
    uom: "EA",
    stage: "Utilization Confirmed",
    agingDays: 0,
    exception: "None",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100241" }, timestamp: "1 Jul 2026", description: "Request raised in chat session SPR-2847" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500114" }, timestamp: "1 Jul 2026", description: "Reservation created against Milling Unit 3 cost center" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71042" }, timestamp: "3 Jul 2026", description: "Purchase requisition raised" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91188" }, timestamp: "5 Jul 2026", description: "PO placed with Flowserve" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330201" }, timestamp: "12 Jul 2026", description: "2 EA received into stores" },
      { id: "c6", stage: "Goods Issued", doc: { type: "GI", documentNumber: "GI-441209" }, timestamp: "14 Jul 2026", description: "2 EA issued to Milling Unit 3" },
      { id: "c7", stage: "Utilization Confirmed", timestamp: "16 Jul 2026", description: "Requester confirmed both seals fitted and consumed", tone: "success" },
    ],
  },

  // ---- Scenario F: issued, utilization confirmation overdue ----------------
  {
    id: "OAR-LDG-0002",
    trackingId: "OAR-TRK-0002",
    reservation: { type: "RESERVATION", documentNumber: "RES-500188", line: "0010" },
    material: materialRef("500-08823"),
    unitPrice: unitPriceFor("500-08823"),
    requester: AMANDA,
    department: "Flotation",
    plant: plant("PLANT-BMM"),
    purpose: "Reactive impeller replacement — vibration trend on FP-2",
    jobWorkOrder: "WO-88410",
    equipment: "FP-2 flotation feed pump",
    plannedConsumptionDate: "12 Aug 2026",
    qtyRequested: 1,
    qtyReceived: 1,
    qtyIssued: 1,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "Goods Issued",
    agingDays: 22,
    exception: "Consumption Overdue",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100266" }, timestamp: "22 Jul 2026", description: "Request raised in chat session SPR-2822" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500188" }, timestamp: "22 Jul 2026", description: "Reservation created against FP-2 cost center" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71098" }, timestamp: "24 Jul 2026", description: "Purchase requisition raised" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91233" }, timestamp: "26 Jul 2026", description: "PO placed with Warman" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330244" }, timestamp: "5 Aug 2026", description: "1 EA received into stores" },
      { id: "c6", stage: "Goods Issued", doc: { type: "GI", documentNumber: "GI-441267" }, timestamp: "8 Aug 2026", description: "1 EA issued to FP-2 work order" },
      { id: "c7", stage: "Goods Issued", timestamp: "3 Sep 2026", description: "Planned consumption date passed 22 days ago — utilization confirmation still outstanding", tone: "warning" },
    ],
  },

  // ---- Scenario G: no longer required -> feeds Redeployment pool -----------
  {
    id: "OAR-LDG-0003",
    trackingId: "OAR-TRK-0003",
    reservation: { type: "RESERVATION", documentNumber: "RES-500152", line: "0010" },
    material: materialRef("500-22140"),
    unitPrice: unitPriceFor("500-22140"),
    requester: RIAAN,
    department: "Conveyance",
    plant: plant("PLANT-SKZ"),
    purpose: "Idler bearing replacement — CV-14 stacker conveyor",
    jobWorkOrder: "WO-87790",
    equipment: "CV-14 stacker conveyor",
    plannedConsumptionDate: "5 Aug 2026",
    qtyRequested: 4,
    qtyReceived: 4,
    qtyIssued: 0,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "Available for Redeployment",
    agingDays: 29,
    exception: "No Longer Required",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100210" }, timestamp: "10 Jul 2026", description: "Request raised in chat session SPR-2831" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500152" }, timestamp: "10 Jul 2026", description: "Reservation created against CV-14 cost center" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71066" }, timestamp: "12 Jul 2026", description: "Purchase requisition raised" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91201" }, timestamp: "14 Jul 2026", description: "PO placed with SKF" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330219" }, timestamp: "29 Jul 2026", description: "4 EA received into stores" },
      { id: "c6", stage: "No Longer Required", timestamp: "20 Aug 2026", description: "CV-14 idler replaced under warranty claim instead — requester marked stock no longer required", tone: "warning" },
    ],
  },

  // ---- Scenario H: 3 reservations consolidated into one PR/PO --------------
  {
    id: "OAR-LDG-0004",
    trackingId: "OAR-TRK-0004",
    reservation: { type: "RESERVATION", documentNumber: "RES-500201", line: "0010" },
    material: materialRef("500-40011"),
    unitPrice: unitPriceFor("500-40011"),
    requester: RIAAN,
    department: "Milling",
    plant: plant("PLANT-GBG"),
    purpose: "Mill trunnion bearing — planned condition-based replacement",
    jobWorkOrder: "WO-88501",
    equipment: "Mill 2 trunnion, drive end",
    plannedConsumptionDate: "20 Sep 2026",
    qtyRequested: 1,
    qtyReceived: 0,
    qtyIssued: 0,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "PO Raised",
    agingDays: 0,
    exception: "None",
    allocationMethod: "Shared / FIFO Mock Allocation",
    consolidatedGroupId: "CG-PR-71300",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100301" }, timestamp: "12 Aug 2026", description: "Request raised in chat session SPR-2798" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500201" }, timestamp: "12 Aug 2026", description: "Reservation created against Mill 2 cost center" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71300" }, timestamp: "14 Aug 2026", description: "Consolidated with 2 other reservations into one requisition — not a 1:1 SAP link" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91400" }, timestamp: "16 Aug 2026", description: "Consolidated PO placed with Timken — quantity split across reservations on receipt (FIFO mock allocation)" },
    ],
  },
  {
    id: "OAR-LDG-0005",
    trackingId: "OAR-TRK-0005",
    reservation: { type: "RESERVATION", documentNumber: "RES-500202", line: "0010" },
    material: materialRef("500-40011"),
    unitPrice: unitPriceFor("500-40011"),
    requester: AMANDA,
    department: "Projects",
    plant: plant("PLANT-GBG"),
    purpose: "Mill 2 shutdown project — spare trunnion bearing stock-up",
    project: "MIL-SHUT-2026",
    jobWorkOrder: "WO-88512",
    equipment: "Mill 2 trunnion, non-drive end",
    plannedConsumptionDate: "22 Sep 2026",
    qtyRequested: 2,
    qtyReceived: 0,
    qtyIssued: 0,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "PO Raised",
    agingDays: 0,
    exception: "None",
    allocationMethod: "Shared / FIFO Mock Allocation",
    consolidatedGroupId: "CG-PR-71300",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100308" }, timestamp: "13 Aug 2026", description: "Request raised in chat session SPR-2801" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500202" }, timestamp: "13 Aug 2026", description: "Reservation created against Mill 2 shutdown project" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71300" }, timestamp: "14 Aug 2026", description: "Consolidated with 2 other reservations into one requisition — not a 1:1 SAP link" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91400" }, timestamp: "16 Aug 2026", description: "Consolidated PO placed with Timken — quantity split across reservations on receipt (FIFO mock allocation)" },
    ],
  },
  {
    id: "OAR-LDG-0006",
    trackingId: "OAR-TRK-0006",
    reservation: { type: "RESERVATION", documentNumber: "RES-500203", line: "0010" },
    material: materialRef("500-40011"),
    unitPrice: unitPriceFor("500-40011"),
    requester: RIAAN,
    department: "Engineering",
    plant: plant("PLANT-GBG"),
    purpose: "Engineering spares pool replenishment",
    jobWorkOrder: "WO-88519",
    equipment: "Engineering spares store",
    plannedConsumptionDate: "18 Sep 2026",
    qtyRequested: 1,
    qtyReceived: 1,
    qtyIssued: 0,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "Goods Receipt",
    agingDays: 0,
    exception: "None",
    allocationMethod: "Shared / FIFO Mock Allocation",
    consolidatedGroupId: "CG-PR-71300",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100312" }, timestamp: "13 Aug 2026", description: "Request raised in chat session SPR-2805" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500203" }, timestamp: "13 Aug 2026", description: "Reservation created against Engineering spares pool" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71300" }, timestamp: "14 Aug 2026", description: "Consolidated with 2 other reservations into one requisition — not a 1:1 SAP link" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91400" }, timestamp: "16 Aug 2026", description: "Consolidated PO placed with Timken — quantity split across reservations on receipt (FIFO mock allocation)" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330288" }, timestamp: "30 Aug 2026", description: "1 EA allocated to this reservation from the consolidated receipt (FIFO mock allocation)" },
    ],
  },

  // ---- Scenario I: frequent-use reclassification candidate -----------------
  {
    id: "OAR-LDG-0007",
    trackingId: "OAR-TRK-0007",
    reservation: { type: "RESERVATION", documentNumber: "RES-500097", line: "0010" },
    material: materialRef("500-31005"),
    unitPrice: unitPriceFor("500-31005"),
    requester: AMANDA,
    department: "Instrumentation",
    plant: plant("PLANT-GBG"),
    purpose: "Reagent dosing skid pressure transmitter replacement — bank 2",
    jobWorkOrder: "WO-88104",
    equipment: "Reagent dosing skid — bank 2",
    plannedConsumptionDate: "1 Jul 2026",
    qtyRequested: 1,
    qtyReceived: 1,
    qtyIssued: 1,
    qtyConfirmedUsed: 1,
    uom: "EA",
    stage: "Utilization Confirmed",
    agingDays: 0,
    exception: "None",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100188" }, timestamp: "18 Jun 2026", description: "Request raised in chat session SPR-2847-I" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500097" }, timestamp: "18 Jun 2026", description: "Reservation created against reagent dosing skid" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-70911" }, timestamp: "19 Jun 2026", description: "Purchase requisition raised" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91050" }, timestamp: "20 Jun 2026", description: "PO placed with Endress+Hauser" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330166" }, timestamp: "27 Jun 2026", description: "1 EA received into stores" },
      { id: "c6", stage: "Goods Issued", doc: { type: "GI", documentNumber: "GI-441150" }, timestamp: "29 Jun 2026", description: "1 EA issued to bank 2" },
      { id: "c7", stage: "Utilization Confirmed", timestamp: "1 Jul 2026", description: "Requester confirmed transmitter fitted and consumed", tone: "success" },
    ],
  },

  // ---- Fillers ---------------------------------------------------------------
  {
    id: "OAR-LDG-0008",
    trackingId: "OAR-TRK-0008",
    reservation: { type: "RESERVATION", documentNumber: "RES-500171", line: "0010" },
    material: materialRef("500-19560"),
    unitPrice: unitPriceFor("500-19560"),
    requester: RIAAN,
    department: "Milling",
    plant: plant("PLANT-BMM"),
    purpose: "Control valve replacement — reagent dosing line",
    jobWorkOrder: "WO-88377",
    equipment: "Reagent dosing line 3",
    plannedConsumptionDate: "18 Aug 2026",
    qtyRequested: 1,
    qtyReceived: 1,
    qtyIssued: 1,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "Goods Issued",
    agingDays: 16,
    exception: "Consumption Overdue",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100255" }, timestamp: "21 Jul 2026", description: "Request raised in chat session SPR-2795" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500171" }, timestamp: "21 Jul 2026", description: "Reservation created against dosing line 3" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71080" }, timestamp: "23 Jul 2026", description: "Purchase requisition raised" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91219" }, timestamp: "25 Jul 2026", description: "PO placed with Fisher/Motion Control Systems" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330233" }, timestamp: "10 Aug 2026", description: "1 EA received into stores" },
      { id: "c6", stage: "Goods Issued", doc: { type: "GI", documentNumber: "GI-441244" }, timestamp: "12 Aug 2026", description: "1 EA issued to dosing line 3" },
      { id: "c7", stage: "Goods Issued", timestamp: "27 Aug 2026", description: "Escalated — requester unresponsive to confirmation reminders", tone: "danger" },
    ],
  },
  {
    id: "OAR-LDG-0009",
    trackingId: "OAR-TRK-0009",
    reservation: { type: "RESERVATION", documentNumber: "RES-500219", line: "0010" },
    material: materialRef("500-55210"),
    unitPrice: unitPriceFor("500-55210"),
    requester: AMANDA,
    department: "Conveyance",
    plant: plant("PLANT-SKZ"),
    purpose: "Standby motor for conveyor drive replacement",
    jobWorkOrder: "WO-88540",
    equipment: "CV-06 overland conveyor drive",
    plannedConsumptionDate: "10 Sep 2026",
    qtyRequested: 1,
    qtyReceived: 0,
    qtyIssued: 0,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "PO Raised",
    agingDays: 0,
    exception: "None",
    replanReason: "Shutdown window moved to align with planned outage",
    replanNewDate: "10 Sep 2026",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100320" }, timestamp: "14 Aug 2026", description: "Request raised in chat session SPR-2811" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500219" }, timestamp: "14 Aug 2026", description: "Reservation created against CV-06 cost center" },
      { id: "c3", stage: "Re-planned", timestamp: "18 Aug 2026", description: "Requester re-planned from 20 Aug 2026 to 10 Sep 2026 — shutdown window moved to align with planned outage", tone: "warning" },
      { id: "c4", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-71310" }, timestamp: "19 Aug 2026", description: "Purchase requisition raised" },
      { id: "c5", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-91410" }, timestamp: "21 Aug 2026", description: "PO placed with WEG" },
    ],
  },
  {
    id: "OAR-LDG-0010",
    trackingId: "OAR-TRK-0010",
    reservation: { type: "RESERVATION", documentNumber: "RES-500063", line: "0010" },
    material: materialRef("500-14892"),
    unitPrice: unitPriceFor("500-14892"),
    requester: RIAAN,
    department: "Milling",
    plant: plant("PLANT-BMM"),
    purpose: "Preventive seal kit stock-up ahead of Q3 shutdown",
    project: "MIL-SHUT-2026",
    jobWorkOrder: "WO-87950",
    equipment: "Warman 6/4 AH slurry pump",
    plannedConsumptionDate: "28 Jun 2026",
    qtyRequested: 3,
    qtyReceived: 3,
    qtyIssued: 3,
    qtyConfirmedUsed: 3,
    uom: "EA",
    stage: "Utilization Confirmed",
    agingDays: 0,
    exception: "None",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100150" }, timestamp: "10 Jun 2026", description: "Request raised in chat session SPR-2760" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500063" }, timestamp: "10 Jun 2026", description: "Reservation created against Milling stores" },
      { id: "c3", stage: "PR Raised", doc: { type: "PR", documentNumber: "PR-70850" }, timestamp: "12 Jun 2026", description: "Purchase requisition raised" },
      { id: "c4", stage: "PO Raised", doc: { type: "PO", documentNumber: "PO-90980" }, timestamp: "14 Jun 2026", description: "PO placed with Flowserve" },
      { id: "c5", stage: "Goods Receipt", doc: { type: "GR", documentNumber: "GR-330120" }, timestamp: "24 Jun 2026", description: "3 EA received into stores" },
      { id: "c6", stage: "Goods Issued", doc: { type: "GI", documentNumber: "GI-441090" }, timestamp: "26 Jun 2026", description: "3 EA issued to Milling stores" },
      { id: "c7", stage: "Utilization Confirmed", timestamp: "28 Jun 2026", description: "Requester confirmed seal kits fitted during Q3 shutdown", tone: "success" },
    ],
  },
  {
    id: "OAR-LDG-0011",
    trackingId: "OAR-TRK-0011",
    reservation: { type: "RESERVATION", documentNumber: "RES-500241", line: "0010" },
    material: materialRef("OAR-77002"),
    unitPrice: unitPriceFor("OAR-77002"),
    requester: AMANDA,
    department: "Engineering",
    plant: plant("PLANT-SKZ"),
    purpose: "Standby flexible coupling for conveyor gearbox rebuild",
    jobWorkOrder: "WO-88602",
    equipment: "CV-09 gearbox",
    plannedConsumptionDate: "25 Sep 2026",
    qtyRequested: 2,
    qtyReceived: 0,
    qtyIssued: 0,
    qtyConfirmedUsed: 0,
    uom: "EA",
    stage: "Reserved",
    agingDays: 0,
    exception: "None",
    documentChain: [
      { id: "c1", stage: "Requested", doc: { type: "RR", documentNumber: "RR-100340" }, timestamp: "28 Aug 2026", description: "Request raised in chat session SPR-2819" },
      { id: "c2", stage: "Reserved", doc: { type: "RESERVATION", documentNumber: "RES-500241" }, timestamp: "28 Aug 2026", description: "Reservation created against CV-09 gearbox rebuild" },
    ],
  },
]

/** Mapped from SAP + platform rows by `npm run dataset:build`. See lib/sap/dataset-mode. */
export const LEDGER_LINES: UtilizationLedgerLine[] = USING_GENERATED_DATA
  ? (generatedLedger as unknown as UtilizationLedgerLine[])
  : SCENARIO_LEDGER_LINES

export function getLedgerLineById(id: string): UtilizationLedgerLine | undefined {
  return LEDGER_LINES.find((line) => line.id === id)
}

export function getLedgerLinesByMaterial(materialId: string): UtilizationLedgerLine[] {
  return LEDGER_LINES.filter((line) => line.material.materialId === materialId)
}
