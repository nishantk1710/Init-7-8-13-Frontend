import type { PlantReference } from "@/lib/domain/contracts"

// Stable plant ID source every initiative uses instead of inventing its own
// site names.
//
// TWO SITES, matching the delivery scope set on 2026-09-21: Black Mountain
// Mining (SAP plant 1300) and Gamsberg (SAP plant 1500). A third site,
// Skorpion Zinc, used to sit here so Initiative 13's cross-site redeployment
// scenario had more than one place to look for unused stock. It was never in
// the extract and is now out of scope, so it is gone.
//
// One consequence worth knowing before adding fixtures: with two sites, a
// redeployment request has AT MOST ONE candidate source — the site that is
// not the requesting one. See data/redeployment.ts.
//
// These IDs are deliberately NOT the SAP codes. The fixtures are a separate
// synthetic universe from the backend's live data (`800-14201` at
// `PLANT-BMM` here, `8000005632` at `1300` there) and mixing the two renders
// nonsense — see lib/dataset-mode.ts. `sapPlantCode` records the mapping for
// anyone reconciling a fixture against a live row by hand.

export interface Plant extends PlantReference {
  region: string
  /** The SAP plant code this fixture site stands in for. */
  sapPlantCode: string
}

export const PLANTS: Plant[] = [
  {
    plantId: "PLANT-BMM",
    name: "Black Mountain Mining",
    region: "Northern Cape, South Africa",
    sapPlantCode: "1300",
  },
  {
    plantId: "PLANT-GBG",
    name: "Gamsberg",
    region: "Northern Cape, South Africa",
    sapPlantCode: "1500",
  },
]

export function getPlantById(plantId: string): Plant | undefined {
  return PLANTS.find((p) => p.plantId === plantId)
}
