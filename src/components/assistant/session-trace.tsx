import Link from "next/link"

import {
  AssessmentCard,
  AssessmentCaveats,
} from "@/components/assistant/assessment-card"
import { SessionReference } from "@/components/assistant/session-reference"
import { UatReservationTools } from "@/components/assistant/uat-reservation-tools"
import type {
  ApiLinkedReservation,
  ApiJustification,
  ApiPlan,
  ApiQuantitySuggestion,
  ApiTurn,
  SessionTraceResponse,
} from "@/lib/api/assistant"
import { summariseAnswer } from "@/lib/assistant/transcript"
import { cn } from "@/lib/utils"

/**
 * One session and everything it produced — the FR-8 demo surface, for both
 * initiatives.
 *
 * ## The advice is replayed, not recomputed
 *
 * `assessment` is the dictionary that was stored when the session was minted,
 * and it is rendered here exactly as it was served. Recomputing it would
 * answer a different question: the register and the stock both move, so a
 * recomputed card would show what is true now and quietly claim that is what
 * the planner was told. The whole value of this record is that it does not
 * change.
 *
 * ## It also has to show what is missing
 *
 * `linkageNote` says in words that no reservation is linked yet, because
 * `Bednr` is not exposed on `ReservationItemSet` (blocker B2). Every session
 * carries that sentence and it is rendered prominently rather than tucked
 * into a footer — a compliance screen that silently omits the one link it
 * cannot make reads as a clean bill of health.
 */
export function SessionTrace({ trace }: { trace: SessionTraceResponse }) {
  return (
    <div className="flex flex-col gap-5">
      <SessionReference
        sessionId={trace.sessionId}
        expiresAt={trace.expiresAt}
        expired={trace.expired}
      />

      <Header trace={trace} />

      <Section title="Why this flow">
        <p className="text-sm text-muted-foreground">{trace.routingReason}</p>
      </Section>

      <Section
        title="The advice, as it was served"
        note="Replayed from what was recorded at the time, not recomputed. Stock and repair status have moved since."
      >
        <AssessmentCard facts={trace.assessment} />
        <AssessmentCaveats facts={trace.assessment} />
        {/* The narrative layer is off by default and its deviation from both
            FRSs is unsigned-off, so it is labelled wherever it does appear. */}
        {trace.narrative && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Generated narrative
            </p>
            <p className="mt-1 text-sm text-foreground">{trace.narrative}</p>
          </div>
        )}
      </Section>

      <Section title={`Conversation (${trace.turns.length} turns)`}>
        <Turns turns={trace.turns} />
      </Section>

      {trace.plans.length > 0 && (
        <Section title="Consumption plan captured">
          {trace.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </Section>
      )}

      {trace.quantitySuggestions.length > 0 && (
        <Section title="Quantity suggestion">
          {trace.quantitySuggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </Section>
      )}

      {trace.justifications.length > 0 && (
        <Section title="Justification recorded">
          {trace.justifications.map((justification) => (
            <JustificationCard
              key={justification.id}
              justification={justification}
            />
          ))}
        </Section>
      )}

      <Linkage
        note={trace.linkageNote}
        sessionId={trace.sessionId}
        linked={trace.linkedReservations ?? []}
      />
    </div>
  )
}

function Header({ trace }: { trace: SessionTraceResponse }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={trace.outcome} />
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground uppercase">
          {trace.flow}
        </span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          opened from {trace.origin === "BADI" ? "SAP" : "the platform"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Field label="Material" value={trace.materialId} mono />
        <Field label="Plant" value={trace.plant} mono />
        {/* Who the part was for, as typed by whoever ran the assistant. Not
            shown here: who ran it. `trace.requester` is served, because the
            trace is the FR-8 evidence view and an audit record without its
            author is not one -- but one coordinator opens every session, so a
            column holding the same value on every row tells a reader nothing
            and crowds out the one that does. */}
        <Field
          label="Requester"
          value={trace.requestedFor}
          // A session opened from SAP carries no name. Saying so beats a blank,
          // which reads as a rendering fault rather than as an absent answer.
          nullNote="not stated"
        />
        <Field
          label="Department"
          value={trace.department}
          nullNote="not stated"
        />
        {/* Only where there is one. Every session minted since the entry point
            stopped asking has none, and an empty row on all of them would
            invite somebody to go looking for the missing number. Older
            sessions carry a real value and still show it. */}
        {trace.requestedQuantity !== null && (
          <Field label="Quantity asked for" value={trace.requestedQuantity} />
        )}
      </dl>

      <p className="text-[11px] text-muted-foreground">
        Issued {formatInstant(trace.issuedAt)}
      </p>
    </div>
  )
}

function Turns({ turns }: { turns: ApiTurn[] }) {
  if (turns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The assistant was opened and the advice was served, but nothing was
        answered. That is recorded too — &ldquo;advice given, not acted
        on&rdquo; is a thing both initiatives count.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {turns.map((turn) => (
        <li
          key={`${turn.sequence}-${turn.stepId}`}
          className="flex flex-col gap-1.5 border-l-2 border-border pl-3"
        >
          <p className="text-sm whitespace-pre-line text-foreground">
            {turn.question}
          </p>
          {turn.answer === null ? (
            <p className="text-xs text-muted-foreground">
              No answer — this was the closing message.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Answered: </span>
              {summariseAnswer(turn.answer)}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {turn.actor} · {formatInstant(turn.answeredAt)}
          </p>
        </li>
      ))}
    </ol>
  )
}

function PlanCard({ plan }: { plan: ApiPlan }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-foreground">{plan.purpose}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Field label="Planned quantity" value={plan.plannedQuantity} />
        <Field
          label="Expected use"
          value={formatWindow(plan.windowStart, plan.windowEnd)}
          nullNote="no window given"
        />
        <Field label="Cost centre" value={plan.costCentre} nullNote="not known" />
        <Field label="Work order" value={plan.orderNumber} nullNote="not known" />
      </dl>
      <p className="text-[11px] text-muted-foreground">
        {plan.status} · captured by {plan.capturedBy} ·{" "}
        {formatInstant(plan.capturedAt)}
      </p>
    </div>
  )
}

function SuggestionCard({
  suggestion,
}: {
  suggestion: ApiQuantitySuggestion
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-foreground">{suggestion.suggestionReason}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Field label="Asked for" value={suggestion.requestedQuantity} />
        <Field
          label="Suggested"
          value={suggestion.suggestedQuantity}
          // Null is NOT zero here: "we suggest nothing" and "we suggest none"
          // are opposite instructions.
          nullNote="no suggestion made"
        />
        <Field label="Recorded as" value={suggestion.acceptedQuantity} />
        <Field
          label="Months of cover"
          value={suggestion.monthsOfCover}
          nullNote="not computable"
        />
      </dl>

      {suggestion.isOverride && (
        <p className="text-xs text-foreground">
          The requester kept their own quantity.
        </p>
      )}

      {/* The three parameters behind the number are all ours and none is
          confirmed by VZI, so they travel with every suggestion. A figure that
          carries its own assumptions can be argued with; one that does not can
          only be disbelieved. */}
      <p className="text-[11px] text-muted-foreground">
        Computed against a {suggestion.coverCeilingMonths}-month cover ceiling,
        a {suggestion.lookbackMonths}-month look-back and a minimum of{" "}
        {suggestion.minHistoryConsumptions} consumptions —{" "}
        {suggestion.consumptionCount} found. All three are configuration and
        none is confirmed by VZI yet.
      </p>
    </div>
  )
}

function JustificationCard({
  justification,
}: {
  justification: ApiJustification
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {justification.kind.replace(/_/g, " ").toLowerCase()}
        </span>
        <span className="text-sm font-medium text-foreground">
          {justification.reasonCategory.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-foreground">{justification.freeText}</p>
      <p className="text-[11px] text-muted-foreground">
        {justification.author} · {formatInstant(justification.recordedAt)}
      </p>
    </div>
  )
}

function Linkage({
  note,
  sessionId,
  linked,
}: {
  note: string
  sessionId: string
  linked: ApiLinkedReservation[]
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
      <h2 className="text-sm font-medium text-foreground">Link to the reservation</h2>
      <p className="text-sm text-muted-foreground">{note}</p>
      {linked.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {linked.map((l) => (
            <li key={`${l.reservationNumber}/${l.reservationItem}`} className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                href={`/oar-utilization/ledger?view=reservations&session=${encodeURIComponent(sessionId)}`}
                className="font-mono text-primary underline-offset-4 hover:underline"
              >
                {l.reservationNumber}/{l.reservationItem}
              </Link>
              <span className="text-xs text-muted-foreground">
                item text &ldquo;{l.sgtxt ?? ""}&rdquo;
                {l.source === "UAT_SGTXT" ? " · UAT simulation" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          The link is read from the reservation&rsquo;s item text (SGTXT) in the loaded SAP
          extract. Until a reservation carrying this session&rsquo;s ID is loaded, this session
          stands on its own: it records what the planner was told and what they decided.
        </p>
      )}
      <UatReservationTools sessionId={sessionId} />
    </div>
  )
}

// --- pieces -----------------------------------------------------------------

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {title}
      </h2>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  nullNote,
  mono,
}: {
  label: string
  value: string | null
  nullNote?: string
  mono?: boolean
}) {
  const missing = value === null || value === undefined || value === ""
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] tracking-[0.3px] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-medium",
          missing ? "text-muted-foreground" : "text-foreground",
          mono && !missing && "font-mono"
        )}
      >
        {missing ? (nullNote ?? "—") : value}
      </dd>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        outcome === "COMPLETED" && "border-border text-foreground",
        outcome === "OPEN" && "border-border text-muted-foreground",
        // Abandoned is not a failure. Somebody read the advice and stopped,
        // which is an outcome both FRSs count.
        outcome === "ABANDONED" && "border-border text-muted-foreground"
      )}
    >
      {outcome.toLowerCase()}
    </span>
  )
}

/** Back to the log, for a trace opened directly by reference. */
export function BackToSessions() {
  return (
    <Link
      href="/assistant/sessions"
      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
    >
      ← All sessions
    </Link>
  )
}

function formatWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `${start} to ${end}`
  return start ? `from ${start}` : `by ${end}`
}

function formatInstant(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
