import { PageHeader } from "@/components/shared/page-header"
import { RepairRegisterTable } from "@/features/initiative-8/components/repair-register-table"

export function RepairRegisterPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Repair Register"
          description="Every repairable material currently in, or eligible for, a repair chain."
        />
        <RepairRegisterTable />
      </div>
    </div>
  )
}
