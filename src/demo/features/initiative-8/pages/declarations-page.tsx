import { PageHeader } from "@demo/components/shared/page-header"
import { DeclarationQueueTable } from "@demo/features/initiative-8/components/declaration-queue-table"
import { DECLARATIONS } from "@demo/features/initiative-8/data/declarations"

/** The same ± window the Exception Queue's missing-attestation check uses. */
const ATTESTATION_WINDOW_DAYS = 14

export function DeclarationQueuePage() {
  const outstanding = DECLARATIONS.filter((d) => d.status !== "Completed").length
  const total = DECLARATIONS.length
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader
          title="Declaration Queue"
          description={
            `${outstanding.toLocaleString()} of ${total.toLocaleString()} repair lines have no condition assessment on ` +
            `record. Matched on material, plant and a ±${ATTESTATION_WINDOW_DAYS}-day window.`
          }
        />
        <DeclarationQueueTable />
      </div>
    </div>
  )
}
