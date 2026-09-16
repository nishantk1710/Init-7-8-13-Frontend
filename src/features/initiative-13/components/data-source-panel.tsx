"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { getI13DataSources } from "@/features/initiative-13/api/client"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"
import { ErrorState, LoadingState } from "@/features/initiative-13/components/query-states"
import { cn, formatCount } from "@/lib/utils"

/**
 * Collapsed-by-default development/UAT indicator (task's §10/§20) — never
 * shown expanded by default, since this is a diagnostic aside, not a
 * headline dashboard element.
 */
export function DataSourcePanel() {
  const [open, setOpen] = useState(false)
  const sources = useI13Query(() => getI13DataSources(), [])

  return (
    <div className="rounded-xl border border-dashed border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Data sources (development/UAT)
      </button>
      {open && (
        <div className="border-t border-dashed border-border p-3">
          {sources.loading && <LoadingState label="Loading data-source status…" />}
          {sources.error && <ErrorState message={sources.error} onRetry={sources.refetch} />}
          {sources.data && (
            <ul className="flex flex-col gap-1.5">
              {sources.data.map((s) => (
                <li key={s.entitySet} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">{s.entitySet}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatCount(s.rowCount)} rows</span>
                    <StatusBadge
                      tone={s.mode === "LIVE" ? "success" : s.mode === "MOCK" ? "warning" : "danger"}
                      className={cn(!s.available && "opacity-60")}
                    >
                      {s.mode}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
