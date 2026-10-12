import type { MaterialReference } from "@demo/lib/domain/contracts"
import type { RepairableMaterialSeed } from "@demo/features/initiative-8/types/repair"

/**
 * The 80-series material master — the one place a material's name, rating and
 * value are written, so every screen calls a part the same thing.
 *
 * What each field stands for in SAP: description is MAKT, `unitValue` is the
 * MBEW unit value (the avoided-purchase benefit), `criticality` is the
 * platform's critical-parts list, and each plant row is MARD stock plus MARC
 * reorder point, MRP type and planned delivery time.
 *
 * Deliberately uneven, as the real extracts are: one material is known only
 * from MARD and EKPO (not in MARA), one has no MARD row, two are flagged for
 * deletion and drop out of the universe, and several Gamsberg rows carry no
 * planned delivery time.
 */
export const MATERIALS: RepairableMaterialSeed[] = [
  {
    materialId: "800-14201",
    description: "Gearbox Bearing Housing Assy — SAG Mill",
    criticality: "CRITICAL",
    unitValue: 186_000,
    newUnitLeadTimeDays: 70,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 1, reorderPoint: 4, plannedDeliveryDays: 30, mrpType: "VB" }],
  },
  {
    materialId: "800-52260",
    description: "Mechanical Seal Cartridge — Tailings Pump",
    criticality: "NORMAL",
    unitValue: 48_500,
    newUnitLeadTimeDays: 28,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 2, reorderPoint: 2, plannedDeliveryDays: 21, mrpType: "VB" }],
  },
  {
    materialId: "800-22110",
    description: "Crusher Liner Set — Primary Crusher",
    criticality: "IMPACT",
    unitValue: 312_000,
    newUnitLeadTimeDays: 84,
    inMaterialMaster: true,
    plants: [
      { plantId: "PLANT-BMM", stockOnHand: 2, reorderPoint: 2, plannedDeliveryDays: 28, mrpType: "PD" },
      { plantId: "PLANT-GBG", stockOnHand: 1, reorderPoint: 1, plannedDeliveryDays: 35, mrpType: "PD" },
    ],
  },
  {
    materialId: "800-31090",
    description: "Hydraulic Power Pack — Apron Feeder",
    criticality: "NORMAL",
    unitValue: 142_000,
    newUnitLeadTimeDays: 56,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 0, reorderPoint: 1, plannedDeliveryDays: 45, mrpType: "VB" }],
  },
  {
    materialId: "800-45210",
    description: "Conveyor Gearmotor — Overland Conveyor",
    criticality: "CRITICAL",
    unitValue: 98_000,
    newUnitLeadTimeDays: 42,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 0, reorderPoint: 2, mrpType: "VB" }],
  },
  {
    materialId: "800-18830",
    description: "Slurry Pump Impeller Assembly",
    criticality: "IMPACT",
    unitValue: 76_000,
    newUnitLeadTimeDays: 35,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 1, reorderPoint: 3, plannedDeliveryDays: 35, mrpType: "PD" }],
  },
  {
    materialId: "800-27340",
    description: "Screen Deck Vibrator Motor",
    unitValue: 52_000,
    newUnitLeadTimeDays: 30,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 2, reorderPoint: 2, plannedDeliveryDays: 42, mrpType: "VB" }],
  },
  {
    materialId: "800-39950",
    description: "Thickener Rake Drive Gearbox",
    criticality: "INSURANCE",
    unitValue: 265_000,
    newUnitLeadTimeDays: 120,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 1, reorderPoint: 1, plannedDeliveryDays: 60, mrpType: "ND" }],
  },
  {
    materialId: "800-60415",
    description: "Ball Mill Pinion Bearing Assy",
    criticality: "CRITICAL",
    unitValue: 224_000,
    newUnitLeadTimeDays: 90,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 1, reorderPoint: 2, plannedDeliveryDays: 40, mrpType: "VB" }],
  },
  {
    materialId: "800-33870",
    description: "Flotation Cell Agitator Motor 75 kW",
    criticality: "IMPACT",
    unitValue: 88_000,
    newUnitLeadTimeDays: 45,
    inMaterialMaster: true,
    plants: [
      { plantId: "PLANT-BMM", stockOnHand: 2, reorderPoint: 2, plannedDeliveryDays: 30, mrpType: "VB" },
      { plantId: "PLANT-GBG", stockOnHand: 1, reorderPoint: 1, plannedDeliveryDays: 28, mrpType: "VB" },
    ],
  },
  {
    materialId: "800-47120",
    description: "Hydraulic Cylinder Assy — Stacker Reclaimer",
    criticality: "NORMAL",
    unitValue: 64_000,
    newUnitLeadTimeDays: 30,
    inMaterialMaster: true,
    plants: [
      { plantId: "PLANT-BMM", stockOnHand: 1, reorderPoint: 1, plannedDeliveryDays: 28, mrpType: "VB" },
      { plantId: "PLANT-GBG", stockOnHand: 2, reorderPoint: 1, plannedDeliveryDays: 30, mrpType: "VB" },
    ],
  },
  {
    materialId: "800-58830",
    description: "Variable Speed Drive Module 315 kW",
    criticality: "IMPACT",
    unitValue: 135_000,
    newUnitLeadTimeDays: 60,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 0, reorderPoint: 1, plannedDeliveryDays: 14, mrpType: "VB" }],
  },
  {
    materialId: "800-29010",
    description: "Cyclone Feed Pump Volute Liner",
    criticality: "NORMAL",
    unitValue: 41_000,
    newUnitLeadTimeDays: 21,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 0, reorderPoint: 1, plannedDeliveryDays: 21, mrpType: "PD" }],
  },
  {
    materialId: "800-71205",
    description: "Underground Loader Transmission",
    criticality: "CRITICAL",
    unitValue: 410_000,
    newUnitLeadTimeDays: 120,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 0, reorderPoint: 1, mrpType: "VB" }],
  },
  {
    materialId: "800-36640",
    description: "Belt Scale Load Cell Assy",
    criticality: "OBSOLETE",
    unitValue: 18_500,
    newUnitLeadTimeDays: 14,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 3, reorderPoint: 0, plannedDeliveryDays: 14, mrpType: "ND" }],
  },
  {
    materialId: "800-12090",
    description: "Primary Crusher Hydraulic Accumulator",
    criticality: "IMPACT",
    unitValue: 57_000,
    newUnitLeadTimeDays: 35,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 0, reorderPoint: 1, plannedDeliveryDays: 35, mrpType: "VB" }],
  },
  {
    materialId: "800-44500",
    description: "Thickener Underflow Pump Gland Assy",
    criticality: "NORMAL",
    unitValue: 23_500,
    newUnitLeadTimeDays: 21,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 1, reorderPoint: 1, plannedDeliveryDays: 21, mrpType: "VB" }],
  },
  {
    materialId: "800-66310",
    description: "Conveyor Drive Pulley 1200 mm Lagged",
    criticality: "NORMAL",
    unitValue: 96_000,
    newUnitLeadTimeDays: 56,
    // Known from MARD and EKPO only — the July MARA held about one in ten of
    // the series, so the universe is built from all four sources.
    inMaterialMaster: false,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 1, mrpType: "ND" }],
  },
  {
    materialId: "800-15530",
    description: "Apron Feeder Drive Chain Sprocket Set",
    criticality: "NORMAL",
    unitValue: 38_000,
    newUnitLeadTimeDays: 28,
    inMaterialMaster: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 2, reorderPoint: 2, plannedDeliveryDays: 28, mrpType: "VB" }],
  },
  {
    materialId: "800-50720",
    description: "Agitator Gearbox — Leach Tank",
    unitValue: 172_000,
    newUnitLeadTimeDays: 98,
    inMaterialMaster: true,
    // No MARD row: stock is unknown, which is not the same as none.
    plants: [{ plantId: "PLANT-BMM", reorderPoint: 1, plannedDeliveryDays: 70, mrpType: "VB" }],
  },
  {
    materialId: "800-90011",
    description: "Mill Lube Pump — Legacy",
    unitValue: 31_000,
    newUnitLeadTimeDays: 30,
    inMaterialMaster: true,
    deletionFlag: true,
    plants: [{ plantId: "PLANT-BMM", stockOnHand: 0 }],
  },
  {
    materialId: "800-90012",
    description: "Jaw Crusher Toggle Plate — Legacy",
    unitValue: 12_500,
    newUnitLeadTimeDays: 21,
    inMaterialMaster: true,
    deletionFlag: true,
    plants: [{ plantId: "PLANT-GBG", stockOnHand: 2 }],
  },
]

export function getMaterial(materialId: string): RepairableMaterialSeed | undefined {
  return MATERIALS.find((m) => m.materialId === materialId)
}

/** The shared reference shape for a material id. */
export function materialRef(materialId: string): MaterialReference {
  return {
    materialId,
    materialCode: materialId,
    description: getMaterial(materialId)?.description ?? materialId,
  }
}
