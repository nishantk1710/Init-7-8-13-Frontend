// W2.6b — reference-data translation between SAP codes and the app's own
// identifiers.
//
// FINDING (2026-09-08): these two vocabularies do not currently meet.
//
//   SAP plants (Werks):   1000, 1500, 2000, 3000, 4000
//   App plants (plantId): PLANT-GBG (Gamsberg), PLANT-BMM (Black Mountain),
//                         PLANT-SKZ (Skorpion Zinc)
//
// The counts do not even match, and no exposed SAP field says which mine site
// a plant code belongs to. The same is true of requesters: platform data
// carries VZIREQ01..05 while the app has its own user catalogue.
//
// Both tables below are therefore EMPTY on purpose. Filling them in with a
// guess would put a confident, wrong site name on every screen — far worse
// than showing "Plant 1000" and being visibly incomplete. VZI has to supply
// the real mapping; until then the fallback passes the SAP code through so
// the gap is visible rather than disguised.

import type { OARPersonRef } from "@/features/initiative-13/types/oar"
import type { PlantReference } from "@/lib/domain/contracts"

/** Werks -> the app's plant identity. Awaiting a mapping from VZI. */
export const PLANT_BY_WERKS: Record<string, PlantReference> = {}

/** Platform requester id -> the app's user identity. Awaiting a mapping from VZI. */
export const USER_BY_REQUESTER: Record<string, OARPersonRef> = {}

/** True once someone has actually supplied the site mapping. Asserted in the gap report. */
export const PLANT_MAPPING_CONFIRMED = Object.keys(PLANT_BY_WERKS).length > 0

export function plantRef(werks: string): PlantReference {
  return PLANT_BY_WERKS[werks] ?? { plantId: werks, name: `Plant ${werks}` }
}

export function personRef(requester: string): OARPersonRef {
  return USER_BY_REQUESTER[requester] ?? { userId: requester, name: requester, role: "Requester" }
}
