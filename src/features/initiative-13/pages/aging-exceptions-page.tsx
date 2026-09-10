import { PageHeader } from "@/components/shared/page-header"
import { AgingExceptionsBoard } from "@/features/initiative-13/components/aging-exceptions-board"
import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"

export function AgingExceptionsPage() {
  const exceptionLines = LEDGER_LINES.filter((l) => l.exception === "Consumption Overdue")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Aging Exceptions"
          description="OAR lines past their planned consumption date. Confirm, re-plan, or release each one — every action is a UI-only simulation, no live SAP write occurs."
        />
        <AgingExceptionsBoard lines={exceptionLines} />
      </div>
    </div>
  )
}
