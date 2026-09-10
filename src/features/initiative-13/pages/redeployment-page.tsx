import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { RedeploymentBoard } from "@/features/initiative-13/components/redeployment-board"
import { REDEPLOYMENT_CANDIDATES } from "@/features/initiative-13/data/redeployment"

export function RedeploymentPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Redeployment"
          description="Unused OAR stock found at other plants that could cover a requested material instead of buying new."
        />
        <AlertBanner tone="info" title="Advisory only">
          Recommending a transfer or continuing procurement is a UI simulation — no automatic SAP
          stock transfer is executed from this page.
        </AlertBanner>
        <RedeploymentBoard candidates={REDEPLOYMENT_CANDIDATES} />
      </div>
    </div>
  )
}
