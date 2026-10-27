"use client"

import { SELECT_CLASS } from "@/components/assistant/request/request-parts"
import { RequiredMark } from "@/components/assistant/step-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import { parseQuantity, type DeclarationDraft } from "@/lib/assistant/request/lines"

/**
 * Option B (27-Oct): the faulty unit coming out is declared with the request,
 * so nobody has to come back to the Declarations screen for it. Optional:
 * left closed, the line sends nothing. The name is typed, not a sign-in.
 * Options come from the preview, never a list of our own.
 */
export function DeclarationFields({
  idPrefix,
  value,
  showErrors,
  faultCategories,
  recommendations,
  onChange,
}: {
  idPrefix: string
  value: DeclarationDraft
  showErrors: boolean
  faultCategories: readonly string[]
  recommendations: readonly ApiReasonCategory[]
  onChange: (next: DeclarationDraft) => void
}) {
  const set = (patch: Partial<DeclarationDraft>) => onChange({ ...value, ...patch })
  const missing = (empty: boolean) => showErrors && empty
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
      <label className="flex w-fit items-center gap-2 text-xs font-medium text-foreground">
        <input type="checkbox" checked={value.open} onChange={(e) => set({ open: e.target.checked })} />
        Taking out a faulty unit? Declare it
      </label>
      {value.open && (
        <div className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr]">
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
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${idPrefix}-drec`} label="Recommendation" required>
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
          <div className="sm:col-span-3">
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
          <div className="sm:col-span-2">
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
          <Field id={`${idPrefix}-dev`} label="Evidence reference (optional)">
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
  children,
}: {
  id: string
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {label} {required && <RequiredMark />}
      </label>
      {children}
    </div>
  )
}
