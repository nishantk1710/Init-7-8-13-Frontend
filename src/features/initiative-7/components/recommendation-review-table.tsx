"use client"

import { Fragment, useState } from "react"
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
import { useMaterial360 } from "@/lib/material-360-context"
import { getPlantById } from "@/lib/shared-data/plants"
import { cn, formatCount, formatZAR } from "@/lib/utils"
import {
  CRITICALITY_CODE,
  RecommendationReviewPanel,
  SubmitForApprovalBox,
} from "@/features/initiative-7/components/recommendation-review-panel"
import { useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import type { DemandPattern, Recommendation } from "@/features/initiative-7/types/inventory"

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

/** XYZ class from the demand pattern: X = smooth, Y = predictable-but-sparse, Z = erratic. */
const DEMAND_CODE: Record<DemandPattern, string> = {
  Smooth: "X",
  "Slow-Moving": "Y",
  Intermittent: "Y",
  Erratic: "Z",
  Lumpy: "Z",
}

function segmentCode(rec: Recommendation): string {
  return `${CRITICALITY_CODE[rec.criticality]}-${DEMAND_CODE[rec.demandPattern]}`
}

function ValueChangeCell({ rec }: { rec: Recommendation }) {
  const delta = rec.workingCapitalImpact
  if (delta === 0) return <span className="text-muted-foreground">no change</span>

  const ropDelta = rec.recommended.rop - rec.current.rop
  const pct = rec.current.rop === 0 ? null : Math.round((ropDelta / rec.current.rop) * 100)
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

function RopChangeCell({ rec }: { rec: Recommendation }) {
  const delta = rec.recommended.rop - rec.current.rop
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


/** Recommendation table with an expandable row per material, mirroring the
 * change-review layout: scan the impact in the row, open it for the full
 * rationale and the submit action. */
export function RecommendationReviewTable({ recommendations }: { recommendations: Recommendation[] }) {
  const { openMaterial360, } = useMaterial360()
  const { stateFor } = useInventoryWorkflow()
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
                        <MaterialIdentity material={rec.material} onOpen={openMaterial360} />
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
                      <ValueChangeCell rec={rec} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RopChangeCell rec={rec} />
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
                        <RecommendationReviewPanel rec={rec} action={<SubmitForApprovalBox rec={rec} />} />
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
