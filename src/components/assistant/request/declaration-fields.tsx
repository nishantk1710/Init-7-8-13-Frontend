"use client"

import { SELECT_CLASS } from "@/components/assistant/request/request-parts"
import { RequiredMark } from "@/components/assistant/step-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import { parseQuantity, withDeclarationOpen, type DeclarationDraft } from "@/lib/assistant/request/lines"
import { faultCategoryLabel } from "@/lib/assistant/session-view"
import { cn } from "@/lib/utils"

/**
 * Option B (27-Oct): the faulty unit coming out is declared with the request,
 * so nobody has to come back to the Declarations screen for it. Optional:
 * left closed, the line sends nothing. The name is typed, not a sign-in; on
 * opening it is filled from the request's Requester and stays editable.
 * Options come from the preview, never a list of our own.
 */
export function DeclarationFields({
  idPrefix,
  value,
  showErrors,
  faultCategories,
  recommendations,
  requester = "",
  onChange,
}: {
  idPrefix: string
  value: DeclarationDraft
  /** The request's Requester, filled into "Your name" when the section opens. */
  requester?: string
  showErrors: boolean
  faultCategories: readonly string[]
  recommendations: readonly ApiReasonCategory[]
  onChange: (next: DeclarationDraft) => void
}) {
  const set = (patch: Partial<DeclarationDraft>) => onChange({ ...value, ...patch })
  const missing = (empty: boolean) => showErrors && empty
  return (
    <div className="@container flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
      <label className="flex w-fit items-center gap-2 text-xs font-medium text-foreground">
        <input
          type="checkbox"
          checked={value.open}
          onChange={(e) => onChange(withDeclarationOpen(value, e.target.checked, requester))}
        />
        Taking out a faulty unit? Declare it
      </label>
      {value.open && (
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 @xl:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]">
          <Field id={`${idPrefix}-dq`} label="Quantity" required>
            <Input
              id={`${idPrefix}-dq`}
              inputMode="numeric"
              value={value.quantity}
              aria-invalid={missing(parseQuantity(value.quantity) === null)}
              onChange={(e) => set({ quantity: e.target.value })}
              className="h-8 text-center tabular-nums"
            />
          </Field>
          <Field id={`${idPrefix}-dfc`} label="Fault category" required>
            <select
              id={`${idPrefix}-dfc`}
              className={SELECT_CLASS}
              value={value.faultCategory}
              aria-invalid={missing(!value.faultCategory)}
              onChange={(e) => set({ faultCategory: e.target.value })}
            >
              <option value="">Choose a category…</option>
              {faultCategories.map((c) => (
                <option key={c} value={c}>
                  {faultCategoryLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${idPrefix}-drec`} label="Recommendation" required className="col-span-2 @xl:col-span-1">
            <select
              id={`${idPrefix}-drec`}
              className={SELECT_CLASS}
              value={value.recommendation}
              aria-invalid={missing(!value.recommendation)}
              onChange={(e) => set({ recommendation: e.target.value })}
            >
              <option value="">Choose…</option>
              {recommendations.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="col-span-2 @xl:col-span-3">
            <Field id={`${idPrefix}-dcond`} label="Condition of the unit" required>
              <Textarea
                id={`${idPrefix}-dcond`}
                rows={1}
                value={value.conditionDescription}
                aria-invalid={missing(!value.conditionDescription.trim())}
                onChange={(e) => set({ conditionDescription: e.target.value })}
                className="min-h-8 text-sm"
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field id={`${idPrefix}-dname`} label="Your name (typed, not a sign-in)" required>
              <Input
                id={`${idPrefix}-dname`}
                value={value.attestorName}
                maxLength={128}
                aria-invalid={missing(!value.attestorName.trim())}
                onChange={(e) => set({ attestorName: e.target.value })}
                className="h-8"
              />
            </Field>
          </div>
          <Field id={`${idPrefix}-dev`} label="Evidence reference (optional)" className="col-span-2 @xl:col-span-1">
            <Input
              id={`${idPrefix}-dev`}
              value={value.evidenceReference}
              onChange={(e) => set({ evidenceReference: e.target.value })}
              className="h-8"
            />
          </Field>
        </div>
      )}
    </div>
  )
}

function Field({
  id,
  label,
  required,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  /** Grid placement, e.g. how many columns it spans. */
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {label} {required && <RequiredMark />}
      </label>
      {children}
    </div>
  )
}
