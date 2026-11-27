// The Pipeline page's "Convert to OAR requests": the requests a planner raised to move a Min-Max material to OAR, and
// where each one waits in the approval chain -- the same chain, and the same Waiting / Health reading, as the OAR and
// Stock item recommendations above it.
//
// A section of its own, read from its own endpoint (GET /reverse-conversion/requests/list). It never changes the
// recommendation figures above it, and a failure here shows only here: the rest of the page stays as it was.

"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useReverseRequestList } from "@/features/initiative-7/hooks/use-reverse-request-list"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import { requestProgress } from "@/features/initiative-7/utils/reverse-request-state"
import { HEALTH_TONE, liveHealth, liveWaitingDays } from "@/features/initiative-7/utils/pipeline-waiting"
import { convertToOarDecisionHref } from "@/features/initiative-7/utils/recommendation-url-state"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { cn, formatCount } from "@/lib/utils"

const ALL = "all"
const PAGE_SIZE = DEFAULT_PAGE_SIZE

/** The statuses a request can be in, in the order a request moves through them, with the words the Pipeline uses. */
export const REQUEST_STAGES: readonly { status: string; label: string; tone: "default" | "success" | "warning" | "danger" }[] = [
  { status: "PENDING_APPROVAL", label: "Pending approval", tone: "warning" },
  { status: "SENT_BACK", label: "Returned", tone: "warning" },
  { status: "HELD", label: "On hold", tone: "warning" },
  { status: "SAP_EXECUTION_PENDING", label: "Waiting for SAP", tone: "success" },
  { status: "REJECTED", label: "Rejected", tone: "danger" },
]

/** A request still moving through the approval chain -- the only kind that can be slow or stuck. */
const IN_FLIGHT = new Set(["PENDING_APPROVAL", "SENT_BACK", "HELD"])

function stageOf(status: string) {
  return REQUEST_STAGES.find((stage) => stage.status === status)
}

export function LivePipelineConvertToOar() {
  const [stage, setStage] = useState<string>(ALL)
  // Page number, back to 1 whenever the status in view changes -- derived during render, not in an effect.
  const [pageState, setPageState] = useState({ key: stage, page: 1 })
  const page = pageState.key === stage ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: stage, page: next })

  const { data, loading, error, refetch } = useReverseRequestList({
    status: stage === ALL ? undefined : stage,
    page,
    pageSize: PAGE_SIZE,
  })

  const counts = new Map((data?.counts ?? []).map((row) => [row.status, row.count]))
  const everything = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
  const rows = data?.items ?? []

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4" aria-label="Convert to OAR requests">
      <div>
        <h3 className="text-sm font-medium text-foreground">Convert to OAR requests</h3>
        <p className="text-[11px] text-muted-foreground">
          Requests to move a Min-Max material to OAR. They follow the same approval chain as an OAR conversion; each material shows its newest request.
        </p>
      </div>

      {error && data === null ? (
        <EmptyState
          icon={<AlertTriangle className="size-4" />}
          title="Could not load the Convert to OAR requests"
          description={error.message}
          actions={
            <Button size="sm" variant="outline" onClick={refetch}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {[{ status: ALL, label: "All", tone: "default" as const }, ...REQUEST_STAGES].map((option) => {
              const count = option.status === ALL ? everything : (counts.get(option.status) ?? 0)
              return (
                <button
                  key={option.status}
                  type="button"
                  onClick={() => setStage(stage === option.status ? ALL : option.status)}
                  aria-pressed={stage === option.status}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    stage === option.status
                      ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {option.label}
                  <span className={cn("font-semibold tabular-nums", count === 0 ? "text-muted-foreground" : "text-foreground")}>
                    {formatCount(count)}
                  </span>
                </button>
              )
            })}
          </div>

          {pagedTableView(loading, rows) === "skeleton" ? (
            <p className="text-sm text-muted-foreground" role="status">
              Loading the Convert to OAR requests…
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              title={stage === ALL ? "No Convert to OAR requests yet" : "No requests in this status"}
              description={stage === ALL ? "A request appears here when a planner clicks Convert to OAR on a Stock item to OAR material." : undefined}
            />
          ) : (
            <div className={cn("rounded-xl border border-border transition-opacity", loading && "opacity-50")} aria-busy={loading}>
              <StickyScrollTable widths={[28, 8, 14, 17, 17, 8, 8]} minWidth={900} wrapCells>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Plant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waiting on</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((request) => {
                    const inFlight = IN_FLIGHT.has(request.status)
                    const days = inFlight ? liveWaitingDays(request.updated_at) : null
                    const health = liveHealth(days)
                    const { done, of } = requestProgress(request)
                    const known = stageOf(request.status)
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Link href={convertToOarDecisionHref(request.material, request.plant)} className="hover:underline">
                            <MaterialIdentity
                              material={{
                                materialId: request.material,
                                materialCode: request.material,
                                description: request.description ?? request.material,
                              }}
                            />
                          </Link>
                        </TableCell>
                        <TableCell className="text-[13px] tabular-nums text-muted-foreground">{request.plant}</TableCell>
                        <TableCell>
                          <StatusBadge tone={known?.tone ?? "default"}>{known?.label ?? request.status}</StatusBadge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{request.pending_role ?? "—"}</TableCell>
                        <TableCell>
                          {of > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {Array.from({ length: of }).map((_, index) => (
                                  <span
                                    key={index}
                                    className={cn(
                                      "h-1.5 w-5 rounded-full",
                                      index < done ? "bg-success" : index === done && request.pending_role ? "bg-warning" : "bg-muted",
                                    )}
                                  />
                                ))}
                              </div>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {done}/{of}
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
                          {health ? <StatusBadge tone={HEALTH_TONE[health]}>{health}</StatusBadge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </StickyScrollTable>
            </div>
          )}

          {rows.length > 0 && (
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              count={rows.length}
              noun="requests"
              loading={loading}
              onPageChange={setPage}
            />
          )}

          {error && data !== null && (
            <p role="alert" className="text-[12px] text-destructive">
              Could not refresh the Convert to OAR requests: {error.message}
            </p>
          )}
        </>
      )}
    </section>
  )
}
