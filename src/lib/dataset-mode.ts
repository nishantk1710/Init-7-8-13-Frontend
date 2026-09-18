// Which dataset the app renders.
//
//   NEXT_PUBLIC_DATASET=live npm run dev
//
// "scenario" (the default) uses the hand-written scenario fixtures in each
// feature's data/ folder. They encode specific, deliberately-designed demo
// situations that pages and cross-initiative adapters reference BY ID --
// RC-8002, OAR-LDG-0004, material 500-14892 -- so they are what makes the
// prototype demonstrable.
//
// "live" renders what the Python backend serves from the seeded July extracts.
// See below.
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
// WHY "live" IS A THIRD MODE AND NOT A REPLACEMENT (W5.4)
// ---------------------------------------------------------------------------
//
// The obvious thing would be to point the pages at the API and delete the
// fixtures. That breaks two things at once, and neither failure is loud:
//
// 1. THE IDENTIFIERS DO NOT OVERLAP AT ALL. The fixtures use `800-14201` at
//    `PLANT-GBG`; the backend serves `8000005632` at `1300`. Not a formatting
//    difference -- genuinely different universes. Any page rendering both at
//    once shows nonsense.
//
// 2. INITIATIVE 7 READS AN INITIATIVE 8 FIXTURE. Its recommendation page calls
//    getInitiative8Material360Signal("500-14892"), which resolves through the
//    RC-8002 fixture. That material does not exist in the backend data. I07's
//    own README says the component renders nothing when the signal is null,
//    "including before Initiative 8's data exists" -- so it degrades rather
//    than crashing. But it silently loses a cross-initiative feature that was
//    built deliberately to be shown, and that is someone else's demo to agree
//    to losing, not ours to take.
//
// A third mode solves both. Real data renders where we point it, every
// cross-initiative path keeps resolving through fixtures until I07 and I13 are
// ready to move too, and the switch is one env var at the demo.
//
// THE DEFAULT PATH MUST STAY BYTE-IDENTICAL. With NEXT_PUBLIC_DATASET unset,
// nothing about any page changes -- that is the whole point of adding a mode
// rather than editing one, and it is the easiest thing to break without
// noticing. There is a test for it.

export type DatasetMode = "scenario" | "live"

function readMode(): DatasetMode {
  switch (process.env.NEXT_PUBLIC_DATASET) {
    case "live":
      return "live"
    default:
      // Anything unrecognised falls back to the fixtures rather than erroring.
      // A typo in an env var must not take the prototype down; it should just
      // render what it always rendered.
      return "scenario"
  }
}

export const DATASET_MODE: DatasetMode = readMode()

/**
 * True when pages should fetch from the backend instead of importing fixtures.
 *
 * Only Initiative 8's register and repair detail honour this today (W5.4, FR-10).
 * Every other page, selector and cross-initiative adapter continues to read the
 * scenario fixtures in every mode -- deliberately, so that turning this on
 * cannot break somebody else's screen.
 */
export const USING_LIVE_DATA = DATASET_MODE === "live"
