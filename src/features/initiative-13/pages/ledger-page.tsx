import { PageHeader } from "@/components/shared/page-header"
import { UtilizationLedgerTable } from "@/features/initiative-13/components/ledger-table"
import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"

export function UtilizationLedgerPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Utilization Ledger"
          description="Every OAR reservation line, anchored end-to-end from request through utilization confirmation. Click a row to see the full document chain."
        />
        <UtilizationLedgerTable lines={LEDGER_LINES} />
      </div>
    </div>
  )
}
