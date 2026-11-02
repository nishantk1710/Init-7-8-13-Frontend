/**
 * The session page in words.
 *
 * A session is stored as codes: a choice is `proceed_new`, a form answer is
 * `{ reason_category: "URGENT_BREAKDOWN", free_text: "..." }`, a quantity is
 * `1.000000`, and every turn is stamped with whoever operated the assistant,
 * which until sign-in lands is the placeholder `UNAUTHENTICATED-FRONTEND`.
 * None of that is for a reader. This module turns a recorded session into what
 * the page shows: the question and the answer as the person saw them, the
 * decision in a few words, the declaration made in the visit, and the ONE
 * instruction for the reference.
 *
 * Pure, so it can be tested (vitest runs `*.test.ts` only). Nothing here
 * changes the record: the download still carries it as stored.
 *
 * ## Why the choice labels are held here
 *
 * A recorded turn keeps the choice's value, not the label the person clicked.
 * The labels below are the backend script's own (`app/assistant/script.py`),
 * keyed by the stable step id and value, so they say what was on the button.
 * A value this file does not know is shown in words, never as a code.
 */

import { isPlaceholderActor } from "@/lib/api/actor"
import type {
  ApiJustification,
  ApiSessionDeclaration,
  ApiTurn,
  SessionTraceResponse,
} from "@/lib/api/assistant"
import {
  isPositiveQuantity,
  repairRequestCountOf,
  repairRequestsOf,
  requestAgePhrase,
  requestDepartmentText,
  requestReference,
  stockView,
  usableBreakdownText,
} from "@/lib/assistant/i08-facts-format"
import { formatDay, type SessionIdentity } from "@/lib/assistant/trace-format"

// --- numbers and codes -------------------------------------------------------

/**
 * A quantity without the decimals SAP pads it with: `1.000000` -> `1`,
 * `2.500` -> `2.5`, `1000` -> `1,000`. Null or blank is the fallback (never
 * zero); text that is not a number is shown as sent.
 */
export function formatQuantity(value: string | number | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return String(value)
  return parsed.toLocaleString("en-US", { maximumFractionDigits: 3 })
}

/** A code as words in sentence case: `SEAL_LEAK` -> "Seal leak". */
export function humanizeCode(code: string | null | undefined, fallback = "—"): string {
  if (!code) return fallback
  const words = code.replace(/_/g, " ").trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : fallback
}

const REASON_LABELS: Record<string, string> = {
  URGENT_BREAKDOWN: "Urgent breakdown",
  NO_SUITABLE_REPAIRABLE: "No suitable repairable unit",
  OTHER: "Other",
}

/** A justification's reason category: `URGENT_BREAKDOWN` -> "Urgent breakdown". */
export function reasonCategoryLabel(code: string | null | undefined): string {
  return code ? (REASON_LABELS[code] ?? humanizeCode(code)) : "—"
}

/** A fault category: `ELECTRICAL_FAULT` -> "Electrical fault". */
export function faultCategoryLabel(code: string | null | undefined): string {
  return humanizeCode(code)
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  REPAIRABLE: "Repairable",
  BEYOND_ECONOMICAL_REPAIR: "Beyond economical repair",
  SCRAP: "Scrap",
}

/** A declaration's assessment, as the declaration form labels it. */
export function recommendationLabel(code: string | null | undefined): string {
  return code ? (RECOMMENDATION_LABELS[code] ?? humanizeCode(code)) : "—"
}

const KIND_LABELS: Record<string, string> = {
  NEW_ACQUISITION: "Why a new unit",
  QUANTITY_OVERRIDE: "Why this quantity",
  NO_PLAN: "Why there is no plan",
  PLAN_BREACH: "Why the plan was missed",
}

/** What a justification answers, as a heading: `NEW_ACQUISITION` -> "Why a new unit". */
export function justificationKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? humanizeCode(kind)
}

// --- text the backend wrote --------------------------------------------------

const ISO_DATE_IN_TEXT = /\b(\d{4}-\d{2}-\d{2})\b/g

/**
 * A sentence the backend wrote, made readable: ` -- ` used as a dash becomes a
 * colon (or a comma where the sentence already has a colon before it), and an
 * ISO date becomes `09 Jul 2026`. Display only; the stored text is unchanged.
 */
export function readableText(text: string): string {
  let out = ""
  let from = 0
  for (const match of text.matchAll(/[ \t]+--[ \t]+/g)) {
    const at = match.index ?? 0
    const before = text.slice(0, at)
    // The sentence so far: from the last full stop, question or line break.
    const sentenceStart = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("\n"))
    const glue = before.slice(sentenceStart + 1).includes(":") ? ", " : ": "
    out += text.slice(from, at) + glue
    from = at + match[0].length
  }
  out += text.slice(from)
  return out.replace(ISO_DATE_IN_TEXT, (iso) => formatDay(iso))
}

// --- people ------------------------------------------------------------------

/**
 * Who a record names. Until sign-in lands every row carries a placeholder
 * (`UNAUTHENTICATED-FRONTEND`); the page shows the requester's typed name in
 * its place, or "Not signed in" when nobody was named. A real name is shown
 * as recorded.
 */
export function personLabel(actor: string | null | undefined, typedName?: string | null): string {
  if (actor && !isPlaceholderActor(actor)) return actor
  const typed = typedName?.trim()
  return typed ? typed : "Not signed in"
}

// --- the reference -----------------------------------------------------------

export type ReferenceInstruction = {
  kind: "request" | "session"
  /** "Request reference" or "Session reference". */
  title: string
  /** What is typed into SAP and copied. */
  value: string
  /** The one instruction, in the words the closing message uses. */
  instruction: string
  /** For a request line, which line this session is (`R…/1`); null otherwise. */
  line: string | null
}

/**
 * The ONE instruction for the reference. A request is typed once into the
 * reservation's header text, and SAP copies it to every item; a single
 * session is typed into the reservation's item text. The box at the top of
 * the page and the backend's closing message use these same words.
 */
export function referenceInstruction(identity: SessionIdentity): ReferenceInstruction {
  if (identity.requestId) {
    return {
      kind: "request",
      title: "Request reference",
      value: identity.requestId,
      instruction: `Type the request reference ${identity.requestId} once into the reservation's header text in SAP; SAP copies it to every item.`,
      line: identity.label !== identity.requestId ? identity.label : null,
    }
  }
  return {
    kind: "session",
    title: "Session reference",
    value: identity.sapText,
    instruction: `Type the session reference ${identity.sapText} into the reservation's item text in SAP.`,
    line: null,
  }
}

// --- the conversation --------------------------------------------------------

/** The backend script's button labels, by step id and value. */
const CHOICE_LABELS: Record<string, Record<string, string>> = {
  i08_assessment: {
    use_existing: "No, I will use the existing unit",
    proceed_new: "Yes, I still need a new one",
  },
  i08_declare_choice: {
    declare: "Yes, declare it now",
    skip: "No",
  },
  i13_assessment: {
    proceed: "Yes, continue",
    not_needed: "No, I do not need it after all",
  },
}

/** The questions whose stored wording carries a long note, asked in short. */
const QUESTION_LABELS: Record<string, string> = {
  i08_assessment: "Do you still want to reserve a new one?",
  i08_justification: "Why is a new unit needed, although one exists?",
  i08_declare_choice: "Are you taking out a faulty unit that should go for repair?",
  i08_declaration: "Describe the faulty unit you are taking out.",
  i13_assessment: "Do you want to go ahead with this reservation?",
  i13_capture_plan: "What is this material for?",
}

/** Form fields, by the answer key the backend stores, in the order shown. */
const FIELD_LABELS: [key: string, label: string][] = [
  ["recommendation", "Assessment"],
  ["fault_category", "Fault"],
  ["condition_description", "Condition"],
  ["quantity", "Quantity"],
  ["attestor_name", "Typed name"],
  ["evidence_reference", "Evidence"],
  ["reason_category", "Reason"],
  ["free_text", "In their own words"],
  ["purpose", "What it is for"],
  ["planned_quantity", "Planned quantity"],
  ["window_start", "Used from"],
  ["window_end", "Used by"],
  ["requested_quantity", "Quantity asked for"],
  ["cost_centre", "Cost centre"],
  ["order_number", "Work order"],
]

/** Extra wording for a choice whose label carries a number (`Take 0`, `Keep 1`). */
export type ChoiceContext = {
  suggestedQuantity?: string | null
  requestedQuantity?: string | null
}

/** A recorded choice as the button said it. */
export function choiceLabel(stepId: string, value: string, context: ChoiceContext = {}): string {
  const known = CHOICE_LABELS[stepId]?.[value]
  if (known) return known
  if (value === "accept_suggested") {
    return context.suggestedQuantity != null
      ? `Take the suggested ${formatQuantity(context.suggestedQuantity)}`
      : "Take the suggested quantity"
  }
  if (value === "keep_requested") {
    return context.requestedQuantity != null
      ? `Keep ${formatQuantity(context.requestedQuantity)}`
      : "Keep the planned quantity"
  }
  return humanizeCode(value)
}

export type AnswerRow = { label: string; value: string }

function fieldValue(key: string, value: unknown): string {
  const text = String(value)
  switch (key) {
    case "reason_category":
      return reasonCategoryLabel(text)
    case "fault_category":
      return faultCategoryLabel(text)
    case "recommendation":
      return recommendationLabel(text)
    case "quantity":
    case "planned_quantity":
    case "requested_quantity":
      return formatQuantity(text)
    case "window_start":
    case "window_end":
      return formatDay(text)
    default:
      return text
  }
}

/**
 * A recorded form answer as labelled values, known fields first in a fixed
 * order, anything else after them in words. Blank and null values are left
 * out: "not answered" is not an answer.
 */
export function answerRows(answer: Record<string, unknown>): AnswerRow[] {
  const present = Object.entries(answer).filter(
    ([key, value]) => key !== "choice" && value !== null && value !== undefined && String(value).trim() !== ""
  )
  const known = new Map(FIELD_LABELS)
  const ordered = [
    ...FIELD_LABELS.filter(([key]) => present.some(([k]) => k === key)).map(([key]) => key),
    ...present.map(([key]) => key).filter((key) => !known.has(key)),
  ]
  const values = new Map(present)
  return ordered.map((key) => ({
    label: known.get(key) ?? humanizeCode(key),
    value: fieldValue(key, values.get(key)),
  }))
}

/** The question as asked, short where the stored wording carries a long note. */
export function questionText(stepId: string, stored: string): string {
  const known = QUESTION_LABELS[stepId]
  if (known) return known
  // A dynamic question (the quantity steps) ends with the question itself;
  // the paragraphs before it repeat the advice shown above.
  const paragraphs = stored.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return readableText(paragraphs[paragraphs.length - 1] ?? stored)
}

/**
 * The closing message without its reference sentences. The reference is
 * shown once, in the box at the top of the page, with the one instruction;
 * older closing messages told a request line to use the item text, which
 * contradicted it.
 */
export function closingText(stored: string): string {
  const mentionsReference = /\breference\b|\bitem text\b|\bheader text\b|\bSGTXT\b/i
  return stored
    .split(/\n{2,}/)
    .map((paragraph) =>
      sentencesOf(paragraph)
        .filter((sentence) => !mentionsReference.test(sentence))
        .join(" ")
        .trim()
    )
    .filter(Boolean)
    .map(readableText)
    .join("\n\n")
}

/** A paragraph split after each full stop, question or exclamation mark. */
function sentencesOf(paragraph: string): string[] {
  return paragraph
    .replace(/([.!?])\s+/g, "$1\u0000")
    .split("\u0000")
    .map((s) => s.trim())
    .filter(Boolean)
}

export type ReadableTurn = {
  key: string
  stepId: string
  question: string
  answer: { kind: "choice"; text: string } | { kind: "form"; rows: AnswerRow[] } | null
  /** The closing message: no answer, and the question is its text. */
  closing: boolean
  answeredAt: string
}

/** The conversation as question and answer pairs, in the order they happened. */
export function readableTurns(turns: readonly ApiTurn[], context: ChoiceContext = {}): ReadableTurn[] {
  return turns.map((turn) => {
    const closing = turn.answer === null && turn.stepKind === "terminal"
    let answer: ReadableTurn["answer"] = null
    if (turn.answer !== null) {
      answer =
        typeof turn.answer.choice === "string"
          ? { kind: "choice", text: choiceLabel(turn.stepId, turn.answer.choice, context) }
          : { kind: "form", rows: answerRows(turn.answer) }
    }
    return {
      key: `${turn.sequence}-${turn.stepId}`,
      stepId: turn.stepId,
      question: closing ? closingText(turn.question) : questionText(turn.stepId, turn.question),
      answer,
      closing,
      answeredAt: turn.answeredAt,
    }
  })
}

// --- what was decided ----------------------------------------------------------

export type Tone = "healthy" | "caution" | "action" | "muted"

export type DecisionSummary = {
  /** A few words: "Used the existing unit". */
  text: string
  tone: Tone
}

type DecisionInput = Pick<SessionTraceResponse, "flow" | "outcome" | "turns" | "justifications"> & {
  plans?: SessionTraceResponse["plans"]
}

function choiceOf(turns: readonly ApiTurn[], stepId: string): string | null {
  const turn = turns.find((t) => t.stepId === stepId)
  const choice = turn?.answer?.choice
  return typeof choice === "string" ? choice : null
}

/** The decision the session recorded, in words, for the summary and the list. */
export function sessionDecision(trace: DecisionInput): DecisionSummary {
  const has = (kind: string) => trace.justifications.some((j) => j.kind === kind)
  const unanswered: DecisionSummary =
    trace.outcome === "ABANDONED"
      ? { text: "Left before deciding", tone: "muted" }
      : { text: "Not decided yet", tone: "muted" }

  if (trace.flow === "i08") {
    const choice = choiceOf(trace.turns, "i08_assessment")
    if (choice === "use_existing") return { text: "Used the existing unit", tone: "healthy" }
    if (choice === "proceed_new") {
      return has("NEW_ACQUISITION")
        ? { text: "New unit requested, reason recorded", tone: "caution" }
        : { text: "New unit requested, no reason given yet", tone: "caution" }
    }
    // No challenge was asked: nothing usable existed, so a new unit is the
    // advice itself. Only true once the conversation reached its end.
    if (trace.outcome === "COMPLETED") return { text: "New unit, none to use instead", tone: "action" }
    return unanswered
  }

  if (trace.flow === "i13") {
    const choice = choiceOf(trace.turns, "i13_assessment")
    if (choice === "not_needed") return { text: "Not needed after the advice", tone: "muted" }
    if (choice === "proceed") {
      const planned = trace.plans?.[0]?.plannedQuantity
      const plan = planned != null ? `Plan recorded for ${formatQuantity(planned)}` : "Plan recorded"
      if (has("QUANTITY_OVERRIDE")) return { text: `${plan}, reason recorded`, tone: "caution" }
      return trace.outcome === "COMPLETED" ? { text: plan, tone: "healthy" } : unanswered
    }
    return unanswered
  }
  return unanswered
}

// --- the declaration -----------------------------------------------------------

export type DeclarationView = {
  key: string
  assessment: string
  fault: string
  condition: string
  quantity: string
  /** The typed name, or "Not given". */
  name: string
  evidence: string | null
  /** When it was recorded; null when read from the conversation of an older backend. */
  recordedAt: string | null
  /** `PO 4500001719/10` when the declaration names a repair line. */
  repairLine: string | null
}

function fromRecord(d: ApiSessionDeclaration): DeclarationView {
  const document = d.repairDocument
    ? `${d.repairDocumentType === "PR" ? "PR" : "PO"} ${d.repairDocument}${d.repairItem ? `/${d.repairItem}` : ""}`
    : null
  return {
    key: d.id,
    assessment: recommendationLabel(d.recommendation),
    fault: faultCategoryLabel(d.faultCategory),
    condition: d.conditionDescription,
    quantity: formatQuantity(d.quantity),
    name: d.attestorName?.trim() || "Not given",
    evidence: d.evidenceReference?.trim() || null,
    recordedAt: d.attestedAt,
    repairLine: document,
  }
}

/**
 * The declarations made in the visit. From the declaration records when the
 * backend sends them; from the declaration answer in the conversation when it
 * does not (an older backend), so the card shows either way.
 */
export function declarationViews(
  trace: Pick<SessionTraceResponse, "turns"> & { declarations?: ApiSessionDeclaration[] }
): DeclarationView[] {
  if (trace.declarations && trace.declarations.length > 0) return trace.declarations.map(fromRecord)
  if (trace.declarations !== undefined) return []
  const turn = trace.turns.find((t) => t.stepId === "i08_declaration" && t.answer !== null)
  if (!turn?.answer) return []
  const a = turn.answer
  const text = (key: string) => (a[key] === null || a[key] === undefined ? "" : String(a[key]).trim())
  return [
    {
      key: `turn-${turn.sequence}`,
      assessment: recommendationLabel(text("recommendation")),
      fault: faultCategoryLabel(text("fault_category")),
      condition: text("condition_description"),
      quantity: formatQuantity(text("quantity")),
      name: text("attestor_name") || "Not given",
      evidence: text("evidence_reference") || null,
      recordedAt: turn.answeredAt,
      repairLine: null,
    },
  ]
}

export type DeclaredState = {
  state: "yes" | "no" | "not-asked"
  text: string
}

/** "Faulty unit declared": yes (with its assessment), no, or not asked (a visit from before 27 Oct 2026). */
export function declaredState(
  trace: Pick<SessionTraceResponse, "turns"> & { declarations?: ApiSessionDeclaration[] }
): DeclaredState {
  const views = declarationViews(trace)
  if (views.length > 0) return { state: "yes", text: `Yes, ${views[0].assessment.toLowerCase()}` }
  const asked = trace.turns.some((t) => t.stepId === "i08_declare_choice")
  return asked ? { state: "no", text: "No" } : { state: "not-asked", text: "Not asked" }
}

// --- the reason ----------------------------------------------------------------

export type ReasonView = {
  key: string
  heading: string
  reason: string
  text: string
  by: string
  recordedAt: string
}

/** The justifications recorded in the session, in words. */
export function reasonViews(justifications: readonly ApiJustification[], typedName?: string | null): ReasonView[] {
  return justifications.map((j) => ({
    key: j.id,
    heading: justificationKindLabel(j.kind),
    reason: reasonCategoryLabel(j.reasonCategory),
    text: j.freeText,
    by: personLabel(j.author, typedName),
    recordedAt: j.recordedAt,
  }))
}

// --- what the assistant showed (I08) ------------------------------------------

export type ShownFigure = {
  key: string
  label: string
  /** Null shows `empty` instead, never zero. */
  value: string | null
  empty: string
  note: string | null
  tone: "default" | "warning"
}

/**
 * The I08 advice as five figures: usable stock (with its conditions), damaged
 * units, open repair POs, repairs requested with no PO, and the new-unit lead
 * time. Read through the shared I08 record readers, so a record from before
 * the 27-Oct stock split shows the one stock figure it had.
 */
export function i08ShownFigures(facts: unknown): ShownFigure[] {
  const f = isRecord(facts) ? facts : {}
  const view = stockView(f)
  const figures: ShownFigure[] = []

  if (view.state === "known") {
    const breakdown = usableBreakdownText(f)
    figures.push({
      key: "usable",
      label: "Usable stock",
      value: formatQuantity(view.usable, "0"),
      empty: "0",
      note: breakdown ?? (isPositiveQuantity(view.usable) ? "new or refurbished" : null),
      tone: "default",
    })
    figures.push({
      key: "damaged",
      label: "Damaged",
      value: formatQuantity(view.damaged, "0"),
      empty: "0",
      note: isPositiveQuantity(view.damaged) ? "not counted as usable" : null,
      tone: "default",
    })
  } else {
    figures.push({
      key: "stock",
      label: "In stock",
      value: view.state === "no-record" ? null : view.total === null ? null : formatQuantity(view.total),
      empty: "No stock record",
      note: view.state === "condition-unknown" && isPositiveQuantity(view.total) ? "condition unknown" : null,
      tone: "default",
    })
  }

  const openLines = typeof f.openRepairLines === "number" ? f.openRepairLines : 0
  const overdue = typeof f.overdueLines === "number" ? f.overdueLines : 0
  const soonest = typeof f.soonestDueDate === "string" ? f.soonestDueDate : null
  figures.push({
    key: "repairs",
    label: "Open repair POs",
    value: String(openLines),
    empty: "0",
    note:
      overdue > 0
        ? `${overdue} past the promised date`
        : soonest
          ? `earliest due back ${formatDay(soonest)}`
          : null,
    tone: overdue > 0 ? "warning" : "default",
  })

  const requests = repairRequestsOf(f)
  const oldest = requests.reduce<number | null>(
    (max, r) => (typeof r.daysSinceRequested === "number" && (max === null || r.daysSinceRequested > max) ? r.daysSinceRequested : max),
    null
  )
  figures.push({
    key: "requested",
    label: "Requested, no PO yet",
    value: String(repairRequestCountOf(f)),
    empty: "0",
    note: oldest !== null && oldest > 0 ? `oldest ${requestAgePhrase(oldest)}` : null,
    tone: "default",
  })

  const lead = typeof f.newUnitLeadTimeDays === "number" ? f.newUnitLeadTimeDays : null
  figures.push({
    key: "lead",
    label: "New unit takes",
    value: lead !== null && lead > 0 ? `${lead} ${lead === 1 ? "day" : "days"}` : null,
    empty: "Not set in SAP",
    note: null,
    tone: "default",
  })
  return figures
}

export type ShownRepairRow = {
  key: string
  reference: string
  vendor: string
  quantity: string
  due: string
  /** `110 days late`, or null when on time or undated. */
  late: string | null
}

/** The open repair POs the advice listed, in the order sent. */
export function i08RepairRows(facts: unknown): ShownRepairRow[] {
  const f = isRecord(facts) ? facts : {}
  const repairs = Array.isArray(f.openRepairs) ? f.openRepairs.filter(isRecord) : []
  return repairs.map((r, index) => {
    const document = String(r.purchasingDocument ?? "")
    const item = r.item ? String(r.item) : ""
    const days = typeof r.daysOverdue === "number" ? r.daysOverdue : null
    return {
      key: `${document}-${item}-${index}`,
      reference: item ? `${document}/${item}` : document,
      vendor:
        (typeof r.vendorName === "string" && r.vendorName) ||
        (typeof r.vendor === "string" && r.vendor ? `Vendor ${r.vendor}` : "Vendor not named"),
      quantity: formatQuantity(typeof r.quantity === "string" || typeof r.quantity === "number" ? r.quantity : null),
      due: typeof r.dueDate === "string" ? formatDay(r.dueDate) : "No date promised",
      late: days !== null && days > 0 ? `${days} ${days === 1 ? "day" : "days"} late` : null,
    }
  })
}

export type ShownRequestRow = {
  key: string
  reference: string
  age: string
  department: string
  quantity: string
}

/** The repairs requested with no PO yet, in the order sent. */
export function i08RequestRows(facts: unknown): ShownRequestRow[] {
  return repairRequestsOf(facts).map((r, index) => ({
    key: `${r.purchaseRequisition}-${r.item}-${index}`,
    reference: requestReference(r),
    age: capitalize(requestAgePhrase(r.daysSinceRequested)),
    department: requestDepartmentText(r) ?? "Not stated",
    quantity: formatQuantity(r.quantity),
  }))
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
