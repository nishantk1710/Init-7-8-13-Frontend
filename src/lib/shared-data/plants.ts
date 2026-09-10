import type { PlantReference } from "@/lib/domain/contracts"

// Stable plant ID source every initiative uses instead of inventing its own
// site names. Three sites so Initiative 13's cross-site redeployment
// scenario has somewhere to find unused stock.

export interface Plant extends PlantReference {
  region: string
}

export const PLANTS: Plant[] = [
  {
    plantId: "PLANT-GBG",
    name: "Gamsberg",
    region: "Northern Cape, South Africa",
  },
  {
    plantId: "PLANT-BMM",
    name: "Black Mountain Mining",
    region: "Northern Cape, South Africa",
  },
  {
    plantId: "PLANT-SKZ",
    name: "Skorpion Zinc",
    region: "Karas, Namibia",
  },
]

export function getPlantById(plantId: string): Plant | undefined {
  return PLANTS.find((p) => p.plantId === plantId)
}
