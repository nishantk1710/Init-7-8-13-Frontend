import { PageHeader } from "@/components/shared/page-header"
import { DuplicateGuardFlow } from "@/features/initiative-8/components/duplicate-guard-flow"

export function DuplicateGuardPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader
          title="Duplicate Guard"
          description="Advisory check for a new procurement attempt against an active repair. Never blocks the requester."
        />
        <DuplicateGuardFlow />
      </div>
    </div>
  )
}
