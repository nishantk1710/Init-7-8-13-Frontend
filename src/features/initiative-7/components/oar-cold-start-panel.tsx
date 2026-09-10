"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import type { OarColdStartGuidance } from "@/features/initiative-7/types/inventory"

const CONFIDENCE_TONE = {
  Low: "warning",
  Medium: "default",
  High: "success",
} as const

/** Advisory-only OAR cold-start guidance panel — shown for materials flagged
 * with no meaningful consumption history. Collapsible, closed by default. */
export function OarColdStartPanel({ guidance }: { guidance: OarColdStartGuidance }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-primary" />
          OAR cold-start guidance
        </span>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className={cn("flex flex-col gap-3 px-3 pb-3")}>
          <p className="text-[11px] text-muted-foreground">
            This material has little to no consumption history at this plant — the figures below are an advisory
            starting point derived from similar materials, not a statistically fitted recommendation.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Confidence:</span>
            <StatusBadge tone={CONFIDENCE_TONE[guidance.confidence]}>{guidance.confidence}</StatusBadge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] text-muted-foreground">Suggested initial ROP</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">{guidance.suggestedRop}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Suggested initial Safety Stock</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">
                {guidance.suggestedSafetyStock}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Similar materials referenced</div>
            <ul className="list-inside list-disc text-[11px] text-muted-foreground">
              {guidance.similarMaterials.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Factors considered</div>
            <ul className="list-inside list-disc text-[11px] text-muted-foreground">
              {guidance.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-[11px] font-medium text-warning">
            {guidance.note}
          </p>
        </div>
      )}
    </div>
  )
}
