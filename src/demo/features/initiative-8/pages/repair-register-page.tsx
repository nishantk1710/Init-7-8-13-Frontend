import { PageHeader } from "@demo/components/shared/page-header"
import { RepairRegisterTable } from "@demo/features/initiative-8/components/repair-register-table"
import { REFERENCE_DATE, REPAIR_CHAINS } from "@demo/features/initiative-8/data/repair-chains"
import { isOpenRepair } from "@demo/features/initiative-8/utils/status"

export function RepairRegisterPage() {
  const total = REPAIR_CHAINS.length
  const open = REPAIR_CHAINS.filter(isOpenRepair).length
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader
          title="Repair Register"
          description={`${total.toLocaleString()} repair lines — ${open.toLocaleString()} still open, as at ${REFERENCE_DATE}.`}
        />
        <RepairRegisterTable />
      </div>
    </div>
  )
}
