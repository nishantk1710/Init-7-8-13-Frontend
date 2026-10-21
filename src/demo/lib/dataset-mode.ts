// Which dataset the app renders.
//
//   NEXT_PUBLIC_DATASET=generated npm run dev
//
// "scenario" (the default) uses the hand-written scenario fixtures in each
// feature's data/ folder. They encode specific, deliberately-designed demo
// situations that pages and cross-initiative adapters reference BY ID --
// RC-8002, OAR-LDG-0004, material 500-14892 -- so they are what makes the
// prototype demonstrable.
//
// "generated" renders the committed JSON in each feature's data/generated/
// folder.
//
// HISTORY, because the flag reads oddly without it
//
// That JSON used to be rebuilt by `npm run dataset:build`, which read
// SAP-shaped CSVs through a TypeScript CPI client living in src/lib/sap/.
// That client has been removed: SAP access is owned by the Python backend
// (backend/app/integrations/sap/), and two implementations of one wire
// protocol would have to be fixed twice every time SAP drifts -- which it
// demonstrably does.
//
// So the generated JSON is now a FROZEN ARTEFACT. It is still committed and
// still loadable, but nothing in this repository can regenerate it. It was
// also built from synthetic data, which Anish's "no synthetic data" ruling
// superseded. Treat it as a historical fixture; the real path forward is the
// backend serving data from the seeded July extracts over HTTP.
//
// This file moved here from lib/sap/dataset-mode.ts when that folder was
// removed. It never had anything to do with SAP -- it reads one env var.

export type DatasetMode = "scenario" | "generated"

export const DATASET_MODE: DatasetMode =
  process.env.NEXT_PUBLIC_DATASET === "generated" ? "generated" : "scenario"

export const USING_GENERATED_DATA = DATASET_MODE === "generated"
