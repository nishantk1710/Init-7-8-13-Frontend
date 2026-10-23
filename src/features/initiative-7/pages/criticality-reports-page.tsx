"use client"

import { PageHeader } from "@/components/shared/page-header"
import { ApiError } from "@/lib/api/client"
import { CriticalityHistoryCard } from "@/features/initiative-7/components/criticality-history-card"
import { CriticalityUploadCard } from "@/features/initiative-7/components/criticality-upload-card"
import { useCriticalityReports } from "@/features/initiative-7/hooks/use-criticality-reports"

/**
 * Criticality Reports -- each plant's monthly ZMM065 criticality report.
 *
 * An upload becomes the criticality I07, I08 and I13 all read (the backend
 * rebuilds `criticality_current` and tells each initiative's snapshot the
 * source changed). Nothing on this page is fixture data: plants and history
 * both come from /api/criticality.
 */
export function CriticalityReportsPage() {
  const { data, loading, error, refetch } = useCriticalityReports()
  const errorText = error ? (error instanceof ApiError ? error.detailText() : error.message) : null

  return (
    <div className="blue-scope min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Criticality Reports"
          description="Upload each plant's monthly criticality report. Every upload is kept — nothing is overwritten."
        />
        <CriticalityUploadCard plants={data?.plants ?? null} onUploaded={refetch} />
        <CriticalityHistoryCard
          plants={data?.plants ?? null}
          uploads={data?.uploads ?? null}
          loading={loading}
          error={errorText}
        />
      </div>
    </div>
  )
}
