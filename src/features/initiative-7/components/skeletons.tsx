import type { ReactNode } from "react"

import {
  Bone,
  SkeletonBars,
  SkeletonBody,
  SkeletonCard,
  SkeletonCards,
  SkeletonCharts,
  SkeletonFilters,
  SkeletonKpis,
  SkeletonLines,
  SkeletonPage,
  SkeletonTable,
  SkeletonTabs,
  type SkeletonHeaderProps,
} from "@/components/shared/page-skeleton"

/**
 * The Inventory Planning screens while they load, each in the shape of the page it stands in for
 * (components/shared/page-skeleton.tsx says why, and how the pieces work).
 *
 * Each shape is drawn once and used twice: `<Name>Skeleton` is the route's `loading.tsx` -- the shape under a header
 * in bones, the moment the sidebar is clicked -- and `<Name>SkeletonBody` is what the workspace shows under its real
 * header while it fetches. One drawing for both, so the wait reads as one wait, and the page lands where the bones were.
 */

function page(label: string, shape: ReactNode, header: SkeletonHeaderProps = {}, className?: string) {
  return (
    <SkeletonPage label={label} header={header} className={className}>
      {shape}
    </SkeletonPage>
  )
}

function body(label: string, shape: ReactNode, className?: string) {
  return (
    <SkeletonBody label={label} className={className}>
      {shape}
    </SkeletonBody>
  )
}

// --- Overview -----------------------------------------------------------------------------------------------------

/** live-overview-workspace.tsx: the filter bar, four KPI cards, four chart cards two by two. */
function OverviewShape() {
  return (
    <>
      <SkeletonFilters labelled fields={[180, 180, 150, 150, 150, 220]} />
      <SkeletonKpis count={4} />
      <SkeletonCharts count={4} columns="lg:grid-cols-2" chart="h-[200px]" />
    </>
  )
}

const OVERVIEW = "Loading the Inventory Planning overview"
export const OverviewSkeleton = () => page(OVERVIEW, <OverviewShape />, { actions: true })
export const OverviewSkeletonBody = () => body(OVERVIEW, <OverviewShape />)

// --- Recommendations ------------------------------------------------------------------------------------------------

/** recommendations-workspace.tsx: the filter bar, the view toggle, the table with its pager. */
function RecommendationsShape() {
  return (
    <>
      <SkeletonFilters labelled fields={[150, 150, 150, 160, 180, 170, 200]} />
      <SkeletonTabs segmented count={3} />
      <SkeletonTable rows={10} columns={9} />
    </>
  )
}

const RECOMMENDATIONS = "Loading recommendations"
export const RecommendationsSkeleton = () => page(RECOMMENDATIONS, <RecommendationsShape />)
export const RecommendationsSkeletonBody = () => body(RECOMMENDATIONS, <RecommendationsShape />)

/** The table alone, once the filter bar and toggle are on screen (recommendations-workspace, min-max-to-oar-workspace). */
export const RecommendationsTableSkeleton = ({ label = RECOMMENDATIONS }: { label?: string }) =>
  body(label, <SkeletonTable rows={10} columns={9} />)

/** recommendation-detail-page.tsx: the back link, the header with its badges, a row of chips, the two cards. */
export function RecommendationDetailSkeleton() {
  return (
    <SkeletonPage label="Loading the recommendation" innerClassName="max-w-6xl" header={{ back: true, actions: true }}>
      <div className="flex flex-wrap gap-2">
        {[88, 104, 96, 112, 80, 120].map((width, i) => (
          <Bone key={i} style={{ width }} className="h-6 rounded-full" />
        ))}
      </div>
      <SkeletonCard className="flex flex-col gap-3 p-4">
        <Bone className="h-4 w-56" />
        <Bone className="h-3 w-80 max-w-full" />
        <SkeletonTable rows={4} columns={5} pagination={false} className="mt-2" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3 p-4">
        <Bone className="h-4 w-40" />
        <SkeletonLines count={3} className="mt-1" />
      </SkeletonCard>
    </SkeletonPage>
  )
}

/** The consumption chart inside an expanded Stock item to OAR row (min-max-to-oar-detail.tsx). */
export const ConsumptionChartSkeleton = () => body("Loading consumption", <SkeletonBars bars={12} className="h-48" />, "gap-0")

// --- Pipeline -------------------------------------------------------------------------------------------------------

/** live-pipeline-workspace.tsx: the status tabs, the stage card, the toolbar, the table. */
function PipelineShape() {
  return (
    <>
      <SkeletonTabs count={3} />
      <SkeletonCard className="flex flex-col gap-3 p-4">
        <Bone className="h-4 w-44" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex min-w-[128px] flex-1 flex-col gap-2 rounded-lg border border-border p-3">
              <Bone className="h-7 w-12" />
              <Bone className="h-2.5 w-20" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <div className="flex flex-wrap gap-2">
        <Bone className="h-8 w-56" />
        <Bone className="h-8 w-44" />
      </div>
      <SkeletonTable rows={8} columns={7} />
    </>
  )
}

const PIPELINE = "Loading the pipeline"
export const PipelineSkeleton = () => page(PIPELINE, <PipelineShape />)
export const PipelineSkeletonBody = () => body(PIPELINE, <PipelineShape />)
/** The table alone, for a page change once the tabs and the stage card are on screen. */
export const PipelineTableSkeleton = () => body(PIPELINE, <SkeletonTable rows={6} columns={7} />)

// --- Adoption Tracking ----------------------------------------------------------------------------------------------

/** adoption-tracking-workspace.tsx: a search, a status filter, the table. */
function AdoptionShape() {
  return (
    <>
      <SkeletonFilters fields={[224, 176]} />
      <SkeletonTable rows={8} columns={5} />
    </>
  )
}

const ADOPTION = "Loading adoption tracking"
export const AdoptionSkeleton = () => page(ADOPTION, <AdoptionShape />)
export const AdoptionSkeletonBody = () => body(ADOPTION, <AdoptionShape />)

// --- Reports ----------------------------------------------------------------------------------------------------------

/** quarterly-reports-workspace.tsx, the landing: the Monthly / Quarterly switch, a line, the period cards. */
function ReportsShape() {
  return (
    <>
      <SkeletonTabs segmented count={2} />
      <div className="flex items-center justify-between">
        <Bone className="h-3.5 w-80 max-w-full" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>
      <SkeletonCards count={8} columns="sm:grid-cols-2 lg:grid-cols-4" height="h-[120px]" lines={1} />
    </>
  )
}

export const ReportsSkeleton = () => page("Loading reports", <ReportsShape />)

/** One opened report: its KPI cards, the charts, the baseline table. */
function ReportShape() {
  return (
    <>
      <SkeletonKpis count={4} />
      <SkeletonCharts count={1} columns="lg:grid-cols-1" chart="h-56" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SkeletonCharts count={1} columns="lg:grid-cols-1" chart="h-48" className="lg:col-span-4" />
        <SkeletonCharts count={1} columns="lg:grid-cols-1" chart="h-48" className="lg:col-span-8" />
      </div>
      <SkeletonTable rows={6} columns={6} pagination={false} />
    </>
  )
}

export const ReportSkeletonBody = () => body("Loading the report", <ReportShape />)

// --- Calculation ----------------------------------------------------------------------------------------------------

/** kpi-formulas-page.tsx: three steps, the how-to line, the KPI cards / Charts switch, the formula cards. */
function CalculationShape() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="flex gap-3 p-4">
            <Bone className="size-6 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-3.5 w-2/3" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-4/5" />
            </div>
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="px-4 py-3">
        <Bone className="h-3.5 w-48" />
      </SkeletonCard>
      <SkeletonTabs segmented count={2} />
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-48" />
            <Bone className="size-5 rounded-full" />
          </div>
          {i === 0 && <SkeletonLines count={4} className="mt-2" />}
        </SkeletonCard>
      ))}
    </>
  )
}

const CALCULATION = "Loading the calculation"
export const CalculationSkeleton = () => page(CALCULATION, <CalculationShape />, {}, "blue-scope p-6")
export const CalculationSkeletonBody = () => body(CALCULATION, <CalculationShape />)

// --- Criticality Reports ------------------------------------------------------------------------------------------

/** criticality-reports-page.tsx: the upload card, then the history card with its table. */
function CriticalityReportsShape() {
  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border-2 border-action/40 bg-card p-4 shadow-lg">
        <Bone className="h-4 w-40" />
        <Bone className="h-3 w-96 max-w-full" />
        <div className="mt-1 flex flex-wrap gap-2">
          <Bone className="h-9 w-56" />
          <Bone className="h-9 w-44" />
          <Bone className="h-9 min-w-48 flex-1" />
          <Bone className="h-9 w-24 rounded-lg" />
        </div>
        <Bone className="h-2.5 w-72 max-w-full" />
      </div>
      <SkeletonCard className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-72 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-7 w-16 rounded-full" />
            <Bone className="h-7 w-16 rounded-full" />
          </div>
        </div>
        <SkeletonTable rows={5} columns={7} pagination={false} />
      </SkeletonCard>
    </>
  )
}

export const CriticalityReportsSkeleton = () =>
  page("Loading Criticality Reports", <CriticalityReportsShape />, {}, "blue-scope p-6")
