"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react"

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
import { getPlantById } from "@/lib/shared-data/plants"
import { cn, formatCount, formatZAR } from "@/lib/utils"
import {
  CRITICALITY_CODE,
  DEMAND_CODE,
  RecommendationReviewPanel,
  SubmitForApprovalBox,
} from "@/features/initiative-7/components/recommendation-review-panel"
import { useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import { useLiveRecommendation } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"

const COLUMN_COUNT = 9

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

function segmentCode(rec: Recommendation): string {
  return `${CRITICALITY_CODE[rec.criticality]}-${DEMAND_CODE[rec.demandPattern]}`
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
  if (isNotYetComputed(source)) {
    return <span className="text-muted-foreground">not yet computed</span>
  }

  const delta = source.workingCapitalImpact
  if (delta === 0) {
    return <span className="text-muted-foreground">no change</span>
  }

  const ropDelta = source.recommended.rop - source.current.rop
  const pct = source.current.rop === 0 ? null : Math.round((ropDelta / source.current.rop) * 100)
  // Positive workingCapitalImpact releases capital; negative ties more up.
  const DeltaIcon = delta > 0 ? ArrowDown : ArrowUp
  const tone = delta > 0 ? "text-success" : "text-warning"

  return (
    <div className={cn("flex items-center justify-end gap-1 font-medium tabular-nums", tone)}>
      <DeltaIcon className="size-3 shrink-0" />
      {formatZAR(Math.abs(delta))}
      {pct !== null && (
        <span className="font-normal text-muted-foreground">
          ({pct > 0 ? "+" : ""}
          {pct}%)
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
  const { data: detail, loading, error } = useLiveRecommendation(rec.id)

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
  return <RecommendationReviewPanel rec={detail} action={<SubmitForApprovalBox rec={detail} />} />
}

/** In live mode, the row's own `rec` comes from the list/summary endpoint,
 * which carries no stock parameters/lead time/service level (see
 * mapSummaryToRecommendation's zeroed fields) -- only the detail endpoint
 * has them. Expanding a row fetches that detail via useLiveRecommendation(id)
 * and renders it in place of the summary object; scenario/generated mode
 * renders unchanged since this component is never mounted there (branch is
 * at the call site, not inside a hook-bearing component, to satisfy
 * rules-of-hooks). */
function ExpandedRecommendationPanel({
  rec,
  onDetail,
}: {
  rec: Recommendation
  onDetail: (detail: Recommendation) => void
}) {
  if (!USING_LIVE_DATA) {
    return <RecommendationReviewPanel rec={rec} action={<SubmitForApprovalBox rec={rec} />} />
  }
  return <LiveExpandedRecommendationPanel rec={rec} onDetail={onDetail} />
}

/** Recommendation table with an expandable row per material, mirroring the
 * change-review layout: scan the impact in the row, open it for the full
 * rationale and the submit action. */
export function RecommendationReviewTable({ recommendations }: { recommendations: Recommendation[] }) {
  const { stateFor } = useInventoryWorkflow()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Populated only for a row that has been expanded at least once (see
  // LiveExpandedRecommendationPanel's onDetail) -- the row's Value/ROP
  // change cells read from here instead of re-fetching independently.
  const [liveDetails, setLiveDetails] = useState<Record<string, Recommendation>>({})
  const recordDetail = useCallback((detail: Recommendation) => {
    setLiveDetails((prev) => (prev[detail.id] === detail ? prev : { ...prev, [detail.id]: detail }))
  }, [])

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
              <TableHead>Segment</TableHead>
              <TableHead>Circuit</TableHead>
              <TableHead>Stockout risk</TableHead>
              <TableHead className="text-right">Value change</TableHead>
              <TableHead className="text-right">ROP change</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.map((rec) => {
              const isExpanded = expandedId === rec.id
              const state = stateFor(rec.id)
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
                      {getPlantById(rec.plantId)?.name ?? rec.plantId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone="default">{segmentCode(rec)}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rec.circuit}</TableCell>
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
                        {state.submitted && !state.outcome && rec.status === "Pending Review"
                          ? "In approval"
                          : (STATUS_LABEL[rec.status] ?? rec.status)}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={COLUMN_COUNT - 1} className="bg-muted/30 py-4 whitespace-normal">
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
