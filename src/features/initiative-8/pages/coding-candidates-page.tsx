import { connection } from "next/server"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { CodingCandidatesTable } from "@/features/initiative-8/components/coding-candidates-table"
import { loadLiveCodingCandidates } from "@/features/initiative-8/data/live-coding-candidates"
import type { CodingCandidate } from "@/features/initiative-8/types/repair"

const DESCRIPTION =
  "Materials whose purchase-requisition, purchase-order or goods-movement free " +
  "text talks about repair but are not 80-series coded. Ranked, each " +
  "row opening on the text that triggered it and the AI's reason. Advisory " +
  "only — nothing here changes SAP."

/**
 * Coding Candidates (FR-2 / W5.5).
 *
 * There was never a fixture for this screen — it is an analyst/audit tool over
 * real SAP free text, and a synthetic "miscoded material" would be a fabricated
 * finding rather than a demo situation.
 *
 * The screen reads all three sources FR-2 names — requisition, purchase order
 * and goods movement — and the table filters by which one turned a material
 * up, because a candidate seen only on a requisition is an earlier and
 * cheaper finding than one already on a PO.
 *
 * Same server/client split as the register and declaration queue: this page
 * fetches the fast keyword-only pass once; the table's "Run AI screen" button
 * triggers the slow language-judgement pass client-side, because a ~4-minute
 * model run must never block the page load.
 */
export async function CodingCandidatesPage() {
  // See the same note on the register page: without this, a live build bakes
  // the keyword-pass results into static HTML at build time.
  await connection()

  let candidates: CodingCandidate[] = []
  let loadError: string | null = null
  try {
    candidates = (await loadLiveCodingCandidates()).candidates
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <Shell description={DESCRIPTION}>
      <CodingCandidatesTable candidates={candidates} loadError={loadError} />
    </Shell>
  )
}

function Shell({
  description,
  children,
}: {
  description: string
  children: ReactNode
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader title="Coding Candidates" description={description} />
        {children}
      </div>
    </div>
  )
}
