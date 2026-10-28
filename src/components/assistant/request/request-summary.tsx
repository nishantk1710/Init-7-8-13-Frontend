"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CircleSlash, FlaskConical, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { NotEnabledNotice } from "@/components/assistant/request/request-builder"
import { downloadRequest } from "@/components/assistant/request/request-export"
import { Chip, CopyReferenceButton, formatDate, reasonLabel } from "@/components/assistant/request/request-parts"
import { useRequest } from "@/components/assistant/request/use-requests"
import { DownloadMenu } from "@/components/shared/download-menu"
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
import { departmentLabel, isDeclined, outcomeSentence } from "@/lib/assistant/request/record"
import { cn } from "@/lib/utils"

/**
 * A submitted request: the reference to type into SAP, every line's `R…/n`, and
 * what SAP has linked so far. A request is one SAP reservation: the bare `R…`
 * goes into its header text, and SAP copies that to every item. The `/n` is how
 * a line is quoted here; linking tells the lines apart by material and plant.
 */
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

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Request reference"
        className="grid overflow-hidden rounded-card border border-line bg-card sm:grid-cols-[11rem_1fr]"
      >
        <div className="flex flex-col justify-center gap-0.5 border-b border-dashed border-line px-5 py-4 sm:border-r sm:border-b-0">
          <span className="text-sm text-muted-foreground">Request reference</span>
          <span className="text-sm font-bold text-foreground">Type this in SAP</span>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-mono text-3xl font-bold tracking-[0.18em] break-all text-foreground select-all">
              {request.requestId}
            </span>
            <span className="max-w-xl text-sm text-muted-foreground">
              Create one reservation for this request and type this reference into its header text. SAP copies it to
              every item&rsquo;s text (SGTXT). Do not add /1, /2.
            </span>
          </div>
          <CopyReferenceButton value={request.requestId} />
        </div>
      </section>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Plant</dt>
          <dd className="font-mono font-bold text-foreground">{request.plant}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Department</dt>
          <dd className="font-semibold text-foreground">{departmentLabel(request)}</dd>
        </div>
        {request.departmentNote && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Department note</dt>
            <dd className="font-semibold text-foreground">{request.departmentNote}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Requester</dt>
          <dd className="font-semibold text-foreground">{request.requestedFor || request.requester}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Recorded</dt>
          <dd className="font-semibold text-foreground">
            {new Date(request.issuedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Lines</h2>
          <span className="text-xs text-muted-foreground">
            Each SAP item is matched to its line by material and plant.
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {request.lines.map((line) => (
            <li key={line.lineNo}>
              <LineCard line={line} />
            </li>
          ))}
        </ul>
      </section>

      {request.skipped.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">No session — reserve as usual</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-card">
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

      <LiveLinks request={request} onSimulated={reload} />

      <div className="flex flex-wrap items-center gap-2 [&_[data-slot=button]]:min-h-11">
        <DownloadMenu onDownload={(format) => downloadRequest(request, format)} />
        <Link href="/assistant/requests/new" className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4 font-semibold")}>
          New request
        </Link>
        <Link
          href="/assistant/requests"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 px-4 font-semibold")}
        >
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
      toast.success("Simulated SAP reservation created", { description: "Its items carry the request reference." })
      onSimulated()
    } catch (error) {
      toast.error("Could not simulate", {
        description: error instanceof ApiError ? error.detailText() : "The backend did not answer.",
      })
    }
    setBusy(false)
  }

  return (
    <section className="flex flex-col gap-2 rounded-card border border-dashed border-line bg-card p-4 text-sm text-muted-foreground">
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
          <span>UAT only: stands in for the requester typing the request reference into SAP.</span>
        </div>
      )}
    </section>
  )
}

function plain(value: string | null): string {
  if (value === null) return "—"
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

type Tone = "action" | "healthy" | "caution" | "muted"

const EDGE: Record<Tone, string> = {
  action: "before:bg-action",
  healthy: "before:bg-success",
  caution: "before:bg-warning",
  muted: "before:bg-muted-foreground/40",
}

const PILL: Record<Tone, string> = {
  action: "bg-action/10 text-action",
  healthy: "bg-success/10 text-success",
  caution: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
}

/**
 * The decision in a few words, with a pill saying how it relates to the advice.
 * Read only from the line's recorded fields -- the full sentence is underneath.
 */
function decisionOf(line: ApiRequestLine): { headline: string; pill: string; tone: Tone } {
  if (line.flow === "i08") {
    if (line.decision === "use_existing") return { headline: "Used the existing unit", pill: "No new unit needed", tone: "healthy" }
    return line.justification
      ? { headline: "New unit", pill: "Justified", tone: "caution" }
      : { headline: "New unit", pill: "None in stock", tone: "action" }
  }
  if (line.decision === "not_needed") return { headline: "Not needed", pill: "Nothing reserved", tone: "muted" }
  const headline = `Procure ${plain(line.plannedQuantity)}`
  if (line.suggestedQuantity === null) return { headline, pill: "No suggestion possible", tone: "caution" }
  const planned = Number(line.plannedQuantity)
  const suggested = Number(line.suggestedQuantity)
  if (planned === suggested) return { headline, pill: "Suggested quantity", tone: "action" }
  return {
    headline,
    pill: planned < suggested ? `Below the suggested ${plain(line.suggestedQuantity)}` : `Above the suggested ${plain(line.suggestedQuantity)}`,
    tone: "caution",
  }
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL[tone])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/** One line of the request as a card: what it is, what was decided, and whether SAP has linked it. */
function LineCard({ line }: { line: ApiRequestLine }) {
  const procured = line.flow === "i13" && line.decision === "proceed"
  const decision = decisionOf(line)
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-card before:absolute before:inset-y-0 before:left-0 before:w-1",
        EDGE[decision.tone]
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 pr-4 pl-5">
        <Link
          href={`/assistant/sessions/${line.sessionId}`}
          className="font-mono text-sm font-bold tracking-wider text-action hover:underline"
          title="Open this line's full conversation record"
        >
          {line.reference}
        </Link>
        <span className="font-mono text-sm font-semibold text-foreground">{line.materialId}</span>
        <span className="min-w-0 text-sm text-foreground">
          {line.materialDescription ?? <span className="text-muted-foreground italic">No description</span>}
        </span>
        <span className="text-xs text-muted-foreground">Plant {line.plant}</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Chip tone={line.flow === "i13" ? "muted" : "warn"}>{line.flow === "i13" ? "OAR" : "Repairable"}</Chip>
          {line.linkedReservations.length === 0 ? (
            <Chip tone="muted">Not linked yet</Chip>
          ) : (
            line.linkedReservations.map((link) => (
              <Chip
                key={`${link.reservationNumber}-${link.reservationItem}`}
                tone={link.note ? "warn" : "ready"}
                title={`SGTXT "${link.sgtxt}"${link.note ? ` · ${link.note}` : ""}`}
              >
                SAP {link.reservationNumber}/{link.reservationItem}
              </Chip>
            ))
          )}
        </span>
      </header>
      <div className="grid gap-5 py-4 pr-4 pl-5 md:grid-cols-3">
        <Field label="Decision">
          <span className={cn("text-2xl font-extrabold tracking-tight", isDeclined(line) && decision.tone === "muted" ? "text-muted-foreground" : "text-foreground")}>
            {decision.headline}
          </span>
          <Pill tone={decision.tone}>{decision.pill}</Pill>
          <span className="text-sm text-muted-foreground">{outcomeSentence(line)}</span>
        </Field>
        <Field label="Window and purpose">
          {procured ? (
            <>
              <span className="text-sm font-semibold text-foreground">
                {formatDate(line.windowStart)} – {formatDate(line.windowEnd)}
              </span>
              <span className="text-sm text-muted-foreground">{line.purpose}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Not asked for this line</span>
          )}
        </Field>
        <Field label="Reason given">
          {line.justification ? (
            <>
              <Chip tone="warn">{reasonLabel(line.justification.reasonCategory)}</Chip>
              <span className="text-sm text-muted-foreground">{line.justification.freeText}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">None given</span>
          )}
        </Field>
      </div>
    </article>
  )
}
