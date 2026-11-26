import {
  Bone,
  SkeletonCard,
  SkeletonFilters,
  SkeletonKpis,
  SkeletonLines,
  SkeletonPage,
  SkeletonTable,
  SkeletonTabs,
} from "@/components/shared/page-skeleton"

/**
 * The OAR Utilization screens while they load (components/shared/page-skeleton.tsx says how). Every I13 page is a
 * server component read for each visit, so these are what a click in the sidebar, or a filter change in the URL,
 * shows until the page arrives. Drawn inside `OarScope`'s container (ui/oar-scope.tsx) under `OarPageHeader`'s
 * shape: the title with the "Data updated" chip at its right, the subtitle, a note.
 */

const OAR_FRAME = "oar-scope px-4 py-6 sm:px-6"
const OAR_COLUMN = "gap-5"

function OarPage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <SkeletonPage
      label={label}
      className={OAR_FRAME}
      innerClassName={OAR_COLUMN}
      header={{ size: "2xl", actions: true }}
    >
      {children}
    </SkeletonPage>
  )
}

/** The dashboard (utilisation-dashboard-page.tsx): filters, seven KPI cards, the follow-up pipeline, the Details card. */
export function OarDashboardSkeleton() {
  return (
    <OarPage label="Loading OAR Utilization">
      <SkeletonFilters labelled fields={[220, 220]} />
      <SkeletonKpis count={7} />
      <SkeletonCard className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <Bone className="h-4 w-56" />
          <Bone className="h-3.5 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border border-t-4 border-t-muted px-4 py-3">
              <Bone className="h-2.5 w-12" />
              <Bone className="h-3 w-28" />
              <Bone className="h-6 w-14" />
            </div>
          ))}
        </div>
        <Bone className="h-3 w-80 max-w-full" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-4 px-4 pt-5 pb-4 sm:px-5">
        <Bone className="h-4 w-20" />
        <div className="flex h-11 items-center gap-1 rounded-lg border border-border p-1">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-8 flex-1 rounded-md" />
          ))}
        </div>
        <Bone className="h-3 w-96 max-w-full" />
        <SkeletonTable rows={6} columns={4} />
      </SkeletonCard>
    </OarPage>
  )
}

/** Procurement Exceptions (aging-exceptions-page.tsx): two KPI cards, the filter row, the exceptions table. */
export function OarExceptionsSkeleton() {
  return (
    <OarPage label="Loading Procurement Exceptions">
      <SkeletonKpis count={2} className="gap-4 sm:grid-cols-2 lg:grid-cols-2" />
      <SkeletonFilters bare fields={[208, 176, 192, 192]} trailing={false} />
      <SkeletonTable rows={8} columns={9} />
    </OarPage>
  )
}

/** Utilization Ledger (ledger-page.tsx): two KPI cards, the view switch over the filter row, the table. */
export function OarLedgerSkeleton() {
  return (
    <OarPage label="Loading the Utilization Ledger">
      <SkeletonKpis count={2} className="gap-4 sm:grid-cols-2 lg:grid-cols-2" />
      <div className="flex flex-col gap-1">
        <SkeletonTabs segmented count={2} />
        <SkeletonFilters bare fields={[208, 176, 176, 208, 160]} trailing={false} />
      </div>
      <SkeletonTable rows={8} columns={8} />
    </OarPage>
  )
}

/** Live Consumption Tracking (watch-page.tsx): the view switch and filters, the history note, the usage row cards. */
export function OarWatchSkeleton() {
  return (
    <OarPage label="Loading Live Consumption Tracking">
      <div className="flex flex-col gap-1">
        <SkeletonTabs segmented count={2} />
        <SkeletonFilters bare fields={[208, 176, 160]} trailing={false} />
      </div>
      <SkeletonCard className="px-4 py-3">
        <Bone className="h-3.5 w-96 max-w-full" />
      </SkeletonCard>
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-[minmax(0,2.8fr)_repeat(3,minmax(0,1fr))_10.5rem] gap-4 px-5">
          {[60, 50, 50, 50, 70].map((w, i) => (
            <Bone key={i} className="h-2.5" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,2.8fr)_repeat(3,minmax(0,1fr))_10.5rem] items-center gap-4 rounded-xl border-2 border-border bg-card px-5 py-3.5"
          >
            <div className="flex flex-col gap-2">
              <Bone className="h-3.5" style={{ width: `${56 + ((i * 13) % 30)}%` }} />
              <Bone className="h-3 w-24" />
            </div>
            <Bone className="h-3 w-3/5" />
            <Bone className="h-3 w-1/2" />
            <Bone className="h-3 w-2/5" />
            <Bone className="h-7 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-40" />
        <div className="flex gap-2">
          <Bone className="h-9 w-24 rounded-md" />
          <Bone className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </OarPage>
  )
}

/** The summary report (summary-report-page.tsx): the document beside the list of earlier reports. Not an OarScope page. */
export function OarSummaryReportSkeleton() {
  return (
    <SkeletonPage
      label="Loading the summary report"
      className="p-4 sm:p-6"
      innerClassName="gap-5"
      header={{ actions: true }}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <SkeletonCard className="flex flex-col gap-5 p-5">
          <Bone className="h-5 w-72 max-w-full" />
          <SkeletonLines count={5} />
          <Bone className="h-4 w-48" />
          <SkeletonLines count={6} />
          <Bone className="h-4 w-56" />
          <SkeletonLines count={4} />
        </SkeletonCard>
        <div className="flex flex-col gap-2">
          <Bone className="h-3.5 w-32" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2">
              <Bone className="h-2.5 w-3/4" />
              <Bone className="h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
