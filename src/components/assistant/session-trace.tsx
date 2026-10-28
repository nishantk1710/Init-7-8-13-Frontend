import Link from "next/link"
import { ChevronLeft, Info, Link2, TriangleAlert } from "lucide-react"

import { AssessmentCard, AssessmentCaveats } from "@/components/assistant/assessment-card"
import { OutcomeChip, TonePill } from "@/components/assistant/session-chips"
import { Chip, CopyReferenceButton } from "@/components/assistant/request/request-parts"
import { UatReservationTools } from "@/components/assistant/uat-reservation-tools"
import type { ApiPlan, ApiQuantitySuggestion, SessionTraceResponse } from "@/lib/api/assistant"
import { factsCaveats, factsHeadline, isI08Facts } from "@/lib/api/assistant-facts"
import { flowLabel } from "@/lib/assistant/flow-labels"
import { needDateAdviceOf } from "@/lib/assistant/i08-facts-format"
import { departmentText } from "@/lib/assistant/request/record"
import {
  JOB_LABELS,
  linkedInSapView,
  type JobMovementRow,
  type SessionJobView,
} from "@/lib/assistant/session-job"
import { sessionOutcome, wentAheadSessionIds } from "@/lib/assistant/session-outcome"
import {
  declarationViews,
  declaredState,
  formatQuantity,
  i08RepairRows,
  i08RequestRows,
  i08ShownFigures,
  personLabel,
  readableText,
  readableTurns,
  reasonViews,
  referenceInstruction,
  sessionDecision,
  type DeclarationView,
  type ReadableTurn,
  type ReasonView,
  type ShownFigure,
} from "@/lib/assistant/session-view"
import { formatInstant, formatWindow, planStatusLabel, sessionIdentity } from "@/lib/assistant/trace-format"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn } from "@/lib/utils"

/**
 * One session and everything it produced, for both initiatives.
 *
 * Five parts, top to bottom: the reference with ONE instruction for SAP; a
 * summary of who, what and the decision; what the assistant showed; what was
 * decided (the conversation in words, then the reason and the declaration
 * recorded); and what SAP has linked so far.
 *
 * ## The advice is replayed, not recomputed
 *
 * `assessment` is what was stored when the session was minted, shown as it
 * was served. Recomputing it would answer a different question: the register
 * and the stock both move, and the value of this record is that it does not.
 *
 * ## Words, not codes
 *
 * Every code on the wire (a choice value, a reason category, a quantity with
 * SAP's padding, the placeholder actor) is read through
 * `lib/assistant/session-view`, which is tested. The download still carries
 * the record as stored.
 */
export function SessionTrace({
  trace,
  job = null,
}: {
  trace: SessionTraceResponse
  /** The job behind a repairable session; null for OAR or when it could not be read. */
  job?: SessionJobView | null
}) {
  const identity = sessionIdentity(trace)
  const reference = referenceInstruction(identity)
  const typedName = trace.requestedFor
  const suggestion = trace.quantitySuggestions[0]
  const pairs = readableTurns(trace.turns, {
    suggestedQuantity: suggestion?.suggestedQuantity ?? null,
    requestedQuantity: suggestion?.requestedQuantity ?? null,
  })
  const reasons = reasonViews(trace.justifications, typedName)
  const declarations = trace.flow === "i08" ? declarationViews(trace) : []
  const linked = linkedInSapView({
    flow: trace.flow,
    sessionId: trace.sessionId,
    linked: trace.linkedReservations,
    job,
  })

  return (
    <div className="flex flex-col gap-6">
      <ReferenceBox trace={trace} reference={reference} />
      <Summary trace={trace} />

      <Part
        title="What the assistant showed"
        note={`As shown on ${formatInstant(trace.issuedAt)}. Replayed from the record, not recomputed: stock and repairs have moved since.`}
      >
        {trace.flow === "i08" && isI08Facts(trace.assessment) ? (
          <I08Shown facts={trace.assessment} />
        ) : (
          <div className="flex flex-col gap-2">
            <AssessmentCard facts={trace.assessment} />
            <AssessmentCaveats facts={trace.assessment} />
          </div>
        )}
        {/* Off by default; labelled wherever it does appear. */}
        {trace.narrative && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">Generated narrative</p>
            <p className="mt-1 text-sm text-foreground">{trace.narrative}</p>
          </div>
        )}
      </Part>

      <Part
        title="What was decided"
        note={answeredBy(trace, typedName)}
      >
        <Conversation pairs={pairs} />
        {trace.plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} typedName={typedName} />
        ))}
        {trace.quantitySuggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
        {(reasons.length > 0 || declarations.length > 0) && (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {reasons.map((r) => (
              <ReasonCard key={r.key} reason={r} />
            ))}
            {declarations.map((d) => (
              <DeclarationCard key={d.key} declaration={d} />
            ))}
          </div>
        )}
      </Part>

      <Part title="Linked in SAP">
        <LinkedPanel view={linked} reference={reference.value} sessionId={trace.sessionId} />
      </Part>
    </div>
  )
}

/** "Answered by SSJ on 27 Oct 2026, 13:04.", or nothing when no question was answered. */
function answeredBy(trace: SessionTraceResponse, typedName: string | null): string | undefined {
  const first = trace.turns.find((t) => t.answer !== null)
  if (!first) return undefined
  return `Answered by ${personLabel(first.actor, typedName)} on ${formatInstant(first.answeredAt)}.`
}

// --- 1. the reference ---------------------------------------------------------

function ReferenceBox({
  trace,
  reference,
}: {
  trace: SessionTraceResponse
  reference: ReturnType<typeof referenceInstruction>
}) {
  const outcome = sessionOutcome(trace, new Set(wentAheadSessionIds(trace.justifications)))
  const requestId = reference.kind === "request" ? reference.value : null
  return (
    <section
      aria-label={reference.title}
      className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-[11rem_1fr]"
    >
      <div className="flex flex-col justify-center gap-0.5 border-b border-dashed border-border px-5 py-4 sm:border-r sm:border-b-0">
        <span className="text-sm text-muted-foreground">{reference.title}</span>
        <span className="text-sm font-semibold text-foreground">Type this in SAP</span>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="font-mono text-3xl font-semibold tracking-[0.18em] break-all text-foreground select-all">
            {reference.value}
          </span>
          <span className="max-w-2xl text-sm text-muted-foreground">{reference.instruction}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <OutcomeChip outcome={outcome} />
            <span>Issued {formatInstant(trace.issuedAt)}</span>
            {requestId && reference.line && (
              <span>
                This session is line{" "}
                <Link
                  href={`/assistant/requests/${requestId}`}
                  className="font-mono font-semibold text-action underline-offset-4 hover:underline"
                  title="Open the request this line belongs to"
                >
                  {reference.line}
                </Link>
              </span>
            )}
            {/* Reported, never enforced: the reservation is already in SAP. */}
            <span>
              {trace.expired
                ? "Past its validity window, still worth quoting"
                : `Valid until ${formatInstant(trace.expiresAt)}`}
            </span>
          </span>
        </div>
        <CopyReferenceButton value={reference.value} hint={reference.instruction} />
      </div>
    </section>
  )
}

// --- 2. the summary -----------------------------------------------------------

function Summary({ trace }: { trace: SessionTraceResponse }) {
  const decision = sessionDecision(trace)
  const declared = trace.flow === "i08" ? declaredState(trace) : null
  return (
    <section aria-label="Summary" className="overflow-hidden rounded-xl border border-border bg-card">
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Material">
          <span className="flex flex-col">
            {trace.materialDescription && (
              <span className="font-semibold text-foreground">{trace.materialDescription}</span>
            )}
            <span className={cn("font-mono", trace.materialDescription ? "text-xs text-muted-foreground" : "font-semibold")}>
              {trace.materialId}
            </span>
          </span>
        </Fact>
        <Fact label="Plant">{sapPlantLabel(trace.plant)}</Fact>
        <Fact label="Requester">
          {/* A session opened from SAP carries no name: say so rather than leave a blank. */}
          {trace.requestedFor ?? <span className="text-muted-foreground">Not stated</span>}
        </Fact>
        <Fact label="Department">
          {trace.department ? (
            departmentText(trace.department, trace.departmentName)
          ) : (
            <span className="text-muted-foreground">Not stated</span>
          )}
          {trace.departmentNote && (
            <span className="block text-xs font-normal text-muted-foreground">{trace.departmentNote}</span>
          )}
        </Fact>
        <Fact label="Decision">
          <TonePill tone={decision.tone}>{decision.text}</TonePill>
        </Fact>
        {declared && (
          <Fact label="Faulty unit declared">
            <span className={cn(declared.state !== "yes" && "text-muted-foreground")}>{declared.text}</span>
          </Fact>
        )}
        {/* Older sessions carry the quantity the entry point used to ask for. */}
        {trace.requestedQuantity !== null && (
          <Fact label="Quantity asked for">{formatQuantity(trace.requestedQuantity)}</Fact>
        )}
      </dl>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
        <Chip tone={trace.flow === "i13" ? "muted" : "warn"}>{flowLabel(trace.flow)}</Chip>
        <span>{readableText(trace.routingReason)}</span>
        <span aria-hidden>·</span>
        <span>Opened from {trace.origin === "BADI" ? "SAP" : "the platform"}</span>
      </p>
    </section>
  )
}

// --- 3. what the assistant showed (I08) ---------------------------------------

function I08Shown({ facts }: { facts: unknown }) {
  const headline = factsHeadline(facts)
  const figures = i08ShownFigures(facts)
  const repairs = i08RepairRows(facts)
  const requests = i08RequestRows(facts)
  const needDate = needDateAdviceOf(facts)
  const caveats = factsCaveats(facts)
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      {headline && <p className="text-sm text-foreground">{readableText(headline)}</p>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {figures.map((figure) => (
          <Figure key={figure.key} figure={figure} />
        ))}
      </dl>
      {needDate && (
        <p className="flex items-start gap-2 rounded-lg border border-action/25 bg-action/5 px-3 py-2.5 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-action" aria-hidden />
          {readableText(needDate)}
        </p>
      )}
      {repairs.length > 0 && (
        <ShownList
          title="Open repair POs"
          columns={["Repair PO", "Vendor", "Quantity", "Due back", ""]}
          rows={repairs.map((r) => ({
            key: r.key,
            cells: [
              <span key="ref" className="font-mono font-semibold text-foreground">
                {r.reference}
              </span>,
              r.vendor,
              r.quantity,
              r.due,
              r.late ? (
                <Chip key="late" tone="bad">
                  {r.late}
                </Chip>
              ) : (
                ""
              ),
            ],
          }))}
        />
      )}
      {requests.length > 0 && (
        <ShownList
          title="Repairs requested, no PO yet"
          columns={["Request", "Department", "Quantity", "Requested"]}
          rows={requests.map((r) => ({
            key: r.key,
            cells: [
              <span key="ref" className="font-mono font-semibold text-foreground">
                {r.reference}
              </span>,
              r.department,
              r.quantity,
              r.age,
            ],
          }))}
        />
      )}
      {caveats.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {caveats.map((caveat) => (
            <li key={caveat} className="text-xs text-muted-foreground">
              {readableText(caveat)}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Figure({ figure }: { figure: ShownFigure }) {
  const warn = figure.tone === "warning"
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border p-3",
        warn ? "border-warning/40 bg-warning/5" : "border-border bg-muted/30"
      )}
    >
      <dt className="text-xs text-muted-foreground">{figure.label}</dt>
      <dd
        className={cn(
          figure.value === null
            ? "text-sm font-semibold text-muted-foreground"
            : "text-2xl leading-tight font-semibold tracking-tight text-foreground tabular-nums"
        )}
      >
        {figure.value ?? figure.empty}
      </dd>
      {figure.note && (
        <span className={cn("text-xs", warn ? "font-medium text-warning" : "text-muted-foreground")}>{figure.note}</span>
      )}
    </div>
  )
}

function ShownList({
  title,
  columns,
  rows,
}: {
  title: string
  columns: string[]
  rows: { key: string; cells: React.ReactNode[] }[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-foreground">
        {title} <span className="font-normal text-muted-foreground">({rows.length})</span>
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              {columns.map((column, i) => (
                <th key={`${column}-${i}`} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-3 py-2 align-top text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- 4. what was decided --------------------------------------------------------

function Conversation({ pairs }: { pairs: ReadableTurn[] }) {
  if (pairs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        The advice was shown, but nothing was answered. That is recorded too: it counts as advice given, not acted on.
      </p>
    )
  }
  const asked = pairs.filter((p) => !p.closing)
  const closing = pairs.find((p) => p.closing && p.question)
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {asked.map((pair) => (
        <li key={pair.key} className="grid gap-1.5 px-5 py-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
          <p className="text-sm text-muted-foreground">{pair.question}</p>
          <Answer answer={pair.answer} />
        </li>
      ))}
      {closing && (
        <li className="flex flex-col gap-1 bg-muted/30 px-5 py-3.5">
          <p className="text-xs font-semibold text-muted-foreground">The assistant closed with</p>
          <p className="text-sm whitespace-pre-line text-foreground">{closing.question}</p>
        </li>
      )}
    </ol>
  )
}

function Answer({ answer }: { answer: ReadableTurn["answer"] }) {
  if (answer === null) return <p className="text-sm text-muted-foreground italic">Not answered</p>
  if (answer.kind === "choice") return <p className="text-sm font-semibold text-foreground">{answer.text}</p>
  if (answer.rows.length === 0) return <p className="text-sm text-muted-foreground italic">Submitted empty</p>
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {answer.rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-semibold break-words text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function RecordCard({
  title,
  badge,
  edge,
  children,
  footer,
}: {
  title: string
  badge?: React.ReactNode
  edge: "warning" | "action" | "muted"
  children: React.ReactNode
  footer: string
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card py-4 pr-5 pl-6",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        edge === "warning" && "before:bg-warning",
        edge === "action" && "before:bg-action",
        edge === "muted" && "before:bg-muted-foreground/40"
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge}
      </header>
      {children}
      <p className="text-xs text-muted-foreground">{footer}</p>
    </article>
  )
}

function ReasonCard({ reason }: { reason: ReasonView }) {
  return (
    <RecordCard
      title="Reason recorded"
      edge="warning"
      badge={<Chip tone="warn">{reason.reason}</Chip>}
      footer={`${reason.heading} · by ${reason.by} · ${formatInstant(reason.recordedAt)}`}
    >
      <blockquote className="border-l-2 border-border pl-3 text-sm whitespace-pre-line text-foreground">
        {reason.text}
      </blockquote>
    </RecordCard>
  )
}

function DeclarationCard({ declaration: d }: { declaration: DeclarationView }) {
  return (
    <RecordCard
      title="Declaration recorded"
      edge="action"
      badge={<Chip tone={d.assessment === "Repairable" ? "ready" : "muted"}>{d.assessment}</Chip>}
      footer={d.recordedAt ? `Recorded ${formatInstant(d.recordedAt)}` : "Recorded in this visit"}
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact label="Condition" wide>
          {d.condition || <span className="text-muted-foreground">Not described</span>}
        </Fact>
        <Fact label="Fault">{d.fault}</Fact>
        <Fact label="Quantity">{d.quantity}</Fact>
        <Fact label="Typed name">{d.name}</Fact>
        <Fact label="Evidence">{d.evidence ?? <span className="text-muted-foreground">None given</span>}</Fact>
        {d.repairLine && <Fact label="Repair line">{d.repairLine}</Fact>}
      </dl>
    </RecordCard>
  )
}

function PlanCard({ plan, typedName }: { plan: ApiPlan; typedName: string | null }) {
  return (
    <RecordCard
      title="Plan recorded"
      edge="action"
      badge={<Chip tone="muted">{planStatusLabel(plan.status)}</Chip>}
      footer={`By ${personLabel(plan.capturedBy, typedName)} · ${formatInstant(plan.capturedAt)}`}
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Fact label="What it is for" wide>
          {plan.purpose}
        </Fact>
        <Fact label="Planned quantity">{formatQuantity(plan.plannedQuantity)}</Fact>
        <Fact label="Expected use">
          {formatWindow(plan.windowStart, plan.windowEnd) ?? <span className="text-muted-foreground">No window given</span>}
        </Fact>
      </dl>
    </RecordCard>
  )
}

function SuggestionCard({ suggestion: s }: { suggestion: ApiQuantitySuggestion }) {
  return (
    <RecordCard
      title="Quantity suggestion"
      edge={s.isOverride ? "warning" : "muted"}
      badge={s.isOverride ? <Chip tone="warn">Kept their own quantity</Chip> : undefined}
      // The three parameters behind the number are configuration, none confirmed
      // by VZI, so they travel with every suggestion.
      footer={`Worked out with a ${formatQuantity(s.coverCeilingMonths)}-month cover ceiling, a ${s.lookbackMonths}-month look-back and at least ${s.minHistoryConsumptions} consumptions (${s.consumptionCount} found). All three are settings, not yet confirmed by VZI.`}
    >
      <p className="text-sm text-foreground">{readableText(s.suggestionReason)}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact label="Asked for">{formatQuantity(s.requestedQuantity)}</Fact>
        <Fact label="Suggested">
          {/* Null is not zero: "we suggest nothing" and "we suggest none" differ. */}
          {s.suggestedQuantity === null ? (
            <span className="text-muted-foreground">No suggestion made</span>
          ) : (
            formatQuantity(s.suggestedQuantity)
          )}
        </Fact>
        <Fact label="Recorded as">{formatQuantity(s.acceptedQuantity)}</Fact>
        <Fact label="Months of cover">
          {s.monthsOfCover === null ? (
            <span className="text-muted-foreground">Not computable</span>
          ) : (
            formatQuantity(s.monthsOfCover)
          )}
        </Fact>
      </dl>
    </RecordCard>
  )
}

// --- 5. linked in SAP ---------------------------------------------------------

function LinkedPanel({
  view,
  reference,
  sessionId,
}: {
  view: ReturnType<typeof linkedInSapView>
  reference: string
  sessionId: string
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      {!view.linked ? (
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Link2 className="size-4" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-foreground">Not linked yet</p>
            <p className="text-sm text-muted-foreground">
              The link appears here once a SAP reservation carrying{" "}
              <span className="font-mono font-semibold text-foreground">{reference}</span> reaches the platform.
            </p>
          </div>
        </div>
      ) : (
        <>
          {view.reservations.length > 0 && (
            <ul className="flex flex-col gap-3">
              {view.reservations.map((r) => (
                <li key={r.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-muted-foreground">Reservation</span>
                    {r.href ? (
                      <Link href={r.href} className="font-mono text-sm font-semibold text-action underline-offset-4 hover:underline">
                        {r.reference}
                      </Link>
                    ) : (
                      <span className="font-mono text-sm font-semibold text-foreground">{r.reference}</span>
                    )}
                    {r.order && <span className="text-xs text-muted-foreground">Order {r.order}</span>}
                    {r.needed && <span className="text-xs text-muted-foreground">{r.needed}</span>}
                    {r.fromUat && (
                      <Chip tone="muted" title="Linked through the UAT test panel, not read from SAP">
                        UAT
                      </Chip>
                    )}
                  </div>
                  {r.issued !== null && r.returned !== null && (
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      <Fact label={JOB_LABELS.issued}>
                        <Movements rows={r.issued} />
                      </Fact>
                      <Fact label={JOB_LABELS.returned} hint={JOB_LABELS.returnedNote}>
                        <Movements rows={r.returned} />
                      </Fact>
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
          {view.repairs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{JOB_LABELS.repairs}</p>
              <ul className="flex flex-col gap-1.5">
                {view.repairs.map((r) => (
                  <li key={r.rowId} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={r.href} className="font-mono font-semibold text-action underline-offset-4 hover:underline">
                      {r.label}
                    </Link>
                    <Chip tone="muted">{r.status}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {/* UAT only: renders nothing unless the backend's test stand-in is on. */}
      <UatReservationTools sessionId={sessionId} sapText={reference} />
    </section>
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

// --- pieces -------------------------------------------------------------------

function Part({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Fact({
  label,
  hint,
  wide,
  children,
}: {
  label: string
  hint?: string
  /** Spans the whole row of its grid. */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", wide && "sm:col-span-full")}>
      <dt className="text-xs text-muted-foreground" title={hint}>
        {label}
      </dt>
      <dd className="text-sm font-medium break-words text-foreground">{children}</dd>
    </div>
  )
}

/** Back to the log, for a session opened directly by reference. */
export function BackToSessions() {
  return (
    <Link
      href="/assistant/sessions"
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft aria-hidden className="size-4" />
      All sessions
    </Link>
  )
}

/** Shown in place of the record when the backend could not be read. */
export function SessionLoadError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="text-sm text-foreground">This session could not be loaded.</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
