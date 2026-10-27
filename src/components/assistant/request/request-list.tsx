"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { NotEnabledNotice } from "@/components/assistant/request/request-builder"
import { deleteDraft, useRequestDrafts, type RequestDraft } from "@/components/assistant/request/request-drafts"
import { Chip } from "@/components/assistant/request/request-parts"
import { useRequestList } from "@/components/assistant/request/use-requests"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isNotEnabled } from "@/lib/api/assistant-requests"
import { ApiError } from "@/lib/api/client"
import { departmentLabel } from "@/lib/assistant/request/record"

/** Recent multi-material requests, newest first (`GET /assistant/requests`). */
export function RequestList() {
  const { data: requests, error, loading } = useRequestList()
  if (isNotEnabled(error)) return <NotEnabledNotice />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/assistant/requests/new" className={buttonVariants({ size: "sm" })}>
          <Plus /> New request
        </Link>
      </div>

      <DraftList />

      {loading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {error instanceof ApiError ? error.detailText() : "Requests could not be loaded."}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No requests yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Requester</th>
                <th className="px-3 py-2 font-medium">Plant · department</th>
                <th className="px-3 py-2 font-medium">Lines</th>
                <th className="px-3 py-2 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.requestId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/assistant/requests/${r.requestId}`} className="font-mono font-semibold text-ai-2 hover:underline">
                      {r.requestId}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.requestedFor ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-mono font-semibold">{r.plant}</span>
                    <span className="ml-1.5 text-muted-foreground">{departmentLabel(r)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      <Chip tone="muted">
                        {r.lineCount} line{r.lineCount === 1 ? "" : "s"}
                      </Chip>
                      {r.skippedCount > 0 && <Chip tone="muted">{r.skippedCount} no session</Chip>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.issuedAt).toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
        <h2 className="text-sm font-semibold text-foreground">Drafts</h2>
        <span className="text-xs text-muted-foreground">
          Saved in this browser only. Nothing is recorded and no reference is given until you submit.
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-dashed border-border bg-card">
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
                      className={buttonVariants({ variant: "outline", size: "xs" })}
                    >
                      Resume
                    </Link>
                    <Button type="button" variant="ghost" size="xs" onClick={() => remove(d)}>
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
