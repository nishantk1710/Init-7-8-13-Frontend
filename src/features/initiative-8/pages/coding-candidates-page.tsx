import { connection } from "next/server"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { CodingCandidatesTable } from "@/features/initiative-8/components/coding-candidates-table"
import { loadLiveCodingCandidates } from "@/features/initiative-8/data/live-coding-candidates"
import type { CodingCandidate } from "@/features/initiative-8/types/repair"
import type { ApiCodingCandidateMeta } from "@/lib/api/i8"

const DESCRIPTION =
  "Materials whose purchase-order free text talks about repair but are not " +
  "80-series coded (FR-2). Advisory only — nothing here changes SAP."

/**
 * Coding Candidates (FR-2 / W5.5).
 *
 * There was never a fixture for this screen — it is an analyst/audit tool over
 * real PO free text, and a synthetic "miscoded material" would be a fabricated
 * finding rather than a demo situation.
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
  let meta: ApiCodingCandidateMeta | null = null
  let loadError: string | null = null
  try {
    const live = await loadLiveCodingCandidates()
    candidates = live.candidates
    meta = live.meta
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <Shell description={DESCRIPTION}>
      <CodingCandidatesTable candidates={candidates} meta={meta} loadError={loadError} />
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
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Coding Candidates" description={description} />
        {children}
      </div>
    </div>
  )
}
