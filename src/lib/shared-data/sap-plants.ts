// Live-mode plant labels.
//
// The app-side PLANTS list (lib/shared-data/plants.ts) is scenario master data
// keyed on invented ids (PLANT-GBG, PLANT-BMM, PLANT-SKZ) that no SAP field
// supplies -- see CLAUDE.md's "the app and SAP do not share identities" note.
// A live plant filter built from it can never match a real row, whose plant is
// a SAP WERKS code. In live mode the filter's options come from the backend's
// own by_plant aggregate instead, and this map only supplies a display label.
//
// Only the two plant codes VZI's own delivery notes actually name are mapped
// here (app/seed/manifest.py: "Black Mountain (plant 1300)", "Gamsberg (plant
// 1500)"). Every other code in the data -- 3000, 2000, 1600, 1100, 1200, 1820
// -- has no confirmed site name in any source we hold, so it is shown as the
// bare code rather than guessed at.
const SAP_PLANT_NAMES: Record<string, string> = {
  "1300": "Black Mountain",
  "1500": "Gamsberg",
}

/** "1500" -> "Gamsberg (1500)"; an unnamed code -> "3000". */
export function sapPlantLabel(code: string): string {
  const name = SAP_PLANT_NAMES[code]
  return name ? `${name} (${code})` : code
}
