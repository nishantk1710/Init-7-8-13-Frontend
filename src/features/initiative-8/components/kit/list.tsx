"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { X } from "lucide-react"

import { cn, formatCount } from "@/lib/utils"

/**
 * The pieces every I08 list screen is built from (I08_Live_UI_Redesign_Plan.md,
 * L0): quick views, tabs, filter chips and the card the table sits in.
 *
 * They write nothing themselves. Each screen owns one `useUrlFilters` and
 * passes its `push` in, so a click on any of them goes through the same
 * transition -- and the results card can show that one pending state.
 */

export type Choice = { value: string; label: string; count?: number }

/**
 * Preset filters as a row of pills, each with its count: "Overdue 104".
 * The selected one is filled. The value "" is "All".
 */
export function QuickViews({
  choices,
  value,
  onSelect,
  label = "Quick views",
}: {
  choices: Choice[]
  value: string
  onSelect: (value: string) => void
  label?: string
}) {
  return (
    <div role="group" aria-label={label} className="mt-5 flex flex-wrap gap-2">
      {choices.map((choice) => {
        const active = choice.value === value
        return (
          <button
            key={choice.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(choice.value)}
            className={cn(
              "inline-flex h-[34px] items-center gap-2 rounded-full border px-3 text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
            )}
          >
            {choice.label}
            {choice.count !== undefined && <Count value={choice.count} inverted={active} />}
          </button>
        )
      })}
    </div>
  )
}

/** Tabs along a hairline, the selected one underlined: "To declare 104". */
export function Tabs({
  choices,
  value,
  onSelect,
  label,
  end,
}: {
  choices: Choice[]
  value: string
  onSelect: (value: string) => void
  label: string
  /** Something on the right of the tab row, e.g. the Open / Closed switch. */
  end?: ReactNode
}) {
  return (
    <div className="mt-5 flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-border">
      <div role="tablist" aria-label={label} className="flex flex-wrap items-end gap-1">
        {choices.map((choice) => {
          const active = choice.value === value
          return (
            <button
              key={choice.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(choice.value)}
              className={cn(
                "relative inline-flex h-11 items-center gap-2 px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:origin-center after:rounded-full after:bg-primary after:transition-transform after:duration-200",
                active ? "text-foreground after:scale-x-100" : "text-muted-foreground after:scale-x-0 hover:text-foreground",
              )}
            >
              {choice.label}
              {choice.count !== undefined && <Count value={choice.count} accent={active} />}
            </button>
          )
        })}
      </div>
      {end && <div className="ml-auto pb-1.5">{end}</div>}
    </div>
  )
}

/** A two-way switch: "Open 207 | Closed 0". */
export function Segmented({
  choices,
  value,
  onSelect,
  label,
}: {
  choices: Choice[]
  value: string
  onSelect: (value: string) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]">
      {choices.map((choice) => {
        const active = choice.value === value
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(choice.value)}
            className={cn(
              "inline-flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {choice.label}
            {choice.count !== undefined && <span className="tabular-nums opacity-80">{formatCount(choice.count)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Count({ value, inverted = false, accent = false }: { value: number; inverted?: boolean; accent?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[12.5px] tabular-nums",
        inverted ? "bg-white/20 text-primary-foreground" : accent ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {formatCount(value)}
    </span>
  )
}

/**
 * What the list is filtered by, each removable: "Plant: Gamsberg ✕".
 * Says nothing when nothing is set.
 */
export function FilterChips({
  chips,
  onRemove,
  onClear,
}: {
  chips: { key: string; label: string }[]
  onRemove: (key: string) => void
  onClear: () => void
}) {
  if (chips.length === 0) return null
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-accent pr-1 pl-2.5 text-[13px] font-medium text-accent-foreground"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            aria-label={`Remove filter ${chip.label}`}
            className="grid size-[22px] place-items-center rounded-full transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-sm px-1 text-[13px] font-medium text-i08-link hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

/**
 * The white card a table sits in. While the next page or filter loads, a thin
 * bar runs along its top and the rows stay on screen, dimmed: the click is
 * answered at once and nothing jumps.
 *
 * `overflow-clip`, not `overflow-hidden`: hidden would make the card a scroll
 * box, and the table's pinned sideways scrollbar sticks to the page's.
 */
export function ResultsCard({
  pending = false,
  className,
  children,
}: {
  pending?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      aria-busy={pending || undefined}
      className={cn("relative mt-3.5 overflow-clip rounded-xl border border-border bg-card shadow-xs", className)}
    >
      <div aria-hidden="true" data-on={pending ? "" : undefined} className="i08-progress absolute inset-x-0 top-0 z-30 h-0.5" />
      <div className={cn("transition-opacity duration-150", pending && "opacity-50")}>{children}</div>
    </section>
  )
}

/**
 * A material as SAP people find it: the number first, in a fixed-width face,
 * then the description. The number used to be 11px grey under an upper-case
 * description, which is the wrong way round for anyone searching by it.
 */
export function MaterialCell({
  code,
  description,
  href,
  extra,
}: {
  code: string
  description?: string | null
  /** Where the material opens -- its repair page -- when there is one. */
  href?: string
  extra?: ReactNode
}) {
  const text = description && description !== code ? description : null
  const body = (
    <>
      <span className="flex items-center gap-1.5 font-mono text-[13.5px] font-medium tracking-tight text-foreground">
        {code}
        {extra}
      </span>
      {text && (
        <span className="block truncate text-[13px] text-muted-foreground" title={text}>
          {text}
        </span>
      )}
    </>
  )
  return href ? (
    <Link href={href} className="flex min-w-0 flex-col leading-snug hover:[&>span:first-child]:text-i08-link hover:[&>span:first-child]:underline">
      {body}
    </Link>
  ) : (
    <div className="flex min-w-0 flex-col leading-snug">{body}</div>
  )
}

/** A field inside a filter panel: its label above the control. */
export function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
