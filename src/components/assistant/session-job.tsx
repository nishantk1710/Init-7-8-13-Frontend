import Link from "next/link"
import { Wrench } from "lucide-react"

import { JOB_LABELS, type JobMovementRow, type SessionJobView } from "@/lib/assistant/session-job"

/**
 * The job behind a repairable session: its reservation, the 261 that issued
 * the part, the 262 that returned it to stock, and the repair PR/PO raised
 * under the same R-reference. Presentation only; the view is built in
 * `lib/assistant/session-job.ts`.
 */
export function SessionJob({ view }: { view: SessionJobView }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Wrench className="size-4 text-ai-2" aria-hidden />
        The job and its repair
      </h2>
      {view.kind === "not-linked" ? (
        <p className="text-sm text-muted-foreground">{view.text}</p>
      ) : (
        <>
          {view.reservations.map((r) => (
            <dl key={r.key} className="grid gap-2 text-sm sm:grid-cols-3">
              <Fact label={JOB_LABELS.reserved}>
                <span className="font-mono">{r.reference}</span>
                {r.order && <span className="text-muted-foreground"> · order {r.order}</span>}
                <span className="block text-xs text-muted-foreground">
                  {r.quantity} needed by {r.requirementDate}
                </span>
              </Fact>
              <Fact label={JOB_LABELS.issued}>
                <Movements rows={r.issued} />
              </Fact>
              <Fact label={JOB_LABELS.returned}>
                <Movements rows={r.returned} />
              </Fact>
            </dl>
          ))}
          {view.repairs.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                {JOB_LABELS.repairs}
              </span>
              <ul className="flex flex-col gap-1 text-sm">
                {view.repairs.map((r) => (
                  <li key={r.rowId} className="flex flex-wrap items-center gap-2">
                    <Link href={r.href} className="font-mono text-primary underline-offset-4 hover:underline">
                      {r.label}
                    </Link>
                    <span className="text-xs text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/40 px-3 py-2">
      <dt className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function Movements({ rows }: { rows: JobMovementRow[] }) {
  if (rows.length === 0) return <span className="text-muted-foreground">Not yet</span>
  return (
    <ul>
      {rows.map((m, i) => (
        <li key={`${m.date}-${i}`}>
          {m.quantity} on {m.date}
        </li>
      ))}
    </ul>
  )
}
