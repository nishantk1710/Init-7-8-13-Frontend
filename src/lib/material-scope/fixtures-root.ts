// Where the SAP discovery snapshot and generated fixtures live.
//
// WHY THIS EXISTS
//
// Three modules used to hardcode "./data-generator/...", resolved against the
// process working directory -- which for every npm script is `frontend/`. That
// held only while `data-generator/` sat inside `frontend/`. It has since moved
// twice (to the repo root in c94af98, then under `backend/`), and both moves
// silently broke 21 tests across 6 files: every fixture read became ENOENT, and
// the gateway then served empty results rather than erroring, so the failures
// read as assertion mismatches rather than a missing directory.
//
// So the location is resolved once, here, instead of being assumed in three
// places. Order of preference:
//
//   1. SAP_FIXTURES_DIR                explicit override, wins always
//   2. ./data-generator                frontend repo carries its own copy
//   3. ../data-generator               combined repo, data-generator at root
//   4. ../backend/data-generator       combined repo, current layout
//
// THE DECISION THIS DOES NOT MAKE
//
// Candidates 3 and 4 reach outside the frontend directory. That works in the
// combined repo and CANNOT work once `frontend/` is its own repository -- a CI
// checkout of the frontend alone has no sibling `backend/`. Before that split
// is real, someone has to choose:
//
//   (a) the frontend repo carries its own copy of the fixtures (14 MB), or
//   (b) the fake gateway and its fixture-backed tests are retired, since
//       Anish's "no synthetic data" ruling makes the generated set obsolete
//       anyway once the backend serves real extracts.
//
// Either is defensible. Silently shipping a frontend repo whose test suite
// cannot find its fixtures is not.

import { existsSync } from "node:fs"
import { resolve } from "node:path"

/** Candidates in preference order. First one that exists on disk wins. */
const CANDIDATES = ["./data-generator", "../data-generator", "../backend/data-generator"]

let cached: string | null = null

/**
 * Absolute path to the `data-generator` directory.
 *
 * Throws rather than returning a bad path: an ENOENT deep inside a CSV reader
 * is far harder to diagnose than a message naming every place we looked.
 */
export function fixturesRoot(): string {
  if (cached) return cached

  const override = process.env.SAP_FIXTURES_DIR
  if (override) {
    if (!existsSync(override)) {
      throw new Error(
        `SAP_FIXTURES_DIR is set to "${override}" but that directory does not exist.`
      )
    }
    cached = resolve(override)
    return cached
  }

  for (const candidate of CANDIDATES) {
    if (existsSync(candidate)) {
      cached = resolve(candidate)
      return cached
    }
  }

  throw new Error(
    "Cannot find the data-generator directory. Looked in: " +
      CANDIDATES.map((c) => `"${c}"`).join(", ") +
      ` (relative to ${process.cwd()}). ` +
      "Set SAP_FIXTURES_DIR to point at it, or see src/lib/material-scope/fixtures-root.ts."
  )
}

/** `<root>/discovery` — the live SAP metadata snapshot the contract is built from. */
export function discoveryDir(): string {
  return resolve(fixturesRoot(), "discovery")
}

/** `<root>/generated/sap` — SAP-shaped CSVs the fake gateway serves. */
export function generatedSapDir(): string {
  return resolve(fixturesRoot(), "generated", "sap")
}

/** `<root>/generated/platform` — data this platform owns, not SAP's. */
export function generatedPlatformDir(): string {
  return resolve(fixturesRoot(), "generated", "platform")
}

/** Test-only: forget the resolved root so a changed env var is picked up. */
export function resetFixturesRoot(): void {
  cached = null
}
