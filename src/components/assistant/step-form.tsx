"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
 * Every field is declared by the backend — name, label, type, whether it is
 * required, its options and its help text. Nothing about the consumption plan
 * or the justification is hard-coded here, and in particular the
 * reason-category list is **not**: neither FRS names the categories, so they
 * are configuration on the backend (seven placeholders today, VZI's own list
 * pending). Holding a copy in the frontend would mean the day VZI supplies one
 * is a redeploy of two things instead of an `.env` change.
 *
 * ## Validation is required-only, on purpose
 *
 * `app/assistant/turns.validate` is the only code that knows what was asked. A
 * second validator in TypeScript is exactly the drift the server-driven design
 * was chosen to avoid. What happens here is the cheap part — telling somebody
 * a box is empty without a round trip — plus one rule the backend genuinely
 * does not check (see the window note below). Everything else is the server's
 * 422, rendered against the field it names.
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
  fieldErrors: Record<string, string>
  formError: string | null
  onSubmit: (values: FormValues) => void
}) {
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(step.fields)
  )
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [localFormError, setLocalFormError] = useState<string | null>(null)

  const errors = { ...localErrors, ...fieldErrors }
  const disabled = !active || submitting

  function set(name: string, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }))
    // Clear a field's error as soon as it is touched. Leaving a stale "Field
    // required" under a box somebody just filled reads as a rejection of what
    // they typed.
    setLocalErrors((previous) => {
      if (!(name in previous)) return previous
      const next = { ...previous }
      delete next[name]
      return next
    })
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (disabled) return

    const missing = missingRequired(step.fields, values)
    if (missing.length > 0) {
      setLocalErrors(
        Object.fromEntries(missing.map((name) => [name, "This is required."]))
      )
      setLocalFormError(
        `${fieldLabel(step.fields, missing[0])} is needed before this can be recorded.`
      )
      return
    }

    // The backend does not check this, and an inverted window breaches on the
    // day it is captured: FR-7 fires on "window end plus grace", so a plan
    // that ends before it starts raises an exception nobody caused.
    if (windowIsInverted(values)) {
      setLocalErrors({ window_end: "This is before the start date." })
      setLocalFormError(
        "The consumption window ends before it begins. Check the two dates."
      )
      return
    }

    setLocalErrors({})
    setLocalFormError(null)
    onSubmit(values)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
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

      {(localFormError || formError) && (
        <p className="text-xs text-destructive" role="alert">
          {localFormError ?? formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={disabled}>
          {submitting ? "Recording…" : "Record this"}
        </Button>
        {/* The platform never blocks. Saying so next to the button is the
            honest framing: the reservation is the planner's to make, and what
            this form does is record the reason, not withhold permission. */}
        <span className="text-[11px] text-muted-foreground">
          Nothing is blocked. This is recorded alongside your reservation.
        </span>
      </div>
    </form>
  )
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
  const describedBy =
    [field.helpText ? `${id}-help` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {field.label}
        {!field.required && (
          // Marking the optional ones rather than the required ones: on this
          // form most fields are required, and "where known" is the unusual
          // case worth pointing at. Cost centre and work order are optional
          // because the FRS says "where known" — a required one gets guessed.
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </label>

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
        <p id={`${id}-help`} className="text-[11px] text-muted-foreground">
          {field.helpText}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-[11px] text-destructive">
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
    disabled,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  }

  if (field.type === "textarea") {
    return (
      <textarea
        {...shared}
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
        )}
      />
    )
  }

  if (field.type === "select") {
    // A native select rather than the styled one. The options come from
    // backend configuration and there are seven of them; the styled Select in
    // components/ui is a popover built for filtering, which is more machinery
    // than a short fixed list needs, and the native control is what a planner
    // gets on a phone anyway.
    return (
      <select
        {...shared}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive",
          "md:text-sm dark:bg-input/30"
        )}
      >
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
      // A quantity is typed as a number for the keypad and the spinner, but it
      // leaves this component as the string the input holds and is never
      // parsed. Decimals reach an append-only record a compliance engine
      // reads, and a round trip through a float turns 2.1 into
      // 2.0999999999999996.
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      inputMode={field.type === "number" ? "decimal" : undefined}
      min={field.type === "number" ? "0" : undefined}
      step={field.type === "number" ? "any" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
