import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"

/**
 * OAR (Order-As-Required) material set — every materialId that appears
 * anywhere in the Utilization Ledger seed data is treated as OAR-managed.
 * Backs `lib/material-router.ts`'s routing precedence (OAR beats
 * repairable/I7-scope) — the Material Assistant chat conversationally asks
 * for a consumption plan for any material this returns true for.
 *
 * Includes "500-14892" — the material on chat session SPR-2847 (the hero
 * demo session in `lib/mock-data.ts`) — so the OAR branch is visibly
 * demonstrable from an existing chat session, not just from Initiative 13's
 * own scenario data.
 */
const OAR_MATERIAL_IDS = new Set(LEDGER_LINES.map((line) => line.material.materialId))

export function isOARMaterial(materialId: string): boolean {
  return OAR_MATERIAL_IDS.has(materialId)
}
