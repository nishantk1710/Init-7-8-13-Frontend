"use client"

import { useState } from "react"
import { CircleAlert, Loader2, Minus, PenLine, Plus, Send } from "lucide-react"

import { AI_BUTTON, AiIconBadge } from "@/components/assistant/ai-visuals"
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
 * ## Validation is required-only, and duplicates the server rather than extending it
 *
 * `app/assistant/turns.validate` is the only code that knows what was asked,
 * and a second validator in TypeScript is exactly the drift the server-driven
 * design was chosen to avoid. What happens here is the cheap part — telling
 * somebody a box is empty, or that a date window runs backwards, without
 * spending a round trip on a POST that would be rejected anyway. The backend
 * checks both of those itself and stays authoritative.
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
      className={cn(
        "animate-ai-message-in overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow",
        disabled
          ? "border-border"
          : "border-ai-2/25 focus-within:shadow-lg focus-within:shadow-ai-2/10"
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-border bg-gradient-to-r from-ai-1/10 via-ai-2/5 to-ai-3/10 px-4 py-2.5">
        <AiIconBadge className="size-7 rounded-lg">
          <PenLine className="size-3.5" />
        </AiIconBadge>
        <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Your answer
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Two columns so a pair of dates sits side by side; every other field
            spans both. Order is still the server's. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {step.fields.map((field) => (
            <FieldRow
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              error={errors[field.name]}
              disabled={disabled}
              onChange={(value) => set(field.name, value)}
              className={field.type === "date" ? undefined : "sm:col-span-2"}
            />
          ))}
        </div>

        {shownFormError && (
          <p
            className="animate-ai-pop flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {shownFormError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button
            type="submit"
            disabled={disabled}
            className={cn(AI_BUTTON, "relative h-9 gap-1.5 overflow-hidden px-4")}
          >
            {/* A light sweep across the button while it is waiting for input. */}
            {!disabled && (
              <span
                aria-hidden
                className="animate-ai-shimmer pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.28)_50%,transparent_65%)] bg-[length:200%_100%]"
              />
            )}
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {submitting ? "Recording…" : "Record this"}
          </Button>
          {/* The platform never blocks. Saying so beside the button is the honest
              framing: the reservation is the planner's to make, and what this
              form does is record the reason, not withhold permission. */}
          <span className="text-[11px] text-muted-foreground">
            Nothing is blocked. This is recorded alongside your reservation.
          </span>
        </div>
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
  className,
}: {
  field: ApiField
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
  className?: string
}) {
  const id = `field-${field.name}`
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy =
    [field.helpText ? helpId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <div className={cn("group/field flex flex-col gap-1.5", className)} data-disabled={disabled}>
      <Label htmlFor={id}>
        {field.label}
        {/* Marking the optional ones rather than the required ones: on the plan
            form most fields are required, so "where known" is the unusual case
            worth pointing at. */}
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

      {/* Help text is instruction, not decoration: it changes what gets
          captured. */}
      {field.helpText && (
        <p id={helpId} className="text-[11px] text-muted-foreground">
          {field.helpText}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="animate-ai-fade flex items-center gap-1 text-[11px] text-destructive"
          role="alert"
        >
          <CircleAlert className="size-3" aria-hidden />
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
        className={FOCUS_ACCENT}
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
          FOCUS_ACCENT,
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

  const input = (
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
      className={cn(FOCUS_ACCENT, field.type === "number" && "text-center tabular-nums")}
    />
  )

  if (field.type !== "number") return input

  // Stepper buttons for whole numbers only. A decimal is left to the keyboard
  // rather than nudged through float arithmetic (see the note above).
  const whole = value === "" || /^\d+$/.test(value)
  const current = value === "" ? 0 : Number(value)
  return (
    <div className="flex items-center gap-1.5">
      <StepButton
        label={`Decrease ${field.label}`}
        disabled={disabled || !whole || current <= 0}
        onClick={() => onChange(String(current - 1))}
      >
        <Minus className="size-3.5" />
      </StepButton>
      <div className="min-w-0 flex-1">{input}</div>
      <StepButton
        label={`Increase ${field.label}`}
        disabled={disabled || !whole}
        onClick={() => onChange(String(current + 1))}
      >
        <Plus className="size-3.5" />
      </StepButton>
    </div>
  )
}

/** The assistant's accent on a focused field. */
const FOCUS_ACCENT = "focus-visible:border-ai-2 focus-visible:ring-ai-2/20"

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground transition-all hover:border-ai-2/40 hover:bg-ai-2/10 hover:text-ai-2 active:scale-90 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
