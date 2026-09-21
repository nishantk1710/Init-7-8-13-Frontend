"use client"

import Link from "next/link"
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getPlantById } from "@/lib/shared-data/plants"
import { formatZAR } from "@/lib/utils"
import { DecisionActions, DecisionHistory } from "@/features/initiative-7/components/decision-panel"
import { LiveDecisionActions, LiveDecisionHistory } from "@/features/initiative-7/components/live-decision-panel"
import { RecommendationReviewPanel } from "@/features/initiative-7/components/recommendation-review-panel"
import { OarColdStartPanel } from "@/features/initiative-7/components/oar-cold-start-panel"
import { RepairContextSignal } from "@/features/initiative-7/components/repair-context-signal"
import { getRecommendationById } from "@/features/initiative-7/data/recommendations"
import { useLiveRecommendation } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Criticality, Recommendation } from "@/features/initiative-7/types/inventory"
import { serviceLevelZFactor } from "@/features/initiative-7/utils/inventory-calc"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"

const STATUS_TONE: Record<Recommendation["status"], "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "default",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

/** Compact ABC-style code for the criticality tier, most severe first. */
const CRITICALITY_CODE: Record<Criticality, string> = {
  Critical: "A",
  High: "B",
  Medium: "C",
  Low: "D",
}

function NotFoundView({ recommendationId }: { recommendationId: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader title="Recommendation not found" />
        <EmptyState
          title={`No recommendation "${recommendationId}"`}
          description="It may have been superseded — return to the Recommendation Workspace to find the current one."
          actions={
            <Link
              href="/inventory-planning/recommendations"
              className="text-sm font-medium text-primary hover:underline"
            >
              Back to Recommendations
            </Link>
          }
        />
      </div>
    </div>
  )
}

/** Presentational body shared by the mock (scenario/generated) and live
 * modes — `live` swaps DecisionActions/DecisionHistory (the scenario-chain
 * simulation) for LiveDecisionActions/LiveDecisionHistory (the real backend
 * ledger), and passes nothing else differently. */
function RecommendationDetailView({
  recommendation,
  live = false,
  onLiveChanged,
}: {
  recommendation: Recommendation
  live?: boolean
  onLiveChanged?: () => void
}) {
  const plant = getPlantById(recommendation.plantId)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Link
          href="/inventory-planning/recommendations"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to Recommendations
        </Link>

        <PageHeader
          title={recommendation.material.description}
          description={`${recommendation.material.materialId} · ${plant?.name ?? recommendation.plantId} · ${recommendation.circuit} circuit`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={recommendation.risk} />
              <StatusBadge tone={STATUS_TONE[recommendation.status]}>{recommendation.status}</StatusBadge>
            </div>
          }
        />

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1">
            Category: {CRITICALITY_CODE[recommendation.criticality]} – {recommendation.criticality}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">Demand pattern: {recommendation.demandPattern}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Lead time: {recommendation.leadTimeDays}d (±{recommendation.leadTimeVarianceDays}d)</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Unit price: {formatZAR(recommendation.unitPrice)}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            Service-level target: {Math.round(recommendation.serviceLevelTarget * 100)}%
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            Z-factor:{" "}
            {recommendation.zFactor != null
              ? recommendation.zFactor.toFixed(2)
              : `${serviceLevelZFactor(recommendation.serviceLevelTarget).toFixed(2)} (illustrative)`}
          </span>
        </div>

        {recommendation.material.materialId === "500-14892" && (
          <RepairContextSignal materialId={recommendation.material.materialId} />
        )}

        {recommendation.oarColdStart && <OarColdStartPanel guidance={recommendation.oarColdStart} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard title="Recommended inventory changes" span={12}>
            <RecommendationReviewPanel
              rec={recommendation}
              action={
                live ? (
                  <LiveDecisionActions
                    recommendationId={recommendation.id}
                    status={recommendation.status}
                    onChanged={() => onLiveChanged?.()}
                  />
                ) : (
                  <DecisionActions recommendation={recommendation} />
                )
              }
            />
          </ChartCard>

          <ChartCard title="Decision history" span={12}>
            {live ? (
              <LiveDecisionHistory recommendationId={recommendation.id} reloadKey={recommendation.generatedAt} />
            ) : (
              <DecisionHistory recommendation={recommendation} />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

function LiveRecommendationDetailPage({ recommendationId }: { recommendationId: string }) {
  const { data, loading, error, refetch } = useLiveRecommendation(recommendationId)

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <PageHeader title="Could not load this recommendation" />
          <EmptyState
            icon={<AlertTriangle className="size-4" />}
            title="Backend request failed"
            description={error.message}
            actions={
              <Button size="sm" variant="outline" onClick={refetch}>
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  if (!data) {
    return <NotFoundView recommendationId={recommendationId} />
  }

  return <RecommendationDetailView recommendation={data} live onLiveChanged={refetch} />
}

export function RecommendationDetailPage({ recommendationId }: { recommendationId: string }) {
  if (USING_LIVE_DATA) {
    return <LiveRecommendationDetailPage recommendationId={recommendationId} />
  }

  const recommendation = getRecommendationById(recommendationId)
  if (!recommendation) {
    return <NotFoundView recommendationId={recommendationId} />
  }
  return <RecommendationDetailView recommendation={recommendation} />
}
