import { PageHeader } from "@demo/components/shared/page-header"
import { CodingCandidatesTable } from "@demo/features/initiative-8/components/coding-candidates-table"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"

const DESCRIPTION =
  "Materials whose purchase-requisition, purchase-order or goods-movement free text talks about repair but are not 80-series coded (FR-2). Ranked, each with the text that triggered it and the AI's reason. Advisory only — nothing here changes SAP."

/**
 * The coding screen (FR-2). The table reads this session's snapshot, so the
 * page itself stays a server component and only the table is client-side.
 */
export function CodingCandidatesPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Coding Candidates" description={DESCRIPTION} />
        <SessionChangesBanner />
        <CodingCandidatesTable />
      </div>
    </div>
  )
}
