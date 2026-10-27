"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import {
  heatLevel,
  monthLabel,
  monthNote,
  readUsage,
  yearGrid,
  type UsageKind,
  type UsageReading,
} from "@/features/initiative-13/utils/usage-pattern"
import type { UsagePattern } from "@/lib/api/i13"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount } from "@/lib/utils"

const BAND_TONE = { FAST: "healthy", SLOW: "caution", NON_MOVING: "urgent" } as const
const BAND_LABEL = { FAST: "Fast", SLOW: "Slow", NON_MOVING: "Non-moving" } as const

export const KIND_DOT: Record<UsageKind, string> = {
  steady: "bg-success",
  bursts: "bg-action",
  quiet: "bg-destructive",
  never: "bg-muted-foreground/50",
}

const KIND_PANEL: Record<UsageKind, string> = {
  steady: "bg-success/10",
  bursts: "bg-action/10",
  quiet: "bg-destructive/10",
  never: "bg-muted",
}

/** Heat steps for the year calendar: nothing, then four shares of the busiest month. */
export const HEAT_FILL = [
  "bg-muted",
  "bg-action/20",
  "bg-action/45",
  "bg-action/75",
  "bg-action",
] as const

/** The row's columns, shared by the header labels and every card so they line up. */
const ROW_COLUMNS =
  "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_10.5rem]"

const keyOf = (row: UsagePattern) => `${row.material}::${row.plant}`
const panelId = (row: UsagePattern) => `usage-detail-${row.material}-${row.plant}`

/**
 * The Usage Pattern tab as a list of cards, one per material, one after
 * another. Each card says what the material is and how it has been issued,
 * and a labelled "Show details" button opens its month-by-month detail inside
 * the same card. One card is open at a time.
 *
 * Renders the one page of rows it is handed; the filters and the pager are the
 * page's, in the URL, exactly as for the table.
 */
export function UsagePatternCards({ rows }: { rows: UsagePattern[] }) {
  const [picked, setPicked] = useState<string | null>(null)
  const readings = useMemo(() => new Map(rows.map((r) => [keyOf(r), readUsage(r.months)])), [rows])
  // A new page of rows may not hold the card that was open: then none is.
  const openKey = picked && readings.has(picked) ? picked : null

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No movement history matches these filters."
        description="Usage is built from goods issues and receipts in the delivered MSEG extract."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div
        aria-hidden
        className={cn("hidden gap-4 px-5 text-[13px] font-medium text-muted-foreground md:grid", ROW_COLUMNS)}
      >
        <span>Material</span>
        <span>Pattern</span>
        <span className="text-right">Issued</span>
        <span>Last issue</span>
        <span className="text-right">Stock</span>
        <span />
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const key = keyOf(row)
          const open = key === openKey
          return (
            <li key={key}>
              <UsageCard
                row={row}
                reading={readings.get(key)!}
                open={open}
                onToggle={() => setPicked(open ? null : key)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function UsageCard({
  row,
  reading,
  open,
  onToggle,
}: {
  row: UsagePattern
  reading: UsageReading
  open: boolean
  onToggle: () => void
}) {
  const name = row.materialDescription || row.material
  return (
    <article
      aria-label={name}
      className={cn(
        "overflow-hidden rounded-xl border-2 bg-card transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none",
        open ? "border-action shadow-lg shadow-action/10" : "border-transparent ring-1 ring-border hover:shadow-md"
      )}
    >
      <div className={cn("grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-3.5", ROW_COLUMNS)}>
        <div className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-foreground" title={name}>
              {name}
            </span>
            {row.agingBand && (
              <StatusPill tone={BAND_TONE[row.agingBand]} className="shrink-0">
                {BAND_LABEL[row.agingBand]}
              </StatusPill>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{row.material}</span> · {sapPlantLabel(row.plant)}
          </span>
        </div>
        <div className="col-span-2 flex min-w-0 flex-col gap-0.5 md:col-span-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", KIND_DOT[reading.kind])} />
            {reading.label}
          </span>
          <span className="truncate text-xs text-muted-foreground">{reading.hint}</span>
        </div>
        <Cell label="Issued" className="md:text-right">
          <span className="text-lg font-semibold tabular-nums text-foreground">{formatCount(row.issuedQuantityTotal)}</span>
        </Cell>
        <Cell label="Last issue">
          <span className="text-sm font-semibold text-foreground">{row.lastIssueMonth ?? "Never"}</span>
        </Cell>
        <Cell label="Stock" className="md:text-right">
          {row.stockOnHand === null ? (
            <EmptyValue kind="noStockRecord" />
          ) : (
            <span className={cn("text-base font-semibold tabular-nums", row.stockOnHand === 0 ? "text-destructive" : "text-foreground")}>
              {formatCount(row.stockOnHand)}
            </span>
          )}
        </Cell>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId(row)}
          className={cn(
            "col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors md:col-span-1 md:justify-self-end",
            "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            open
              ? "border-action bg-action/10 text-action ring-1 ring-action"
              : "border-border bg-card text-action hover:bg-action/10"
          )}
        >
          {open ? "Hide details" : "Show details"}
          <ChevronDown
            aria-hidden
            className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          />
        </button>
      </div>
      {open && <UsageDetail row={row} reading={reading} />}
    </article>
  )
}

/** A figure in the card row. On a phone its column label is not above it, so it carries its own. */
function Cell({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      {children}
    </div>
  )
}

function UsageDetail({ row, reading }: { row: UsagePattern; reading: UsageReading }) {
  const [hover, setHover] = useState<number | null>(null)
  const months = row.months
  const max = Math.max(0, ...months.map((m) => m.issuedQuantity))
  const peak = reading.peakIndex >= 0 ? months[reading.peakIndex] : null
  const years = useMemo(() => yearGrid(months), [months])
  const first = months[0]?.month
  const last = months.at(-1)?.month

  return (
    <section
      id={panelId(row)}
      aria-label={`${row.materialDescription || row.material}: usage detail`}
      className="grid gap-5 border-t border-action/20 bg-muted/30 p-5 animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.1fr)]"
    >
      <div className="flex flex-col gap-3">
        <div className={cn("flex flex-col gap-2 rounded-xl p-4", KIND_PANEL[reading.kind])}>
          <span className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-foreground uppercase">
            <span aria-hidden className={cn("size-2 rounded-full", KIND_DOT[reading.kind])} />
            {reading.label}
          </span>
          <p className="text-[15px] leading-relaxed text-foreground">{reading.story}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Figure label="Active months" value={`${row.activeMonths} / ${months.length}`} />
          <Figure
            label="Months of cover"
            value={row.monthsOfCover === null ? <EmptyValue kind="noConsumptionHistory" /> : row.monthsOfCover.toFixed(1)}
          />
          <Figure
            label="Avg per month"
            value={
              row.averageMonthlyConsumption === null ? (
                <EmptyValue kind="noConsumptionHistory" />
              ) : (
                row.averageMonthlyConsumption.toFixed(1)
              )
            }
          />
          <Figure label="Busiest month" value={peak ? monthLabel(peak.month) : "None"} />
        </dl>
        <Link
          href={`/oar-utilization/watch?material=${encodeURIComponent(row.material)}&plant=${encodeURIComponent(row.plant)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-action hover:bg-action/10"
        >
          Open in Metrics
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-foreground">Issued each month</h3>
          <span className="text-xs text-muted-foreground">Hover or tab to a month for details</span>
        </div>
        <div className="relative">
          <div className="flex h-[190px] items-end gap-[3px] border-b border-border pt-2" onMouseLeave={() => setHover(null)}>
            {months.map((m, i) => {
              const height = m.issuedQuantity > 0 && max > 0 ? Math.max(3, (m.issuedQuantity / max) * 100) : 0
              const on = hover === i
              return (
                <button
                  key={m.month}
                  type="button"
                  aria-label={`${monthLabel(m.month)}: ${formatCount(m.issuedQuantity)} issued in ${m.issueCount} movement${m.issueCount === 1 ? "" : "s"}, ${formatCount(m.receivedQuantity)} received`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="flex h-full min-w-0 flex-1 items-end focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <span
                    className={cn(
                      "w-full rounded-t-[3px] animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none",
                      height > 0
                        ? on
                          ? "bg-foreground"
                          : i === reading.peakIndex
                            ? "bg-action"
                            : "bg-action/55"
                        : on
                          ? "bg-muted-foreground"
                          : "bg-border"
                    )}
                    style={{ height: height > 0 ? `${height}%` : "3px" }}
                  />
                </button>
              )
            })}
          </div>
          {hover !== null && months[hover] && <MonthCard month={months[hover]} at={(hover + 0.5) / months.length} />}
        </div>
        {first && last && (
          <div aria-hidden className="flex justify-between text-[11px] text-muted-foreground">
            <span>{monthLabel(first)}</span>
            <span>{monthLabel(last)}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <h3 className="text-[15px] font-semibold text-foreground">By year</h3>
        <div className="grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] items-center gap-[3px] text-[10px] text-muted-foreground">
          <span />
          {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((d, i) => (
            <span key={i} aria-hidden className="text-center">
              {d}
            </span>
          ))}
          {years.map((y) => (
            <Fragment key={y.year}>
              <span className="text-xs font-semibold text-foreground">{y.year}</span>
              {y.cells.map((c) =>
                c.index === null ? (
                  <span key={c.month} aria-hidden className="aspect-square rounded border border-dashed border-border" />
                ) : (
                  <span
                    key={c.month}
                    title={`${monthLabel(c.month)}: ${formatCount(months[c.index].issuedQuantity)} issued`}
                    onMouseEnter={() => setHover(c.index)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "aspect-square rounded",
                      HEAT_FILL[heatLevel(months[c.index].issuedQuantity, max)],
                      hover === c.index && "outline-2 outline-offset-1 outline-foreground"
                    )}
                  />
                )
              )}
            </Fragment>
          ))}
        </div>
        <div aria-hidden className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Less</span>
          {HEAT_FILL.map((fill) => (
            <span key={fill} className={cn("size-3 rounded-[3px]", fill)} />
          ))}
          <span>More issued</span>
        </div>
        <p className="text-xs text-muted-foreground">Dashed: outside the movement history.</p>
      </div>
    </section>
  )
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

/**
 * The hover card over a bar: the month's three figures and what they say
 * together. Drawn inside the chart's own area -- the card around it clips
 * anything above, which cut the month name off.
 */
function MonthCard({ month, at }: { month: UsagePattern["months"][number]; at: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-10 w-[220px] -translate-x-1/2 rounded-xl bg-foreground p-3.5 text-card shadow-xl"
      style={{ left: `clamp(110px, ${at * 100}%, calc(100% - 110px))` }}
    >
      <div className="mb-2 text-[13px] font-semibold">{monthLabel(month.month)}</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px]">
        <dt className="flex items-center gap-2 opacity-80">
          <span className="size-2 rounded-[2px] bg-action/70" />
          Issued
        </dt>
        <dd className="text-right font-semibold tabular-nums">{formatCount(month.issuedQuantity)}</dd>
        <dt className="flex items-center gap-2 opacity-80">
          <span className="size-2 rounded-full border-[1.5px] border-current" />
          Movements
        </dt>
        <dd className="text-right font-semibold tabular-nums">{formatCount(month.issueCount)}</dd>
        <dt className="flex items-center gap-2 opacity-80">
          <span className="size-2 rounded-[2px] bg-success" />
          Received
        </dt>
        <dd className="text-right font-semibold tabular-nums">{formatCount(month.receivedQuantity)}</dd>
      </dl>
      <div className="mt-2 border-t border-card/20 pt-2 text-xs opacity-80">{monthNote(month)}</div>
    </div>
  )
}
