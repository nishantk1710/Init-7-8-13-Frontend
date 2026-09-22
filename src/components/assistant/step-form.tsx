"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ApiField, ApiStep } from "@/lib/api/assistant"
import {
  fieldLabel,
  initialFormValues,
  missingRequired,
  windowIsInverted,
  type FormValues,
} from "@/lib/assistant/answers"
import { cn } from "@/lib/utils"

/**
 * A `form` step, rendered from its own field list.
 *
 * Every field is declared by the backend — name, label, type, required, options
 * and help text. Nothing about the consumption plan or the justification is
 * hard-coded here, and the reason-category list in particular is **not**:
 * neither FRS names the categories, so they are configuration on the backend
 * (seven placeholders today, VZI's own list pending). A copy here would mean
 * the day VZI supplies one is a redeploy of two things instead of an `.env`
 * change.
 *
 * ## Validation is required-only, plus one rule the backend does not have
 *
 * `app/assistant/turns.validate` is the only code that knows what was asked,
 * and a second validator in TypeScript is exactly the drift the server-driven
 * design was chosen to avoid. What happens here is the cheap part — telling
 * somebody a box is empty without a round trip — and the inverted-window check,
 * which the backend genuinely does not do and which would otherwise produce a
 * plan that breaches on the day it is captured.
 *
 * Everything else is the server's 422, mapped onto the field it names.
 */
export function StepForm({
  step,
  active,
  submitting,
  fieldErrors,
  formError,
  onSubmit,
}: {
  step: ApiStep
  active: boolean
  submitting: boolean
  /** Per-field messages from a server 422, keyed by field name. */
  fieldErrors: Record<string, string>
  /** A failure that is not attributable to one field. */
  formError: string | null
  onSubmit: (values: FormValues) => void
}) {
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(step.fields)
  )
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [localFormError, setLocalFormError] = useState<string | null>(null)
  /**
   * Set the moment anything is typed, cleared on submit.
   *
   * A server rejection describes one particular submission. Once the planner
   * starts changing the answers, that message is about something they are no
   * longer proposing — and a red alert contradicting the fields under it
   * teaches people the form is broken rather than that they made a mistake.
   * So the server's messages are hidden while editing and come back, updated,
   * on the next attempt.
   */
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false)

  // Server errors win where both exist: they describe the submission that was
  // actually rejected, whereas a local error describes the state before it
  // was sent.
  const serverErrors = editedSinceSubmit ? {} : fieldErrors
  const errors = { ...localErrors, ...serverErrors }
  const disabled = !active || submitting

  function set(name: string, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setEditedSinceSubmit(true)
    // Clear a field's own error as soon as it is touched. A stale "Field
    // required" under a box somebody has just filled in reads as a rejection
    // of what they typed.
    setLocalErrors((previous) => {
      if (!(name in previous)) return previous
      const next = { ...previous }
      delete next[name]
      return next
    })
    setLocalFormError(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    // Also the guard against Enter held down on a text input: the parent's
    // in-flight ref stops the second POST, and this stops the second attempt
    // reaching it at all.
    if (disabled) return

    const missing = missingRequired(step.fields, values)
    if (missing.length > 0) {
      setLocalErrors(
        Object.fromEntries(missing.map((name) => [name, "This is required."]))
      )
      setLocalFormError(
        missing.length === 1
          ? `${fieldLabel(step.fields, missing[0])} is needed before this can be recorded.`
          : `${missing.length} answers are needed before this can be recorded.`
      )
      focusField(missing[0])
      return
    }

    if (windowIsInverted(values)) {
      setLocalErrors({ window_end: "This is before the start date." })
      setLocalFormError(
        "The consumption window ends before it begins. A plan like that breaches on the day it is captured, so it is worth a second look at the two dates."
      )
      focusField("window_end")
      return
    }

    setLocalErrors({})
    setLocalFormError(null)
    setEditedSinceSubmit(false)
    onSubmit(values)
  }

  const shownFormError =
    localFormError ?? (editedSinceSubmit ? null : formError)

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      {step.fields.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          value={values[field.name] ?? ""}
          error={errors[field.name]}
          disabled={disabled}
          onChange={(value) => set(field.name, value)}
        />
      ))}

      {shownFormError && (
        <p className="text-xs text-destructive" role="alert">
          {shownFormError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button type="submit" size="sm" disabled={disabled}>
          {submitting ? "Recording…" : "Record this"}
        </Button>
        {/* The platform never blocks. Saying so beside the button is the honest
            framing: the reservation is the planner's to make, and what this
            form does is record the reason, not withhold permission. */}
        <span className="text-[11px] text-muted-foreground">
          Nothing is blocked. This is recorded alongside your reservation.
        </span>
      </div>
    </form>
  )
}

/**
 * Move focus to the first field that needs attention.
 *
 * Without this, a submit that fails validation leaves focus on the button and
 * a keyboard user has to hunt back up the form for whichever box was the
 * problem — and on the plan form there are six.
 */
function focusField(name: string) {
  if (typeof document === "undefined") return
  const element = document.getElementById(`field-${name}`)
  if (element instanceof HTMLElement) element.focus()
}

function FieldRow({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: ApiField
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const id = `field-${field.name}`
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy =
    [field.helpText ? helpId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <div className="group/field flex flex-col gap-1.5" data-disabled={disabled}>
      <Label htmlFor={id}>
        {field.label}
        {/* Marking the optional ones rather than the required ones: on the plan
            form most fields are required, so "where known" is the unusual case
            worth pointing at. Cost centre and work order are optional because
            the FRS says "where known" — a required one gets guessed, and a
            guessed cost centre on an audit record is worse than a blank. */}
        {!field.required && (
          <span className="text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </Label>

      <FieldInput
        id={id}
        field={field}
        value={value}
        disabled={disabled}
        invalid={Boolean(error)}
        describedBy={describedBy}
        onChange={onChange}
      />

      {/* Help text is instruction, not decoration: "leave blank if you
          genuinely do not know yet" changes what gets captured. */}
      {field.helpText && (
        <p id={helpId} className="text-[11px] text-muted-foreground">
          {field.helpText}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function FieldInput({
  id,
  field,
  value,
  disabled,
  invalid,
  describedBy,
  onChange,
}: {
  id: string
  field: ApiField
  value: string
  disabled: boolean
  invalid: boolean
  describedBy?: string
  onChange: (value: string) => void
}) {
  const shared = {
    id,
    name: field.name,
    disabled,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        {...shared}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.type === "select") {
    // A native select, not the styled one in components/ui. That one is a
    // popover built for filtering long lists; this is seven configured values
    // and the native control is what a planner gets on a phone anyway. It is
    // also the one that cannot get its keyboard behaviour wrong.
    return (
      <select
        {...shared}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
        )}
      >
        {/* An explicit empty option so the control does not open already
            showing a category nobody chose. A pre-selected reason on a
            justification is a reason nobody gave. */}
        <option value="">Choose one…</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Input
      {...shared}
      // A quantity is typed as a number for the keypad, but it leaves this
      // component as the string the input holds and is never parsed. Decimals
      // reach an append-only record a compliance engine reads, and a round
      // trip through a float turns 2.1 into 2.0999999999999996.
      type={
        field.type === "number" ? "number" : field.type === "date" ? "date" : "text"
      }
      inputMode={field.type === "number" ? "decimal" : undefined}
      min={field.type === "number" ? "0" : undefined}
      step={field.type === "number" ? "any" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
