import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import type { ApiSessionSummary } from "@/lib/api/assistant"
import { cn } from "@/lib/utils"

/**
 * The assistant sessions recorded against this material and plant.
 *
 * ## The link that was missing
 *
 * Every OAR screen showed what the platform concluded, and none of them showed
 * the conversation it concluded it from. FR-4 asks for traceability from a plan
 * back to the advice that shaped it, and the session log has always held that —
 * nothing pointed at it.
 *
 * This is the row-level half of that link. The exception queue has a stronger
 * one: an ACT exception carries its own `sessionId`, so it links to the exact
 * session rather than to whichever ones share a material and plant.
 *
 * ## Why material + plant, and never material alone
 *
 * Stock, cover and consumption are all held per plant, so the same material at
 * 1300 and at 1500 gets different advice — frequently opposite advice. A session
 * matched on material alone would attach one site's conversation to the other
 * site's row, which is worse than showing no link.
 *
 * ## Why this takes a resolved list rather than fetching
 *
 * Because it renders inside a table. The list is joined once, on the server, for
 * the whole screen — `loadLiveActExceptions` and the WATCH loader both do it.
 * Fetching per row is what turned the justification log into thirty requests.
 */
export function SessionChips({
  sessions,
  className,
}: {
  sessions?: ApiSessionSummary[]
  className?: string
}) {
  if (!sessions || sessions.length === 0) return null

  // Newest first. `issuedAt` is an ISO timestamp, so a string compare is a
  // chronological one, and the most recent conversation is the one somebody
  // arriving at this row wants.
  const ordered = [...sessions].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  const newest = ordered[0]
  const extra = ordered.length - 1

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Link
        href={`/assistant/sessions/${encodeURIComponent(newest.sessionId)}`}
        className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={`Session ${newest.sessionId} — ${newest.outcome.toLowerCase()}`}
      >
        <MessagesSquare className="size-3" aria-hidden />
        {/* ABANDONED is worth showing rather than hiding: advice served and not
            acted on is a number both FRSs count, and a row whose only session
            was abandoned is a different situation from one with none. */}
        {newest.outcome === "ABANDONED" ? "Session (abandoned)" : "Session"}
      </Link>
      {extra > 0 && (
        <Link
          href={`/assistant/sessions?material=${encodeURIComponent(newest.materialId)}&plant=${encodeURIComponent(newest.plant)}`}
          className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
        >
          +{extra}
        </Link>
      )}
    </span>
  )
}
