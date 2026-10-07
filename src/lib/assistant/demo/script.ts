/**
 * The two scripted conversations, as pure functions over a stored run.
 *
 * Mirrors the branch structure of `app/assistant/script.py::next_step`, and
 * every step it serves is a checked-in wire fixture -- generated from the
 * backend's own serialisers -- with the run's demo ID swapped in. What the
 * presenter actually typed is kept and replayed on the trace.
 *
 *   I08   01 assessment ─ use_existing ─▶ 06 done
 *                       └ proceed_new ──▶ 07 justification ─▶ 08 done
 *
 *   I13   04 assessment ─ not_needed ───▶ 09 done
 *                       └ proceed ──────▶ 10 plan ─▶ 11 quantity ─ accept_suggested ─▶ 12 done
 *                                                               └ keep_requested ───▶ 13 reason ─▶ 14 done
 *
 * Validation follows `app/assistant/turns.py::validate` closely enough that a
 * bad answer is refused with the same kind of 422 the live route returns.
 */

import { ApiError } from "@/lib/api/client"
import type {
  AnswerResponse,
  ApiJustification,
  ApiJustificationKind,
  ApiLinkedReservation,
  ApiNarrative,
  ApiPlan,
  ApiQuantitySuggestion,
  ApiRouting,
  ApiSessionOutcome,
  ApiSessionSummary,
  ApiStep,
  ApiTurn,
  SessionTraceResponse,
  StartSessionRequest,
  StartSessionResponse,
} from "@/lib/api/assistant"
import startI08Fixture from "@/lib/api/__fixtures__/01-start-i08-choice.json"
import startI13Fixture from "@/lib/api/__fixtures__/04-start-i13-choice.json"
import i08UseExistingFixture from "@/lib/api/__fixtures__/06-answer-i08-use-existing.json"
import i08ProceedNewFixture from "@/lib/api/__fixtures__/07-answer-i08-proceed-new.json"
import i08JustifiedFixture from "@/lib/api/__fixtures__/08-answer-i08-justification.json"
import i13NotNeededFixture from "@/lib/api/__fixtures__/09-answer-i13-not-needed.json"
import i13ProceedFixture from "@/lib/api/__fixtures__/10-answer-i13-proceed.json"
import i13PlanFixture from "@/lib/api/__fixtures__/11-answer-i13-capture-plan.json"
import i13AcceptFixture from "@/lib/api/__fixtures__/12-answer-i13-accept-suggested.json"
import i13KeepFixture from "@/lib/api/__fixtures__/13-answer-i13-keep-requested.json"
import i13JustifiedFixture from "@/lib/api/__fixtures__/14-answer-i13-quantity-justification.json"
import i13TraceFixture from "@/lib/api/__fixtures__/16-session-trace-i13.json"
import i08TraceFixture from "@/lib/api/__fixtures__/17-session-trace-i08.json"

import { demoMaterial } from "@/lib/assistant/demo/catalogue"
import { demoIdFrom } from "@/lib/assistant/demo/ids"

/** The IDs the fixtures were generated with. Never shown in a demo. */
export const FIXTURE_SESSION_IDS = ["S7K2M4P8Q1", "SQ4X9B2T7M"] as const

/** The suggestion the I13 fixtures were generated for. */
const SUGGESTED_QUANTITY = "1"

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000

/** Copied from `app/api/assistant/router.py`, so the trace says what live says. */
export const LINKAGE_NOTE =
  "No reservation is linked to this session yet. The assistant runs while the " +
  "reservation is being created, so it has no document number to record -- the " +
  "requester types the session ID into the reservation's item text (SGTXT) in " +
  "SAP, and the link is made when a SAP extract carrying it is loaded."
export const LINKED_NOTE =
  "Linked through the reservation's item text (SGTXT), which carries this " +
  "session's ID."

/** Everything a demo session has recorded. Stored in the browser, never sent. */
export type DemoRun = {
  sessionId: string
  flow: "i08" | "i13"
  materialId: string
  plant: string
  department: string | null
  requestedFor: string | null
  /** Whoever operated it. Live takes this from `X-Actor-Id`. */
  requester: string
  origin: string
  issuedAt: string
  expiresAt: string
  routing: ApiRouting
  assessment: unknown
  narrative: ApiNarrative | null
  /** The step awaiting an answer, or the terminal step once finished. */
  current: ApiStep
  turns: ApiTurn[]
  plans: ApiPlan[]
  quantitySuggestions: ApiQuantitySuggestion[]
  justifications: ApiJustification[]
  linkedReservations: ApiLinkedReservation[]
  /** I13: what the presenter planned, quoted back on the later steps. */
  plannedQuantity: string | null
  /** One of the two sessions every demo starts with. */
  seeded: boolean
}

// --- fixture plumbing --------------------------------------------------------

/** A deep copy with every fixture session ID replaced by this run's. */
function withSessionId<T>(value: T, sessionId: string): T {
  let json = JSON.stringify(value)
  for (const fixtureId of FIXTURE_SESSION_IDS) json = json.split(fixtureId).join(sessionId)
  return JSON.parse(json) as T
}

function stepOf(fixture: unknown, sessionId: string): ApiStep {
  return withSessionId((fixture as { step: ApiStep }).step, sessionId)
}

/** The plan form asks how many will be procured; the fixture says "use". */
function withProcuredLabel(step: ApiStep): ApiStep {
  return {
    ...step,
    fields: step.fields.map((field) =>
      field.name === "planned_quantity" ? { ...field, label: "How many you plan to procure" } : field
    ),
  }
}

/** Swap the fixture's planned quantity (5) for the one the presenter typed. */
function withPlannedQuantity(step: ApiStep, quantity: string): ApiStep {
  const swap = (text: string) =>
    text
      .replace("You planned 5.", `You planned ${quantity}.`)
      .replace("why 5 is needed", `why ${quantity} is needed`)
      .replace("Plan recorded at 5,", `Plan recorded at ${quantity},`)
  const facts =
    step.facts && typeof step.facts === "object"
      ? { ...(step.facts as Record<string, unknown>), requestedQuantity: quantity }
      : step.facts
  return {
    ...step,
    prompt: swap(step.prompt),
    facts,
    choices: step.choices.map((choice) =>
      choice.value === "keep_requested" ? { ...choice, label: `Keep ${quantity}` } : choice
    ),
  }
}

function newId(prefix: string): string {
  return prefix + Math.random().toString(16).slice(2, 12).padEnd(10, "0")
}

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString()
}

// --- opening -----------------------------------------------------------------

export type DemoStart = { run: DemoRun | null; response: StartSessionResponse }

/**
 * Open a demo session. A material that is not one of the two is out of scope,
 * as live answers for a consumable: a 200 with no session.
 */
export function startDemoRun(
  body: StartSessionRequest,
  { sessionId, now }: { sessionId: string; now: string }
): DemoStart {
  const material = demoMaterial(body.materialId, body.plant)
  if (!material) {
    return {
      run: null,
      response: {
        routing: {
          flow: "none",
          materialId: body.materialId.trim(),
          plant: body.plant.trim(),
          eightySeries: false,
          materialScope: "EXCLUDED",
          mrpType: null,
          alsoMatched: null,
          reason: `Material ${body.materialId.trim()} was not found at plant ${body.plant.trim()}.`,
        },
        sessionId: null,
        expiresAt: null,
        step: null,
        narrative: null,
      },
    }
  }

  const fixture = withSessionId(
    (material.flowHint === "i08" ? startI08Fixture : startI13Fixture) as unknown as StartSessionResponse,
    sessionId
  )
  const step = fixture.step as ApiStep
  const run: DemoRun = {
    sessionId,
    flow: material.flowHint === "i08" ? "i08" : "i13",
    materialId: material.materialId,
    plant: material.plant,
    department: body.department?.trim() || null,
    requestedFor: body.requestedFor?.trim() || null,
    // The fixtures' own requester, so a blank "requested for" still reads as a person.
    requester: body.requestedFor?.trim() || "MILLERJ",
    origin: body.origin ?? "PLATFORM",
    issuedAt: now,
    expiresAt: addMs(now, SESSION_WINDOW_MS),
    routing: fixture.routing,
    assessment: step.facts,
    narrative: fixture.narrative,
    current: step,
    turns: [],
    plans: [],
    quantitySuggestions: [],
    justifications: [],
    linkedReservations: [],
    plannedQuantity: null,
    seeded: false,
  }

  return {
    run,
    response: { ...fixture, sessionId, expiresAt: run.expiresAt, step },
  }
}

// --- answering ---------------------------------------------------------------

function refuse(detail: string): never {
  throw new ApiError(`POST turn failed with 422`, 422, undefined, detail)
}

function cleanChoice(step: ApiStep, answer: Record<string, unknown>): string {
  const allowed = step.choices.map((c) => c.value)
  const choice = answer.choice
  if (typeof choice !== "string" || !allowed.includes(choice)) {
    refuse(`choice must be one of ${JSON.stringify([...allowed].sort())}, got ${JSON.stringify(choice ?? null)}`)
  }
  return choice
}

function cleanForm(step: ApiStep, answer: Record<string, unknown>): Record<string, string | null> {
  const declared = step.fields.map((f) => f.name)
  const unknown = Object.keys(answer).filter((key) => !declared.includes(key))
  if (unknown.length > 0) {
    refuse(`${step.id} does not take ${JSON.stringify(unknown)}. It takes ${JSON.stringify([...declared].sort())}.`)
  }

  const cleaned: Record<string, string | null> = {}
  for (const field of step.fields) {
    const raw = answer[field.name]
    const text = raw === undefined || raw === null ? "" : String(raw).trim()
    if (text === "") {
      if (field.required) refuse(`${field.name} is required`)
      cleaned[field.name] = null
      continue
    }
    if (field.type === "number") {
      const value = Number(text)
      if (!Number.isFinite(value)) refuse(`${field.label} must be a number, got ${JSON.stringify(text)}`)
      if (value <= 0) refuse(`${field.label} must be greater than zero, got ${text}`)
    }
    if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      refuse(`${field.label} must be a date as YYYY-MM-DD, got ${JSON.stringify(text)}`)
    }
    if (field.type === "select") {
      const allowed = field.options.map((o) => o.value)
      if (!allowed.includes(text)) {
        refuse(`${field.name} must be one of ${JSON.stringify([...allowed].sort())}, got ${JSON.stringify(text)}`)
      }
    }
    cleaned[field.name] = text
  }

  const start = cleaned.window_start
  const end = cleaned.window_end
  if (start && end && end < start) refuse(`the planned window ends (${end}) before it starts (${start})`)
  return cleaned
}

function recordTurn(run: DemoRun, step: ApiStep, answer: Record<string, unknown> | null, now: string): ApiTurn {
  return {
    sequence: run.turns.length,
    stepId: step.id,
    stepKind: step.kind,
    question: step.prompt,
    answer,
    actor: run.requester,
    answeredAt: now,
  }
}

function justification(
  run: DemoRun,
  kind: ApiJustificationKind,
  form: Record<string, string | null>,
  now: string
): ApiJustification {
  return {
    id: newId("ju"),
    sessionId: run.sessionId,
    exceptionId: null,
    kind,
    reasonCategory: form.reason_category ?? "",
    freeText: form.free_text ?? "",
    materialId: run.materialId,
    plant: run.plant,
    author: run.requester,
    recordedAt: now,
  }
}

function suggestion(run: DemoRun, accepted: string, now: string): ApiQuantitySuggestion {
  const template = (i13TraceFixture as unknown as SessionTraceResponse).quantitySuggestions[0]
  const requested = run.plannedQuantity ?? accepted
  return {
    ...template,
    id: newId("qs"),
    requestedQuantity: requested,
    acceptedQuantity: accepted,
    isOverride: accepted !== SUGGESTED_QUANTITY,
    suggestedAt: now,
  }
}

function terminal(run: DemoRun, prompt: string): ApiStep {
  return {
    id: `${run.flow}_done`,
    kind: "terminal",
    prompt:
      `${prompt}\n\nYour session reference is ${run.sessionId}. Type it into the ` +
      "reservation in SAP so this advice can be linked to what you actually reserve.",
    choices: [],
    fields: [],
    facts: null,
    footnote: null,
    sessionId: run.sessionId,
  }
}

/** The next step for one answer. Throws `ApiError` (422) for a bad answer. */
function nextStep(
  run: DemoRun,
  answer: Record<string, unknown>,
  now: string
): { step: ApiStep; recorded: Record<string, unknown>; changes: Partial<DemoRun> } {
  const step = run.current
  const id = run.sessionId

  switch (step.id) {
    case "i08_assessment": {
      const choice = cleanChoice(step, answer)
      return {
        recorded: { choice },
        step: stepOf(choice === "use_existing" ? i08UseExistingFixture : i08ProceedNewFixture, id),
        changes: {},
      }
    }
    case "i08_justification": {
      const form = cleanForm(step, answer)
      return {
        recorded: form,
        step: stepOf(i08JustifiedFixture, id),
        changes: { justifications: [...run.justifications, justification(run, "NEW_ACQUISITION", form, now)] },
      }
    }
    case "i13_assessment": {
      const choice = cleanChoice(step, answer)
      return {
        recorded: { choice },
        step:
          choice === "not_needed"
            ? stepOf(i13NotNeededFixture, id)
            : withProcuredLabel(stepOf(i13ProceedFixture, id)),
        changes: {},
      }
    }
    case "i13_capture_plan": {
      const form = cleanForm(step, answer)
      const quantity = form.planned_quantity ?? SUGGESTED_QUANTITY
      const plan: ApiPlan = {
        id: newId("cp"),
        material: run.materialId,
        plant: run.plant,
        purpose: form.purpose ?? "",
        plannedQuantity: quantity,
        windowStart: form.window_start,
        windowEnd: form.window_end,
        costCentre: form.cost_centre,
        orderNumber: form.order_number,
        status: "OPEN",
        reservationNumber: null,
        reservationItem: null,
        capturedBy: run.requester,
        capturedAt: now,
      }
      const withPlan = { ...run, plans: [...run.plans, plan], plannedQuantity: quantity }
      // Nothing to question when the plan is already at or under the suggestion.
      if (Number(quantity) <= Number(SUGGESTED_QUANTITY)) {
        return {
          recorded: form,
          step: terminal(withPlan, `Plan recorded at ${quantity}.`),
          changes: {
            plans: withPlan.plans,
            plannedQuantity: quantity,
            quantitySuggestions: [...run.quantitySuggestions, suggestion(withPlan, quantity, now)],
          },
        }
      }
      return {
        recorded: form,
        step: withPlannedQuantity(stepOf(i13PlanFixture, id), quantity),
        changes: { plans: withPlan.plans, plannedQuantity: quantity },
      }
    }
    case "i13_quantity": {
      const choice = cleanChoice(step, answer)
      const quantity = run.plannedQuantity ?? SUGGESTED_QUANTITY
      if (choice === "accept_suggested") {
        return {
          recorded: { choice },
          step: stepOf(i13AcceptFixture, id),
          changes: {
            quantitySuggestions: [...run.quantitySuggestions, suggestion(run, SUGGESTED_QUANTITY, now)],
            plans: run.plans.map((p) => ({ ...p, plannedQuantity: SUGGESTED_QUANTITY })),
          },
        }
      }
      return {
        recorded: { choice },
        step: withPlannedQuantity(stepOf(i13KeepFixture, id), quantity),
        changes: { quantitySuggestions: [...run.quantitySuggestions, suggestion(run, quantity, now)] },
      }
    }
    case "i13_quantity_justification": {
      const form = cleanForm(step, answer)
      return {
        recorded: form,
        step: withPlannedQuantity(stepOf(i13JustifiedFixture, id), run.plannedQuantity ?? SUGGESTED_QUANTITY),
        changes: { justifications: [...run.justifications, justification(run, "QUANTITY_OVERRIDE", form, now)] },
      }
    }
    default:
      if (step.kind === "terminal") {
        refuse(
          `Session ${run.sessionId} is already finished. Its conversation cannot ` +
            "be reopened -- start a new session if the decision has changed."
        )
      }
      refuse(`${step.id} cannot be answered in this session.`)
  }
}

/** Answer the current step: the updated run, and what the route would return. */
export function answerDemoRun(
  run: DemoRun,
  answer: Record<string, unknown>,
  now: string
): { run: DemoRun; response: AnswerResponse } {
  const { step, recorded, changes } = nextStep(run, answer, now)
  const answered: DemoRun = { ...run, ...changes }
  const turns = [...run.turns, recordTurn(answered, run.current, recorded, now)]
  // The backend records the terminal step as a turn the moment it is served.
  if (step.kind === "terminal") {
    turns.push(recordTurn({ ...answered, turns }, step, null, now))
  }
  const next: DemoRun = { ...answered, turns, current: step }
  return { run: next, response: { sessionId: run.sessionId, step } }
}

// --- reservations --------------------------------------------------------------

/** What "the requester typed the ID into SGTXT" would produce. */
export function linkDemoReservation(run: DemoRun, reservationNumber: string, now: string): DemoRun {
  const link: ApiLinkedReservation = {
    reservationNumber,
    reservationItem: "0001",
    material: run.materialId,
    plant: run.plant,
    source: "UAT_SGTXT",
    sgtxt: run.sessionId,
    firstSeenAt: now,
  }
  return {
    ...run,
    linkedReservations: [...run.linkedReservations, link],
    plans: run.plans.map((plan) =>
      plan.reservationNumber
        ? plan
        : { ...plan, reservationNumber, reservationItem: "0001", linkedReservations: [link] }
    ),
  }
}

export function unlinkDemoReservations(run: DemoRun): DemoRun {
  return {
    ...run,
    linkedReservations: [],
    plans: run.plans.map((plan) => ({
      ...plan,
      reservationNumber: null,
      reservationItem: null,
      linkedReservations: [],
    })),
  }
}

// --- reading back --------------------------------------------------------------

export function outcomeOf(run: DemoRun, now: string): ApiSessionOutcome {
  if (run.turns.some((turn) => turn.stepKind === "terminal")) return "COMPLETED"
  return new Date(now) <= new Date(run.expiresAt) ? "OPEN" : "ABANDONED"
}

export function traceOf(run: DemoRun, now: string): SessionTraceResponse {
  return {
    sessionId: run.sessionId,
    flow: run.flow,
    outcome: outcomeOf(run, now),
    materialId: run.materialId,
    plant: run.plant,
    department: run.department,
    requestedFor: run.requestedFor,
    requestedQuantity: null,
    requester: run.requester,
    origin: run.origin,
    issuedAt: run.issuedAt,
    expiresAt: run.expiresAt,
    expired: new Date(now) > new Date(run.expiresAt),
    routingReason: run.routing.reason,
    assessment: run.assessment,
    narrative: run.narrative?.text ?? null,
    turns: run.turns,
    plans: run.plans,
    quantitySuggestions: run.quantitySuggestions,
    justifications: run.justifications,
    linkedReservations: run.linkedReservations,
    linkageNote: run.linkedReservations.length > 0 ? LINKED_NOTE : LINKAGE_NOTE,
  }
}

export function summaryOf(run: DemoRun, now: string): ApiSessionSummary {
  return {
    sessionId: run.sessionId,
    flow: run.flow,
    outcome: outcomeOf(run, now),
    materialId: run.materialId,
    plant: run.plant,
    department: run.department,
    requestedFor: run.requestedFor,
    requester: run.requester,
    origin: run.origin,
    issuedAt: run.issuedAt,
    expiresAt: run.expiresAt,
    turns: run.turns.length,
  }
}

// --- the two sessions every demo starts with -----------------------------------

function seeded(trace: SessionTraceResponse, start: StartSessionResponse, sessionId: string): DemoRun {
  const copy = withSessionId(trace, sessionId)
  const startCopy = withSessionId(start, sessionId)
  const lastTurn = copy.turns[copy.turns.length - 1]
  return {
    sessionId,
    flow: copy.flow === "i08" ? "i08" : "i13",
    materialId: copy.materialId,
    plant: copy.plant,
    department: copy.department,
    requestedFor: copy.requestedFor,
    requester: copy.requestedFor ?? copy.requester,
    origin: copy.origin,
    issuedAt: copy.issuedAt,
    expiresAt: copy.expiresAt,
    routing: startCopy.routing,
    assessment: copy.assessment,
    narrative: startCopy.narrative,
    current: terminal(
      { sessionId, flow: copy.flow === "i08" ? "i08" : "i13" } as DemoRun,
      lastTurn?.question.split("\n\n")[0] ?? "Recorded."
    ),
    turns: copy.turns.map((turn) => ({ ...turn, actor: copy.requestedFor ?? turn.actor })),
    plans: copy.plans.map((plan) => ({ ...plan, capturedBy: copy.requestedFor ?? plan.capturedBy })),
    quantitySuggestions: copy.quantitySuggestions,
    justifications: copy.justifications.map((j) => ({ ...j, author: copy.requestedFor ?? j.author })),
    linkedReservations: copy.linkedReservations ?? [],
    plannedQuantity: copy.plans[0]?.plannedQuantity ?? null,
    seeded: true,
  }
}

export const SEEDED_I08_ID = demoIdFrom("7K2M4P8Q")
export const SEEDED_I13_ID = demoIdFrom("Q4X9B2T7")

/** One finished session per flow, so the session log is never empty. */
export function seededRuns(): DemoRun[] {
  return [
    seeded(i13TraceFixture as unknown as SessionTraceResponse, startI13Fixture as unknown as StartSessionResponse, SEEDED_I13_ID),
    seeded(i08TraceFixture as unknown as SessionTraceResponse, startI08Fixture as unknown as StartSessionResponse, SEEDED_I08_ID),
  ]
}
