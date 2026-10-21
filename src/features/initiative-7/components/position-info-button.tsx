"use client"

import { useCallback, useState } from "react"
import { InfoIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { PositionMetric } from "@/features/initiative-7/utils/plant-position"
import { positionInfo, type PositionFigures } from "@/features/initiative-7/utils/position-info"

// The (i) beside a "by plant" card's title: what the card counts, how it is worked out, a worked
// example, what the percentage is of, and the data date, in a popover. Each card has its own, so
// opening one never opens the other. Open / close on click, Enter and Space, Escape and a click
// outside, and focus returning to the button, are the Base UI popover's; the close button is there
// for anyone who looks for one.
//
// The popover opens over the whole card, exactly its size, so the card's own title and chart sit
// behind it, blurred -- not beside the button, so it never lands on the KPI row or the neighbouring
// card. When its text is taller than the card it scrolls inside. Where the button is not inside a
// ChartCard it falls back to opening under the button.

const CARD_SELECTOR = '[data-slot="chart-card"]'

/** The card's exact width and height, rounded like the card. See-through: a solid fill where the
 * browser cannot blur, otherwise 45% over a strong blur, so what is behind shows through softly,
 * with a hairline border and a soft shadow. Body text is near full-strength foreground so it stays
 * readable over the bars. A thin scrollbar keeps the card look when the text has to scroll. */
export const POSITION_INFO_POPUP_CLASS =
  "h-(--anchor-height) w-(--anchor-width) overflow-y-auto rounded-xl border border-border/50 bg-popover p-4 shadow-lg ring-0 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] supports-backdrop-filter:bg-popover/45 supports-backdrop-filter:backdrop-blur-lg"

/** Open on the anchor's top edge: the popup sits "below" the anchor, pulled up by the anchor's own height. */
export const COVER_ANCHOR_OFFSET = ({ anchor }: { anchor: { height: number } }) => -anchor.height

/** The definitions in the popover, separate from the button (and from the popover's own title, which
 * needs the popover around it) so they can be rendered and read on their own. */
export function PositionInfoContent({
  metric,
  asOf,
  figures,
}: {
  metric: PositionMetric
  asOf?: string | null
  figures?: PositionFigures
}) {
  const info = positionInfo(metric, asOf, figures)
  return (
    <div className="flex flex-col gap-2">
      {info.blocks.map((block) => (
        <section key={block.heading} className="flex flex-col gap-0.5">
          <h3 className="text-xs font-medium text-foreground">{block.heading}</h3>
          {block.formula && (
            <p className="rounded-md bg-foreground/5 px-2 py-1 text-xs font-medium leading-snug text-foreground">
              {block.formula}
            </p>
          )}
          {block.text?.map((line) => (
            <p key={line} className="text-xs leading-snug text-foreground/80">
              {line}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

/** `asOf`: the stockout figures' date from the summary (`undefined` while loading, `null` when the
 * usage has not been built). `figures`: the card's own All-plants numerator and denominator, for the
 * percentage line. The excess card has no date and ignores `asOf`. */
export function PositionInfoButton({
  metric,
  asOf,
  figures,
}: {
  metric: PositionMetric
  asOf?: string | null
  figures?: PositionFigures
}) {
  const label = positionInfo(metric).title
  // This button's card, to open over. A stable callback, so React does not re-run it (and set state)
  // on every render.
  const [region, setRegion] = useState<Element | null>(null)
  const findRegion = useCallback((node: HTMLElement | null) => {
    setRegion(node?.closest(CARD_SELECTOR) ?? null)
  }, [])
  return (
    <Popover>
      <PopoverTrigger
        ref={findRegion}
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={`About ${label}`}
          />
        }
      >
        <InfoIcon />
      </PopoverTrigger>
      <PopoverContent
        className={POSITION_INFO_POPUP_CLASS}
        anchor={region}
        side="bottom"
        align="start"
        sideOffset={region ? COVER_ANCHOR_OFFSET : 6}
        collisionAvoidance={region ? { side: "none", align: "none", fallbackAxisSide: "none" } : undefined}
      >
        <PopoverClose
          render={<Button variant="ghost" size="icon-xs" className="absolute top-4 right-4" aria-label="Close" />}
        >
          <XIcon />
        </PopoverClose>
        <div className="flex flex-col gap-2">
          <PopoverTitle className="pr-7">{label}</PopoverTitle>
          <PositionInfoContent metric={metric} asOf={asOf} figures={figures} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
