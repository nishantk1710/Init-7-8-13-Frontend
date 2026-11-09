import Link from "next/link"
import { Check, ChevronDown, ChevronLeft, Info, TriangleAlert } from "lucide-react"

import { AssessmentCard, AssessmentCaveats } from "@/components/assistant/assessment-card"
import { OutcomeChip, TonePill } from "@/components/assistant/session-chips"
import { ExpandAllSteps } from "@/components/assistant/session-expand-all"
import { Chip, CopyReferenceButton } from "@/components/assistant/request/request-parts"
import { UatReservationTools } from "@/components/assistant/uat-reservation-tools"
import type { ApiPlan, ApiQuantitySuggestion, SessionTraceResponse } from "@/lib/api/assistant"
import { factsCaveats, factsHeadline, isI08Facts, isI13Facts } from "@/lib/api/assistant-facts"
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
 * A summary card first: the reference to type into SAP, the outcome, and who,
 * what and where. Then "How this session went": the session as numbered steps,
 * from opening to the SAP link, each opening to show its record (what the
 * assistant showed, the answers, the plan, the reservations linked). The step
 * still waiting on someone is open and marked.
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
  const firstAnswer = trace.turns.find((t) => t.answer !== null) ?? null
  const plan = trace.plans[0] ?? null
  const recorded = trace.plans.length > 0 || trace.quantitySuggestions.length > 0
  const choices = pairs.flatMap((p) => (p.answer?.kind === "choice" ? [p.answer.text] : []))
  const linkedCount = linked.reservations.length + linked.repairs.length
  // Step 4 is there only when something was recorded, so the numbers follow the steps shown.
  const linkStep = recorded ? 5 : 4

  return (
    <div className="flex flex-col gap-6">
      <SessionHero trace={trace} reference={reference} />

      <section aria-labelledby="session-steps-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="session-steps-title" className="text-base font-semibold text-foreground">
              How this session went
            </h2>
            <p className="text-xs text-muted-foreground">
              From the first screen to the SAP link. Replayed from the record of {formatInstant(trace.issuedAt)}, not
              recomputed: stock and repairs have moved since.
            </p>
          </div>
          <ExpandAllSteps targetId="session-steps" />
        </div>

        <ol id="session-steps" className="flex flex-col">
          <Step
            n={1}
            when={formatInstant(trace.issuedAt)}
            title={`Session opened from ${trace.origin === "BADI" ? "SAP" : "the platform"}`}
            state="done"
            chips={
              <>
                <Chip tone={trace.flow === "i13" ? "muted" : "warn"}>{flowLabel(trace.flow)}</Chip>
                <Chip tone="muted">Plant {trace.plant}</Chip>
              </>
            }
          >
            <p className="text-sm text-foreground">{readableText(trace.routingReason)}</p>
          </Step>

          <Step
            n={2}
            when={formatInstant(trace.issuedAt)}
            title={
              trace.flow === "i08" ? "The assistant showed the repair position" : "The assistant showed the stock position"
            }
            state="done"
            chips={<ShownChips facts={trace.assessment} />}
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
          </Step>

          <Step
            n={3}
            when={firstAnswer ? formatInstant(firstAnswer.answeredAt) : null}
            title={firstAnswer ? "Your answers" : "No answer given"}
            state={firstAnswer ? "done" : "idle"}
            status={firstAnswer ? undefined : trace.outcome === "ABANDONED" ? "Left" : "Not answered"}
            chips={
              firstAnswer ? (
                <>
                  {choices.slice(0, 3).map((c) => (
                    <Chip key={c} tone="ready">
                      {c}
                    </Chip>
                  ))}
                  {reasons.length > 0 && <Chip tone="warn">Reason recorded</Chip>}
                  {declarations.length > 0 && <Chip tone="muted">Declaration recorded</Chip>}
                </>
              ) : null
            }
          >
            {firstAnswer && (
              <p className="text-xs text-muted-foreground">
                Answered by {personLabel(firstAnswer.actor, typedName)} on {formatInstant(firstAnswer.answeredAt)}.
              </p>
            )}
            <Conversation pairs={pairs} />
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
          </Step>

          {recorded && (
            <Step
              n={4}
              when={plan ? formatInstant(plan.capturedAt) : null}
              title={plan ? "A plan was recorded" : "A quantity was suggested"}
              state="done"
              status={plan ? planStatusLabel(plan.status) : undefined}
              statusTone={plan ? "action" : undefined}
              chips={
                <>
                  {plan && <Chip tone="ready">{formatQuantity(plan.plannedQuantity)} recorded</Chip>}
                  <SuggestionChip suggestion={suggestion} />
                </>
              }
            >
              {trace.plans.map((p) => (
                <PlanCard key={p.id} plan={p} typedName={typedName} />
              ))}
              {trace.quantitySuggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
              ))}
            </Step>
          )}

          <Step
            n={linkStep}
            when={null}
            whenLabel={linked.linked ? undefined : "Waiting"}
            title="Linked in SAP"
            state={linked.linked ? "done" : "current"}
            status={linked.linked ? undefined : "Your turn"}
            defaultOpen={!linked.linked}
            last
            chips={
              linked.linked ? (
                <Chip tone="ready">
                  {linkedCount} {linkedCount === 1 ? "link" : "links"} in SAP
                </Chip>
              ) : (
                <>
                  <Chip tone="todo">Not linked yet</Chip>
                  <Chip tone="muted">Waiting for the SAP reservation</Chip>
                </>
              )
            }
          >
            <LinkedPanel view={linked} reference={reference} sessionId={trace.sessionId} />
          </Step>
        </ol>
      </section>
    </div>
  )
}

// --- the summary card ---------------------------------------------------------

function SessionHero({
  trace,
  reference,
}: {
  trace: SessionTraceResponse
  reference: ReturnType<typeof referenceInstruction>
}) {
  const outcome = sessionOutcome(trace, new Set(wentAheadSessionIds(trace.justifications)))
  const requestId = reference.kind === "request" ? reference.value : null
  const decision = sessionDecision(trace)
  const declared = trace.flow === "i08" ? declaredState(trace) : null
  const plan = trace.plans[0] ?? null
  const window = plan ? formatWindow(plan.windowStart, plan.windowEnd) : null
  return (
    <section
      aria-label="Session summary"
      className="flex flex-col gap-4 rounded-2xl border border-action/20 bg-action/5 p-4 sm:p-5"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-action/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-action uppercase">
                {reference.title} · Type this in SAP
              </span>
              <span className="font-mono text-3xl font-semibold tracking-[0.18em] break-all text-action select-all">
                {reference.value}
              </span>
            </div>
            <CopyReferenceButton value={reference.value} hint={reference.instruction} />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{reference.instruction}</p>
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeChip outcome={outcome} />
            <Chip tone="muted">Issued {formatInstant(trace.issuedAt)}</Chip>
            {requestId && reference.line && (
              <Link
                href={`/assistant/requests/${requestId}`}
                className="rounded-full border border-action/30 bg-action/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-action underline-offset-4 hover:underline"
                title="Open the request this line belongs to"
              >
                Line {reference.line}
              </Link>
            )}
          </div>
          {/* Reported, never enforced: the reservation is already in SAP. */}
          <p className="text-xs text-muted-foreground">
            {trace.expired
              ? "Past its validity window, still worth quoting."
              : `Valid until ${formatInstant(trace.expiresAt)}.`}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Outcome</span>
          <p className={cn("text-2xl leading-tight font-semibold", DECISION_INK[decision.tone])}>{decision.text}</p>
          {plan && <p className="text-sm font-semibold text-foreground">{plan.purpose}</p>}
          {window && <p className="text-sm text-muted-foreground">Use {window}</p>}
          {declared && (
            <p className={cn("text-sm", declared.state === "yes" ? "text-foreground" : "text-muted-foreground")}>
              Faulty unit declared: {declared.text}
            </p>
          )}
          {/* Older sessions carry the quantity the entry point used to ask for. */}
          {trace.requestedQuantity !== null && (
            <p className="text-sm text-muted-foreground">
              Quantity asked for: {formatQuantity(trace.requestedQuantity)}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <SuggestionChip suggestion={trace.quantitySuggestions[0]} />
          </div>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-3 px-1 sm:grid-cols-2 lg:grid-cols-4">
        <HeroFact label="Material">
          {trace.materialDescription && <span className="block font-semibold">{trace.materialDescription}</span>}
          <span
            className={cn("block font-mono", trace.materialDescription ? "text-xs text-muted-foreground" : "font-semibold")}
          >
            {trace.materialId}
          </span>
        </HeroFact>
        <HeroFact label="Plant">{sapPlantLabel(trace.plant)}</HeroFact>
        <HeroFact label="Requester">
          {/* A session opened from SAP carries no name: say so rather than leave a blank. */}
          {trace.requestedFor ?? <span className="text-muted-foreground">Not stated</span>}
        </HeroFact>
        <HeroFact label="Department">
          {trace.department ? (
            departmentText(trace.department, trace.departmentName)
          ) : (
            <span className="text-muted-foreground">Not stated</span>
          )}
          {trace.departmentNote && (
            <span className="block text-xs font-normal text-muted-foreground">{trace.departmentNote}</span>
          )}
        </HeroFact>
      </dl>
    </section>
  )
}

const DECISION_INK: Record<ReturnType<typeof sessionDecision>["tone"], string> = {
  healthy: "text-success",
  caution: "text-warning",
  action: "text-action",
  muted: "text-muted-foreground",
}

function HeroFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm font-medium break-words text-foreground">{children}</dd>
    </div>
  )
}

/** "Matches the suggestion of 10" or "Kept their own quantity"; nothing without a suggestion. */
function SuggestionChip({ suggestion: s }: { suggestion: ApiQuantitySuggestion | undefined }) {
  if (!s) return null
  if (s.isOverride) return <Chip tone="warn">Kept their own quantity</Chip>
  if (s.suggestedQuantity !== null && Number(s.acceptedQuantity) === Number(s.suggestedQuantity)) {
    return <Chip tone="ready">Matches the suggestion of {formatQuantity(s.suggestedQuantity)}</Chip>
  }
  return null
}

/** The figures a step heading carries: stock, open PO and cover (OAR), or the first repair figures. */
function ShownChips({ facts }: { facts: unknown }) {
  if (isI13Facts(facts)) {
    return (
      <>
        <Chip tone="warn">{formatQuantity(facts.stockOnHand, "0")} in stock</Chip>
        <Chip tone="warn">{formatQuantity(facts.openPoQuantity, "0")} on open PO</Chip>
        {facts.monthsOfCover !== null && <Chip tone="warn">{formatQuantity(facts.monthsOfCover)} months of cover</Chip>}
      </>
    )
  }
  return (
    <>
      {i08ShownFigures(facts)
        .filter((f) => f.value !== null)
        .slice(0, 3)
        .map((f) => (
          <Chip key={f.key} tone="muted">
            {f.label}: {f.value}
          </Chip>
        ))}
    </>
  )
}

// --- the timeline -------------------------------------------------------------

type StepState = "done" | "current" | "idle"

/**
 * One step: a numbered marker on the line, and a card that opens to show the
 * step's record. A native <details>, so it opens without script.
 */
function Step({
  n,
  when,
  whenLabel,
  title,
  state,
  status,
  statusTone,
  chips,
  defaultOpen = false,
  last = false,
  children,
}: {
  n: number
  when: string | null
  whenLabel?: string
  title: string
  state: StepState
  /** The pill on the right; "Done" for a done step unless given. */
  status?: string
  statusTone?: "action"
  chips?: React.ReactNode
  defaultOpen?: boolean
  last?: boolean
  children: React.ReactNode
}) {
  const pill = status ?? (state === "done" ? "Done" : null)
  const pillTone = statusTone ?? (state === "done" ? "healthy" : state === "current" ? "caution" : "muted")
  const stamp = when ?? whenLabel
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute top-8 bottom-0 left-4 w-0.5 -translate-x-1/2",
            state === "done" ? "bg-success/50" : "bg-border"
          )}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative z-10 grid size-8 place-items-center rounded-full text-sm font-semibold",
          state === "done" && "bg-success text-white",
          state === "current" && "border-2 border-warning bg-card text-warning",
          state === "idle" && "border border-border bg-muted text-muted-foreground"
        )}
      >
        {state === "done" ? <Check className="size-4" strokeWidth={3} /> : n}
      </span>
      <details
        open={defaultOpen}
        className={cn(
          "group min-w-0 overflow-hidden rounded-xl border shadow-sm",
          state === "current" ? "border-warning/50 bg-warning/5" : "border-border bg-card"
        )}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Step {n}
              {stamp && <> · {stamp}</>}
            </span>
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {chips && <span className="flex flex-wrap gap-1.5 pt-0.5">{chips}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {pill && <TonePill tone={pillTone}>{pill}</TonePill>}
            <span className="grid size-7 place-items-center rounded-full bg-muted text-muted-foreground">
              <ChevronDown
                aria-hidden
                className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              />
            </span>
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4">{children}</div>
      </details>
    </li>
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
          title="PRs raised for repair, no PO yet"
          columns={["PR", "Department", "Quantity", "Raised"]}
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
        {/* Asked until 3-Nov-2026: shown only on a declaration that has one. */}
        {d.condition && (
          <Fact label="Condition" wide>
            {d.condition}
          </Fact>
        )}
        <Fact label="Fault">{d.fault}</Fact>
        <Fact label="Quantity">{d.quantity}</Fact>
        <Fact label="Declared by">{d.name}</Fact>
        {d.evidence && <Fact label="Evidence">{d.evidence}</Fact>}
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
  reference: ReturnType<typeof referenceInstruction>
  sessionId: string
}) {
  return (
    <div className="flex flex-col gap-4">
      {!view.linked ? (
        <>
          <p className="text-sm text-foreground">
            The link appears here once a SAP reservation carrying{" "}
            <span className="font-mono font-semibold">{reference.value}</span> reaches the platform.
          </p>
          <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-card p-4">
            <p className="text-[11px] font-semibold tracking-wide text-warning uppercase">What to do next</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-foreground">
              <li>Create the reservation in SAP.</li>
              <li>
                Type <span className="font-mono font-semibold">{reference.value}</span>{" "}
                {reference.kind === "request" ? "once into its header text" : "into its item text"}.
              </li>
              <li>
                {reference.kind === "request"
                  ? "SAP copies it to every item, and this session links itself."
                  : "This session links itself."}
              </li>
            </ol>
            <div>
              <CopyReferenceButton value={reference.value} hint={reference.instruction} />
            </div>
          </div>
        </>
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
      <UatReservationTools sessionId={sessionId} sapText={reference.value} />
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

// --- pieces -------------------------------------------------------------------

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
