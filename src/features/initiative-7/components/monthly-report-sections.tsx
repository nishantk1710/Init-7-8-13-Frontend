"use client"

// The sections the monthly (and quarterly) report adds around the Overview's own charts: which kind of figure a section
// speaks for, the month-end inventory position, excess in money by plant, where the recommendations stand in approval
// (apart from SAP adoption), and what each figure rests on.
//
// Everything is read from the saved report through `utils/quarterly-sections.ts`. A figure that was not measured says so
// and says why; it is never drawn as 0, and the current calculation is never shown where a month-end snapshot is meant.

import { ChartCard } from "@/components/shared/chart-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount } from "@/lib/utils"
import type { ApiAdoptionQuarter, ApiKpiCard, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { cardTitle, moneyExact, orderedKpis } from "@/features/initiative-7/utils/quarterly-management"
import {
  approvalStageRows,
  coverageItemsOf,
  PERSPECTIVE_LABEL,
  plantExcessRows,
  type CoverageStatus,
  type Perspective,
} from "@/features/initiative-7/utils/quarterly-sections"

/** A small label saying which kind of figure a section shows: what happened in the period, a saved month-end reading, or
 * how things stand now. The full sentence is in the tooltip. */
export function PerspectiveTag({ perspective }: { perspective: Perspective }) {
  const { label, hint } = PERSPECTIVE_LABEL[perspective]
  return (
    <span
      title={hint}
      className={cn(
        "mb-2 inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.4px] uppercase",
        perspective === "snapshot" && "border-success/40 text-success",
        perspective === "monthly" && "border-primary/40 text-primary",
        perspective === "current" && "border-warning/40 text-warning",
      )}
    >
      {label}
    </span>
  )
}

/** What each card measures and over what, folded away: the cards carry one plain line, this is the rest. */
export function KpiGuide({ cards }: { cards: ApiKpiCard[] }) {
  const shown = orderedKpis(cards)
  if (shown.length === 0) return null
  return (
    <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">How each figure above is measured</summary>
      <dl className="mt-2 flex flex-col gap-2.5">
        {shown.map((card) => (
          <div key={card.key}>
            <dt className="font-medium text-foreground">{cardTitle(card)}</dt>
            <dd className="leading-relaxed">
              {card.explanation}
              {card.note ? ` ${card.note}` : ""}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

// --- Excess inventory by plant, in money ----------------------------------------------------------------------

const PLANT_NAME: Record<string, string> = {
  "1300": "Black Mountain (1300)",
  "1500": "Gamsberg (1500)",
}
const plantName = (code: string | null): string => (code === null ? "All plants" : (PLANT_NAME[code] ?? code))

/** Each plant's excess as a count of material-plants and as an estimated value, side by side so one is never read as the
 * other. The value is an estimate of stock above the recommended maximum, not a saving. */
export function ExcessByPlantValues({ management }: { management: ApiQuarterManagement }) {
  const rows = plantExcessRows(management, plantName)
  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Material-plants with excess</TableHead>
              <TableHead className="text-right">Estimated excess value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.plant}>
                <TableCell>{row.plant}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.count)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.value === null ? <span className="text-muted-foreground">Not available</span> : moneyExact(row.value, row.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        These are potential figures, estimated from I07&apos;s recommendations. Realised savings are not measured: nothing records stock
        that was actually released or a purchase that was actually avoided, so no amount here is a saving.
      </p>
    </div>
  )
}

// --- Approval stages, apart from SAP adoption ------------------------------------------------------------------

/** Where the period's recommendations stand in the approval chain today. SAP adoption is a separate process and has its own
 * card: the two are never added into one "pending". */
export function ApprovalStagesCard({ adoption }: { adoption: ApiAdoptionQuarter }) {
  const rows = approvalStageRows(adoption)
  const total = adoption.stages?.total ?? 0
  return (
    <ChartCard
      title="Approval status"
      subtitle="Where this period's recommendations stand in the approval chain. Whether SAP was then updated is the next card."
      span={6}
    >
      <PerspectiveTag perspective="current" />
      {rows ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground" title={row.hint}>
                  {row.label}
                </span>
                <span className="tabular-nums text-foreground">
                  {formatCount(row.count)}
                  {total > 0 && <span className="ml-1 text-muted-foreground">({Math.round((row.count / total) * 1000) / 10}%)</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary"
                  style={{
                    width: `${total > 0 ? Math.max((row.count / total) * 100, row.count > 0 ? 1 : 0) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">The approval stages were not saved with this report. Generate it again to see them.</p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {formatCount(total)} recommendation records as of the day this report was generated. Approved is not adopted, and SAP&apos;s
        “pending” counts recommendations with no SAP change evidence yet, whether or not they were approved.
      </p>
    </ChartCard>
  )
}

// --- What each figure rests on --------------------------------------------------------------------------------

const COVERAGE_TONE: Record<CoverageStatus, "success" | "warning" | "danger" | "default"> = {
  Available: "success",
  Stale: "warning",
  "Not available": "danger",
  "Not covered": "warning",
  "Insufficient history": "warning",
}

/** Every important date and source, with a plain status and the reason when it is not Available. */
export function CoverageStatusTable({ management }: { management: ApiQuarterManagement }) {
  const items = coverageItemsOf(management)
  // A report made before the backend saved the statuses has none: the dates and warnings below still say what they did.
  if (items === null) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Data</TableHead>
            <TableHead>As of</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>What it means</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.key}>
              <TableCell className="font-medium text-foreground">{item.label}</TableCell>
              <TableCell className="tabular-nums">{item.value ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>
                <StatusBadge tone={COVERAGE_TONE[item.status]}>{item.status}</StatusBadge>
              </TableCell>
              <TableCell className="text-xs leading-relaxed whitespace-normal text-muted-foreground">{item.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
