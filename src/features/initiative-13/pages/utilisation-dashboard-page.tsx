import { connection } from "next/server"

import { ChartCard } from "@/components/shared/chart-card"
import { PageHeader } from "@/components/shared/page-header"
import { AcquiredVsPlanPanel } from "@/features/initiative-13/components/acquired-vs-plan-panel"
import { AgingBucketsChart } from "@/features/initiative-13/components/aging-buckets-chart"
import { DataSourcePanel } from "@/features/initiative-13/components/data-source-panel"
import { ExceptionStatusPanel } from "@/features/initiative-13/components/exception-status-panel"
import { JustificationLog } from "@/features/initiative-13/components/justification-log"
import { KpiSummary } from "@/features/initiative-13/components/kpi-summary"
import {
  CalculatedAtNote,
  LoadFailure,
  PlanProvenanceNote,
  RowCapNote,
  SectionUnavailable,
} from "@/features/initiative-13/components/load-states"
import { NonMoverExport } from "@/features/initiative-13/components/non-mover-export"
import { NonMoverTable } from "@/features/initiative-13/components/non-mover-table"
import { PlansTable } from "@/features/initiative-13/components/plans-table"
import { ReclassificationTable } from "@/features/initiative-13/components/reclassification-table"
import { ReferenceCountForm } from "@/features/initiative-13/components/reference-count-form"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { loadLiveDashboard, type Section } from "@/features/initiative-13/data/live-dashboard"
import {
  attachCriticalImpactIndicator,
  countByField,
  filterNonMovers,
} from "@/features/initiative-13/utils/dashboard-transforms"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { formatCount } from "@/lib/utils"

const AGING_BAND_LABELS: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

/**
 * W6.7 — the Utilisation Dashboard (FR-10).
 *
 * One consolidated view: KPIs, aging distribution, non-mover drilldown,
 * acquired-versus-plan, exception status, reclassification candidates, captured
 * consumption plans, the justification log and validation.
 *
 * ## What changed, and why it is not just tidying
 *
 * This was a `"use client"` page running **six** `useI13Query` hooks. They fired
 * after hydration, and re-fired on every debounced keystroke — including
 * `getI13AllJustifications`, which is two list calls plus up to thirty detail
 * fetches, from the browser. Now it is one server-side `Promise.allSettled`
 * before the HTML is sent.
 *
 * The consequence that matters is not the round trips. It is that
 * `router.refresh()` and `revalidatePath` now do something here: recording a
 * confirmation updates the exception panel, the justification log and the KPIs
 * together, because the server re-renders them. Against the old page a write
 * could not update anything, because every section's data lived in `useState`.
 *
 * ## Which sections are allowed to be missing
 *
 * The dashboard's one official dependency is W6.3 (WATCH). Reclassification
 * (W6.5), the ACT exception queue and justification log (W6.6), captured plans
 * (WS7) and validation all degrade independently — a 404 is reported as
 * "not available" rather than as an error, because a backend without those
 * wired up is a deployment fact with nothing to retry. See `live-dashboard.ts`.
 *
 * ## The transforms this page performs
 *
 * Grouping, joining and filtering fields the backend already computed —
 * `utils/dashboard-transforms.ts` — and never a business rule. No aging band is
 * reclassified here, no months of cover recalculated, no candidacy re-decided.
 * If it were, this screen and the WATCH screen would disagree about the same
 * material in front of a user.
 */
export async function UtilisationDashboardPage({
  searchParams,
}: {
  searchParams: I13SearchParams
}) {
  await connection()

  const dashboard = await loadLiveDashboard({
    plant: searchParams.plant,
    material: searchParams.material,
    agingBand: searchParams.agingBand,
    acquiredVsPlanStatus: searchParams.acquiredVsPlanStatus,
    zmm065ReferenceCount: searchParams.zmm065,
    gr30DayReferenceCount: searchParams.gr30Day,
  })

  const { watch } = dashboard

  const agingDistribution = watch
    ? countByField(watch.rows, (row) => row.agingBand).map((entry) => ({
        ...entry,
        bucket: AGING_BAND_LABELS[entry.bucket] ?? entry.bucket,
      }))
    : []

  const nonMoverRows = watch
    ? attachCriticalImpactIndicator(
        filterNonMovers(watch.rows),
        dashboard.reclassification.status === "ready"
          ? dashboard.reclassification.data.rows
          : []
      )
    : []

  const capturedPlanCount =
    dashboard.plans.status === "ready" ? dashboard.plans.data.count : null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Utilisation Dashboard"
          description="KPIs, aging, non-mover drilldown, acquired-vs-plan, exceptions, reclassification candidates, captured plans, justifications and validation — one consolidated view over the read-only Initiative 13 API (FR-10)."
          actions={<CalculatedAtNote calculatedAt={watch?.calculatedAt ?? null} />}
        />

        <I13UrlFilters
          fields={["plant", "material", "agingBand", "acquiredVsPlanStatus"]}
          plants={watch?.plantOptions}
          agingBands={watch?.agingBandOptions}
        />

        {/* KPIs */}
        {dashboard.summary.status === "ready" ? (
          <KpiSummary summary={dashboard.summary.data} />
        ) : (
          <SectionFallback section={dashboard.summary} what="utilisation summary" />
        )}

        <PlanProvenanceNote capturedCount={capturedPlanCount} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard
            title="Aging distribution"
            subtitle="Backend-computed aging band (FAST/SLOW/NON_MOVING) — never reclassified in the browser"
            span={6}
          >
            {watch ? (
              <AgingBucketsChart data={agingDistribution} />
            ) : (
              <LoadFailure what="WATCH metrics" message={dashboard.watchError} />
            )}
          </ChartCard>

          <ChartCard
            title="Acquired vs. plan"
            subtitle="Backend-computed acquired-vs-plan status and variance"
            span={6}
          >
            {watch ? (
              <AcquiredVsPlanPanel rows={watch.rows} />
            ) : (
              <LoadFailure what="WATCH metrics" message={dashboard.watchError} />
            )}
          </ChartCard>

          <ChartCard
            title="Non-mover drilldown"
            subtitle="NON_MOVING positions by plant and critical-impact indicator (joined from W6.5, when available)"
            span={12}
            footnote={
              dashboard.reclassification.status === "unavailable"
                ? "Critical-impact indicator unavailable — reclassification candidates (W6.5) could not be loaded, so this column shows Unknown for every row."
                : undefined
            }
          >
            {watch ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <NonMoverExport rows={watch.rows} />
                </div>
                <NonMoverTable rows={nonMoverRows} />
              </div>
            ) : (
              <LoadFailure what="WATCH metrics" message={dashboard.watchError} />
            )}
          </ChartCard>

          <ChartCard
            title="Exception status"
            subtitle="W6.6 ACT exception queue — read-only here; confirmations are recorded on the Exceptions screen"
            span={12}
            footnote={
              dashboard.exceptions.status === "ready" &&
              dashboard.exceptions.data.count > dashboard.exceptions.data.ownedCount
                ? `${formatCount(
                    dashboard.exceptions.data.count - dashboard.exceptions.data.ownedCount
                  )} of these have no resolved requester, so they have never been routed and cannot escalate.`
                : undefined
            }
          >
            {dashboard.exceptions.status === "ready" ? (
              <ExceptionStatusPanel rows={dashboard.exceptions.data.rows} />
            ) : (
              <SectionFallback section={dashboard.exceptions} what="exceptions" />
            )}
          </ChartCard>

          <ChartCard
            title="Captured consumption plans"
            subtitle="FR-4 — plans stated by a person in the assistant, kept apart from the 742 generated reference rows"
            span={12}
          >
            {dashboard.plans.status === "ready" ? (
              <div className="flex flex-col gap-2">
                <PlansTable plans={dashboard.plans.data.rows.slice(0, 10)} />
                {dashboard.plans.data.count > 10 && (
                  <p className="text-[11px] text-muted-foreground">
                    Showing 10 of {formatCount(dashboard.plans.data.count)} — the
                    full list is on the Consumption plans screen.
                  </p>
                )}
              </div>
            ) : (
              <SectionFallback section={dashboard.plans} what="captured plans" />
            )}
          </ChartCard>

          <ChartCard
            title="Reclassification candidates"
            subtitle="W6.5 advisory evidence — recommended for review, never an automatic conversion"
            span={12}
          >
            {dashboard.reclassification.status === "ready" ? (
              <>
                <ReclassificationTable candidates={dashboard.reclassification.data.rows} />
                <RowCapNote
                  atLimit={dashboard.reclassification.data.atLimit}
                  count={dashboard.reclassification.data.count}
                  noun="candidate"
                />
              </>
            ) : (
              <SectionFallback
                section={dashboard.reclassification}
                what="reclassification candidates"
              />
            )}
          </ChartCard>

          <ChartCard
            title="Justification log"
            subtitle="Structured reasons from ACT confirmations and from the assistant at reservation time — audit view only"
            span={12}
            footnote="The ACT half is bounded to the most recent confirmed/resolved exceptions — there is no bulk confirmation-listing endpoint yet."
          >
            {dashboard.justifications.status === "ready" ? (
              <JustificationLog entries={dashboard.justifications.data} />
            ) : (
              <SectionFallback section={dashboard.justifications} what="justification log" />
            )}
          </ChartCard>

          <ChartCard
            title="Validation"
            subtitle="Reconciliation against ZMM065 and the 30-Day GR Report — all tolerance math runs in the backend"
            span={12}
          >
            <div className="mb-3">
              <ReferenceCountForm />
            </div>
            {dashboard.validation.status === "ready" ? (
              <ValidationPanel result={dashboard.validation.data} />
            ) : (
              <SectionFallback section={dashboard.validation} what="validation data" />
            )}
          </ChartCard>
        </div>

        {watch && (
          <RowCapNote atLimit={watch.atLimit} count={watch.count} noun="WATCH position" />
        )}

        <DataSourcePanel />
      </div>
    </div>
  )
}

/** `unavailable` and `error` render differently — see `live-dashboard.ts`. */
function SectionFallback<T>({
  section,
  what,
}: {
  section: Section<T>
  what: string
}) {
  if (section.status === "unavailable") {
    return <SectionUnavailable message={section.message} />
  }
  if (section.status === "error") {
    return <LoadFailure what={what} message={section.message} />
  }
  return null
}
