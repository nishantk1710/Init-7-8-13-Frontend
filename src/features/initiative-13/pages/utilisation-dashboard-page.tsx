import dynamic from "next/dynamic"
import Link from "next/link"
import { connection } from "next/server"
import type { ReactNode } from "react"
import { ArrowRight, Clock3, FileText } from "lucide-react"

import { TablePagination } from "@/components/shared/table-pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AcquiredVsPlanPanel } from "@/features/initiative-13/components/acquired-vs-plan-panel"
import { DistributionBar } from "@/features/initiative-13/components/distribution-bar"
import { ExceptionPipeline } from "@/features/initiative-13/components/exception-pipeline"
import { AttentionBanner, type AttentionItem } from "@/features/initiative-13/components/ui/attention-banner"
import { Card, CardHeading } from "@/features/initiative-13/components/ui/kpi-card"
import { InfoChip, OarPageHeader, OarScope } from "@/features/initiative-13/components/ui/oar-scope"
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
import { loadLiveDashboard, type Section } from "@/features/initiative-13/data/live-dashboard"
import { attachCriticalImpactIndicator } from "@/features/initiative-13/utils/dashboard-transforms"
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
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"
import { formatApiDateTime } from "@/lib/api/format"
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

/** Demo mode only: the plans captured in this browser's demo sessions. */
const DemoPlans = dynamic(() =>
  import("@/components/assistant/demo/demo-records").then((m) => m.DemoPlans)
)

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
 * is no separate plans screen; `?tab=plans` opens that tab. The
 * reclassification feed is read here only for the non-movers' Critical impact
 * column.
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
    agingBand: searchParams.agingBand,
    acquiredVsPlanStatus: searchParams.acquiredVsPlanStatus,
  }
  const initialTab = resolveDetailTab(searchParams.tab)
  const page = searchParams.page ?? 1
  const dashboard = await loadLiveDashboard(filters, { tab: initialTab, page })

  const { watch, watchCounts, nonMovers } = dashboard
  /** The page a tab is showing: the URL's for the open tab, else its first. */
  const pageOf = (tab: DetailTabId) => (tab === initialTab ? page : 1)
  const hrefFor = (tab: DetailTabId) => (p: number) => pageHref(PATH, { ...searchParams, tab }, p)

  const nonMoverRows = nonMovers
    ? attachCriticalImpactIndicator(
        nonMovers.rows,
        dashboard.reclassification.status === "ready"
          ? dashboard.reclassification.data.rows
          : []
      )
    : []

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

  const unroutedExceptions =
    dashboard.exceptionCounts.status === "ready"
      ? dashboard.exceptionCounts.data.total - dashboard.exceptionCounts.data.withRequester
      : 0

  const attentionItems: AttentionItem[] = []
  if (dashboard.exceptionCounts.status === "ready" && unroutedExceptions > 0) {
    attentionItems.push({ key: "unrouted", count: unroutedExceptions, label: "follow-ups with no identified requester" })
  }
  if (dashboard.summary.status === "ready") {
    const { grNotIssued30DayCount, planBreachCount } = dashboard.summary.data
    if (grNotIssued30DayCount > 0) {
      attentionItems.push({ key: "grni", count: grNotIssued30DayCount, label: "received, not issued (30d)" })
    }
    if (planBreachCount > 0) {
      attentionItems.push({ key: "overdue", count: planBreachCount, label: "planned consumption overdue" })
    }
  }

  return (
    <OarScope>
      <OarPageHeader
        title="OAR Utilization"
        subtitle="How OAR spares move from reservation to issue — what is idle, what is off plan, and what needs a follow-up."
        actions={
          <>
            <InfoChip icon={<Clock3 aria-hidden className="size-4" />}>
              {watch?.calculatedAt
                ? `Data as of ${formatApiDateTime(watch.calculatedAt)}`
                : "Computation time not recorded"}
            </InfoChip>
            {watchCounts && <NonMoverExport filters={filters} />}
            {dashboard.reportEnabled && (
              <Link
                href="/oar-utilization/report"
                className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4 font-semibold hover:bg-primary-strong-hover")}
              >
                <FileText aria-hidden className="size-4" />
                Summary report
              </Link>
            )}
          </>
        }
      />

      <I13UrlFilters
        fields={["plant", "material", "agingBand", "acquiredVsPlanStatus"]}
        plants={watch?.plantOptions}
        agingBands={watch?.agingBandOptions}
      />

      {attentionItems.length > 0 && (
        <AttentionBanner
          title="Needs your attention"
          items={attentionItems}
          action={
            <Link
              href="/oar-utilization/aging-exceptions"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 gap-1.5 border-attention-line px-4 font-semibold text-attention-ink")}
            >
              Open procurement exceptions
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
        />
      )}

      {dashboard.summary.status === "ready" ? (
        <KpiSummary
          summary={dashboard.summary.data}
          plant={searchParams.plant}
          material={searchParams.material}
        />
      ) : (
        <SectionFallback section={dashboard.summary} what="utilization summary" />
      )}

      {SHOW_PLAN_COVERAGE && (
        <Card>
          <CardHeading
            title="Consumption Plan Coverage"
            subtitle="Received quantity against the consumption plan, per material"
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
          actions={
            <Link
              href="/oar-utilization/aging-exceptions"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 gap-1.5 px-4 font-semibold")}
            >
              Open procurement exceptions
              <ArrowRight aria-hidden className="size-4" />
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

      <section aria-labelledby="oar-details-heading" className="rounded-card border border-line bg-card">
        <Tabs defaultValue={initialTab} className="gap-0">
          <div className="flex flex-col gap-3 border-b border-line px-4 pt-5 sm:px-5">
            <CardHeading
              id="oar-details-heading"
              title="Details"
              subtitle="Position-level drilldowns for the current filters"
            />
            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <TabsList variant="line" className="h-11">
                <DetailTab value="non-movers" label="Non-movers" count={nonMovers?.total ?? null} />
                <DetailTab value="plan" label="Acquired vs plan" count={watchCounts?.total ?? null} />
                <DetailTab value="plans" label="Captured plans" count={capturedPlanCount} />
                <DetailTab value="justifications" label="Justifications" count={sectionCount(dashboard.justifications, (d) => d.length)} />
              </TabsList>
            </div>
          </div>

            <div className="p-4 sm:p-5">
              <TabsContent value="non-movers">
                {nonMovers ? (
                  <div className="flex flex-col gap-3">
                    {dashboard.reclassification.status === "unavailable" && (
                      <p className="text-xs text-muted-foreground">
                        Critical impact shows Unknown for every row — criticality (ZMM065) is not
                        available from this backend.
                      </p>
                    )}
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
                {watch ? (
                  <AcquiredVsPlanPanel
                    rows={watch.rows}
                    total={watch.total}
                    filters={filters}
                    pagination={
                      <TablePagination
                        page={pageOf("plan")}
                        pageSize={DEFAULT_PAGE_SIZE}
                        total={watch.total}
                        count={watch.count}
                        noun="positions"
                        hrefFor={hrefFor("plan")}
                      />
                    }
                  />
                ) : (
                  <LoadFailure what="consumption tracking data" message={dashboard.watchError} />
                )}
              </TabsContent>

              <TabsContent value="plans">
                {ASSISTANT_DEMO ? (
                  <DemoPlans
                    material={searchParams.material || undefined}
                    plant={searchParams.plant || undefined}
                  />
                ) : dashboard.plans.status === "ready" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Plans stated by requesters in the assistant, kept apart from generated
                      reference plans.
                    </p>
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
    <TabsTrigger value={value} className="h-11 flex-none px-3 font-semibold after:bg-primary-strong data-active:text-primary-ink">
      {label}
      {count !== null && (
        <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-bold tabular-nums text-primary-ink">
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
    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-healthy-tint px-4 py-8 text-center text-healthy-ink">
      <div className="text-sm font-bold">{title}</div>
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
