"use client"

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

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
  steady: "bg-healthy",
  bursts: "bg-primary-strong",
  quiet: "bg-urgent",
  never: "bg-ink-muted/50",
}

const KIND_PANEL: Record<UsageKind, string> = {
  steady: "bg-healthy-tint",
  bursts: "bg-primary-tint",
  quiet: "bg-urgent-tint",
  never: "bg-muted",
}

/** Heat steps for the year calendar: nothing, then four shares of the busiest month. */
export const HEAT_FILL = [
  "bg-muted",
  "bg-primary-strong/20",
  "bg-primary-strong/45",
  "bg-primary-strong/75",
  "bg-primary-strong",
] as const

const keyOf = (row: UsagePattern) => `${row.material}::${row.plant}`

/** Cards per row at this width -- the panel opens under the row the card is in. */
function columnsFor(width: number): number {
  return width >= 1180 ? 4 : width >= 860 ? 3 : width >= 560 ? 2 : 1
}

function useColumns() {
  const ref = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(4)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setColumns(columnsFor(el.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, columns }
}

/**
 * The Usage Pattern tab as cards. A card is a summary -- name, stock type,
 * total issued, the pattern and the stock -- and opening one unfolds the
 * month-by-month detail across the full width, under that card's row.
 *
 * Renders the one page of rows it is handed; the filters and the pager are the
 * page's, in the URL, exactly as for the table.
 */
export function UsagePatternCards({ rows }: { rows: UsagePattern[] }) {
  const { ref, columns } = useColumns()
  const [picked, setOpenKey] = useState<string | null>(null)
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

  const groups: UsagePattern[][] = []
  for (let i = 0; i < rows.length; i += columns) groups.push(rows.slice(i, i + columns))

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {groups.map((group) => {
        const openIndex = group.findIndex((r) => keyOf(r) === openKey)
        const open = openIndex >= 0 ? group[openIndex] : null
        return (
          <Fragment key={keyOf(group[0])}>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {group.map((row) => {
                const key = keyOf(row)
                const isOpen = key === openKey
                return (
                  <UsageCard
                    key={key}
                    row={row}
                    reading={readings.get(key)!}
                    open={isOpen}
                    dimmed={openKey !== null && !isOpen}
                    onToggle={() => setOpenKey(isOpen ? null : key)}
                  />
                )
              })}
            </div>
            {open && (
              <UsageDetail
                key={keyOf(open)}
                row={open}
                reading={readings.get(keyOf(open))!}
                pointerAt={(openIndex + 0.5) / columns}
                onClose={() => setOpenKey(null)}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function panelId(row: UsagePattern) {
  return `usage-detail-${row.material}-${row.plant}`
}

function UsageCard({
  row,
  reading,
  open,
  dimmed,
  onToggle,
}: {
  row: UsagePattern
  reading: UsageReading
  open: boolean
  dimmed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? panelId(row) : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-card border-2 bg-card p-[18px] text-left transition-[transform,box-shadow,opacity,border-color] duration-200 motion-reduce:transition-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        open
          ? "-translate-y-0.5 border-primary-strong shadow-lg shadow-primary-strong/15"
          : "border-transparent ring-1 ring-line hover:-translate-y-0.5 hover:shadow-md",
        dimmed && "opacity-70 hover:opacity-100"
      )}
    >
      <span className="flex w-full items-start justify-between gap-2.5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">
            {row.materialDescription || row.material}
          </span>
          <span className="truncate text-xs text-ink-muted">
            <span className="font-mono">{row.material}</span> · {sapPlantLabel(row.plant)}
          </span>
        </span>
        {row.agingBand && (
          <StatusPill tone={BAND_TONE[row.agingBand]} className="shrink-0">
            {BAND_LABEL[row.agingBand]}
          </StatusPill>
        )}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-[28px] leading-none font-extrabold tracking-tight text-ink tabular-nums">
          {formatCount(row.issuedQuantityTotal)}
        </span>
        <span className="text-[13px] text-ink-muted">issued in {row.months.length} months</span>
      </span>
      <span className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", KIND_DOT[reading.kind])} />
          <strong className="text-ink">{reading.label}</strong>
          <span className="truncate text-ink-muted">{reading.hint}</span>
        </span>
        <span className="text-ink-muted">
          Stock{" "}
          {row.stockOnHand === null ? (
            <span className="font-semibold">not recorded</span>
          ) : (
            <strong className={row.stockOnHand === 0 ? "text-urgent-ink" : "text-ink"}>{formatCount(row.stockOnHand)}</strong>
          )}
        </span>
      </span>
    </button>
  )
}

function UsageDetail({
  row,
  reading,
  pointerAt,
  onClose,
}: {
  row: UsagePattern
  reading: UsageReading
  /** 0..1 across the grid: where the pointer sits, over the open card. */
  pointerAt: number
  onClose: () => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const months = row.months
  const max = Math.max(0, ...months.map((m) => m.issuedQuantity))
  const peak = reading.peakIndex >= 0 ? months[reading.peakIndex] : null
  const years = useMemo(() => yearGrid(months), [months])
  const first = months[0]?.month
  const last = months.at(-1)?.month

  return (
    <div className="relative pt-3.5">
      <span
        aria-hidden
        className="absolute top-1 size-[22px] -translate-x-1/2 rotate-45 border-t border-l border-primary-strong/30 bg-card"
        style={{ left: `${pointerAt * 100}%` }}
      />
      <section
        id={panelId(row)}
        aria-label={`${row.materialDescription || row.material}: usage detail`}
        className="relative flex flex-col gap-5 rounded-card border border-primary-strong/30 bg-card p-5 shadow-xl shadow-primary-strong/10 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-xl font-extrabold text-ink">{row.materialDescription || row.material}</h2>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
              {row.agingBand && <StatusPill tone={BAND_TONE[row.agingBand]}>{BAND_LABEL[row.agingBand]}</StatusPill>}
              <span className="font-mono text-ink">{row.material}</span>
              <span>{sapPlantLabel(row.plant)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/oar-utilization/watch?material=${encodeURIComponent(row.material)}&plant=${encodeURIComponent(row.plant)}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-bold text-primary-ink hover:bg-primary-tint"
            >
              Open in Metrics
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail"
              className="inline-flex size-11 items-center justify-center rounded-lg border border-line text-ink hover:bg-muted"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3.5">
            <div className={cn("flex flex-col gap-2 rounded-xl p-4", KIND_PANEL[reading.kind])}>
              <span className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-ink uppercase">
                <span aria-hidden className={cn("size-2 rounded-full", KIND_DOT[reading.kind])} />
                {reading.label}
              </span>
              <p className="text-[15px] leading-relaxed text-ink">{reading.story}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2.5">
              <Figure label="Active months" value={`${row.activeMonths} / ${months.length}`} />
              <Figure label="Last issue" value={row.lastIssueMonth ?? "Never"} />
              <Figure
                label="Stock on hand"
                value={row.stockOnHand === null ? <EmptyValue kind="noStockRecord" /> : formatCount(row.stockOnHand)}
                urgent={row.stockOnHand === 0}
              />
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
              <Figure label="Issued in history" value={formatCount(row.issuedQuantityTotal)} />
            </dl>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-bold text-ink">Issued each month</h3>
              {peak && (
                <span className="text-[13px] text-ink-muted">
                  Busiest: <strong className="text-ink">{monthLabel(peak.month)} · {formatCount(peak.issuedQuantity)}</strong>
                </span>
              )}
            </div>
            <div className="relative">
              <div className="flex h-[190px] items-end gap-[3px] border-b border-line pt-2" onMouseLeave={() => setHover(null)}>
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
                              ? "bg-ink"
                              : i === reading.peakIndex
                                ? "bg-primary-strong"
                                : "bg-primary-strong/55"
                            : on
                              ? "bg-ink-muted"
                              : "bg-line"
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
              <div aria-hidden className="flex justify-between text-[11px] text-ink-muted">
                <span>{monthLabel(first)}</span>
                <span>{monthLabel(last)}</span>
              </div>
            )}
            <p className="text-xs text-ink-muted">Hover or tab to a month for its issued, movements and received.</p>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <h3 className="text-[15px] font-bold text-ink">By year</h3>
            <div className="grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] items-center gap-[3px] text-[10px] text-ink-muted">
              <span />
              {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((d, i) => (
                <span key={i} aria-hidden className="text-center">
                  {d}
                </span>
              ))}
              {years.map((y) => (
                <Fragment key={y.year}>
                  <span className="text-xs font-semibold text-ink">{y.year}</span>
                  {y.cells.map((c) =>
                    c.index === null ? (
                      <span key={c.month} aria-hidden className="aspect-square rounded border border-dashed border-line" />
                    ) : (
                      <span
                        key={c.month}
                        title={`${monthLabel(c.month)}: ${formatCount(months[c.index].issuedQuantity)} issued`}
                        onMouseEnter={() => setHover(c.index)}
                        onMouseLeave={() => setHover(null)}
                        className={cn(
                          "aspect-square rounded",
                          HEAT_FILL[heatLevel(months[c.index].issuedQuantity, max)],
                          hover === c.index && "outline-2 outline-offset-1 outline-ink"
                        )}
                      />
                    )
                  )}
                </Fragment>
              ))}
            </div>
            <div aria-hidden className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>Less</span>
              {HEAT_FILL.map((fill) => (
                <span key={fill} className={cn("size-3 rounded-[3px]", fill)} />
              ))}
              <span>More issued</span>
            </div>
            <p className="text-xs text-ink-muted">Dashed: outside the movement history.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function Figure({ label, value, urgent = false }: { label: string; value: React.ReactNode; urgent?: boolean }) {
  return (
    <div className="rounded-xl bg-page p-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-xl font-extrabold tabular-nums", urgent ? "text-urgent-ink" : "text-ink")}>{value}</dd>
    </div>
  )
}

/** The hover card over a bar: the month's three figures and what they say together. */
function MonthCard({ month, at }: { month: UsagePattern["months"][number]; at: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[calc(100%-6px)] z-10 w-[220px] -translate-x-1/2 rounded-xl bg-ink p-3.5 text-card shadow-xl"
      style={{ left: `clamp(110px, ${at * 100}%, calc(100% - 110px))` }}
    >
      <div className="mb-2 text-[13px] font-bold">{monthLabel(month.month)}</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px]">
        <dt className="flex items-center gap-2 opacity-80">
          <span className="size-2 rounded-[2px] bg-primary-strong/70" />
          Issued
        </dt>
        <dd className="text-right font-bold tabular-nums">{formatCount(month.issuedQuantity)}</dd>
        <dt className="flex items-center gap-2 opacity-80">
          <span className="size-2 rounded-full border-[1.5px] border-current" />
          Movements
        </dt>
        <dd className="text-right font-bold tabular-nums">{formatCount(month.issueCount)}</dd>
        <dt className="flex items-center gap-2 opacity-80">
          <span className="size-2 rounded-[2px] bg-healthy" />
          Received
        </dt>
        <dd className="text-right font-bold tabular-nums">{formatCount(month.receivedQuantity)}</dd>
      </dl>
      <div className="mt-2 border-t border-card/20 pt-2 text-xs opacity-80">{monthNote(month)}</div>
    </div>
  )
}
