"use client"

import { useState } from "react"

import { ApprovalsTable } from "@/components/approvals/approvals-table"
import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { getPendingApprovals } from "@/lib/approvals"
import { ApprovalsWorkspace } from "@/features/initiative-7/components/approvals-workspace"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"
import type { InitiativeId } from "@/lib/domain/contracts"

const ALL = "all"
type FilterId = InitiativeId | typeof ALL

const FILTERS: { id: FilterId; label: string }[] = [
  { id: ALL, label: "All" },
  { id: "initiative-7", label: initiative7Manifest.name },
  { id: "initiative-8", label: initiative8Manifest.name },
  { id: "initiative-13", label: initiative13Manifest.name },
]

/**
 * Approvals — every decision waiting on someone, filterable by module (§26).
 * "Inventory Planning" reuses the same `ApprovalsWorkspace` the Action
 * Center's Inventory Planning tab already renders (one live component
 * instance, not a fork); the other filters are a simple table over the same
 * shared action feed (`lib/approvals.ts`).
 */
export function ApprovalsPage() {
  const [filter, setFilter] = useState<FilterId>(ALL)
  const approvals = getPendingApprovals().filter(
    (a) => filter === ALL || a.initiative === filter
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Approvals"
          description={`${getPendingApprovals().length} waiting for your decision.`}
        />

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                filter === f.id
                  ? "border-primary/40 bg-accent font-medium text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filter === "initiative-7" ? (
          <ApprovalsWorkspace />
        ) : (
          <ApprovalsTable approvals={approvals} />
        )}
      </div>
    </div>
  )
}
