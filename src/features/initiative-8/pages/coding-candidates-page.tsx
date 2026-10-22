import { connection } from "next/server"

import { CodingCandidatesTable } from "@/features/initiative-8/components/coding-candidates-table"
import { loadLiveCodingCandidates } from "@/features/initiative-8/data/live-coding-candidates"
import type { CodingCandidate } from "@/features/initiative-8/types/repair"

/**
 * Repair Candidates (FR-2 / W5.5).
 *
 * There was never a fixture for this screen — it is an analyst/audit tool over
 * real SAP free text, and a synthetic "miscoded material" would be a fabricated
 * finding rather than a demo situation.
 *
 * The screen reads the sources FR-2 names — requisition, purchase order and
 * goods movement — and filters by which one turned a material up, because a
 * candidate seen only on a requisition is an earlier and cheaper finding than
 * one already on a PO.
 *
 * Same server/client split as the register: this page fetches the fast
 * keyword pass once (stored verdicts come back with it); the "Run AI screen"
 * button runs the slow language-judgement pass client-side, because a
 * multi-minute model run must never block the page load. The header, the
 * summary line and the ⓘ are the table's: they depend on the verdicts, which
 * a run changes in the browser.
 */
export async function CodingCandidatesPage() {
  // See the same note on the register page: without this, a live build bakes
  // the keyword-pass results into static HTML at build time.
  await connection()

  let candidates: CodingCandidate[] = []
  let sources: string[] = []
  let loadError: string | null = null
  try {
    const live = await loadLiveCodingCandidates()
    candidates = live.candidates
    sources = live.meta.sources ?? []
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return <CodingCandidatesTable candidates={candidates} loadError={loadError} sources={sources} />
}
