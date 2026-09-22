/**
 * Turning what somebody typed into the payload the backend expects.
 *
 * Pure functions, no React. They live outside the components for two reasons:
 * this repo's vitest runs `environment: "node"` over `*.test.ts` only, so
 * anything inside a `.tsx` cannot be tested at all; and the rules below are the
 * part worth testing, because getting one wrong writes a wrong row into a table
 * that cannot be corrected.
 *
 * ## The shapes, verified against recorded turns
 *
 * A `choice` step answers `{ choice: "<value>" }`.
 * A `form` step answers `{ "<field.name>": "<value>", ... }`.
 *
 * Both are keyed by **`field.name` verbatim**, which is snake_case
 * (`planned_quantity`, `window_start`, `reason_category`, `free_text`) even
 * though the envelope around it is camelCase. Field names are data keys, not
 * pydantic model fields, so the alias generator never touches them. Posting
 * `plannedQuantity` is accepted as an unknown key and captures nothing.
 *
 * ## Everything is a string
 *
 * Every value in a recorded answer is a JSON string, including quantities
 * (`"5"`) and dates (`"2026-08-10"`). Quantities must stay strings because a
 * Decimal through a JSON number returns 2.1 as 2.0999999999999996, and these
 * land in an append-only record a compliance engine reads. Dates are already
 * `YYYY-MM-DD`, which is exactly what `<input type="date">` holds, so no
 * conversion is needed in either direction.
 */

import type { ApiField, ApiStep } from "@/lib/api/assistant"

/** What a form holds while it is being filled in: every value a string. */
export type FormValues = Record<string, string>

/** The answer payload for a choice step. */
export function choiceAnswer(value: string): Record<string, unknown> {
  return { choice: value }
}

/**
 * The answer payload for a form step.
 *
 * Trims, then **drops empty optional fields entirely** rather than sending
 * `""`. An empty string is a value, and "the cost centre is the empty string"
 * is a different statement from "the requester did not know the cost centre" —
 * the plan form says so out loud ("leave blank if you genuinely do not know
 * yet"). Only one of those is true, and it is not the one an empty string
 * records.
 *
 * A required field that is empty is still sent, so the server's own validator
 * is the one that rejects it and the UI never has to duplicate that rule.
 */
export function formAnswer(
  fields: readonly ApiField[],
  values: FormValues
): Record<string, unknown> {
  const answer: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = values[field.name] ?? ""
    const trimmed = raw.trim()
    if (trimmed.length === 0 && !field.required) continue
    answer[field.name] = trimmed
  }
  return answer
}

/**
 * Initial form state for a step, honouring each field's `default`.
 *
 * A default arrives as whatever the backend stored — a quantity default is the
 * string `"5"`. Coerced with String() rather than assumed, because the field is
 * `Any` on the wire, but a null default becomes `""` and not `"null"`.
 */
export function initialFormValues(fields: readonly ApiField[]): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    values[field.name] =
      field.default === null || field.default === undefined
        ? ""
        : String(field.default)
  }
  return values
}

/**
 * Which required fields are still empty.
 *
 * Required-only, deliberately. `app/assistant/turns.validate` is the only code
 * that knows what was asked, and a second validator here is exactly the drift
 * the server-driven design was chosen to avoid. This one exists so a planner
 * gets told about an empty box without a round trip; everything subtler is the
 * server's 422, rendered where it lands.
 *
 * Returns field names, in the order the step declared them, so the message can
 * name the first one rather than saying "a field is missing".
 */
export function missingRequired(
  fields: readonly ApiField[],
  values: FormValues
): string[] {
  return fields
    .filter((field) => field.required && (values[field.name] ?? "").trim() === "")
    .map((field) => field.name)
}

/**
 * The window is backwards: the planner expects to use the material before they
 * expect to receive it.
 *
 * Checked client-side because the backend does not check it, and a plan whose
 * window ends before it starts breaches on the day it is captured — FR-7 fires
 * on "window end plus grace", so an inverted window is an exception nobody
 * caused. Returns null when either end is blank, because both are optional and
 * an absent date is not an error.
 */
export function windowIsInverted(values: FormValues): boolean {
  const start = (values.window_start ?? "").trim()
  const end = (values.window_end ?? "").trim()
  if (!start || !end) return false
  // ISO YYYY-MM-DD compares correctly as a string; no Date parsing needed, and
  // no timezone to get wrong.
  return end < start
}

/** A human label for a field name, for an error that has to name one. */
export function fieldLabel(
  fields: readonly ApiField[],
  name: string
): string {
  return fields.find((field) => field.name === name)?.label ?? name
}

/**
 * Does answering this step need a submit button, or is a click the answer?
 *
 * A choice answers on click — an extra "confirm" step on a two-option question
 * is friction that teaches people to click through the next one. A form needs
 * an explicit submit.
 */
export function stepNeedsSubmit(step: ApiStep): boolean {
  return step.kind === "form"
}

/** A terminal step ends the conversation; nothing more can be answered. */
export function stepIsTerminal(step: ApiStep): boolean {
  return step.kind === "terminal"
}
