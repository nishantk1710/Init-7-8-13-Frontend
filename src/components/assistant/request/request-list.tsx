"use client"

import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"

import { Chip, DemoBanner } from "@/components/assistant/request/request-parts"
import { useDemoRequests } from "@/components/assistant/request/use-demo-requests"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { departmentsOf } from "@/lib/assistant/request/record"
import { resetRequests } from "@/lib/assistant/request/store"

/** Every demo request made in this browser. */
export function RequestList() {
  const requests = useDemoRequests()

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner />
      <div className="flex flex-wrap gap-2">
        <Link href="/assistant/requests/new" className={buttonVariants({ size: "sm" })}>
          <Plus /> New multi-material request
        </Link>
        {requests && requests.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={resetRequests}>
            <Trash2 /> Clear demo requests
          </Button>
        )}
      </div>

      {requests === null ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No requests yet in this browser.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Requester</th>
                <th className="px-3 py-2 font-medium">Plant · departments</th>
                <th className="px-3 py-2 font-medium">Lines</th>
                <th className="px-3 py-2 font-medium">Linked in SAP</th>
                <th className="px-3 py-2 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const oar = r.lines.filter((l) => l.outcome.flow === "i13").length
                const rep = r.lines.length - oar
                const linked = r.lines.filter((l) => l.links.length > 0).length
                return (
                  <tr key={r.requestId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link
                        href={`/assistant/requests/${r.requestId}`}
                        className="font-mono font-semibold text-ai-2 hover:underline"
                      >
                        {r.requestId}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {r.requester}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="font-mono font-semibold">{r.plant ?? r.lines[0]?.material.plant ?? "—"}</span>
                      <span className="ml-1.5 font-mono text-muted-foreground">
                        {departmentsOf(r).join(", ") || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {oar > 0 && <Chip tone="muted">{oar} OAR</Chip>}
                        {rep > 0 && <Chip tone="muted">{rep} repairable</Chip>}
                        {r.skipped.length > 0 && <Chip tone="muted">{r.skipped.length} no session</Chip>}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Chip tone={linked === r.lines.length ? "ready" : linked > 0 ? "warn" : "muted"}>
                        {linked} of {r.lines.length}
                      </Chip>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.issuedAt).toLocaleString("en-GB")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
