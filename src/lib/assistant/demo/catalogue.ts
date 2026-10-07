/**
 * The two demo materials -- one repairable, one OAR.
 *
 * Their numbers are the ones the wire fixtures were generated for, so the
 * assessment each conversation opens with is the one that belongs to it.
 */

import type { ApiMaterialMatch, MaterialSearchResponse } from "@/lib/api/assistant"
import startI08Fixture from "@/lib/api/__fixtures__/01-start-i08-choice.json"
import startI13Fixture from "@/lib/api/__fixtures__/04-start-i13-choice.json"

export const DEMO_REPAIRABLE: ApiMaterialMatch = {
  materialId: "8000005632",
  // As the I08 fixture's assessment names it.
  description: "Pump, centrifugal",
  plant: "1300",
  plantName: "Black Mountain Mining",
  flowHint: "i08",
  // Taken from the fixture's routing rather than written out: MRP-type codes
  // belong to lib/material-scope (see no-leakage.test.ts).
  mrpType: startI08Fixture.routing.mrpType,
}

export const DEMO_OAR: ApiMaterialMatch = {
  materialId: "1000000123",
  // The I13 fixture carries no description. Chosen to read naturally beside the
  // fixture's own plan text ("Replacing the seal on mill 3 gearbox"), and to be
  // replaced by the real MAKTX if this number exists in the extract.
  description: "Seal kit, mill gearbox",
  plant: "1300",
  plantName: "Black Mountain Mining",
  flowHint: "i13",
  mrpType: startI13Fixture.routing.mrpType,
}

export const DEMO_MATERIALS: readonly ApiMaterialMatch[] = [DEMO_REPAIRABLE, DEMO_OAR]

export const DEMO_SEARCH_NOTE = ""

/** Number prefix (zeros ignored) or every word of the name, like the backend. */
export function searchDemoMaterials(raw: string): MaterialSearchResponse {
  const text = raw.trim()
  if (text.length < 2) return { items: [], note: DEMO_SEARCH_NOTE }

  const compact = text.replace(/[\s-]/g, "")
  if (/^\d+$/.test(compact)) {
    const prefix = compact.replace(/^0+/, "")
    const items = prefix
      ? DEMO_MATERIALS.filter((m) => m.materialId.startsWith(prefix))
      : []
    return { items, note: DEMO_SEARCH_NOTE }
  }

  const words = (text.toUpperCase().match(/[A-Z0-9]+/g) ?? []).filter((w) => w.length >= 2)
  const items = DEMO_MATERIALS.filter((m) => {
    const haystack = `${m.description ?? ""} ${m.materialId}`.toUpperCase()
    return words.length > 0 && words.every((w) => haystack.includes(w))
  })
  return { items, note: DEMO_SEARCH_NOTE }
}

export function demoMaterial(materialId: string, plant: string): ApiMaterialMatch | undefined {
  const id = materialId.trim().replace(/^0+/, "")
  return DEMO_MATERIALS.find((m) => m.materialId === id && m.plant === plant.trim())
}
