// Which dataset the app renders.
//
//   npm run dev                                  # live -- the default
//   NEXT_PUBLIC_DATASET=scenario npm run dev     # demo fixtures where any remain
//
// "live" (the default) renders what the Python backend serves from the seeded
// July extracts.
//
// "scenario" uses the hand-written scenario fixtures in each feature's data/
// folder. They encode specific, deliberately-designed demo situations that
// pages and cross-initiative adapters reference BY ID -- RC-8002,
// OAR-LDG-0004, material 500-14892 -- which is why they still exist even
// though Initiative 8's own backed screens no longer read them.
//
// HISTORY, because the flag reads oddly without a third option having once
// existed
//
// There used to be a "generated" mode, rendering committed JSON that
// `npm run dataset:build` produced by reading SAP-shaped CSVs through a
// TypeScript CPI client living in src/lib/sap/. That client was removed --
// SAP access is owned by the Python backend (backend/app/integrations/sap/),
// and two implementations of one wire protocol would have to be fixed twice
// every time SAP drifts -- which it demonstrably does. The generated JSON
// became an unrebuildable frozen artefact built from synthetic data, which
// Anish's "no synthetic data" ruling superseded, and both the mode and the
// JSON files it read (one per feature's data/generated/) were deleted once
// the live backend path existed to replace it.
//
// This file moved here from lib/sap/dataset-mode.ts when that folder was
// removed. It never had anything to do with SAP -- it reads one env var.
//
// ---------------------------------------------------------------------------
// WHY "live" IS NOW THE DEFAULT, AND WHAT IS LEFT OF "scenario"
// ---------------------------------------------------------------------------
//
// `live` began as a third mode rather than a replacement, because deleting the
// fixtures outright would have broken two things quietly:
//
// 1. THE IDENTIFIERS DO NOT OVERLAP AT ALL. The fixtures use `800-14201` at
//    `PLANT-GBG`; the backend serves `8000005632` at `1300`. Not a formatting
//    difference -- genuinely different universes. Any page rendering both at
//    once shows nonsense.
//
// 2. INITIATIVE 7 READS AN INITIATIVE 8 FIXTURE. Its recommendation page calls
//    getInitiative8Material360Signal("500-14892"), which resolves through the
//    RC-8002 fixture. That material does not exist in the backend data.
//
// Initiative 8's four backed screens -- the register, the repair detail, the
// declaration queue and the coding-candidate screen -- now read the backend
// UNCONDITIONALLY. They no longer consult this flag and no longer import a
// fixture, so for them the question is settled.
//
// WHAT IS STILL FIXTURE-BACKED, AND WHY THIS FLAG STILL EXISTS
//
// Two I08 screens have no backend behind them at all: the Overview and the
// Duplicate Guard. Duplicate Guard is FR-6 territory, which is not built. The
// four cross-initiative selectors (summary, global actions, audit events, the
// Material 360 adapter) are also still fixture-backed: they are SYNCHRONOUS
// and are consumed by app-wide shared code -- lib/aggregation.ts, the global
// chat intents, the material router, the Material 360 drawer -- which I07 and
// I13 read too. Making those live is an async refactor across somebody else's
// module, not an Initiative 8 cleanup.
//
// So the flag's remaining job is NOT to switch a data source. It is to let the
// screens that are still demo-backed SAY SO while the ones beside them show
// real SAP data. A hand-written number sitting unlabelled next to a real one is
// exactly the confusion this module exists to prevent.

export type DatasetMode = "scenario" | "live"

function readMode(): DatasetMode {
  switch (process.env.NEXT_PUBLIC_DATASET) {
    case "scenario":
      return "scenario"
    default:
      // Anything unrecognised means live. A typo in an env var must not
      // silently serve hand-written demo numbers to somebody who asked for
      // their real ones -- that is the more dangerous direction to fail in.
      return "live"
  }
}

export const DATASET_MODE: DatasetMode = readMode()

/**
 * True unless `NEXT_PUBLIC_DATASET=scenario` was set explicitly.
 *
 * Read it to ask "should this screen admit it is showing demo data?", not to
 * choose a data source -- every screen that has a backend now reads it
 * unconditionally. See the note above.
 */
export const USING_LIVE_DATA = DATASET_MODE === "live"
