"use client"

import { RefreshCw } from "lucide-react"

import { useLastRebuilt } from "@/features/initiative-7/hooks/use-last-rebuilt"
import { formatRebuiltAt } from "@/features/initiative-7/utils/rebuilt-at"

/** The oval "Last rebuilt" badge, in the blue the Clear filters button uses. Nothing when there is no date. */
export function LastRebuiltPill({ rebuiltAt, timeZone }: { rebuiltAt: string | null; timeZone?: string }) {
  const text = formatRebuiltAt(rebuiltAt, timeZone)
  if (!text) return null
  return (
    <span
      title={text.title}
      className="inline-flex items-center gap-1.5 rounded-full border border-action bg-action/10 px-3 py-1 text-xs font-semibold text-action shadow-sm"
    >
      <RefreshCw className="size-3.5 shrink-0" aria-hidden />
      Last rebuilt: {text.label}
    </span>
  )
}

/** The badge on the Inventory Planning header: when the results on the page were last rebuilt. */
export function LastRebuiltBadge() {
  return <LastRebuiltPill rebuiltAt={useLastRebuilt()} />
}
