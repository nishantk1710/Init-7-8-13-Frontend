// Seed dataset for the Redeployment page — a requested material at one plant
// matched against unused stock found at the other plant. Advisory only: no
// automatic SAP stock transfer is simulated anywhere in this module.
//
// Scope is two plants (1300 Black Mountain, 1500 Gamsberg), so a request can
// have AT MOST ONE match: the only candidate source is the site that is not
// the requesting one. Every candidate below therefore carries a single match.
// `matches` stays an array because the page renders a list and because a
// third site would restore the many-match case without a type change.

import type { RedeploymentCandidate } from "@/features/initiative-13/types/oar"
import { materialRef } from "@/features/initiative-13/data/materials"
import { getPlantById } from "@/lib/shared-data/plants"

function plant(plantId: string) {
  const p = getPlantById(plantId)
  if (!p) throw new Error(`Unknown plant id: ${plantId}`)
  return { plantId: p.plantId, name: p.name }
}

export const REDEPLOYMENT_CANDIDATES: RedeploymentCandidate[] = [
  {
    id: "RDP-0001",
    material: materialRef("500-22140"),
    requestingPlant: plant("PLANT-GBG"),
    qtyNeeded: 3,
    requestedFor: "CV-03 troughing idler replacement — Gamsberg",
    sourceLedgerLineId: "OAR-LDG-0003",
    matches: [
      {
        plant: plant("PLANT-BMM"),
        qtyAvailable: 4,
        lastMovementDate: "29 Jul 2026",
        condition: "New — marked no longer required after warranty claim (OAR-TRK-0003)",
      },
    ],
  },
  {
    id: "RDP-0002",
    material: materialRef("500-40011"),
    requestingPlant: plant("PLANT-BMM"),
    qtyNeeded: 1,
    requestedFor: "Mill 1 trunnion bearing — condition-based replacement",
    matches: [
      {
        plant: plant("PLANT-GBG"),
        qtyAvailable: 2,
        lastMovementDate: "30 Aug 2026",
        condition: "New — consolidated PO over-allocation (CG-PR-71300)",
      },
    ],
  },
  {
    id: "RDP-0003",
    material: materialRef("OAR-77002"),
    requestingPlant: plant("PLANT-BMM"),
    qtyNeeded: 2,
    requestedFor: "CV-11 gearbox coupling rebuild",
    matches: [
      {
        plant: plant("PLANT-GBG"),
        qtyAvailable: 3,
        lastMovementDate: "15 Jul 2026",
        condition: "New — engineering spares pool excess",
      },
    ],
  },
]
