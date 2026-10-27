"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Minus, TriangleAlert } from "lucide-react"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { sapPlantName } from "@/lib/shared-data/sap-plants"
import { cn, formatCount, formatMoney } from "@/lib/utils"
import {
  OarConversionLabel,
  RecommendationReviewPanel,
} from "@/features/initiative-7/components/recommendation-review-panel"
import { LiveDecisionActions } from "@/features/initiative-7/components/live-decision-panel"
import { useLiveRecommendation } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { hasRealCircuit } from "@/features/initiative-7/utils/circuit"
import { valueChangeView } from "@/features/initiative-7/utils/value-change"

const COLUMN_COUNT = 10 // every column, with the optional Circuit and Min-Max conversion ones counted

const STATUS_TONE: Record<Recommendation["status"], "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "warning",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

const STATUS_LABEL: Partial<Record<Recommendation["status"], string>> = {
  "Pending Review": "Needs review",
}

/** The material's criticality tier and demand pattern, in plain words -- not
 * the ABC-XYZ shorthand this used to show. For live rows the tier is the
 * material's own (NORMAL / INSURANCE / IMPACT / CRITICAL / OBSOLETE), the same
 * words the Criticality filter offers; `rec.criticality` is only a derived
 * Low-to-Critical display scale and reads like a risk grade, which this column
 * is not. Scenario rows have no tier, so they keep the ordinal. */
function segmentLabel(rec: Recommendation): string {
  const criticality =
    rec.criticalityTier === undefined ? rec.criticality : (rec.criticalityTier ?? "Not recorded")
  return `${criticality} - ${rec.demandPattern}`
}

/** True only for a live-backend recommendation the backend has not actually
 * computed yet (see rationale.ts's "nothing computed" short-circuit on the
 * backend) -- surfaced here as the one `factors` entry mapDetailToRecommendation
 * adds for that case. Scenario/generated recommendations never carry this
 * label, so this only changes behaviour for live-mode rows. Without this
 * check, a 0/0 delta from two un-computed stock parameters reads as "no
 * change" -- which claims equality between two numbers that were never
 * calculated at all. */
function isNotYetComputed(rec: Recommendation): boolean {
  return rec.factors.some((factor) => factor.label === "Blocked")
}

/** `rec` is the row's own object. In live mode this is the list/summary
 * mapping (mapSummaryToRecommendation) -- its current/recommended stock
 * params AND unit_price/workingCapitalImpact are real values straight from
 * the list endpoint (Part 29/34), so no detail fetch is needed just to show
 * this cell. `liveDetail`, when present (row has been expanded), is used
 * instead since it is the more complete record, but both now carry a real
 * monetary delta. */
function ValueChangeCell({ rec, liveDetail }: { rec: Recommendation; liveDetail?: Recommendation }) {
  const source = liveDetail ?? rec
  const view = valueChangeView(source)
  if (view.kind === "not-computed") {
    return <span className="text-muted-foreground">not yet computed</span>
  }
  if (view.kind === "not-available") {
    return <span className="text-muted-foreground">not available</span>
  }

  // Released: reorder point down, green down arrow. Tied up: reorder point up, amber up arrow.
  // Unchanged: a real 0, neutral. The arrow carries the direction, so the amount has no sign.
  const DeltaIcon = view.kind === "released" ? ArrowDown : view.kind === "tied-up" ? ArrowUp : Minus
  const tone =
    view.kind === "released" ? "text-success" : view.kind === "tied-up" ? "text-warning" : "text-muted-foreground"

  return (
    <div className={cn("flex items-center justify-end gap-1 font-medium tabular-nums", tone)}>
      <DeltaIcon className="size-3 shrink-0" />
      {formatMoney(view.amount, source.currency)}
      {view.ropPercent !== null && (
        <span className="font-normal text-muted-foreground">
          ({view.ropPercent > 0 ? "+" : ""}
          {view.ropPercent}%)
        </span>
      )}
    </div>
  )
}

function RopChangeCell({ rec, liveDetail }: { rec: Recommendation; liveDetail?: Recommendation }) {
  const source = liveDetail ?? rec
  if (isNotYetComputed(source)) {
    return <span className="text-muted-foreground">not yet computed</span>
  }

  const delta = source.recommended.rop - source.current.rop
  if (delta === 0) return <span className="text-muted-foreground">no change</span>

  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp
  const tone = delta < 0 ? "text-success" : "text-warning"

  return (
    <div className={cn("flex items-center justify-end gap-1 font-medium tabular-nums", tone)}>
      <DeltaIcon className="size-3 shrink-0" />
      {formatCount(Math.abs(delta))} {Math.abs(delta) === 1 ? "unit" : "units"}
    </div>
  )
}


/** In live mode, the row's own `rec` comes from the list/summary endpoint,
 * which carries no stock parameters/lead time/service level (see
 * mapSummaryToRecommendation's zeroed fields) -- only the detail endpoint
 * has them. Fetches that detail via the existing useLiveRecommendation(id)
 * hook and reports it up to the row (via onDetail) so the collapsed row's
 * own Value/ROP change cells can use the same fetch, rather than each
 * re-fetching independently. */
function LiveExpandedRecommendationPanel({
  rec,
  onDetail,
}: {
  rec: Recommendation
  onDetail: (detail: Recommendation) => void
}) {
  const { data: detail, loading, error, refetch } = useLiveRecommendation(rec.id)

  useEffect(() => {
    if (detail) onDetail(detail)
  }, [detail, onDetail])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading full recommendation detail…</p>
  }
  if (error || !detail) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load full detail for this recommendation. Showing summary data only.
      </p>
    )
  }
  return (
    <RecommendationReviewPanel
      rec={detail}
      onSimilarMaterialsChanged={refetch}
      action={
        <LiveDecisionActions
          recommendationId={detail.id}
          onChanged={refetch}
          convertToMinMax={Boolean(detail.oarConversion)}
        />
      }
    />
  )
}

/** The row's own `rec` comes from the list/summary endpoint, which carries no
 * stock parameters/lead time/service level (see mapSummaryToRecommendation's
 * zeroed fields) -- only the detail endpoint has them. Expanding a row
 * fetches that detail via useLiveRecommendation(id) and renders it in place
 * of the summary object. */
function ExpandedRecommendationPanel({
  rec,
  onDetail,
}: {
  rec: Recommendation
  onDetail: (detail: Recommendation) => void
}) {
  return <LiveExpandedRecommendationPanel rec={rec} onDetail={onDetail} />
}

/** Recommendation table with an expandable row per material, mirroring the
 * change-review layout: scan the impact in the row, open it for the full
 * rationale and the submit action. */
export function RecommendationReviewTable({
  recommendations,
  showMinMaxConversion = false,
}: {
  recommendations: Recommendation[]
  /** Adds the Min-Max conversion column. Meant for a list of OAR recommendations: no other
   * recommendation has a conversion decision. */
  showMinMaxConversion?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Populated only for a row that has been expanded at least once (see
  // LiveExpandedRecommendationPanel's onDetail) -- the row's Value/ROP
  // change cells read from here instead of re-fetching independently.
  const [liveDetails, setLiveDetails] = useState<Record<string, Recommendation>>({})
  const recordDetail = useCallback((detail: Recommendation) => {
    setLiveDetails((prev) => (prev[detail.id] === detail ? prev : { ...prev, [detail.id]: detail }))
  }, [])

  // MARC carries no circuit for most of the extract, so every row reads
  // "Unassigned". A column of one repeated word is noise; it comes back by
  // itself the moment any row has a real circuit.
  const showCircuit = hasRealCircuit(recommendations)
  const columnCount = COLUMN_COUNT - (showCircuit ? 0 : 1) - (showMinMaxConversion ? 0 : 1)

  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No recommendations match these filters.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Criticality - Demand pattern</TableHead>
              {showCircuit && <TableHead>Circuit</TableHead>}
              <TableHead>Stockout risk</TableHead>
              <TableHead className="text-right">Value change</TableHead>
              <TableHead className="text-right">ROP change</TableHead>
              <TableHead>Status</TableHead>
              {showMinMaxConversion && <TableHead>Min-Max conversion</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.map((rec) => {
              const isExpanded = expandedId === rec.id
              const atRisk = rec.risk === "critical" || rec.risk === "high"
              return (
                <Fragment key={rec.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    aria-expanded={isExpanded}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MaterialIdentity material={rec.material} />
                        {atRisk && (
                          <TriangleAlert
                            className="size-3.5 shrink-0 text-warning"
                            aria-label="Flagged for stockout risk"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sapPlantName(rec.plantId)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge tone="default">{segmentLabel(rec)}</StatusBadge>
                        {rec.demandType === "Declining" && <StatusBadge tone="warning">Declining</StatusBadge>}
                      </div>
                    </TableCell>
                    {showCircuit && <TableCell className="text-muted-foreground">{rec.circuit}</TableCell>}
                    <TableCell>
                      <RiskBadge level={rec.risk} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValueChangeCell rec={rec} liveDetail={liveDetails[rec.id]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RopChangeCell rec={rec} liveDetail={liveDetails[rec.id]} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[rec.status]}>
                        {STATUS_LABEL[rec.status] ?? rec.status}
                      </StatusBadge>
                    </TableCell>
                    {showMinMaxConversion && (
                      <TableCell>
                        {rec.conversionEligibility ? (
                          <OarConversionLabel eligibility={rec.conversionEligibility} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={columnCount - 1} className="bg-muted/30 py-4 whitespace-normal">
                        {/* The row truncates a long description to fit its column; the open row shows all of it. */}
                        <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium break-words text-foreground">
                            {rec.material.description}
                          </span>
                          {rec.material.materialCode !== rec.material.description && (
                            <span className="text-xs text-muted-foreground">{rec.material.materialCode}</span>
                          )}
                        </div>
                        <ExpandedRecommendationPanel rec={rec} onDetail={recordDetail} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {recommendations.length} recommendation{recommendations.length === 1 ? "" : "s"} · open a row for the
        forecast, rationale and submit action.
      </p>
    </div>
  )
}
