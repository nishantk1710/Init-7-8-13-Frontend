import { PageHeader } from "@demo/components/shared/page-header"
import { CodingCandidatesTable } from "@demo/features/initiative-8/components/coding-candidates-table"

export function CodingCandidatesPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Coding Candidates"
          description="Materials whose purchase-order free text talks about repair but are not 80-series coded. Advisory only — nothing here changes SAP."
        />
        <CodingCandidatesTable />
      </div>
    </div>
  )
}
