import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { RedeploymentBoard } from "@/features/initiative-13/components/redeployment-board"
import { REDEPLOYMENT_CANDIDATES } from "@/features/initiative-13/data/redeployment"
import { USING_LIVE_DATA } from "@/lib/dataset-mode"

/**
 * Redeployment — the one OAR screen with no backend behind it, and the only one
 * that is still entirely fixture-backed.
 *
 * That is not an oversight. D10 defers the formal cross-plant redeployment
 * workflow: cross-plant stock is in scope for **visibility** only, on exceptions
 * and in the assistant's cross-check, and VZI's appetite for a redeployment
 * policy is still an open item. There is no endpoint to wire because there is no
 * agreed behaviour to serve.
 *
 * What is real and already live is the visibility half: every ACT exception
 * carries `crossPlantStock`, and the assistant's I13 cross-check reports stock
 * at other plants. Both come from the same provider.
 *
 * So this page keeps its hand-written candidates and now says so on screen,
 * matching every other demo-backed screen in the application.
 */
export function RedeploymentPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Redeployment"
          description="Unused OAR stock found at other plants that could cover a requested material instead of buying new."
        />

        {USING_LIVE_DATA && (
          <AlertBanner tone="warning" title="This page is demo data, not SAP">
            Every candidate below is hand-written, against materials that do not
            exist in the July extract. There is no redeployment endpoint: D10
            defers the workflow, and cross-plant stock is in scope for visibility
            only. The real cross-plant figures appear on each ACT exception and
            in the reservation assistant&rsquo;s cross-check, both served by the
            backend.
          </AlertBanner>
        )}

        <AlertBanner tone="info" title="Advisory only">
          Recommending a transfer or continuing procurement is a UI simulation — no automatic SAP
          stock transfer is executed from this page.
        </AlertBanner>
        <RedeploymentBoard candidates={REDEPLOYMENT_CANDIDATES} />
      </div>
    </div>
  )
}
