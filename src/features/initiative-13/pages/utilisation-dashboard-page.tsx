import Link from "next/link"
import { connection } from "next/server"
import type { ReactNode } from "react"
import { ArrowRight, ChevronDown, Clock3 } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AcquiredVsPlanPanel } from "@/features/initiative-13/components/acquired-vs-plan-panel"
import { DataSourcePanel } from "@/features/initiative-13/components/data-source-panel"
import { DistributionBar } from "@/features/initiative-13/components/distribution-bar"
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
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { loadLiveDashboard, type Section } from "@/features/initiative-13/data/live-dashboard"
import {
  attachCriticalImpactIndicator,
  filterNonMovers,
} from "@/features/initiative-13/utils/dashboard-transforms"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import {
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_ORDER,
  EXCEPTION_STATUS_TONE,
  orderedCounts,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_ORDER,
  PLAN_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import type { AcquiredVsPlanStatus, ActExceptionStatus } from "@/lib/api/i13"
import { formatApiDateTime } from "@/lib/api/format"
import { buttonVariants } from "@/components/ui/button"
import { cn, formatCount } from "@/lib/utils"

/**
 * W6.7 — the Utilisation Dashboard (FR-10), and the module's landing page at
 * `/oar-utilization`.
 *
 * ## Layout
 *
 * Overview first, detail on demand: the KPI cards, then plan coverage and
 * exception status. Every FR-10 drilldown (non-movers, acquired-vs-plan, exceptions,
 * reclassification, captured plans, justifications, validation) is still here,
 * in one tabbed card below, instead of seven full-width tables stacked on one
 * scroll. Provenance and row-cap notes live in a collapsed "About this data".
 *
 * ## Data
 *
 * One server-side `Promise.allSettled` before the HTML is sent (see
 * `live-dashboard.ts`), so `router.refresh()` after a confirmation updates
 * every section together. WATCH (W6.3) is the one official dependency; every
 * other section degrades on its own, a 404 reading as "not available" rather
 * than as an error.
 *
 * ## The transforms this page performs
 *
 * Grouping, joining and filtering fields the backend already computed —
 * `utils/dashboard-transforms.ts` and `utils/status-labels.ts` — and never a
 * business rule. No aging band is reclassified here, no months of cover
 * recalculated, no candidacy re-decided.
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
  })

  const { watch } = dashboard

  const nonMoverRows = watch
    ? attachCriticalImpactIndicator(
        filterNonMovers(watch.rows),
        dashboard.reclassification.status === "ready"
          ? dashboard.reclassification.data.rows
          : []
      )
    : []

  const planSegments = watch
    ? orderedCounts(watch.rows, (r) => r.acquiredVsPlanStatus, PLAN_STATUS_ORDER).map(
        ({ key, count }) => ({
          key,
          count,
          label: PLAN_STATUS_LABEL[key as AcquiredVsPlanStatus] ?? key,
          tone: PLAN_STATUS_TONE[key as AcquiredVsPlanStatus] ?? "neutral",
        })
      )
    : []

  const exceptionSegments =
    dashboard.exceptions.status === "ready"
      ? orderedCounts(dashboard.exceptions.data.rows, (r) => r.status, EXCEPTION_STATUS_ORDER).map(
          ({ key, count }) => ({
            key,
            count,
            label: EXCEPTION_STATUS_LABEL[key as ActExceptionStatus] ?? key,
            tone: EXCEPTION_STATUS_TONE[key as ActExceptionStatus] ?? "neutral",
          })
        )
      : []

  const capturedPlanCount =
    dashboard.plans.status === "ready" ? dashboard.plans.data.count : null
  const referencePlanCount =
    dashboard.summary.status === "ready" ? dashboard.summary.data.referencePlanCount : null

  const unroutedExceptions =
    dashboard.exceptions.status === "ready"
      ? dashboard.exceptions.data.count - dashboard.exceptions.data.ownedCount
      : 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PageHeader
          title="OAR Utilization"
          description="How OAR spares move from reservation to issue — what is idle, what is off plan, and what needs a follow-up."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {watch?.calculatedAt
                  ? `Data as of ${formatApiDateTime(watch.calculatedAt)}`
                  : "Computation time not recorded"}
              </span>
              {watch && <NonMoverExport rows={watch.rows} />}
            </div>
          }
        />

        <I13UrlFilters
          fields={["plant", "material", "agingBand", "acquiredVsPlanStatus"]}
          plants={watch?.plantOptions}
          agingBands={watch?.agingBandOptions}
        />

        {dashboard.summary.status === "ready" ? (
          <KpiSummary summary={dashboard.summary.data} />
        ) : (
          <SectionFallback section={dashboard.summary} what="utilisation summary" />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard
            title="Plan coverage"
            subtitle="Received quantity against the consumption plan, per position"
            span={6}
          >
            {watch ? (
              <div className="flex h-full flex-col gap-4">
                <DistributionBar segments={planSegments} label="Positions by acquired-vs-plan status" />
                <PlanProvenanceNote
                  capturedCount={capturedPlanCount}
                  referenceCount={referencePlanCount}
                  className="mt-auto"
                />
              </div>
            ) : (
              <LoadFailure what="WATCH metrics" message={dashboard.watchError} />
            )}
          </ChartCard>

          <ChartCard
            title="Exception status"
            subtitle="Where each follow-up sits in the confirmation workflow"
            span={6}
          >
            {dashboard.exceptions.status === "ready" ? (
              dashboard.exceptions.data.count === 0 ? (
                <QuietState
                  title="No exceptions in the queue"
                  description="Nothing is waiting on a requester or escalated."
                />
              ) : (
                <div className="flex h-full flex-col gap-4">
                  <DistributionBar segments={exceptionSegments} label="Exceptions by status" />
                  {unroutedExceptions > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatCount(unroutedExceptions)} have no resolved requester, so they
                      have not been routed and cannot escalate.
                    </p>
                  )}
                </div>
              )
            ) : (
              <SectionFallback section={dashboard.exceptions} what="exceptions" />
            )}
            <div className="mt-4 flex justify-end">
              <Link
                href="/oar-utilization/aging-exceptions"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                Open exceptions queue
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </ChartCard>
        </div>

        <section className="rounded-xl border border-border bg-card">
          <Tabs defaultValue="non-movers" className="gap-0">
            <div className="flex flex-col gap-3 border-b border-border px-4 pt-4 sm:px-5">
              <div>
                <h2 className="text-sm font-medium text-foreground">Details</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Position-level drilldowns for the current filters
                </p>
              </div>
              <div className="-mx-1 overflow-x-auto px-1 pb-2">
                <TabsList variant="line" className="h-9">
                  <DetailTab value="non-movers" label="Non-movers" count={watch ? nonMoverRows.length : null} />
                  <DetailTab value="plan" label="Acquired vs plan" count={watch?.rows.length ?? null} />
                  <DetailTab value="exceptions" label="Exceptions" count={sectionCount(dashboard.exceptions, (d) => d.count)} />
                  <DetailTab value="reclassification" label="Reclassification" count={sectionCount(dashboard.reclassification, (d) => d.rows.filter((r) => r.candidateFlag).length)} />
                  <DetailTab value="plans" label="Captured plans" count={sectionCount(dashboard.plans, (d) => d.count)} />
                  <DetailTab value="justifications" label="Justifications" count={sectionCount(dashboard.justifications, (d) => d.length)} />
                  <DetailTab value="validation" label="Validation" count={null} />
                </TabsList>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <TabsContent value="non-movers">
                {watch ? (
                  <div className="flex flex-col gap-3">
                    {dashboard.reclassification.status === "unavailable" && (
                      <p className="text-xs text-muted-foreground">
                        Critical impact shows Unknown for every row — reclassification data is not
                        available from this backend.
                      </p>
                    )}
                    <NonMoverTable rows={nonMoverRows} />
                  </div>
                ) : (
                  <LoadFailure what="WATCH metrics" message={dashboard.watchError} />
                )}
              </TabsContent>

              <TabsContent value="plan">
                {watch ? (
                  <AcquiredVsPlanPanel rows={watch.rows} />
                ) : (
                  <LoadFailure what="WATCH metrics" message={dashboard.watchError} />
                )}
              </TabsContent>

              <TabsContent value="exceptions">
                {dashboard.exceptions.status === "ready" ? (
                  <ExceptionStatusPanel rows={dashboard.exceptions.data.rows} />
                ) : (
                  <SectionFallback section={dashboard.exceptions} what="exceptions" />
                )}
              </TabsContent>

              <TabsContent value="reclassification">
                {dashboard.reclassification.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Advisory only — recommended for review, never converted automatically.
                    </p>
                    <ReclassificationTable candidates={dashboard.reclassification.data.rows} />
                    <RowCapNote
                      atLimit={dashboard.reclassification.data.atLimit}
                      count={dashboard.reclassification.data.count}
                      total={dashboard.reclassification.data.total}
                      noun="candidate"
                    />
                  </div>
                ) : (
                  <SectionFallback
                    section={dashboard.reclassification}
                    what="reclassification candidates"
                  />
                )}
              </TabsContent>

              <TabsContent value="plans">
                {dashboard.plans.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Plans stated by requesters in the assistant, kept apart from generated
                      reference plans.
                    </p>
                    <PlansTable plans={dashboard.plans.data.rows.slice(0, 10)} />
                    {dashboard.plans.data.count > 10 && (
                      <Link
                        href="/oar-utilization/plans"
                        className="self-end text-xs font-medium text-primary hover:underline"
                      >
                        Showing 10 of {formatCount(dashboard.plans.data.count)} — view all plans
                      </Link>
                    )}
                  </div>
                ) : (
                  <SectionFallback section={dashboard.plans} what="captured plans" />
                )}
              </TabsContent>

              <TabsContent value="justifications">
                {dashboard.justifications.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Reasons given when exceptions were confirmed and when reservations were
                      made in the assistant. Covers the most recent confirmations only.
                    </p>
                    <JustificationLog entries={dashboard.justifications.data} />
                  </div>
                ) : (
                  <SectionFallback section={dashboard.justifications} what="justification log" />
                )}
              </TabsContent>

              <TabsContent value="validation">
                {dashboard.validation.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Reconciliation against ZMM065 and the 30-Day GR Report, computed by the
                      backend.
                    </p>
                    <ValidationPanel result={dashboard.validation.data} />
                  </div>
                ) : (
                  <SectionFallback section={dashboard.validation} what="validation data" />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </section>

        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            About this data
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
            <CalculatedAtNote calculatedAt={watch?.calculatedAt ?? null} />
            {watch && (
              <RowCapNote
                atLimit={watch.atLimit}
                count={watch.count}
                total={watch.total}
                noun="WATCH position"
              />
            )}
            {dashboard.summary.status === "ready" && dashboard.summary.data.valuationIsMocked && (
              <p className="text-[11px] text-muted-foreground">
                Valuation data behind these figures is currently mocked in the backend.
              </p>
            )}
            <DataSourcePanel />
          </div>
        </details>
      </div>
    </div>
  )
}

function DetailTab({
  value,
  label,
  count,
}: {
  value: string
  label: string
  count: number | null
}) {
  return (
    <TabsTrigger value={value} className="flex-none px-2.5">
      {label}
      {count !== null && (
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatCount(count)}
        </span>
      )}
    </TabsTrigger>
  )
}

function sectionCount<T>(section: Section<T>, count: (data: T) => number): number | null {
  return section.status === "ready" ? count(section.data) : null
}

/** A calm "nothing to do" — smaller than `EmptyState`, which is sized for a page. */
function QuietState({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-muted/40 px-4 py-8 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
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
