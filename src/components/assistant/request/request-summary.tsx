"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Boxes, CircleSlash, FlaskConical, Info, Link2, Loader2, Wrench } from "lucide-react"
import { toast } from "sonner"

import { AiEyebrow, AiIconBadge } from "@/components/assistant/ai-visuals"
import { NotEnabledNotice } from "@/components/assistant/request/request-builder"
import { RequestDownloadMenu } from "@/components/assistant/request/request-download-menu"
import { LinkSimulator } from "@/components/assistant/request/link-simulator"
import { Chip, CopyReference, DemoBanner, formatDate, reasonLabel } from "@/components/assistant/request/request-parts"
import { useRequest } from "@/components/assistant/request/use-requests"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  isNotEnabled,
  simulateRequestReservation,
  uatEnabled,
  type ApiRequest,
  type ApiRequestLine,
} from "@/lib/api/assistant-requests"
import { ApiError } from "@/lib/api/client"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"
import { isDeclined, lineReference, outcomeSentence } from "@/lib/assistant/request/record"

/** A submitted request: its reference, every line's `/n`, and what SAP has linked so far. */
export function RequestSummary({ requestId }: { requestId: string }) {
  const { data: request, error, loading, reload } = useRequest(requestId)
  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />
  if (isNotEnabled(error)) return <NotEnabledNotice />
  if (!request) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-foreground">
          {error instanceof ApiError ? error.detailText() : `Request ${requestId} could not be loaded.`}
        </p>
        <Link href="/assistant/requests/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Start a new request
        </Link>
      </div>
    )
  }

  const toReserve = request.lines.filter((l) => !isDeclined(l))

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
              {request.requestedFor ?? "—"} · plant {request.plant} ·{" "}
              {request.departments.length === 0
                ? "no department"
                : `${request.departments.length} department${request.departments.length === 1 ? "" : "s"} (${request.departments.join(", ")})`}{" "}
              · {new Date(request.issuedAt).toLocaleString("en-GB")}
            </span>
          </div>
          <div className="flex flex-col items-end gap-3">
            <dl className="grid grid-cols-3 gap-4 text-center">
              <Stat term="Lines" value={request.lines.length} />
              <Stat term="To reserve" value={toReserve.length} />
              <Stat term="No session" value={request.skipped.length} />
            </dl>
            <RequestDownloadMenu request={request} />
          </div>
        </div>
        <div className="flex gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            On each SAP reservation item, type that line&rsquo;s reference into the item text (SGTXT), e.g.{" "}
            <span className="font-mono text-foreground">{lineReference(request.requestId, 1)}</span>. The{" "}
            <span className="font-mono">/n</span> helps a reader, but the link is made by request + material + plant,
            so a missing or wrong <span className="font-mono">/n</span> still links -- with a note.
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
                <LineRow key={line.lineNo} line={line} />
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
                  <span className="text-[11px] text-muted-foreground">Plant {s.plant}</span>
                  <span className="block text-xs text-muted-foreground">{s.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ASSISTANT_DEMO ? <LinkSimulator request={request} /> : <LiveLinks request={request} onSimulated={reload} />}

      <div className="flex flex-wrap gap-2">
        <RequestDownloadMenu request={request} />
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

/**
 * Live: links appear when a SAP extract carrying the references is loaded.
 * Where the backend's UAT stand-in is on (never in production), one button
 * simulates the request's reservation -- an item per line to be reserved.
 */
function LiveLinks({ request, onSimulated }: { request: ApiRequest; onSimulated: () => void }) {
  const [uat, setUat] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    uatEnabled().then(setUat)
  }, [])
  const linked = request.lines.reduce((n, l) => n + l.linkedReservations.length, 0)

  async function simulate() {
    setBusy(true)
    try {
      await simulateRequestReservation(request.requestId)
      toast.success("Simulated SAP reservation created", { description: "Its items carry each line's reference." })
      onSimulated()
    } catch (error) {
      toast.error("Could not simulate", {
        description: error instanceof ApiError ? error.detailText() : "The backend did not answer.",
      })
    }
    setBusy(false)
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card p-5 text-xs text-muted-foreground">
      <span>
        {linked === 0
          ? "No SAP reservation item carries these references yet. Links appear here once a SAP extract with the item texts is loaded."
          : `${linked} SAP reservation item${linked === 1 ? "" : "s"} linked so far.`}
      </span>
      {uat && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={simulate}>
            {busy ? <Loader2 className="animate-spin" /> : <FlaskConical />}
            Simulate SAP reservation (UAT)
          </Button>
          <span>UAT only: stands in for the requester typing each line&rsquo;s reference into SAP.</span>
        </div>
      )}
    </section>
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

function plain(value: string | null): string {
  if (value === null) return "—"
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

function LineRow({ line }: { line: ApiRequestLine }) {
  const declined = isDeclined(line)
  const procured = line.flow === "i13" && line.decision === "proceed"
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-3">
        <CopyReference value={line.reference} />
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {line.flow === "i13" ? (
              <Boxes className="size-3.5 text-ai-2" aria-label="OAR" />
            ) : (
              <Wrench className="size-3.5 text-ai-2" aria-label="Repairable" />
            )}
            <Link
              href={`/assistant/sessions/${line.sessionId}`}
              className="font-mono text-xs font-semibold hover:underline"
              title="Open this line's full conversation record"
            >
              {line.materialId}
            </Link>
          </span>
          <span>{line.materialDescription ?? <span className="text-muted-foreground italic">No description</span>}</span>
          <span className="text-[11px] text-muted-foreground">Plant {line.plant}</span>
        </div>
      </td>
      <td className="px-3 py-3 font-mono text-sm">
        {line.department ?? <span className="font-sans text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          {procured && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-base font-bold">{plain(line.plannedQuantity)}</span>
              <span className="text-[11px] text-muted-foreground">suggested {plain(line.suggestedQuantity)}</span>
            </span>
          )}
          <span className={declined ? "text-muted-foreground" : "text-foreground"}>{outcomeSentence(line)}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs">
        {procured ? (
          <div className="flex flex-col gap-0.5">
            <span>
              {formatDate(line.windowStart)} – {formatDate(line.windowEnd)}
            </span>
            <span className="text-muted-foreground">{line.purpose}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {line.justification ? (
          <div className="flex flex-col gap-0.5">
            <Chip tone="warn">{reasonLabel(line.justification.reasonCategory)}</Chip>
            <span className="text-muted-foreground">{line.justification.freeText}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {line.linkedReservations.length === 0 ? (
          <Chip tone="muted">Not linked yet</Chip>
        ) : (
          <ul className="flex flex-col gap-1">
            {line.linkedReservations.map((link) => (
              <li key={`${link.reservationNumber}-${link.reservationItem}`} className="flex flex-col gap-0.5">
                <Chip tone={link.note ? "warn" : "ready"}>
                  {link.reservationNumber}/{link.reservationItem}
                </Chip>
                <span className="text-[11px] text-muted-foreground">
                  SGTXT &ldquo;<span className="font-mono">{link.sgtxt}</span>&rdquo;
                  {link.note && <> · {link.note}</>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}
