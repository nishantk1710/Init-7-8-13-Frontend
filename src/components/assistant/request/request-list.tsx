"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { NotEnabledNotice } from "@/components/assistant/request/request-builder"
import { deleteDraft, useRequestDrafts, type RequestDraft } from "@/components/assistant/request/request-drafts"
import { Chip } from "@/components/assistant/request/request-parts"
import { useRequestList } from "@/components/assistant/request/use-requests"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { isNotEnabled, type ApiRequestSummary } from "@/lib/api/assistant-requests"
import { ApiError } from "@/lib/api/client"
import { groupByDay } from "@/lib/assistant/request/group-by-day"
import { departmentLabel } from "@/lib/assistant/request/record"
import { formatCount } from "@/lib/utils"

/** Recent multi-material requests, newest first (`GET /assistant/requests`). */
export function RequestList() {
  const { data: requests, error, loading } = useRequestList()
  const [query, setQuery] = useState("")
  const [onlyNoSession, setOnlyNoSession] = useState(false)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (requests ?? []).filter(
      (r) =>
        (!onlyNoSession || r.skippedCount > 0) &&
        (!q || r.requestId.toLowerCase().includes(q) || (r.requestedFor ?? "").toLowerCase().includes(q))
    )
  }, [requests, query, onlyNoSession])
  const groups = useMemo(() => groupByDay(shown, (r) => r.issuedAt), [shown])

  if (isNotEnabled(error)) return <NotEnabledNotice />

  const all = requests ?? []
  const lineTotal = all.reduce((sum, r) => sum + r.lineCount, 0)
  const withNoSession = all.filter((r) => r.skippedCount > 0).length

  return (
    <div className="flex flex-col gap-5">
      {requests && requests.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard value={all.length} label="Requests" hint="The most recent, newest first." />
          <StatCard value={lineTotal} label="Lines" hint="Across those requests." />
          <StatCard
            tone="caution"
            value={withNoSession}
            label="With a line that has no session"
            hint={onlyNoSession ? "Showing only these. Click to show all." : "Click to show only these."}
            onClick={() => setOnlyNoSession((v) => !v)}
            pressed={onlyNoSession}
          />
        </div>
      )}

      <DraftList />

      {loading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : error ? (
        <div className="rounded-card border border-line bg-card p-6 text-sm text-muted-foreground">
          {error instanceof ApiError ? error.detailText() : "Requests could not be loaded."}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-card p-8 text-center text-sm text-muted-foreground">
          No requests yet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="w-full sm:w-80">
              <span className="sr-only">Search requests</span>
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reference or requester"
                className="h-11 bg-card"
              />
            </label>
            <span className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{formatCount(shown.length)}</span> request
              {shown.length === 1 ? "" : "s"}
            </span>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-card p-8 text-center text-sm text-muted-foreground">
              No requests match.
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`} className="flex flex-col gap-2">
                <h2 id={`day-${group.key}`} className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-foreground">{group.heading}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.date && `${group.date} · `}
                    {group.items.length} request{group.items.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((r) => (
                    <li key={r.requestId}>
                      <RequestRow request={r} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

/** One request as a whole-row link: reference, who, where, how many lines, when. */
function RequestRow({ request: r }: { request: ApiRequestSummary }) {
  const who = r.requestedFor?.trim()
  return (
    <Link
      href={`/assistant/requests/${r.requestId}`}
      className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-card border border-line bg-card px-4 py-3 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:grid-cols-[9rem_10rem_1fr_auto_auto_auto]"
    >
      <span className="font-mono text-sm font-bold text-action">{r.requestId}</span>
      <span className="flex items-center gap-2 text-sm text-foreground max-md:order-3 max-md:col-span-2">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-action/10 text-xs font-bold text-action uppercase"
        >
          {who ? who[0] : "?"}
        </span>
        <span className="truncate">{who || "Requester not recorded"}</span>
      </span>
      <span className="truncate text-sm max-md:order-4 max-md:col-span-2">
        <span className="font-mono font-semibold text-foreground">{r.plant}</span>
        <span className="ml-2 text-muted-foreground">{departmentLabel(r)}</span>
      </span>
      <span className="flex gap-1 max-md:hidden">
        <Chip tone="muted">
          {r.lineCount} line{r.lineCount === 1 ? "" : "s"}
        </Chip>
        {r.skippedCount > 0 && <Chip tone="warn">{r.skippedCount} no session</Chip>}
      </span>
      <time dateTime={r.issuedAt} className="text-sm text-muted-foreground tabular-nums max-md:hidden">
        {new Date(r.issuedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </time>
      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
    </Link>
  )
}

/** Requests saved as a draft in this browser (`request-drafts.ts`). Nothing when there are none. */
function DraftList() {
  const drafts = useRequestDrafts()
  if (!drafts || drafts.length === 0) return null

  function remove(draft: RequestDraft) {
    if (window.confirm("Delete this draft? It cannot be recovered.")) deleteDraft(draft.id)
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-base font-bold text-foreground">Drafts</h2>
        <span className="text-xs text-muted-foreground">
          Saved in this browser only. Nothing is recorded and no reference is given until you submit.
        </span>
      </div>
      <div className="overflow-x-auto rounded-card border border-dashed border-line bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Saved</th>
              <th className="px-3 py-2 font-medium">Requester</th>
              <th className="px-3 py-2 font-medium">Plant · department</th>
              <th className="px-3 py-2 font-medium">Materials</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(d.savedAt).toLocaleString("en-GB")}</td>
                <td className="px-3 py-2">{d.requester || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-mono font-semibold">{d.rows[0]?.plant ?? "—"}</span>
                  {d.department && <span className="ml-1.5 text-muted-foreground">{d.department}</span>}
                </td>
                <td className="px-3 py-2">
                  <Chip tone="muted">
                    {d.rows.length} material{d.rows.length === 1 ? "" : "s"}
                  </Chip>
                </td>
                <td className="px-3 py-2">
                  <span className="flex justify-end gap-1">
                    <Link
                      href={`/assistant/requests/new?draft=${encodeURIComponent(d.id)}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Resume
                    </Link>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(d)}>
                      Delete
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
