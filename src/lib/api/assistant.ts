/**
 * Typed client for the shared reservation-time assistant — `/api/assistant/*`
 * and `/api/justifications`.
 *
 * Mirrors `app/api/assistant/schemas.py` one-for-one. Three things to know
 * before using it.
 *
 * ## 1. This prefix is shared, and that is the point
 *
 * The assistant sits OUTSIDE `/api/i8` and `/api/i13` on purpose. The SAP
 * reservation pop-up knows a material and a plant; it cannot know whether that
 * material is 80-series or OAR, because working that out is the thing the
 * assistant does. A per-initiative entry point would force the caller to guess
 * the one question it came to ask. One prefix also means one session-ID
 * namespace, which matters because the reference comes back off a reservation
 * with nothing attached to say which initiative issued it.
 *
 * ## 2. camelCase here, snake_case one directory away
 *
 * These routes serve camelCase (`alias_generator=to_camel`), exactly like
 * `lib/api/i8.ts`. Most of `/api/i13/*` does NOT — which is why
 * `features/initiative-13/api/client.ts` hand-maps every field. **Do not copy
 * that mapper into this file.** There is nothing to map.
 *
 * The one exception is inside a step: a field's `name` is the key the answer is
 * posted under, and those are snake_case — `planned_quantity`, `window_start`,
 * `reason_category`, `free_text`. They are data keys, not model fields, so the
 * alias generator never touches them. Build answer payloads from `field.name`
 * verbatim and never camelise it.
 *
 * ## 3. Quantities are strings and must stay strings
 *
 * A Decimal serialised as a JSON number comes back through a float, and 2.1
 * returns as 2.0999999999999996. These values reach an append-only table that a
 * compliance engine reads, so they travel as text. Format for display; never
 * round-trip a quantity through `Number()`.
 */

import { apiFetch, apiPost } from "@/lib/api/client"

// --- the conversation -------------------------------------------------------

/** One option on a `choice` step. */
export type ApiChoice = {
  value: string
  label: string
  description: string | null
}

/** The five input types a `form` step can ask for. */
export type ApiFieldType = "text" | "textarea" | "number" | "date" | "select"

export type ApiField = {
  /**
   * The answer key. **snake_case** — see the module note. Post the answer under
   * this exact string.
   */
  name: string
  label: string
  type: ApiFieldType
  required: boolean
  /** Populated only for `select`. Built from backend configuration, not an enum. */
  options: ApiChoice[]
  /**
   * Real instruction, not decoration — "leave blank if you genuinely do not know
   * yet" changes what gets captured. Render it.
   */
  helpText: string | null
  /** Pre-fill. A quantity default arrives as a string. */
  default: unknown
}

export type ApiStepKind = "message" | "choice" | "form" | "terminal"

export type ApiStep = {
  /** Stable across wording changes. Key answers by this, never by position. */
  id: string
  kind: ApiStepKind
  prompt: string
  choices: ApiChoice[]
  fields: ApiField[]
  /** The assessment card. Untyped on the wire — narrow with `lib/api/assistant-facts`. */
  facts: unknown
  /** The caveats, joined by newline. Render under the question, not inside it. */
  footnote: string | null
  /**
   * Set **only on a terminal step**, where the prompt tells the planner to type
   * it into SAP. Null everywhere else — the session id from the start response
   * is the one to hold on to.
   */
  sessionId: string | null
}

export type ApiFlow = "i08" | "i13" | "none"

/** Why this material got the flow it got — served even when no session was minted. */
export type ApiRouting = {
  flow: ApiFlow
  materialId: string
  plant: string
  eightySeries: boolean
  materialScope: string
  mrpType: string | null
  /**
   * The flow that lost the tie. 97.6% of 80-series rows are also OAR, so this is
   * populated on almost every I08 session. Recorded so the decision stays
   * reviewable rather than looking arbitrary.
   */
  alsoMatched: string | null
  reason: string
}

export type StartSessionRequest = {
  materialId: string
  plant: string
  /**
   * Which department the part is for — the requester's, not the coordinator's.
   *
   * Optional, and it has to stay optional: the BAdI pop-up carries a material
   * and a plant and cannot supply this, so a session opened from SAP
   * legitimately has none. Omit rather than sending an empty string.
   */
  department?: string
  /**
   * Who the part is for, as typed by whoever is operating the assistant.
   *
   * **Free text, and not identity.** Nobody verified it — one person typed
   * another person's name into a box. It is a property of the reservation, like
   * the material number, and the backend stores it in its own column rather
   * than as the author of the record. The author still comes from the
   * `X-Actor-Id` header and nothing here can change that.
   */
  requestedFor?: string
  origin?: "BADI" | "PLATFORM"
}

/**
 * A model-written sentence, and the prompt behind it.
 *
 * The provenance travels with the text and is not decoration: this programme is
 * human-gated and audited, and "the model said so" is not an acceptable account
 * of where a sentence came from.
 */
export type ApiNarrative = {
  text: string
  promptId: string | null
  promptVersion: number | null
  model: string | null
}

/**
 * `sessionId`, `expiresAt` and `step` are null **together**, and only when the
 * material is out of scope.
 *
 * That case is a 200, not an error. The assistant has no opinion about a
 * consumable, and minting a session to record silence would fill an append-only
 * table with it. `routing.reason` is the sentence to show.
 */
export type StartSessionResponse = {
  routing: ApiRouting
  sessionId: string | null
  expiresAt: string | null
  step: ApiStep | null
  /**
   * The model's phrasing of the advice, where one was served.
   *
   * Null whenever the narrative layer is off, unconfigured or failed — all
   * ordinary states, none of them an error. Render it **beside** `step.facts`,
   * never instead of them: the deterministic assessment is the answer of
   * record, and phrasing must not occupy the place where a number belongs.
   */
  narrative: ApiNarrative | null
}

/** The answer to the current step, keyed by `field.name` (or `choice`). */
export type AnswerRequest = {
  answer: Record<string, unknown>
}

export type AnswerResponse = {
  sessionId: string
  step: ApiStep
}

// --- reading a session back -------------------------------------------------

export type ApiTurn = {
  sequence: number
  stepId: string
  stepKind: string
  question: string
  answer: Record<string, unknown> | null
  actor: string
  answeredAt: string
}

export type ApiPlan = {
  id: string
  material: string
  plant: string
  purpose: string
  /** Decimal-as-string. */
  plannedQuantity: string
  windowStart: string | null
  windowEnd: string | null
  costCentre: string | null
  orderNumber: string | null
  /** `OPEN` or `CLOSED`. The exception engine only treats `OPEN` as a commitment. */
  status: string
  /**
   * Null until FR-8 links it, which is the normal state and not a gap: the
   * assistant runs while the reservation is being created, so there is no number
   * yet. It stays null until `Bednr` is exposed on `ReservationItemSet` (B2).
   */
  reservationNumber: string | null
  reservationItem: string | null
  capturedBy: string
  capturedAt: string
}

export type ApiQuantitySuggestion = {
  id: string
  material: string
  plant: string
  requestedQuantity: string
  /**
   * Null when no suggestion could be made. Null is **not** zero: "we suggest
   * nothing" and "we suggest none" are opposite instructions.
   */
  suggestedQuantity: string | null
  acceptedQuantity: string
  suggestionReason: string
  monthsOfCover: string | null
  coverCeilingMonths: string
  lookbackMonths: number
  minHistoryConsumptions: number
  consumptionCount: number
  isOverride: boolean
  suggestedAt: string
}

/** The four things a justification can be recorded against. */
export type ApiJustificationKind =
  | "NEW_ACQUISITION"
  | "QUANTITY_OVERRIDE"
  | "PLAN_BREACH"
  | "NO_PLAN"

export type ApiJustification = {
  id: string
  sessionId: string | null
  exceptionId: string | null
  kind: ApiJustificationKind
  reasonCategory: string
  freeText: string
  materialId: string
  plant: string
  author: string
  recordedAt: string
}

export type ApiSessionOutcome = "OPEN" | "COMPLETED" | "ABANDONED"

/**
 * One session and everything it produced — the FR-8 demo surface.
 *
 * `assessment` is the advice **as served**, replayed from what was stored rather
 * than recomputed. Recomputing would answer a different question, because the
 * register and the stock both move, and the value of the record is that it does
 * not. Narrow it with `lib/api/assistant-facts` exactly like a step's `facts`.
 */
export type SessionTraceResponse = {
  sessionId: string
  flow: string
  outcome: ApiSessionOutcome
  materialId: string
  plant: string
  department: string | null
  /** Who the part was for. Null when nobody was named — a session opened from
   *  SAP cannot carry one. Show "not stated", never a blank. */
  requestedFor: string | null
  /** Null on every session opened since the entry point stopped asking. Older
   *  ones carry a real value, which is why this stays. Null is "not stated"
   *  and never zero. */
  requestedQuantity: string | null
  /** Who **operated** the assistant, not who wanted the part — that is
   *  `requestedFor`. Served because the trace is the FR-8 evidence view and an
   *  audit record without its author is not one, but **no screen draws it**:
   *  one coordinator opens every session, so it says the same thing on every
   *  row. */
  requester: string
  origin: string
  issuedAt: string
  expiresAt: string
  /**
   * Reported, never enforced. The reservation is already in SAP and the platform
   * cannot write back, so treating an expired reference as non-compliant would
   * raise an exception nobody could ever clear.
   */
  expired: boolean
  routingReason: string
  assessment: unknown
  narrative: string | null
  turns: ApiTurn[]
  plans: ApiPlan[]
  quantitySuggestions: ApiQuantitySuggestion[]
  justifications: ApiJustification[]
  /** Says in words what is not yet linked, and why. Show it; do not summarise it. */
  linkageNote: string
}

export type ApiSessionSummary = {
  sessionId: string
  flow: string
  outcome: string
  materialId: string
  plant: string
  department: string | null
  requestedFor: string | null
  /** The operator. Served, never drawn — see `SessionTraceResponse`. */
  requester: string
  origin: string
  issuedAt: string
  expiresAt: string
  turns: number
}

export type SessionListResponse = {
  items: ApiSessionSummary[]
  total: number
  note: string
}

// --- justifications ---------------------------------------------------------

/** `author` is absent on purpose — it comes from the `X-Actor-Id` header. */
export type JustificationRequest = {
  kind: ApiJustificationKind
  reasonCategory: string
  freeText: string
  materialId: string
  plant: string
  sessionId?: string
  exceptionId?: string
}

export type JustificationListResponse = {
  items: ApiJustification[]
  total: number
  /** VZI's vocabulary, served rather than hard-coded. Seven placeholders today. */
  reasonCategories: string[]
  note: string
}

// --- the free-text box ------------------------------------------------------

/**
 * A deterministic answer, or a plain statement that there is none.
 *
 * `answered` is false for a question this assistant does not cover, and `text`
 * then says so and lists what it does. Render that as a sentence, never as an
 * error and never as an empty result: a box that silently does nothing teaches
 * people it is broken, and one that guesses teaches them it is unreliable.
 *
 * `sources` names the endpoints every number came from. **No model is involved
 * in this path at all** — a backend test asserts the module does not even import
 * the AI layer.
 */
export type AskResponse = {
  intent: string
  answered: boolean
  text: string
  sources: string[]
  data: Record<string, unknown>
  suggestions: string[]
  note: string
}

// --- calls ------------------------------------------------------------------

/**
 * Open the assistant for a material and plant.
 *
 * Returns 200 with a null session when the material is out of scope — check
 * `sessionId`, not the status. Throws 422 when the material is in scope but the
 * platform has no read model for it (an OAR part WATCH has never seen); that
 * `detail` is a sentence worth showing.
 */
export function startSession(
  body: StartSessionRequest
): Promise<StartSessionResponse> {
  return apiPost<StartSessionResponse>("/assistant/sessions", body)
}

/**
 * Answer the current step and get the next one. **Responds 201, not 200.**
 *
 * Throws 404 for a reference that was never issued or was mistyped — the
 * backend's message distinguishes those, and so should the UI: "no such
 * session" is the exact compliance finding raised against somebody who skipped
 * the assistant, so a typo must not read as an accusation.
 */
export function postTurn(
  sessionId: string,
  answer: Record<string, unknown>
): Promise<AnswerResponse> {
  return apiPost<AnswerResponse>(
    `/assistant/sessions/${encodeURIComponent(sessionId)}/turns`,
    { answer } satisfies AnswerRequest
  )
}

/** The full trace for one session. */
export function getSession(sessionId: string): Promise<SessionTraceResponse> {
  return apiFetch<SessionTraceResponse>(
    `/assistant/sessions/${encodeURIComponent(sessionId)}`
  )
}

/**
 * The session log.
 *
 * These four are exactly what the route accepts — `flow`, `material`, `plant`
 * and `limit` (bounded `1 <= limit <= 500`, default 50).
 *
 * **There is no `outcome` filter, deliberately not offered here.** Outcome is
 * derived per row from that session's turns rather than stored, so the backend
 * cannot filter on it in SQL. FastAPI ignores an unknown query parameter
 * silently, so advertising one would return an unfiltered list that looks
 * filtered — which on a compliance screen reads as "no abandoned sessions
 * exist". Filter by outcome on the client, over what comes back.
 */
export function listSessions(params?: {
  flow?: string
  material?: string
  plant?: string
  limit?: number
}): Promise<SessionListResponse> {
  return apiFetch<SessionListResponse>(`/assistant/sessions${query(params)}`)
}

/** Ask one of a fixed set of questions. Never throws for "I do not know". */
export function ask(question: string): Promise<AskResponse> {
  return apiPost<AskResponse>("/assistant/ask", { question })
}

/**
 * The questions the free-text box can actually answer.
 *
 * Served rather than hard-coded so the chips cannot offer a question the backend
 * has stopped answering.
 */
export function getAskSuggestions(): Promise<string[]> {
  return apiFetch<string[]>("/assistant/ask/suggestions")
}

/** Record a justification. Shared by both initiatives. */
export function createJustification(
  body: JustificationRequest
): Promise<ApiJustification> {
  return apiPost<ApiJustification>("/justifications", body)
}

/**
 * Every justification, from the assistant and from ACT confirmations alike.
 *
 * Also the source of `reasonCategories` — the picker on a justification form is
 * built from this, never from a list held in the frontend.
 */
export function listJustifications(params?: {
  kind?: string
  material?: string
  plant?: string
  limit?: number
}): Promise<JustificationListResponse> {
  return apiFetch<JustificationListResponse>(`/justifications${query(params)}`)
}

function query(params?: Record<string, string | number | undefined>): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const queryString = search.toString()
  return queryString ? `?${queryString}` : ""
}
