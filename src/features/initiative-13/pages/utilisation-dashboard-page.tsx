import Link from "next/link"
import { connection } from "next/server"
import type { ReactNode } from "react"
import { ArrowRight, FileText } from "lucide-react"

import { TablePagination } from "@/components/shared/table-pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataUpdatedNote } from "@/features/initiative-13/components/data-updated-note"
import { AcquiredVsPlanPanel } from "@/features/initiative-13/components/acquired-vs-plan-panel"
import { DashboardInfo } from "@/features/initiative-13/components/dashboard-info"
import { DistributionBar } from "@/features/initiative-13/components/distribution-bar"
import { ExceptionPipeline } from "@/features/initiative-13/components/exception-pipeline"
import { Card, CardHeading } from "@/features/initiative-13/components/ui/kpi-card"
import { OarPageHeader, OarScope } from "@/features/initiative-13/components/ui/oar-scope"
import { JustificationLog } from "@/features/initiative-13/components/justification-log"
import { KpiSummary } from "@/features/initiative-13/components/kpi-summary"
import {
  LoadFailure,
  PlanProvenanceNote,
  SectionUnavailable,
} from "@/features/initiative-13/components/load-states"
import { NonMoverExport } from "@/features/initiative-13/components/non-mover-export"
import { NonMoverTable } from "@/features/initiative-13/components/non-mover-table"
import { PlansTable } from "@/features/initiative-13/components/plans-table"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import type { DashboardInfoId } from "@/features/initiative-13/data/dashboard-info"
import { loadLiveDashboard, type Section } from "@/features/initiative-13/data/live-dashboard"
import { resolveDetailTab, type DetailTabId } from "@/features/initiative-13/utils/detail-tabs"
import { displayTone } from "@/features/initiative-13/utils/oar-display"
import { pageHref, type I13SearchParams } from "@/features/initiative-13/utils/search-params"
import {
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_ORDER,
  EXCEPTION_STATUS_TONE,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_ORDER,
  PLAN_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import type { AcquiredVsPlanStatus, ActExceptionStatus } from "@/lib/api/i13"
import { buttonVariants } from "@/components/ui/button"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { cn, formatCount } from "@/lib/utils"

const PATH = "/oar-utilization"

/**
 * Consumption Plan Coverage card, hidden for now (UAT, 21 Oct). Plans are
 * captured only by assistant sessions since go-live, and the SAP extract ends
 * before it, so almost every position reads "No plan"; and its "received" is
 * goods receipts on reservation-linked POs only, while most OAR reservations
 * are issued from stock. Set to true to bring it back.
 */
const SHOW_PLAN_COVERAGE = false

/** `{STATUS: n}` from a count endpoint, in display order, unknown keys last. */
function inOrder(counts: Record<string, number>, order: readonly string[]): { key: string; count: number }[] {
  const extra = Object.keys(counts).filter((k) => !order.includes(k))
  return [...order, ...extra].map((key) => ({ key, count: counts[key] ?? 0 }))
}

/**
 * W6.7 — the Utilisation Dashboard (FR-10), and the module's landing page at
 * `/oar-utilization`.
 *
 * ## Layout
 *
 * Overview first, detail on demand: the KPI cards, then plan coverage and
 * exception status. Every FR-10 drilldown (non-movers, acquired-vs-plan,
 * captured plans, justifications) is here, in one tabbed card below, instead of
 * full-width tables stacked on one scroll. Exceptions are the one exception: the
 * dashboard shows only their status summary (FR-10's "exception status") and
 * links to the Exceptions screen, which owns the queue -- the full list here
 * duplicated it. Captured plans live only here -- there
 * is no separate plans screen; `?tab=plans` opens that tab. The non-movers
 * carry no critical-impact column: the ZMM065 rating was on record for almost
 * no OAR position (8 of 2,791 "Yes" on 6-Nov-2026), so it read as "No".
 *
 * ## Data
 *
 * One server-side `Promise.allSettled` before the HTML is sent (see
 * `live-dashboard.ts`), so `router.refresh()` after a confirmation updates
 * every section together. WATCH (W6.3) is the one official dependency; every
 * other section degrades on its own, a 404 reading as "not available" rather
 * than as an error.
 *
 * The bars and tab badges are counted by the backend over every row the
 * filters match; each table is one server page of 25 (`?tab=` and `?page=`).
 * They used to be computed from the first 1,000 WATCH rows and 1,000
 * exceptions, so they described a slice and said so only in small print.
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

  const filters = {
    plant: searchParams.plant,
    material: searchParams.material,
    // No stock-type filter on the dashboard (UAT, 7-Nov-2026): an old link's
    // ?agingBand= must not narrow the page with no filter on screen to say so.
    acquiredVsPlanStatus: searchParams.acquiredVsPlanStatus,
  }
  // The Acquired vs required tab's rows have their own filters, set inside the tab.
  const planVsIssuedFilters = {
    plant: searchParams.plant,
    // The tab's own Material wins; else the page's, which narrows everything.
    material: searchParams.planMaterial || searchParams.material,
    status: searchParams.planStatus,
    reservation: searchParams.reservation,
    overdue: searchParams.overdue === "1",
  }
  const initialTab = resolveDetailTab(searchParams.tab)
  const page = searchParams.page ?? 1
  const dashboard = await loadLiveDashboard(
    {
      ...filters,
      planStatus: searchParams.planStatus,
      reservation: searchParams.reservation,
      overdue: searchParams.overdue === "1",
      assistantPage: searchParams.apage ?? 1,
      planMaterial: searchParams.planMaterial,
    },
    { tab: initialTab, page }
  )

  const { watch, watchCounts, nonMovers } = dashboard
  /** The page a tab is showing: the URL's for the open tab, else its first. */
  const pageOf = (tab: DetailTabId) => (tab === initialTab ? page : 1)
  const hrefFor = (tab: DetailTabId) => (p: number) => pageHref(PATH, { ...searchParams, tab }, p)
  /** The Via assistant table pages on `?apage=`, leaving the SAP table's `?page=` as it is. */
  const assistantHref = (p: number) =>
    pageHref(PATH, { ...searchParams, tab: "plan", apage: p > 1 ? p : undefined }, searchParams.page ?? 1)

  const nonMoverRows = nonMovers?.rows ?? []

  const planSegments = watchCounts
    ? inOrder(watchCounts.byAcquiredVsPlanStatus, PLAN_STATUS_ORDER).map(({ key, count }) => ({
        key,
        count,
        label: PLAN_STATUS_LABEL[key as AcquiredVsPlanStatus] ?? key,
        tone: PLAN_STATUS_TONE[key as AcquiredVsPlanStatus] ?? "neutral",
      }))
    : []

  const exceptionSegments =
    dashboard.exceptionCounts.status === "ready"
      ? inOrder(dashboard.exceptionCounts.data.byStatus, EXCEPTION_STATUS_ORDER).map(({ key, count }) => ({
          key,
          count,
          label: EXCEPTION_STATUS_LABEL[key as ActExceptionStatus] ?? key,
          tone: displayTone(EXCEPTION_STATUS_TONE[key as ActExceptionStatus] ?? "neutral"),
        }))
      : []

  const capturedPlanCount =
    dashboard.plans.status === "ready" ? (dashboard.plans.data.total ?? dashboard.plans.data.count) : null
  const referencePlanCount =
    dashboard.summary.status === "ready" ? dashboard.summary.data.referencePlanCount : null

  // The pipeline's step 1 (OPEN: no requester identified yet), so the note
  // under the steps says the same number. total - withRequester also counted
  // closed exceptions that never had a requester (115 on non-prod, 9 Nov).
  const unroutedExceptions =
    dashboard.exceptionCounts.status === "ready" ? (dashboard.exceptionCounts.data.byStatus.OPEN ?? 0) : 0

  const countScope = [
    searchParams.plant ? `Plant ${searchParams.plant}` : "Plants 1300 and 1500 combined",
    searchParams.material ? `material ${searchParams.material}` : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <OarScope>
      <OarPageHeader
        title="OAR Utilization"
        meta={<DataUpdatedNote />}
        subtitle="How OAR spares move from reservation to issue — what is idle, what is off plan, and what needs a follow-up."
        notes={
          dashboard.summary.status === "ready" ? (
            <>
              {/* The scope the backend counted for, so the cards never read as both plants when they are one. */}
              <p>Counts for: {countScope}</p>
              {dashboard.summary.data.valuationIsMocked && (
                <p>Valuation figures are indicative and not yet sourced from SAP.</p>
              )}
            </>
          ) : undefined
        }
        actions={
          <>
            {watchCounts && <NonMoverExport filters={filters} />}
            {dashboard.reportEnabled && (
              <Link
                href="/oar-utilization/report"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap", "h-9 min-h-9! border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action")}
              >
                <FileText aria-hidden className="size-3.5" />
                Summary report
              </Link>
            )}
          </>
        }
      />

      <I13UrlFilters
        layout="panel"
        fields={["plant", "material"]}
        plants={watch?.plantOptions}
      />

      {dashboard.summary.status === "ready" ? (
        <KpiSummary summary={dashboard.summary.data} />
      ) : (
        <SectionFallback section={dashboard.summary} what="utilization summary" />
      )}

      {SHOW_PLAN_COVERAGE && (
        <Card>
          <CardHeading
            title="Consumption Plan Coverage"
            subtitle="Quantity issued against the consumption plan, per material"
          />
          <div className="mt-4">
            {watchCounts ? (
              <div className="flex h-full flex-col gap-4">
                <DistributionBar segments={planSegments} label="Materials by acquired-vs-plan status" />
                <PlanProvenanceNote
                  capturedCount={capturedPlanCount}
                  referenceCount={referencePlanCount}
                  className="mt-auto"
                />
              </div>
            ) : (
              <LoadFailure what="consumption tracking data" message={dashboard.watchError} />
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeading
          title="Exception follow-up pipeline"
          subtitle="Where each follow-up sits in the confirmation workflow"
          info={<DashboardInfo id="exceptionPipeline" />}
          actions={
            <Link
              href="/oar-utilization/aging-exceptions"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 min-h-9! whitespace-nowrap border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
              )}
            >
              Open procurement exceptions
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          }
        />
        <div className="mt-5">
          {dashboard.exceptionCounts.status === "ready" ? (
            dashboard.exceptionCounts.data.total === 0 ? (
              <QuietState
                title="No exceptions in the queue"
                description="Nothing is waiting on a requester or escalated."
              />
            ) : (
              <ExceptionPipeline steps={exceptionSegments} unrouted={unroutedExceptions} />
            )
          ) : (
            <SectionFallback section={dashboard.exceptionCounts} what="exceptions" />
          )}
        </div>
      </Card>


      <section aria-labelledby="oar-details-heading" className="rounded-xl border border-border bg-card">
        <Tabs defaultValue={initialTab} className="gap-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 pt-5 sm:px-5">
            <CardHeading
              id="oar-details-heading"
              title="Details"
              subtitle="Position-level drilldowns for the current filters"
            />
            <div className="pb-4">
              <TabsList className="w-full border-2 border-action/40 bg-card p-1 shadow-lg ring-0 group-data-horizontal/tabs:h-11">
                <DetailTab value="non-movers" label="Non-movers" count={nonMovers?.total ?? null} />
                <DetailTab
                  value="plan"
                  label="Acquired vs required"
                  count={sumCounts(
                    sectionCount(dashboard.planAssistantCounts, (d) => d.total),
                    sectionCount(dashboard.planSapCounts, (d) => d.total)
                  )}
                />
                <DetailTab value="plans" label="Captured plans" count={capturedPlanCount} />
                <DetailTab value="justifications" label="Justifications" count={sectionCount(dashboard.justifications, (d) => d.length)} />
              </TabsList>
            </div>
          </div>

            <div className="p-4 sm:p-5">
              <TabsContent value="non-movers">
                {nonMovers ? (
                  <div className="flex flex-col gap-3">
                    <TabIntro info="nonMoversTab">
                      OAR positions not issued for more than 730 days, or never issued.
                    </TabIntro>
                    <NonMoverTable
                      rows={nonMoverRows}
                      total={nonMovers.total}
                      filters={filters}
                      pagination={
                        <TablePagination
                          page={pageOf("non-movers")}
                          pageSize={DEFAULT_PAGE_SIZE}
                          total={nonMovers.total}
                          count={nonMovers.count}
                          noun="non-movers"
                          hrefFor={hrefFor("non-movers")}
                        />
                      }
                    />
                  </div>
                ) : (
                  <LoadFailure what="consumption tracking data" message={dashboard.watchError} />
                )}
              </TabsContent>

              <TabsContent value="plan">
                <div className="flex flex-col gap-3">
                  <TabIntro info="acquiredVsPlanTab">
                    What was issued against what was required: first the plans captured in the assistant, then the
                    OAR reservations raised directly in SAP.
                  </TabIntro>
                  <AcquiredVsPlanPanel
                    filters={planVsIssuedFilters}
                    assistant={{
                      rows: dashboard.planAssistant.status === "ready" ? dashboard.planAssistant.data.rows : [],
                      total: dashboard.planAssistant.status === "ready" ? dashboard.planAssistant.data.total : null,
                      overdue: dashboard.planAssistantCounts.status === "ready" ? dashboard.planAssistantCounts.data.overdue : null,
                      error: sectionError(dashboard.planAssistant),
                      pagination:
                        dashboard.planAssistant.status === "ready" ? (
                          <TablePagination
                            page={searchParams.apage ?? 1}
                            pageSize={DEFAULT_PAGE_SIZE}
                            total={dashboard.planAssistant.data.total}
                            count={dashboard.planAssistant.data.count}
                            noun="plans"
                            hrefFor={assistantHref}
                          />
                        ) : null,
                    }}
                    sap={{
                      rows: dashboard.planSap.status === "ready" ? dashboard.planSap.data.rows : [],
                      total: dashboard.planSap.status === "ready" ? dashboard.planSap.data.total : null,
                      error: sectionError(dashboard.planSap),
                      pagination:
                        dashboard.planSap.status === "ready" ? (
                          <TablePagination
                            page={pageOf("plan")}
                            pageSize={DEFAULT_PAGE_SIZE}
                            total={dashboard.planSap.data.total}
                            count={dashboard.planSap.data.count}
                            noun="reservations"
                            hrefFor={hrefFor("plan")}
                          />
                        ) : null,
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="plans">
                {dashboard.plans.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <TabIntro info="capturedPlansTab">
                      Plans stated by requesters in the assistant, kept apart from generated
                      reference plans.
                    </TabIntro>
                    <PlansTable plans={dashboard.plans.data.rows} />
                    <TablePagination
                      page={pageOf("plans")}
                      pageSize={DEFAULT_PAGE_SIZE}
                      total={dashboard.plans.data.total}
                      count={dashboard.plans.data.count}
                      noun="captured plans"
                      hrefFor={hrefFor("plans")}
                    />
                  </div>
                ) : (
                  <SectionFallback section={dashboard.plans} what="captured plans" />
                )}
              </TabsContent>

              <TabsContent value="justifications">
                {dashboard.justifications.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <TabIntro info="justificationsTab">
                      Reasons given when exceptions were confirmed and when reservations were
                      made in the assistant. Covers the most recent confirmations only.
                    </TabIntro>
                    <JustificationLog entries={dashboard.justifications.data} />
                  </div>
                ) : (
                  <SectionFallback section={dashboard.justifications} what="justification log" />
                )}
              </TabsContent>

            </div>
          </Tabs>
        </section>
    </OarScope>
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
    <TabsTrigger
      value={value}
      className="min-h-0! px-4 font-semibold text-foreground/70 duration-300 ease-out data-active:border-action data-active:bg-background data-active:text-foreground data-active:shadow-md dark:data-active:border-action dark:data-active:bg-background dark:data-active:text-foreground"
    >
      {label}
      {count !== null && (
        <span className="rounded-full bg-action/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-action">
          {formatCount(count)}
        </span>
      )}
    </TabsTrigger>
  )
}

/** A Details tab's one-line description, with the (i) that explains its rule. */
function TabIntro({ info, children }: { info: DashboardInfoId; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{children}</span>
      <DashboardInfo id={info} />
    </div>
  )
}

function sectionCount<T>(section: Section<T>, count: (data: T) => number): number | null {
  return section.status === "ready" ? count(section.data) : null
}

/** The tab badge over both tables; unknown while either count is. */
function sumCounts(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b
}

/** A section's failure as one line, or null when it loaded. */
function sectionError<T>(section: Section<T>): string | null {
  return section.status === "ready" ? null : section.message
}

/** A calm "nothing to do" — smaller than `EmptyState`, which is sized for a page. */
function QuietState({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-success/10 px-4 py-8 text-center text-success">
      <div className="text-sm font-semibold">{title}</div>
      {description && <p className="text-sm">{description}</p>}
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
