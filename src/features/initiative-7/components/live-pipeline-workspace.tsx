// Part 22 — I07 complete frontend live data integration.
//
// Live counterpart to pipeline-workspace.tsx. The stage strip below still
// buckets by the real backend lifecycle status (not by approval role) since
// that is what the portfolio-wide summary endpoint aggregates. The table's
// "Waiting on"/"Progress" columns, however, now use chain_index/route --
// which the list endpoint (RecommendationSummary) added specifically so a
// pipeline table could show pending-role and step-N-of-M for every row in
// one list fetch, without the per-recommendation GET .../workflow-state call
// live-approvals-workspace.tsx uses for a single detail view.

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw, Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageLoader } from "@/components/shared/page-loader"
import { TablePagination } from "@/components/shared/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"
import { cn, formatCount } from "@/lib/utils"
import { useDebouncedValue } from "@/features/initiative-7/hooks/use-debounced-value"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { mapStatus } from "@/features/initiative-7/services/i7-api"
import type { RecommendationStatus } from "@/features/initiative-7/types/inventory"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"

const ALL = "all"
/** How many rows of each status a tab that spans several statuses loads. */
const LIVE_PIPELINE_PAGE_SIZE = 200
/** Rows per page of the table -- the same 25 as every I13 table. */
const PAGE_SIZE = DEFAULT_PAGE_SIZE

type StatusTab = "in-flight" | "completed" | "not-submitted"

/** Every real backend RecommendationStatus this reduction recognises,
 * grouped for the stage strip -- mirrors mapStatus's own reduction in
 * i7-api.ts so the labels here are consistent with the badges elsewhere. */
const STAGES: RecommendationStatus[] = [
  "Pending Review",
  "In Approval",
  "Returned",
  "Approved",
  "Rejected",
  "Implemented",
]

const STATUS_TONE: Record<RecommendationStatus, "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "default",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

/** The tab bucket a display status belongs to -- mirrors the scenario
 * version's tabFor() reduction, applied to the mapped status rather than a
 * full Recommendation (this file no longer keeps an unfiltered Recommendation[]
 * around to derive a tab from -- see LivePipelineWorkspace's own comment). */
function tabForStatus(status: RecommendationStatus): StatusTab {
  if (status === "Pending Review") return "not-submitted"
  if (status === "Approved" || status === "Implemented" || status === "Rejected") return "completed"
  return "in-flight"
}

/** Days since `updatedAt` (submit/hold/approve/reject all update the row in
 * place -- see the schema's own updated_at docstring), against wall-clock
 * "now" -- unlike the scenario version's waitingDays(), live data has no
 * fixed dataset reference date to measure against. */
function liveWaitingDays(updatedAt: string | undefined): number | null {
  if (!updatedAt) return null
  const parsed = new Date(updatedAt).getTime()
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.round((Date.now() - parsed) / 86_400_000))
}

/** Same thresholds as the scenario version's pipelineHealth() -- illustrative,
 * not an agreed SLA -- applied only to rows still actually in motion
 * (in-flight); a completed or not-yet-submitted row is never "stuck". */
function liveHealth(days: number | null): "On track" | "Slow" | "Stuck" | null {
  if (days === null) return null
  if (days > 14) return "Stuck"
  if (days > 7) return "Slow"
  return "On track"
}

const HEALTH_TONE: Record<"On track" | "Slow" | "Stuck", "success" | "warning" | "danger"> = {
  "On track": "success",
  Slow: "warning",
  Stuck: "danger",
}

/** Every raw backend LifecycleStatus this page recognises, each fetched
 * unconditionally on every render (a fixed, compile-time-known list -- never
 * a dynamic per-tab array) so the table is always built from rows actually
 * matching a real status, not one arbitrary unfiltered page. A 200-row page
 * ordered by generated_at ascending, out of ~113k rows almost all Pending
 * Review, essentially never contains the handful of real In Approval/
 * Approved/Rejected rows -- which is exactly why the stage strip could show
 * "In flight: 1" while the table below showed nothing. Twelve small,
 * cheap, parallel-by-the-browser requests, each scoped to one status, is a
 * defensible cost for a table the size this data actually has (a few dozen
 * rows total outside Pending Review on the current extract).
 *
 * NOT_EVALUABLE is deliberately excluded: it means the backend has not yet
 * computed any current/recommended stock parameters for that material-plant
 * (see app/schemas/i7/recommendations.py), so it carries no real
 * recommendation to show on a pipeline of decisions in flight -- not a status
 * this table hides a count for, a status it never queries or displays at
 * all, on the table, the stage strip or the tab counts below. */
const ALL_RAW_STATUSES = [
  "READY_FOR_REVIEW",
  "PENDING_APPROVAL",
  "HELD",
  "ADJUSTED",
  "SENT_BACK",
  "APPROVED",
  "SAP_EXECUTION_PENDING",
  "REJECTED",
  "SAP_EXECUTED",
  "ADOPTED",
  "PARTIALLY_ADOPTED",
  "NOT_ADOPTED",
] as const

export function LivePipelineWorkspace() {
  // Part 37 -- portfolio-wide counts, not one fetched page's: with ~113k
  // accumulated rows almost all Pending Review, a 200-row page (like every
  // other portfolio-count bug found this session -- Pending Approval KPI,
  // Stockout Risk Distribution, Recommendation status) reads as "everything
  // is Not submitted, nothing else exists" even when real In-flight/
  // Completed rows exist elsewhere in the full set.
  const { summary } = useLiveRecommendationSummary()
  const [tab, setTab] = useState<StatusTab>("in-flight")
  const [stage, setStage] = useState<string>(ALL)
  const [query, setQuery] = useState("")
  // The backend is asked once the person pauses typing, not once per keystroke.
  const searchTerm = useDebouncedValue(query.trim())

  // Page number, back to 1 whenever the view changes. Derived during render -- not in an effect -- the way the
  // recommendations workspace does it.
  const viewKey = `${tab}|${stage}|${searchTerm}`
  const [pageState, setPageState] = useState({ key: viewKey, page: 1 })
  const requestedPage = pageState.key === viewKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: viewKey, page: next })

  const activeStatuses =
    stage !== ALL
      ? [stage as (typeof ALL_RAW_STATUSES)[number]]
      : ALL_RAW_STATUSES.filter((raw) => tabForStatus(mapStatus(raw)) === tab)

  // Two shapes of view, paged two ways:
  //  - ONE status in view (the Not submitted tab, or a stage picked from the dropdown): the backend pages and
  //    searches it in SQL -- that is where the ~113k rows are, and 200 of them is not a table.
  //  - SEVERAL statuses (In flight, Completed): the backend takes one status per request, so it cannot page their
  //    union. Each is loaded up to LIVE_PIPELINE_PAGE_SIZE and the merged rows are paged here.
  const singleStatus = activeStatuses.length === 1 ? activeStatuses[0] : null
  const paramsFor = (raw: (typeof ALL_RAW_STATUSES)[number]) =>
    raw === singleStatus
      ? { status: raw, page: requestedPage, pageSize: PAGE_SIZE, search: searchTerm || undefined }
      : { status: raw, pageSize: LIVE_PIPELINE_PAGE_SIZE }

  // One hook call per fixed status -- see ALL_RAW_STATUSES's own comment on
  // why this is a fixed, not dynamic, hook count.
  const byStatus = {
    READY_FOR_REVIEW: useLiveRecommendations(paramsFor("READY_FOR_REVIEW")),
    PENDING_APPROVAL: useLiveRecommendations(paramsFor("PENDING_APPROVAL")),
    HELD: useLiveRecommendations(paramsFor("HELD")),
    ADJUSTED: useLiveRecommendations(paramsFor("ADJUSTED")),
    SENT_BACK: useLiveRecommendations(paramsFor("SENT_BACK")),
    APPROVED: useLiveRecommendations(paramsFor("APPROVED")),
    SAP_EXECUTION_PENDING: useLiveRecommendations(paramsFor("SAP_EXECUTION_PENDING")),
    REJECTED: useLiveRecommendations(paramsFor("REJECTED")),
    SAP_EXECUTED: useLiveRecommendations(paramsFor("SAP_EXECUTED")),
    ADOPTED: useLiveRecommendations(paramsFor("ADOPTED")),
    PARTIALLY_ADOPTED: useLiveRecommendations(paramsFor("PARTIALLY_ADOPTED")),
    NOT_ADOPTED: useLiveRecommendations(paramsFor("NOT_ADOPTED")),
  }

  const active = activeStatuses.map((raw) => byStatus[raw])
  const loading = active.some((f) => f.loading)
  const error = active.find((f) => f.error)?.error ?? null
  const refetch = () => active.forEach((f) => f.refetch())
  const data = active.every((f) => f.data) ? active.flatMap((f) => f.data ?? []) : null

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>(STAGES.map((s) => [s, 0]))
    if (summary) {
      for (const row of summary.byStatus) {
        if (row.status === "NOT_EVALUABLE") continue
        const status = mapStatus(row.status)
        if (counts.has(status)) counts.set(status, (counts.get(status) ?? 0) + row.count)
      }
    }
    return counts
  }, [summary])

  const tabCounts = useMemo(() => {
    const counts = { "in-flight": 0, completed: 0, "not-submitted": 0 }
    if (summary) {
      for (const row of summary.byStatus) {
        if (row.status === "NOT_EVALUABLE") continue
        counts[tabForStatus(mapStatus(row.status))] += row.count
      }
    }
    return counts
  }, [summary])

  // Several statuses in view: the search narrows the merged rows here. One status: the backend already searched.
  const search = searchTerm.toLowerCase()
  const matching =
    singleStatus || !search
      ? (data ?? [])
      : (data ?? []).filter((rec) =>
          `${rec.material.materialId} ${rec.material.description}`.toLowerCase().includes(search),
        )

  const page = singleStatus ? requestedPage : Math.min(requestedPage, pageCountOf(matching.length, PAGE_SIZE))
  // A hook keeps its previous rows while the next page loads, so the table dims them instead of vanishing. The
  // first time a status switches to paging it still holds its 200 rows for a moment; only a page's worth of them
  // is shown under the "Loading page" line.
  const rows = singleStatus ? matching.slice(0, PAGE_SIZE) : matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = singleStatus ? active[0].total : matching.length

  // Several statuses: a status with more rows than LIVE_PIPELINE_PAGE_SIZE is only partly loaded, and the pager
  // below can only reach what is loaded. Say so, rather than let "of N" read as the whole population.
  const loadedCount = data?.length ?? 0
  const populationCount = active.reduce((sum, f) => sum + f.total, 0)
  const partlyLoaded = !singleStatus && !searchTerm && populationCount > loadedCount

  // Only the very first load replaces the page. After that a page change dims the rows underneath instead, so the
  // tabs and the search box stay where they are.
  if (loading && data === null) {
    return (
      <PageLoader label="Loading the pipeline" className="h-72 w-full" />
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-4" />}
        title="Could not load the pipeline from the backend"
        description={error.message}
        actions={
          <Button size="sm" variant="outline" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "not-submitted", label: "Not submitted" },
            { key: "in-flight", label: "In flight" },
            { key: "completed", label: "Completed" },
          ] as { key: StatusTab; label: string }[]
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              tab === option.key
                ? "border-warning/40 bg-warning/10 font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            {option.label}
            <span className="font-semibold tabular-nums text-foreground">{formatCount(tabCounts[option.key])}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Recommendations by lifecycle status</div>
        <div className="mt-3 flex flex-wrap items-stretch gap-1.5">
          {STAGES.map((stageName) => {
            const count = stageCounts.get(stageName) ?? 0
            const isEmpty = count === 0
            const rawForStage = ALL_RAW_STATUSES.filter((raw) => mapStatus(raw) === stageName)
            const isActive = rawForStage.includes(stage as (typeof ALL_RAW_STATUSES)[number])
            return (
              <button
                key={stageName}
                type="button"
                onClick={() => setStage(isActive ? ALL : rawForStage[0])}
                className={cn(
                  "min-w-[128px] flex-1 rounded-lg border p-3 text-left transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background hover:bg-muted/40"
                )}
              >
                <div className={cn("truncate text-2xl font-semibold tabular-nums", isEmpty ? "text-muted-foreground" : "text-primary")}>
                  {formatCount(count)}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{stageName}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track a material..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Select value={stage} onValueChange={(v) => setStage(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-44">
            <SelectValue placeholder="All stages">
              {(v: string) => (v === ALL ? "All stages" : mapStatus(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {ALL_RAW_STATUSES.map((raw) => (
              <SelectItem key={raw} value={raw}>
                {mapStatus(raw)} ({raw})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pagedTableView(loading, rows) === "skeleton" ? (
        <PageLoader label="Loading the pipeline" className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing matches this view" />
      ) : (
        <div
          className={cn("overflow-x-auto rounded-xl border border-border transition-opacity", loading && "opacity-50")}
          aria-busy={loading}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Waiting on</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rec) => {
                const isInFlight = tabForStatus(rec.status) === "in-flight"
                const days = isInFlight ? liveWaitingDays(rec.updatedAt) : null
                const health = liveHealth(days)
                const routeLength = rec.routeLength ?? 0
                const done = rec.chainIndex !== undefined ? Math.min(rec.chainIndex, routeLength) : 0
                return (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <Link href={`/inventory-planning/recommendations/${rec.id}`} className="hover:underline">
                        <MaterialIdentity material={rec.material}  />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={rec.risk} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rec.pendingRole ?? (isInFlight ? "—" : <StatusBadge tone={STATUS_TONE[rec.status]}>{rec.status}</StatusBadge>)}
                    </TableCell>
                    <TableCell>
                      {routeLength > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: routeLength }).map((_, index) => (
                              <span
                                key={index}
                                className={cn(
                                  "h-1.5 w-5 rounded-full",
                                  index < done
                                    ? "bg-success"
                                    : index === done && rec.pendingRole
                                      ? "bg-warning"
                                      : "bg-muted"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {done}/{routeLength}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] tabular-nums text-muted-foreground">
                      {days !== null ? `${days} day${days === 1 ? "" : "s"}` : "—"}
                    </TableCell>
                    <TableCell>
                      {health ? (
                        <StatusBadge tone={HEALTH_TONE[health]}>{health}</StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {new Date(rec.updatedAt ?? rec.generatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length > 0 && (
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          count={rows.length}
          noun="recommendations"
          loading={loading}
          onPageChange={setPage}
        />
      )}

      {partlyLoaded && (
        <p className="text-[11px] text-muted-foreground">
          This view holds {formatCount(populationCount)} recommendations; the first{" "}
          {formatCount(LIVE_PIPELINE_PAGE_SIZE)} of each status are loaded here.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Live backend data. &quot;Waiting&quot; and &quot;Health&quot; are measured from each recommendation&apos;s
        last status change (a submit/hold/approve/reject action updates the row in place) against the current time
        — &quot;Slow&quot; past 7 days, &quot;Stuck&quot; past 14, illustrative thresholds, not an agreed SLA. Only
        shown for recommendations actually in flight; a row not yet submitted or already completed cannot be
        stuck. &quot;Waiting on&quot; and &quot;Progress&quot; reflect the real approval role and chain position the
        backend resolved for this recommendation, not a fixed 4-step assumption.
      </p>
    </div>
  )
}
