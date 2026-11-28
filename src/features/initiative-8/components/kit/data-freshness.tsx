"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

import { freshnessNote } from "@/features/initiative-8/utils/freshness"
import { getI8Freshness, type ApiI8Freshness } from "@/lib/api/i8"
import { cn } from "@/lib/utils"

/**
 * When the SAP data behind this screen was loaded, and how far it reaches
 * (`GET /i8/status`). Shown on every I08 screen, through `I08Page`.
 *
 * **A client component, where Initiative 13's equivalent is a server one.**
 * `I08Page` is itself a server component, but five of the six I08 screens
 * render it from inside `"use client"` trees, so an async server component
 * cannot live in it. It reads once on mount instead; moving between screens
 * remounts it, which is as fresh as this needs to be.
 *
 * A failed read shows nothing at all. The alternative — a date that might be
 * wrong — is worse on a chip whose entire job is to be trusted about dates.
 */
export function DataFreshness({ className }: { className?: string }) {
  const [status, setStatus] = useState<ApiI8Freshness | null>(null)

  useEffect(() => {
    let alive = true
    getI8Freshness()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch(() => {
        // Nothing to say, and the screen's own error handling owns the rest.
      })
    return () => {
      alive = false
    }
  }, [])

  const note = freshnessNote(status)
  if (!note) return null

  return (
    <span
      title={note.title}
      className={cn(
        "inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] whitespace-nowrap",
        note.tone === "warn"
          ? "border-i08-warn-border bg-i08-warn-tint text-i08-warn-ink"
          : "border-border bg-card text-muted-foreground",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      {note.label}
    </span>
  )
}
