import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Skeleton loaders: a page's shape, drawn in grey bones, while the page loads.
 *
 * WHY A SHAPE AND NOT A SPINNER
 *
 * A spinner in the middle of an empty area says only "wait". A skeleton says what is coming and where: the filter bar
 * sits where the filter bar will be, the table where the table will be, and when the data arrives it fills the shapes
 * in instead of landing on a blank page. So the eye is already in the right place, and nothing jumps.
 *
 * WHERE EACH PIECE GOES
 *
 * - `SkeletonPage` is the frame for a route's `loading.tsx` -- what a click in the sidebar shows at once, before the
 *   page has rendered anything. It takes the page's own container classes, so the body lands exactly where the
 *   skeleton was, and draws the header in bones (the page draws the real one).
 * - `SkeletonBody` is for a page that has already drawn its header (and often its filter bar) and is waiting for its
 *   data: the workspace's first load. Same look as the frame, so a route's loading screen and the page's own loader
 *   read as one continuous wait, not two different ones.
 * - The pieces below (`SkeletonFilters`, `SkeletonKpis`, `SkeletonTable`, ...) are the building blocks. Each one
 *   is sized like the real component it stands in for; the comments say which.
 *
 * A feature keeps its page compositions next to its pages (features/initiative-7/components/skeletons.tsx, ...), so a
 * route's `loading.tsx` and the workspace's own first-load branch share one composition.
 *
 * MOTION, TIMING, ACCESSIBILITY (all in globals.css, `skeleton-*`)
 *
 * - One soft light band sweeps across every bone on the screen together.
 * - The frame holds back for 160 ms before it shows, so a page that arrives in a blink never flashes a skeleton.
 * - After 8 s a quiet line says the page is still on its way (`SkeletonLateNote`).
 * - For anyone who has asked for reduced motion: still bones, no band.
 * - The frame is `role="status"` with the label a screen reader announces; the bones are hidden from it.
 *
 * A button that is busy (Submitting..., Exporting...) keeps its small spinner: a skeleton stands in for content, not
 * for an action. A chart waiting for its own figure inside a page that is otherwise drawn keeps `ChartLoader`.
 */

// --- Primitives ---------------------------------------------------------------------------------------------------

/** One grey shape. `aria-hidden`: the frame carries the label; a hundred bones say nothing to a screen reader. */
export function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={cn("skeleton-bone rounded-md", className)} />
}

/** A white card, as the pages draw one (`rounded-xl border border-border bg-card`). */
export function SkeletonCard({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
}

/** The line that appears after a long wait (globals.css `.skeleton-late`: 8 s). Inside the live region, so it is read out. */
export function SkeletonLateNote() {
  return (
    <p className="skeleton-late text-center text-xs text-muted-foreground">
      Still loading. The page will appear as soon as its data is ready.
    </p>
  )
}

/**
 * The frame for a route's `loading.tsx`.
 *
 * `className` is the page's outer container -- its padding and scope class, in place of the usual `p-6` (a replacement,
 * not a merge: `px-4 py-6` beside `p-6` would leave both). `innerClassName` is merged into the inner column's usual
 * `max-w-7xl gap-4`. `header` draws the title and description in bones (`false` where the page has no header of its
 * own, or draws it inside the body).
 */
export function SkeletonPage({
  label,
  children,
  className,
  innerClassName,
  header = true,
}: {
  label: string
  children?: ReactNode
  className?: string
  innerClassName?: string
  header?: boolean | SkeletonHeaderProps
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("skeleton-frame min-h-0 flex-1 overflow-y-auto", className ?? "p-6")}
    >
      <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-4", innerClassName)}>
        {header && <SkeletonHeader {...(header === true ? {} : header)} />}
        {children}
        <SkeletonLateNote />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** The body of a page whose header is already on screen: what a workspace shows on its first load. */
export function SkeletonBody({
  label,
  children,
  className,
}: {
  label: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("skeleton-frame flex flex-col gap-4", className)}>
      {children}
      <SkeletonLateNote />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export type SkeletonHeaderProps = {
  /** `xl` is the shared PageHeader (text-xl); `2xl` the assistant's and OAR's (text-2xl). */
  size?: "xl" | "2xl"
  /** A small line above the title (the assistant's eyebrow, I08's breadcrumbs). */
  eyebrow?: boolean
  /** A button or pill at the right of the title row (Export, Last rebuilt, Data updated). */
  actions?: boolean
  /** A back link above the title ("All requests", "Back"). */
  back?: boolean
}

/** A page header in bones: PageHeader's title (text-xl, one line) and description (text-sm), and an action at the right. */
export function SkeletonHeader({ size = "xl", eyebrow = false, actions = false, back = false }: SkeletonHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      {back && <Bone className="h-4 w-24" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow && <Bone className="h-3 w-28" />}
          <Bone className={cn("max-w-full", size === "2xl" ? "h-8 w-72" : "h-7 w-56")} />
          <Bone className="h-4 w-[28rem] max-w-full" />
        </div>
        {actions && <Bone className="h-9 w-40 shrink-0 rounded-lg" />}
      </div>
    </div>
  )
}

// --- Pieces -----------------------------------------------------------------------------------------------------------

/**
 * A filter bar: the "action" bar the pages share (`rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg`).
 * `fields` are the controls' widths in px. `labelled` is the p-4 variant -- an 11px label over each h-8 control, the
 * controls sharing the row (`min-w-[132px] flex-1`, the width as the starting share); the plain one is a row of h-9
 * controls at their own widths. `trailing` puts a button at the right (Clear filters, Export). `bare` leaves the bar
 * out: I13's plain filter row.
 */
export function SkeletonFilters({
  fields = [288, 160, 176, 176],
  labelled = false,
  trailing = true,
  bare = false,
  className,
}: {
  fields?: number[]
  labelled?: boolean
  trailing?: boolean
  bare?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3",
        !bare && "rounded-lg border-2 border-action/40 bg-card shadow-lg",
        !bare && (labelled ? "p-4" : "p-3"),
        className,
      )}
    >
      {fields.map((width, i) => (
        <div
          key={i}
          style={labelled ? { flexBasis: width } : { width }}
          className={cn("flex max-w-full flex-col gap-1.5", labelled && "min-w-[132px] flex-1")}
        >
          {labelled && <Bone className="h-2.5 w-16" />}
          <Bone className={cn(labelled ? "h-8" : "h-9", "w-full")} />
        </div>
      ))}
      {trailing && <Bone className={cn("ml-auto w-32 rounded-lg", labelled ? "h-8" : "h-9")} />}
    </div>
  )
}

/** A row of tabs: `segmented` is the bordered h-11 track with pills inside; otherwise bordered buttons side by side. */
export function SkeletonTabs({
  count = 3,
  segmented = false,
  className,
}: {
  count?: number
  segmented?: boolean
  className?: string
}) {
  if (segmented) {
    return (
      <div className={cn("p-1 pb-3", className)}>
        <div className="inline-flex h-11 items-center gap-1 rounded-lg border border-border bg-card p-1">
          {Array.from({ length: count }, (_, i) => (
            <Bone key={i} className={cn("h-8 rounded-md", i === 0 ? "w-36" : "w-32")} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className={cn("h-9 rounded-lg", i === 0 ? "w-36" : "w-28")} />
      ))}
    </div>
  )
}

/** KPI cards (I7's portfolio cards, I13's KpiCard): an icon chip and label, a big figure, a hint. */
export function SkeletonKpis({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="flex h-[124px] flex-col justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bone className="size-[30px] rounded-lg" />
            <Bone className="h-3 w-28" />
          </div>
          <Bone className="h-7 w-24" />
          <Bone className="h-3 w-36" />
        </SkeletonCard>
      ))}
    </div>
  )
}

const BAR_HEIGHTS = [55, 78, 48, 92, 64, 36, 70, 58]

/** The chart area alone: a row of bars, as a chart draws them. For a chart inside a card the page has already drawn. */
export function SkeletonBars({ bars = 8, className }: { bars?: number; className?: string }) {
  return (
    <div className={cn("flex h-40 items-end gap-3 border-b border-border px-2 pb-px", className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <Bone key={i} style={{ height: `${BAR_HEIGHTS[i % BAR_HEIGHTS.length]}%` }} className="flex-1 rounded-b-none" />
      ))}
    </div>
  )
}

/** Chart cards (ChartCard: `rounded-xl border bg-card p-4`, a title and subtitle, the chart). */
export function SkeletonCharts({
  count = 2,
  columns = "lg:grid-cols-2",
  chart = "h-48",
  className,
}: {
  count?: number
  columns?: string
  /** The chart area's height class, as the page's chart has. */
  chart?: string
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", columns, className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="flex flex-col gap-2 p-4">
          <Bone className="h-4 w-44" />
          <Bone className="h-3 w-64 max-w-full" />
          <SkeletonBars bars={6 + (i % 3)} className={cn("mt-3", chart)} />
        </SkeletonCard>
      ))}
    </div>
  )
}

const CELL_WIDTHS = [84, 62, 70, 56, 76, 48, 66, 58, 72, 52, 60, 68]

/**
 * A table (`rounded-xl border bg-card`): a head row, `rows` body rows of `columns` cells with varied widths, and the
 * "Showing" line with two buttons under it when `pagination`.
 */
export function SkeletonTable({
  rows = 8,
  columns = 6,
  pagination = true,
  rowHeight = "h-12",
  className,
}: {
  rows?: number
  columns?: number
  pagination?: boolean
  rowHeight?: string
  className?: string
}) {
  const grid: CSSProperties = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <SkeletonCard className="overflow-hidden">
        <div style={grid} className="grid h-10 items-center gap-4 bg-muted/60 px-4">
          {Array.from({ length: columns }, (_, col) => (
            <Bone key={col} className="h-2.5" style={{ width: `${40 + ((col * 7) % 30)}%` }} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} style={grid} className={cn("grid items-center gap-4 border-t border-border px-4", rowHeight)}>
            {Array.from({ length: columns }, (_, col) => (
              <Bone
                key={col}
                className="h-3"
                style={{ width: `${CELL_WIDTHS[(row + col) % CELL_WIDTHS.length] - ((row * 3 + col * 5) % 14)}%` }}
              />
            ))}
          </div>
        ))}
      </SkeletonCard>
      {pagination && (
        <div className="flex items-center justify-between">
          <Bone className="h-3 w-40" />
          <div className="flex gap-2">
            <Bone className="h-8 w-20 rounded-md" />
            <Bone className="h-8 w-20 rounded-md" />
          </div>
        </div>
      )}
    </div>
  )
}

/** A list of row cards (requests, notifications): an avatar or icon, two lines, a chip at the right. */
export function SkeletonList({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="flex min-h-14 items-center gap-4 px-4 py-3">
          <Bone className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone className="h-3.5" style={{ width: `${44 + ((i * 11) % 30)}%` }} />
            <Bone className="h-3" style={{ width: `${28 + ((i * 7) % 24)}%` }} />
          </div>
          <Bone className="h-6 w-20 shrink-0 rounded-full" />
        </SkeletonCard>
      ))}
    </div>
  )
}

/** Cards in a grid: a title line and `lines` of text each, `height` tall. */
export function SkeletonCards({
  count = 3,
  columns = "sm:grid-cols-3",
  height = "h-32",
  lines = 2,
  className,
}: {
  count?: number
  columns?: string
  height?: string
  lines?: number
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", columns, className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className={cn("flex flex-col gap-3 p-4", height)}>
          <Bone className="h-4 w-2/5" />
          {Array.from({ length: lines }, (_, line) => (
            <Bone key={line} className="h-3" style={{ width: `${88 - ((i * 9 + line * 23) % 40)}%` }} />
          ))}
        </SkeletonCard>
      ))}
    </div>
  )
}

/** Lines of text, as a paragraph or a description list reads. */
export function SkeletonLines({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className="h-3" style={{ width: `${96 - ((i * 17) % 38)}%` }} />
      ))}
    </div>
  )
}

/** A form: `fields` labelled inputs (h-10) in `columns`, and a button row. */
export function SkeletonForm({
  fields = 4,
  columns = "sm:grid-cols-2",
  className,
}: {
  fields?: number
  columns?: string
  className?: string
}) {
  return (
    <SkeletonCard className={cn("flex flex-col gap-5 p-5", className)}>
      <Bone className="h-4 w-40" />
      <div className={cn("grid grid-cols-1 gap-4", columns)}>
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Bone className="h-10 w-28 rounded-lg" />
        <Bone className="h-10 w-24 rounded-lg" />
      </div>
    </SkeletonCard>
  )
}
