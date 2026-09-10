import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { getPlantById } from "@/lib/shared-data/plants"
import { formatZAR } from "@/lib/utils"
import { DecisionActions, DecisionHistory } from "@/features/initiative-7/components/decision-panel"
import { RecommendationReviewPanel } from "@/features/initiative-7/components/recommendation-review-panel"
import { OarColdStartPanel } from "@/features/initiative-7/components/oar-cold-start-panel"
import { RepairContextSignal } from "@/features/initiative-7/components/repair-context-signal"
import { getRecommendationById } from "@/features/initiative-7/data/recommendations"
import type { Criticality, Recommendation } from "@/features/initiative-7/types/inventory"
import { serviceLevelZFactor } from "@/features/initiative-7/utils/inventory-calc"

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

export function RecommendationDetailPage({ recommendationId }: { recommendationId: string }) {
  const recommendation = getRecommendationById(recommendationId)

  if (!recommendation) {
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
            Z-factor: {serviceLevelZFactor(recommendation.serviceLevelTarget).toFixed(2)} (illustrative)
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
              action={<DecisionActions recommendation={recommendation} />}
            />
          </ChartCard>

          <ChartCard title="Decision history" span={12}>
            <DecisionHistory recommendation={recommendation} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
