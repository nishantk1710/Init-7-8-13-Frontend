"use client"

// The sections the monthly (and quarterly) report adds around the Overview's own charts: which kind of figure a section
// speaks for, the month-end inventory position, excess in money by plant, where the recommendations stand in approval
// (apart from SAP adoption), and what each figure rests on.
//
// Everything is read from the saved report through `utils/quarterly-sections.ts`. A figure that was not measured says so
// and says why; it is never drawn as 0, and the current calculation is never shown where a month-end snapshot is meant.

import type { ReactNode } from "react"

import { ChartCard } from "@/components/shared/chart-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { INFO_TONE, InfoPopup, riseIn, slideIn } from "@/components/shared/info-popup"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount } from "@/lib/utils"
import type { ApiAdoptionQuarter, ApiKpiCard, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { moneyExact, orderedKpis, pageCardTitle } from "@/features/initiative-7/utils/quarterly-management"
import {
  approvalStageRows,
  coverageItemsOf,
  PERSPECTIVE_LABEL,
  plantExcessRows,
  type CoverageStatus,
  type Perspective,
} from "@/features/initiative-7/utils/quarterly-sections"

/** The detail behind a short line, folded away: one click to read it, nothing to scroll past until then. */
export function MoreInfo({ summary, children, className }: { summary: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn("text-[11px] text-muted-foreground", className)}>
      <summary className="cursor-pointer font-medium text-foreground">{summary}</summary>
      <div className="mt-1 leading-relaxed">{children}</div>
    </details>
  )
}

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

/** The rule behind a card, written out the way the Overview's calculator popups write a formula. Only cards that are a calculation
 * have one; the rest are explained in words. */
const CARD_FORMULA: Record<string, string[]> = {
  critical_stockout_risk: ["At risk when: stock on hand < average daily consumption × lead time"],
  excess_inventory_opportunity: [
    "Excess value = unit price × (current max stock − recommended max stock)",
    "Only where the current maximum is above the recommended one",
  ],
  working_capital_stock: [
    "Impact = unit price × (current reorder point − recommended reorder point)",
    "Added up over the included material-plants",
    "Shown as: − cash released, + cash tied up",
  ],
  working_capital_oar: [
    "Impact = unit price × (current reorder point − recommended reorder point)",
    "Added up over the included material-plants",
    "Shown as: − cash released, + cash tied up",
  ],
  working_capital_potential: [
    "Impact = unit price × (current reorder point − recommended reorder point)",
    "Over every eligible OAR material-plant, adopted or not",
    "Shown as: − cash released, + cash tied up",
  ],
}

/** What each row of the Activity by month table is counted from, and how: the data (table and field) and the calculation. Written out
 * here, from the report's own definitions (`monthly_activity.py`), so a reader never has to guess what a number is made of. */
const ACTIVITY_SOURCES: { row: string; means: string; source: string; how: string; tech: string }[] = [
  {
    row: "SAP consumption",
    means: "How much material was used.",
    source: "SAP records of stock taken out of the store (goods issues).",
    how: "We count the goods-issue records in each month. It is a count of records, not a quantity. A month with no data shows a dash, never 0.",
    tech: "i7_staged_consumption: period, issue_count",
  },
  {
    row: "Recommendations generated",
    means: "How many recommendations are worth acting on.",
    source: "The recommendations we produced, compared with the stock levels SAP holds today.",
    how: "We count the recommendations made in the month that would change something in SAP (a suggested reorder point, safety stock or maximum stock that differs from SAP's, or an OAR material that can move to Min-Max). A material recalculated in the month counts once. This is the same group the Overview counts.",
    tech: "i7_recommendation: generated_at, recommended_/current_ rop, safety_stock, max_stock, is_oar, conversion_eligibility",
  },
  {
    row: "Sent for approval",
    means: "How many recommendations were sent to an approver.",
    source: "The approval history, which records every step with its date.",
    how: "Every time a recommendation is submitted (or submitted again), it counts in the month it happened.",
    tech: "i7_approval_ledger: action = SUBMIT / RESUBMIT, timestamp",
  },
  {
    row: "Approval decisions",
    means: "How many approvals were given.",
    source: "The approval history.",
    how: "Every approval counts in the month it was given. A recommendation that needs several approvers adds one for each.",
    tech: "i7_approval_ledger: action = APPROVE, timestamp",
  },
  {
    row: "Rejections",
    means: "How many recommendations were turned down.",
    source: "The approval history.",
    how: "Every rejection, by an approver or by the planner, counts in the month it happened.",
    tech: "i7_approval_ledger: action = REJECT, timestamp",
  },
  {
    row: "Sent back",
    means: "How many were returned for correction.",
    source: "The approval history.",
    how: "Every time one is sent back to a step, it counts in the month it happened.",
    tech: "i7_approval_ledger: action = SEND_BACK, timestamp",
  },
  {
    row: "Confirmed SAP adoptions",
    means: "How many recommendations SAP has actually changed to.",
    source: "SAP's change history, which records who changed which stock setting, when, and from what to what.",
    how: "We check whether SAP's stock settings were changed to the approved values. If they were, the recommendation is confirmed, and it counts in the month SAP made the change. 0 means no matching change was found that month.",
    tech: "SAP change history CDHDR (UDATE) and CDPOS (FNAME, VALUE_OLD, VALUE_NEW); i7_sap_adoption: status, adopted_on",
  },
  {
    row: "Forecast demand / Actual demand",
    means: "What we predicted would be used, and what really was.",
    source: "The latest forecast run's test results, where each forecast is compared with what was used that month.",
    how: "We add up the predictions and the real usage for each month. Materials with no test result are left out.",
    tech: "i7_forecast_backtest_path: forecast_period, predicted, actual",
  },
]

/** The (i) on the Activity by month table. */
export function ActivityInfo() {
  return (
    <InfoPopup
      title="Activity by month"
      description="What each row means, where it comes from and how it is counted."
      tone="info"
      triggerLabel="How the activity figures are worked out"
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="min-w-[170px]">Row</TableHead>
                <TableHead className="min-w-[220px]">Where the data comes from</TableHead>
                <TableHead className="min-w-[280px]">How it is counted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACTIVITY_SOURCES.map((source) => (
                <TableRow key={source.row} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="font-medium text-foreground">{source.row}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{source.means}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    <div className="text-foreground">{source.source}</div>
                    <div className="mt-1.5 font-mono text-[11px] leading-snug text-muted-foreground" title="The technical name of the data, for the IT team">
                      {source.tech}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal text-foreground">{source.how}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>Every row counts things by the month they happened in, not by where they stand today.</li>
          <li>A dash means there is no figure for that month (it has not started, or there is no data). A 0 means we looked and found none.</li>
          <li>The Month total adds the months together.</li>
        </ul>
      </div>
    </InfoPopup>
  )
}

/** What each card measures and over what: one (i) button for the whole report, the same popup the Overview's cards use. The
 * cards carry one plain line; this is the rest, each card's rule and formula where it has one, then how it is worked out. */
export function KpiGuide({ cards }: { cards: ApiKpiCard[] }) {
  const shown = orderedKpis(cards)
  if (shown.length === 0) return null
  const tone = "info" as const
  const colours = INFO_TONE[tone]
  return (
    <div className="flex justify-end">
      <InfoPopup title="How each number is worked out" description="What each figure in this report measures, and how it is calculated." tone={tone} triggerLabel="How each number is worked out" className="size-8 border border-border bg-card">
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {shown.map((card, index) => {
            const motion = riseIn(80 + index * 60)
            const formula = CARD_FORMULA[card.key]
            return (
              <section key={card.key} className={`flex min-w-0 flex-col gap-2 ${motion.className}`} style={motion.style}>
                <h3 className={`flex items-center gap-2 text-xs font-semibold tracking-wide uppercase ${colours.heading}`}>
                  <span className={`h-3 w-1 rounded-sm ${colours.tick}`} aria-hidden />
                  {pageCardTitle(card)}
                </h3>
                {formula && (
                  <div className={`rounded-sm border-l-4 px-3 py-2 font-mono text-xs leading-relaxed text-foreground ${colours.callout}`}>
                    {formula.map((line, i) => {
                      const line_motion = slideIn(160 + index * 60 + i * 90)
                      return (
                        <div key={line} className={line_motion.className} style={line_motion.style}>
                          {line}
                        </div>
                      )
                    })}
                  </div>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {card.explanation}
                  {card.note ? ` ${card.note}` : ""}
                </p>
              </section>
            )
          })}
        </div>
      </InfoPopup>
    </div>
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
      <MoreInfo summary="About these amounts" className="mt-2">
        These are expected figures, worked out from I07&apos;s recommendations. Money actually saved is not measured: nothing records stock that
        was actually released or a purchase that was actually avoided, so no amount here is a saving.
      </MoreInfo>
    </div>
  )
}

// --- Approval stages, apart from SAP adoption ------------------------------------------------------------------

/** Where the period's recommendations stand in the approval chain today. SAP adoption is a separate process and has its own
 * card: the two are never added into one "pending". */
export function ApprovalStagesCard({ adoption, periodName }: { adoption: ApiAdoptionQuarter; periodName?: string }) {
  const rows = approvalStageRows(adoption)
  const total = adoption.stages?.total ?? 0
  return (
    <ChartCard
      title="Approval status"
      subtitle="Where this period's recommendations stand in the approval chain. Whether SAP was then updated is the next card."
      span={6}
    >
      {periodName ? (
        // The month the recommendations were generated in, in place of "as of today".
        <span
          title="The recommendations behind these figures were generated in this period; where each stands is as of when the report was generated"
          className="mb-2 inline-flex w-fit items-center rounded-md border border-primary/40 px-2 py-0.5 text-xs font-medium tracking-[0.4px] text-primary uppercase"
        >
          {periodName}
        </span>
      ) : (
        <PerspectiveTag perspective="current" />
      )}
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
      <p className="mt-3 text-[11px] text-muted-foreground">{formatCount(total)} recommendations with something to change in SAP, as they stand today.</p>
      <MoreInfo summary="What do these mean?" className="mt-1">
        Approved is not the same as changed in SAP: whether SAP was changed is shown in the SAP adoption card. SAP&apos;s “pending” counts
        recommendations SAP has not been checked on yet, whether or not they were approved.
      </MoreInfo>
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

/** The sources the figures rest on, with a plain status and the reason when one is not Available. By default only the ones that need
 * attention are listed (`problemsOnly`); the full list is one click away in the coverage card. */
export function CoverageStatusTable({ management, problemsOnly = false }: { management: ApiQuarterManagement; problemsOnly?: boolean }) {
  const all = coverageItemsOf(management)
  // A report made before the backend saved the statuses has none: the dates and warnings below still say what they did.
  if (all === null) return null
  const items = problemsOnly ? all.filter((item) => item.status !== "Available") : all
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Everything this report uses is up to date.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>What</TableHead>
            <TableHead>Last data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>What this means</TableHead>
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
