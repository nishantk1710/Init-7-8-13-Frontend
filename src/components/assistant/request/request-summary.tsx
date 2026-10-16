"use client"

import Link from "next/link"
import { Boxes, CircleSlash, Info, Link2, Wrench } from "lucide-react"

import { AiEyebrow, AiIconBadge } from "@/components/assistant/ai-visuals"
import { LinkSimulator } from "@/components/assistant/request/link-simulator"
import { Chip, CopyReference, DemoBanner, formatDate, reasonLabel } from "@/components/assistant/request/request-parts"
import { useDemoRequests } from "@/components/assistant/request/use-demo-requests"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { departmentsOf, lineReference, outcomeSentence, type RequestLine } from "@/lib/assistant/request/record"

/** A submitted request: its reference, every line's `/n`, and a SAP link simulator. */
export function RequestSummary({ requestId }: { requestId: string }) {
  const requests = useDemoRequests()
  if (requests === null) return <Skeleton className="h-64 w-full rounded-2xl" />

  const request = requests.find((r) => r.requestId === requestId.toUpperCase())
  if (!request) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-foreground">Request {requestId} was not found in this browser.</p>
        <p className="text-xs text-muted-foreground">
          Demo requests are kept in the browser that made them. Clearing site data removes them.
        </p>
        <Link href="/assistant/requests/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Start a new request
        </Link>
      </div>
    )
  }

  // Requests saved before plant moved to the header carry none; the lines know it.
  const plant = request.plant ?? request.lines[0]?.material.plant ?? "—"
  const departments = departmentsOf(request)
  const procured = request.lines.filter(
    (l) =>
      (l.outcome.flow === "i13" && l.outcome.decision === "proceed") ||
      (l.outcome.flow === "i08" && l.outcome.decision === "proceed_new")
  )

  return (
    <div className="flex flex-col gap-5">
      <DemoBanner>This request is held in this browser only. The reference cannot link to a real reservation.</DemoBanner>

      <section className="ai-glow animate-ai-message-in flex flex-col gap-4 rounded-2xl border border-ai-2/20 bg-card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <AiIconBadge className="hidden sm:inline-flex">
            <Link2 className="size-4" />
          </AiIconBadge>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Your request reference
            </span>
            <CopyReference value={request.requestId} size="lg" />
            <span className="text-xs text-muted-foreground">
              {request.requester} · plant {plant} ·{" "}
              {departments.length === 0
                ? "no department"
                : `${departments.length} department${departments.length === 1 ? "" : "s"} (${departments.join(", ")})`}{" "}
              · {new Date(request.issuedAt).toLocaleString("en-GB")}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-center">
            <Stat term="Lines" value={request.lines.length} />
            <Stat term="To reserve" value={procured.length} />
            <Stat term="No session" value={request.skipped.length} />
          </dl>
        </div>
        <div className="flex gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            On each SAP reservation item, type that line&rsquo;s reference into the item text (SGTXT), e.g.{" "}
            <span className="font-mono text-foreground">{lineReference(request.requestId, 1)}</span>. The{" "}
            <span className="font-mono">/n</span> helps a reader, but the link is made by request + material +
            plant, so a missing or wrong <span className="font-mono">/n</span> still links -- with a warning.
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <AiEyebrow>Lines</AiEyebrow>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Reference for SGTXT</th>
                <th className="px-3 py-2 font-medium">Material</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Decision</th>
                <th className="px-3 py-2 font-medium">Window · purpose</th>
                <th className="px-3 py-2 font-medium">Reason given</th>
                <th className="px-3 py-2 font-medium">SAP link</th>
              </tr>
            </thead>
            <tbody>
              {request.lines.map((line) => (
                <LineRow key={line.lineNo} requestId={request.requestId} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {request.skipped.length > 0 && (
        <section className="flex flex-col gap-3">
          <AiEyebrow>No session -- reserve as usual</AiEyebrow>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {request.skipped.map((s) => (
              <li key={`${s.materialId}-${s.plant}`} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                <CircleSlash className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                <span className="font-mono text-xs font-semibold">{s.materialId}</span>
                <span className="min-w-0 flex-1">
                  {s.description ?? "Unknown material"}{" "}
                  <span className="text-[11px] text-muted-foreground">Plant {s.plant}</span>
                  <span className="block text-xs text-muted-foreground">{s.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LinkSimulator request={request} />

      <div className="flex flex-wrap gap-2">
        <Link href="/assistant/requests/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          New request
        </Link>
        <Link href="/assistant/requests" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          All requests
        </Link>
      </div>
    </div>
  )
}

function Stat({ term, value }: { term: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dd className="text-xl font-semibold text-foreground">{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{term}</dt>
    </div>
  )
}

function LineRow({ requestId, line }: { requestId: string; line: RequestLine }) {
  const o = line.outcome
  const declined =
    (o.flow === "i13" && o.decision === "not_needed") || (o.flow === "i08" && o.decision === "use_existing")
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <CopyReference value={lineReference(requestId, line.lineNo)} />
          <span className="text-[11px] text-muted-foreground" title="The line's own session, as the backend records it">
            session <span className="font-mono">{line.sessionId}</span>
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {o.flow === "i13" ? (
              <Boxes className="size-3.5 text-ai-2" aria-label="OAR" />
            ) : (
              <Wrench className="size-3.5 text-ai-2" aria-label="Repairable" />
            )}
            <span className="font-mono text-xs font-semibold">{line.material.materialId}</span>
          </span>
          <span>{line.material.description}</span>
          <span className="text-[11px] text-muted-foreground">Plant {line.material.plant}</span>
        </div>
      </td>
      <td className="px-3 py-3 font-mono text-sm">
        {line.department ?? <span className="font-sans text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          {o.flow === "i13" && o.decision === "proceed" && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-base font-bold">{o.quantity}</span>
              <span className="text-[11px] text-muted-foreground">
                suggested {o.suggestion.quantity ?? "—"}
              </span>
            </span>
          )}
          <span className={declined ? "text-muted-foreground" : "text-foreground"}>{outcomeSentence(o)}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs">
        {o.flow === "i13" && o.decision === "proceed" ? (
          <div className="flex flex-col gap-0.5">
            <span>
              {formatDate(o.windowStart)} – {formatDate(o.windowEnd)}
            </span>
            <span className="text-muted-foreground">{o.purpose}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {o.justification ? (
          <div className="flex flex-col gap-0.5">
            <Chip tone="warn">{reasonLabel(o.justification.reasonCategory)}</Chip>
            <span className="text-muted-foreground">{o.justification.freeText}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {line.links.length === 0 ? (
          <Chip tone="muted">Not linked yet</Chip>
        ) : (
          <ul className="flex flex-col gap-1">
            {line.links.map((link, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <Chip tone={link.status === "LINKED" ? "ready" : "warn"}>
                  {link.reservationNumber}/{link.reservationItem}
                </Chip>
                <span className="text-[11px] text-muted-foreground">
                  SGTXT &ldquo;<span className="font-mono">{link.sgtxt}</span>&rdquo;
                  {link.status === "LINKED_WITH_WARNING" && <> · {link.note}</>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}
