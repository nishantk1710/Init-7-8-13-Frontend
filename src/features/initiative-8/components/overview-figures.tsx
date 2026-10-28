"use client"

import Link from "next/link"
import { useState, type ComponentType, type ReactNode } from "react"
import { ArrowRight, CircleCheck, ClipboardList, Clock, TriangleAlert } from "lucide-react"

import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { declarationsHref } from "@/features/initiative-8/data/live-declarations"
import { DEFAULT_EXCEPTION_STATUS, exceptionsHref } from "@/features/initiative-8/data/live-exceptions"
import { registerHref, type RegisterFilters } from "@/features/initiative-8/data/live-register"
import type { RepairChain, RepairStatus } from "@/features/initiative-8/types/repair"
import { plural, stageLabel } from "@/features/initiative-8/utils/format"
import {
  STAGE_ORDER,
  declarationCounts,
  openExceptionSummary,
  queueNote,
  stageAging,
  stockLines,
  vendorRows,
  type OpenExceptionCounts,
  type OverviewMetrics,
} from "@/features/initiative-8/utils/overview-view"
import { isOpenRepair, isRepairOverdue } from "@/features/initiative-8/utils/status"
import { cn, formatCount } from "@/lib/utils"

/**
 * The Overview's figures: what the screen shows and what the PDF prints
 * (I08_Live_UI_Redesign_Plan.md, L1).
 *
 * It opens with what needs doing, and every number opens the list behind it.
 * The old page showed five tiles -- four of them read 104 -- and five charts,
 * four with one or two bars, and none of it could be clicked. Now:
 *
 * - three action cards: late repairs, lines with no condition declaration,
 *   and open exceptions, each linking to that list already filtered;
 * - three quiet tiles for context: the open lines, where they are in the
 *   process (the repairs requested with no PO yet first), and the repairable
 *   universe with its stock, usable and damaged when the backend splits it;
 * - vendors as a ranked list with short bars, each opening its repairs;
 * - FR-9's aging per stage as a stage-by-age table whose cells open exactly
 *   their lines (the register's `stageAging` filter).
 *
 * `print` draws the same figures in a fixed A4-landscape grid with no motion,
 * no links and no "show all": the PDF is printed the moment it mounts, so an
 * animation would be caught half-way.
 */
export type OverviewFiguresProps = {
  /** The filtered repair lines. */
  chains: RepairChain[]
  agingBands: string[]
  metrics: OverviewMetrics
  universeLoaded: boolean
  /** Open exception items on these lines, by type, or null when the queue
   *  could not be read -- shown as such, never as a zero. */
  exceptions: OpenExceptionCounts | null
  /** Repairs requested with no PO yet under the same filters, or undefined
   *  when the backend does not serve them. */
  repairRequests?: number
  /** The register filters this Overview's own filters correspond to, so every
   *  link opens the same slice the figure counted. */
  linkFilters: RegisterFilters
  /** A vendor is chosen: the universe tile says it is not narrowed by one. */
  vendorFiltered: boolean
  print?: boolean
}

export function OverviewFigures({
  chains,
  repairRequests,
  agingBands,
  metrics,
  universeLoaded,
  exceptions,
  linkFilters,
  vendorFiltered,
  print = false,
}: OverviewFiguresProps) {
  const open = chains.filter(isOpenRepair)
  const overdue = chains.filter(isRepairOverdue).length
  // Waiting means Required only: a Historical line was never asked for a
  // declaration, and a Flagged one has one.
  const { required: undeclared, historical, flagged } = declarationCounts(chains)
  const materials = new Set(open.map((c) => c.material.materialId)).size
  const vendors = new Set(open.map((c) => c.vendor ?? "none")).size
  const stock = stockLines(metrics.stock.plants, formatCount)
  const stockSplit = metrics.stock.plants.some((p) => p.usable !== undefined || p.damaged !== undefined)
  // `none` is the register's word for a line with no vendor; the queue would
  // read it as a vendor code and list nothing (see `queueNote`).
  const declarationLink = declarationsHref({
    plant: linkFilters.plant,
    vendor: linkFilters.vendor === "none" ? undefined : linkFilters.vendor,
  })
  const exceptionLink = exceptionsHref({ status: DEFAULT_EXCEPTION_STATUS, plant: linkFilters.plant })

  return (
    <>
      <h2 className="mt-7 mb-2.5 text-[13.5px] font-semibold text-muted-foreground">Needs action</h2>
      <div className={cn("grid gap-4", print ? "grid-cols-3" : "lg:grid-cols-3")}>
        <ActionCard
          tone="crit"
          icon={Clock}
          value={overdue}
          label="Repairs overdue"
          text={
            overdue === 0
              ? "Nothing is past its expected return date."
              : overdue === chains.length
                ? "Every open repair is past its expected return date."
                : `${formatCount(overdue)} of ${formatCount(chains.length)} open repairs are past their expected return date.`
          }
          href={registerHref({ ...linkFilters, view: "overdue" })}
          cta="View in register"
          print={print}
        />
        <ActionCard
          tone="warn"
          icon={ClipboardList}
          value={undeclared}
          label="Not declared"
          text={
            (undeclared === 0 ? "Nothing is waiting for a condition declaration." : "No condition declaration on record.") +
            (flagged ? ` ${plural(flagged, "line")} sent for repair against an assessment.` : "")
          }
          muted={historical ? `${formatCount(historical)} raised before declarations began` : undefined}
          href={declarationLink}
          cta="Declare"
          note={queueNote(linkFilters, "declarations")}
          print={print}
        />
        <ActionCard
          tone="warn"
          icon={TriangleAlert}
          value={exceptions?.total ?? null}
          label="Open exceptions"
          text={
            exceptions === null
              ? "The exception queue could not be read, so this is not a zero."
              : exceptions.total === 0
                ? "No open exceptions on these repair lines."
                : openExceptionSummary(exceptions.byType, formatCount)
          }
          href={exceptionLink}
          cta="Open the queue"
          note={queueNote(linkFilters, "exceptions")}
          print={print}
        />
      </div>

      <div className={cn("mt-4 grid gap-4", print ? "grid-cols-3" : "lg:grid-cols-3")}>
        <Tile label="Open repair lines">
          <div className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
            {formatCount(open.length)}
          </div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            {plural(metrics.qtyUnderRepair, "unit")} under repair · {plural(materials, "material")} ·{" "}
            {plural(vendors, "vendor")}
          </div>
        </Tile>
        <Tile label="Where they are in the process">
          <StageList chains={open} requested={repairRequests} linkFilters={linkFilters} print={print} />
        </Tile>
        <Tile label="Repairable materials monitored">
          {universeLoaded ? (
            <>
              <div className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
                {formatCount(metrics.universeMaterials)}
              </div>
              {stockSplit ? (
                // Usable and damaged, per plant, as the assistant shows them.
                <ul className="mt-0.5 text-[13px] text-muted-foreground">
                  {stock.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-0.5 text-[13px] text-muted-foreground">
                  Stock on hand: {stock.join(" · ") || "not recorded"}
                </div>
              )}
              {vendorFiltered && (
                <div className="mt-2 text-[12.5px] text-i08-warn-ink">
                  Not narrowed by vendor: materials have no vendor.
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 text-[13px] text-muted-foreground">
              The repairable universe could not be loaded, so this is not a zero.
            </div>
          )}
        </Tile>
      </div>

      <div className={cn("mt-4 grid items-start gap-4", print ? "grid-cols-2" : "xl:grid-cols-[1.08fr_1fr]")}>
        <VendorPanel chains={chains} linkFilters={linkFilters} print={print} />
        <StagePanel chains={chains} bands={agingBands} linkFilters={linkFilters} print={print} />
      </div>
    </>
  )
}

const TONES = {
  crit: { bar: "before:bg-i08-crit", chip: "bg-i08-crit-tint text-i08-crit-ink" },
  warn: { bar: "before:bg-i08-warn", chip: "bg-i08-warn-tint text-i08-warn-ink" },
  good: { bar: "before:bg-i08-good", chip: "bg-i08-good-tint text-i08-good-ink" },
  neutral: { bar: "before:bg-i08-neutral", chip: "bg-muted text-muted-foreground" },
} as const

/** A number that needs someone, and the link to the list behind it. */
function ActionCard({
  tone,
  icon: Icon,
  value,
  label,
  text,
  href,
  cta,
  muted,
  note,
  print,
}: {
  tone: "crit" | "warn"
  icon: ComponentType<{ className?: string }>
  /** Null when its source could not be read. */
  value: number | null
  label: string
  text: string
  href: string
  cta: string
  /** A quiet fact under the text, not a call to act: "104 raised before
   *  declarations began". Printed too. */
  muted?: string
  /** Where the link opens something wider than the count. Not printed: the
   *  PDF has no links, and its header already names the filters. */
  note?: string
  print: boolean
}) {
  const shown = value === null ? "neutral" : value === 0 ? "good" : tone
  const body = (
    <>
      <span className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
        <span className={cn("grid size-[30px] place-items-center rounded-lg", TONES[shown].chip)}>
          {value === 0 ? <CircleCheck className="size-[17px]" /> : <Icon className="size-[17px]" />}
        </span>
        {label}
      </span>
      <span className="mt-1.5 text-[34px] leading-tight font-semibold tracking-tight text-foreground">
        {value === null ? "—" : formatCount(value)}
      </span>
      <span className="text-[13.5px] text-muted-foreground">{text}</span>
      {muted && <span className="text-[12.5px] text-muted-foreground/80">{muted}</span>}
      {!print && note && <span className="mt-1 text-[12.5px] text-i08-warn-ink">{note}</span>}
      {!print && (
        <span className="mt-auto flex items-center gap-1 pt-2.5 text-[13.5px] font-medium text-i08-link">
          {cta}
          <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  )
  const className = cn(
    "group relative flex flex-col gap-1 rounded-xl border border-border bg-card px-5 pt-4 pb-4 shadow-xs",
    "before:absolute before:inset-y-4 before:-left-px before:w-[3px] before:rounded-r-full",
    TONES[shown].bar,
    !print &&
      "transition-all duration-150 outline-none hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50",
  )
  return print ? (
    <div className={className}>{body}</div>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  )
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-xs">
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

/** One step of the lifecycle colour, light to dark in stage order. */
const STAGE_KEY: Partial<Record<RepairStatus, string>> = {
  "PR Raised": "bg-i08-ord-1",
  "PO Issued": "bg-i08-ord-2",
  "At Vendor": "bg-i08-ord-3",
}

/**
 * How many open lines sit in each stage: numbers, where a chart drew one bar.
 *
 * First, when the backend serves them, the repairs requested with no PO yet:
 * they were mentioned in the header only. Their row opens the register's "No
 * PO yet" view; the others open their stage.
 */
function StageList({
  chains,
  requested,
  linkFilters,
  print,
}: {
  chains: RepairChain[]
  /** Repairs requested with no PO yet; undefined when not served. */
  requested?: number
  linkFilters: RegisterFilters
  print: boolean
}) {
  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    count:
      stage === "PR Raised" && requested !== undefined
        ? requested
        : chains.filter((c) => c.repairStatus === stage).length,
  })).filter((s) => s.count > 0)
  if (stages.length === 0) {
    return <div className="mt-2 text-[13px] text-muted-foreground">No open repair lines.</div>
  }
  return (
    <ul className="mt-2 flex flex-col gap-0.5">
      {stages.map(({ stage, count }) => {
        const row = (
          <>
            <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", STAGE_KEY[stage])} />
            <span>{stageLabel(stage)}</span>
            <b className="font-semibold tabular-nums">{formatCount(count)}</b>
          </>
        )
        const className =
          "-mx-1.5 grid grid-cols-[14px_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-[13.5px] text-foreground"
        return (
          <li key={stage}>
            {print ? (
              <div className={className}>{row}</div>
            ) : (
              <Link
                href={
                  stage === "PR Raised"
                    ? registerHref({ ...linkFilters, view: "notOrdered" })
                    : registerHref({ ...linkFilters, repairStatus: stage })
                }
                className={cn(className, "transition-colors hover:bg-i08-row-hover")}
              >
                {row}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Open repair lines by vendor: a ranked list whose rows open the register. */
function VendorPanel({
  chains,
  linkFilters,
  print,
}: {
  chains: RepairChain[]
  linkFilters: RegisterFilters
  print: boolean
}) {
  const [all, setAll] = useState(false)
  const rows = vendorRows(chains)
  const shown = all && !print ? rows : rows.slice(0, 10)
  const max = Math.max(1, ...rows.map((r) => r.open))

  return (
    <section className="rounded-xl border border-border bg-card px-5 pt-4.5 pb-4 shadow-xs">
      <h2 className="text-[15.5px] font-semibold text-foreground">Where the repairs are</h2>
      <p className="mt-0.5 mb-3.5 text-[13px] text-muted-foreground">
        Open repair lines by vendor{rows.length > 10 && !all ? `, top 10 of ${rows.length}` : ""}.
        {!print && " Click a vendor to open its repairs."}
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No open repair lines.</p>
      ) : (
        <div role="table" aria-label="Open repair lines by vendor">
          <div
            role="row"
            className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_44px_88px] gap-3 border-b border-border px-2 pb-1.5 text-[12.5px] text-muted-foreground"
          >
            <span role="columnheader">Vendor</span>
            <span role="columnheader" aria-hidden="true" />
            <span role="columnheader" className="text-right">
              Open
            </span>
            <span role="columnheader">Late</span>
          </div>
          {shown.map((vendor, index) => {
            const cells = (
              <>
                <span role="cell" className="truncate text-[13.5px]" title={vendor.name}>
                  {vendor.name}
                </span>
                <span role="cell" aria-hidden="true" className="relative h-2.5">
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-r-[4px] bg-i08-bar", !print && "i08-grow")}
                    style={{ width: `${(vendor.open / max) * 100}%`, animationDelay: `${index * 35}ms` }}
                  />
                </span>
                <span role="cell" className="text-right text-[13.5px] font-semibold tabular-nums">
                  {formatCount(vendor.open)}
                </span>
                <span role="cell">
                  {vendor.late ? (
                    <StatusDot tone="crit" small>
                      {formatCount(vendor.late)} late
                    </StatusDot>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </>
            )
            const className =
              "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_44px_88px] items-center gap-3 rounded-lg px-2 py-2 text-foreground"
            return print ? (
              <div key={vendor.code} role="row" className={className}>
                {cells}
              </div>
            ) : (
              <Link
                key={vendor.code}
                role="row"
                href={registerHref({ ...linkFilters, vendor: vendor.code })}
                className={cn(className, "transition-colors hover:bg-i08-row-hover")}
              >
                {cells}
              </Link>
            )
          })}
        </div>
      )}
      {!print && rows.length > 10 && (
        <button
          type="button"
          onClick={() => setAll((value) => !value)}
          className="mt-2 rounded-sm px-2 text-[13.5px] font-medium text-i08-link hover:underline"
        >
          {all ? "Show the top 10" : `Show all ${rows.length} vendors`}
        </button>
      )}
    </section>
  )
}

/**
 * FR-9's aging per stage: rows are stages, columns are bands of days in that
 * stage, and each cell is shaded light (few lines) to dark (many) and opens
 * exactly its lines. The last row is the whole repair's clock, days open.
 */
function StagePanel({
  chains,
  bands,
  linkFilters,
  print,
}: {
  chains: RepairChain[]
  bands: string[]
  linkFilters: RegisterFilters
  print: boolean
}) {
  const aging = stageAging(chains, bands)
  // Step 1 is kept for the legend's near-zero end, so a small count is never
  // drawn in the palest blue.
  const step = (value: number) => Math.min(7, Math.max(2, Math.ceil((value / aging.max) * 7)))
  let order = 0
  const cell = (value: number, href: string, title: string) => {
    const delay = { animationDelay: `${order++ * 30}ms` }
    if (value === 0) {
      return (
        <span
          aria-label="none"
          style={delay}
          className={cn("grid h-[46px] place-items-center rounded-md bg-muted/70 text-muted-foreground", !print && "i08-settle")}
        >
          –
        </span>
      )
    }
    const className = cn(
      "grid h-[46px] place-items-center rounded-md text-[14.5px] font-semibold tabular-nums",
      `i08-seq-${step(value)}`,
      !print && "i08-settle transition-transform duration-150 outline-none hover:scale-[1.05] hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring",
    )
    return print ? (
      <span className={className}>{formatCount(value)}</span>
    ) : (
      <Link href={href} title={title} style={delay} className={className}>
        {formatCount(value)}
      </Link>
    )
  }
  const bandText = (band: string) => `${band.replace("-", "–")} d`
  const bandDays = (band: string) => `${band.replace("-", "–")} days`

  return (
    <section className="rounded-xl border border-border bg-card px-5 pt-4.5 pb-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15.5px] font-semibold text-foreground">How long repairs have been waiting</h2>
          <p className="mt-0.5 mb-3 text-[13px] text-muted-foreground">
            Open repair lines by days in their current stage.{!print && " Click a cell to open those lines."}
          </p>
        </div>
        {!print && (
          <InfoPopover title="Two clocks" align="end">
            <p>
              <b className="font-semibold text-foreground">Days in stage</b> count from when a line entered the
              stage it is in now: the PO date for &ldquo;PO issued&rdquo;, the dispatch date for &ldquo;At
              vendor&rdquo;.
            </p>
            <p>
              <b className="font-semibold text-foreground">Days open</b> count the whole repair, from the PO
              date.
            </p>
          </InfoPopover>
        )}
      </div>
      {aging.rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No open repair lines.</p>
      ) : (
        <table className="w-full table-fixed border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th className="w-[27%]">
                <span className="sr-only">Stage</span>
              </th>
              {bands.map((band) => (
                <th key={band} scope="col" className="pb-1 text-center text-[12.5px] font-medium text-muted-foreground">
                  {bandText(band)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aging.rows.map((row) => (
              <tr key={row.stage}>
                <th scope="row" className="pr-2 text-left text-[13.5px] font-medium text-foreground">
                  {stageLabel(row.stage)}
                  <small className="block text-xs font-normal text-muted-foreground">days in stage</small>
                </th>
                {row.cells.map((value, index) => (
                  <td key={bands[index]} className="p-0">
                    {cell(
                      value,
                      registerHref({ ...linkFilters, repairStatus: row.stage, stageAging: bands[index] }),
                      `${stageLabel(row.stage)}, ${bandDays(bands[index])} in this stage: ${plural(value, "repair line")}`,
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="pt-3 pr-2 text-left text-[13.5px] font-medium text-foreground">
                All open lines
                <small className="block text-xs font-normal text-muted-foreground">days open</small>
              </th>
              {aging.total.map((value, index) => (
                <td key={bands[index]} className="p-0 pt-3">
                  {cell(
                    value,
                    registerHref({ ...linkFilters, aging: bands[index] }),
                    `${bandDays(bands[index])} open: ${plural(value, "repair line")}`,
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground" aria-hidden="true">
        <span>Fewer</span>
        <span className="flex gap-0.5">
          {[1, 2, 3, 4, 5, 6, 7].map((k) => (
            <span key={k} className={`h-2.5 w-[18px] rounded-[2px] i08-seq-${k}`} />
          ))}
        </span>
        <span>More lines</span>
      </div>
    </section>
  )
}
