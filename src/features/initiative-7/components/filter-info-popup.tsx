"use client"

import { INFO_TONE, InfoPopup, riseIn, type InfoTone } from "@/components/shared/info-popup"
import { cn } from "@/lib/utils"

/** One entry in a filter's (i) popup: a name, an optional short tag, a plain sentence and an optional example.
 * The tone is one of the four the cards and charts already use; `neutral` is for entries with no good/bad reading. */
export interface FilterInfoItem {
  name: string
  tag?: string
  definition: string
  /** Shown after "Example:". */
  example?: string
  tone: InfoTone | "neutral"
}

const NEUTRAL = {
  callout: "border-border bg-muted/50",
  heading: "text-foreground",
  chip: "bg-muted text-muted-foreground",
}

// Written out in full so Tailwind can see every class.
const CHIP: Record<InfoTone, string> = {
  info: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
}

/** The (i) icon beside a filter label, opening a popup drawn like the Overview's card and chart popups: one
 * coloured card per option, saying in plain words what it means. */
export function FilterInfoPopup({
  title,
  description,
  triggerLabel,
  items,
  footnote,
}: {
  title: string
  description: string
  triggerLabel: string
  items: readonly FilterInfoItem[]
  footnote?: string
}) {
  return (
    <InfoPopup title={title} description={description} tone="info" triggerLabel={triggerLabel}>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item, i) => {
          const colours = item.tone === "neutral" ? NEUTRAL : INFO_TONE[item.tone]
          const chip = item.tone === "neutral" ? NEUTRAL.chip : CHIP[item.tone]
          const motion = riseIn(80 + i * 60)
          return (
            <li
              key={item.name}
              className={cn("flex min-w-0 flex-col gap-2 rounded-sm border-l-4 px-3 py-2.5", colours.callout, motion.className)}
              style={motion.style}
            >
              <span className={cn("text-xs font-semibold tracking-wide uppercase", colours.heading)}>{item.name}</span>
              {item.tag && <span className={cn("w-fit rounded-sm px-2 py-0.5 text-[11px] font-medium", chip)}>{item.tag}</span>}
              <span className="text-sm text-foreground">{item.definition}</span>
              {item.example && (
                <span className="rounded-sm border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-xs text-foreground">
                  <span className="font-semibold">Example:</span> {item.example}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {footnote && <p className="mt-4 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">{footnote}</p>}
    </InfoPopup>
  )
}
