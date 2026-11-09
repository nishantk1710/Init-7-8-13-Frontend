"use client"

import { Fragment } from "react"
import { Ban, CheckCircle2, Lock, PiggyBank, RefreshCw, Sparkles, Trash2, Undo2 } from "lucide-react"

import { Chip, JustificationFields } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import {
  choiceOf,
  lineIssues,
  oarNeedsJustification,
  parseQuantity,
  requiredOf,
  suggestionSavingOf,
  toNumber,
  withChoice,
  withRequired,
  windowError,
  type LineSaving,
  type OarLine,
} from "@/lib/assistant/request/lines"
import { justificationPrompt, suggestionKind } from "@/lib/assistant/request/suggest"
import { cn, formatZAR } from "@/lib/utils"

/**
 * The OAR (I13) rows of a request.
 *
 * Reads left to right in the order the assistant asks: what is on hand, the
 * quantity the requester needs (typed first, 3 Nov), and only then what the
 * assistant suggests -- with a choice to lock the suggestion or their own
 * number, and what the suggestion saves. A reason is asked when their own
 * number is above or below the suggestion; then the consumption window
 * (prefilled from the locked quantity and the usage rate) and the purpose.
 * Every figure is the backend's assessment, exactly as a conversation would
 * show it.
 */
export function OarTable({
  rows,
  lineNumbers,
  showErrors,
  reasons,
  refusedKey,
  onChange,
  onRemove,
}: {
  rows: OarLine[]
  lineNumbers: Map<string, number>
  showErrors: boolean
  reasons: readonly ApiReasonCategory[]
  /** The row submit refused, outlined until it is changed. */
  refusedKey: string | null
  onChange: (next: OarLine) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="min-w-36 px-3 py-2 font-medium">Material</th>
            <th className="px-3 py-2 font-medium">On hand</th>
            <th className="w-[5.5rem] px-3 py-2 font-medium">
              <Step n={1}>You need</Step>
            </th>
            <th className="w-48 px-3 py-2 font-medium">
              <Step n={2}>
                Suggested <Sparkles className="size-3 text-action" aria-hidden />
              </Step>
            </th>
            <th className="w-40 px-3 py-2 font-medium">
              <Step n={3}>Consumption window</Step>
            </th>
            <th className="px-3 py-2 font-medium">
              <Step n={4}>Purpose</Step>
            </th>
            <th className="w-36 px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OarRow
              key={row.key}
              row={row}
              lineNo={lineNumbers.get(row.key) ?? 0}
              showErrors={showErrors}
              reasons={reasons}
              refused={row.key === refusedKey}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A numbered step in the column header: the order a row is filled in. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
        {n}
      </span>
      {children}
    </span>
  )
}

function OarRow({
  row,
  lineNo,
  showErrors,
  reasons,
  refused,
  onChange,
  onRemove,
}: {
  row: OarLine
  lineNo: number
  showErrors: boolean
  reasons: readonly ApiReasonCategory[]
  refused: boolean
  onChange: (next: OarLine) => void
  onRemove: (key: string) => void
}) {
  const declined = row.decision === "not_needed"
  const issues = lineIssues(row)
  const quantity = parseQuantity(row.quantity)
  const required = requiredOf(row)
  const choice = choiceOf(row)
  const saving = suggestionSavingOf(row)
  const justify = oarNeedsJustification(row)
  const kind = suggestionKind(row.suggested)
  const facts = row.preview.facts ?? {}
  const crossPlant = Array.isArray(facts.crossPlantStock)
    ? (facts.crossPlantStock as { plant: string; stockOnHand: string }[])
    : []
  const err = (name: string) => showErrors && issues.includes(name)
  // Said at the dates as soon as both are entered, not only after "Show what's missing".
  const windowProblem = declined ? null : windowError(row.windowStart, row.windowEnd)

  return (
    <Fragment>
      <tr
        className={cn(
          "border-t border-border align-top",
          declined && "bg-muted/30",
          refused && "outline-2 -outline-offset-2 outline-destructive"
        )}
      >
        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">/{lineNo}</td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold text-foreground">{row.materialId}</span>
            <span className={cn("text-sm text-foreground", declined && "line-through opacity-60")}>
              {row.description ?? <span className="text-muted-foreground italic">No description</span>}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Plant <span className="font-mono">{row.plant}</span>
            </span>
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground">
          <dl className="grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5">
            <dt>Stock</dt>
            <dd className="font-mono text-foreground">{figure(facts.stockOnHand)}</dd>
            <dt>Open PO</dt>
            <dd className="font-mono text-foreground">{figure(facts.openPoQuantity)}</dd>
            <dt>Use/month</dt>
            <dd className="font-mono text-foreground">{figure(facts.averageMonthlyConsumption)}</dd>
            <dt>Issues 12m</dt>
            <dd className="font-mono text-foreground">{figure(facts.consumptionCount12m)}</dd>
          </dl>
          {crossPlant.length > 0 && (
            <div className="mt-1 text-[11px]">
              Other plants: {crossPlant.map((c) => `${figure(c.stockOnHand)} at ${c.plant}`).join(", ")}
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          <Input
            inputMode="numeric"
            aria-label={`Quantity you need for ${row.materialId}`}
            value={row.required ?? ""}
            disabled={declined}
            aria-invalid={err("required quantity")}
            placeholder="Enter"
            onChange={(e) =>
              onChange(withRequired({ ...row, changed: false }, e.target.value, choice === "own" ? "own" : null))
            }
            className={cn(
              "h-8 w-16 font-mono",
              !declined && required === null && "border-action ring-2 ring-action/20"
            )}
          />
        </td>
        <td className="px-3 py-3">
          {required === null ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
              <Sparkles className="size-3.5 shrink-0 text-action" aria-hidden />
              Enter the quantity you need to see the suggestion.
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {kind === "suggested" && (
                  <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-accent-foreground">
                    <span className="text-[11px] font-medium">Suggested</span>
                    <span className="font-mono text-lg leading-none font-semibold">{row.suggested}</span>
                  </span>
                )}
                {kind === "covered" && (
                  <Chip tone="ready" className="py-1 text-xs">
                    <CheckCircle2 className="size-3.5" aria-hidden /> Stock covers it · suggest 0
                  </Chip>
                )}
                {kind === "none" && (
                  <Chip tone="muted" className="py-1 text-xs">
                    No suggestion
                  </Chip>
                )}
                {row.changed && (
                  <Chip tone="warn" title="The stock figures moved since this row was added; choose again.">
                    <RefreshCw className="size-3" /> Updated
                  </Chip>
                )}
              </div>
              {row.preview.suggestion?.reason && (
                <p
                  className="line-clamp-2 text-[11px] leading-snug text-muted-foreground"
                  title={row.preview.suggestion.reason}
                >
                  {row.preview.suggestion.reason}
                </p>
              )}
              {kind === "none" ? (
                <span className="text-[11px] text-muted-foreground">Your {required} is used, with a reason.</span>
              ) : (
                <div
                  className="flex w-full max-w-44 flex-col gap-1.5"
                  role="group"
                  aria-label={`Quantity to lock for ${row.materialId}`}
                >
                  <LockButton
                    due={choice === null}
                    chosen={choice === "suggested"}
                    onClick={() => onChange(withChoice(row, "suggested"))}
                    label={kind === "covered" ? "Not needed" : `Use ${row.suggested}`}
                    title={
                      kind === "covered"
                        ? "Stock and open orders already cover it: reserve nothing"
                        : "Lock the suggested quantity"
                    }
                  />
                  <LockButton
                    due={choice === null}
                    chosen={choice === "own"}
                    onClick={() => onChange(withChoice(row, "own"))}
                    label={`Use mine (${required})`}
                    title="Lock your own quantity"
                  />
                </div>
              )}
              <SavingStrip
                saving={saving}
                price={toNumber(row.preview.unitPrice?.price)}
                ownChosen={choice === "own"}
              />
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col items-start gap-1">
              <Input
                type="date"
                aria-label="Window start"
                value={row.windowStart}
                max={row.windowEnd || undefined}
                disabled={declined}
                aria-invalid={err("window start") || windowProblem !== null}
                aria-describedby={windowProblem ? `window-error-${row.key}` : undefined}
                onChange={(e) =>
                  onChange({
                    ...row,
                    windowStart: e.target.value,
                    windowEdited: true,
                  })
                }
                className="h-8 w-[8.5rem] text-xs"
              />
              <span className="pl-1 text-[11px] text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Window end"
                value={row.windowEnd}
                min={row.windowStart || undefined}
                disabled={declined}
                aria-invalid={err("window end") || windowProblem !== null}
                aria-describedby={windowProblem ? `window-error-${row.key}` : undefined}
                onChange={(e) =>
                  onChange({
                    ...row,
                    windowEnd: e.target.value,
                    windowEdited: true,
                  })
                }
                className="h-8 w-[8.5rem] text-xs"
              />
            </div>
            {windowProblem && (
              <span id={`window-error-${row.key}`} role="alert" className="text-[11px] font-medium text-destructive">
                {windowProblem}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          <Input
            aria-label={`Purpose for ${row.materialId}`}
            value={row.purpose}
            disabled={declined}
            aria-invalid={err("purpose")}
            placeholder="What for"
            onChange={(e) => onChange({ ...row, purpose: e.target.value })}
            className="h-8 w-full min-w-24"
          />
        </td>
        <td className="px-3 py-3">
          <RowStatus declined={declined} issues={issues} />
          <div className="mt-1.5 -ml-2 flex flex-wrap items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title={declined ? "Needed after all" : "After the assessment, this part is not needed"}
              onClick={() =>
                onChange(
                  declined
                    ? // Back to proceed: a locked "nothing needed" no longer holds.
                      withRequired({ ...row, decision: "proceed" }, row.required ?? "", choice === "own" ? "own" : null)
                    : { ...row, decision: "not_needed" }
                )
              }
            >
              {declined ? <Undo2 /> : <Ban />}
              {declined ? "Undo" : "Not needed"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Remove from request"
              aria-label={`Remove ${row.materialId}`}
              onClick={() => onRemove(row.key)}
            >
              <Trash2 className="text-destructive/80" />
            </Button>
          </div>
        </td>
      </tr>
      {justify && quantity !== null && (
        <tr className="align-top">
          <td />
          <td colSpan={7} className="px-3 pb-3">
            <JustificationFields
              idPrefix={row.key}
              prompt={justificationPrompt(row.suggested, quantity)}
              value={row.justification}
              showErrors={showErrors}
              reasons={reasons}
              onChange={(justification) => onChange({ ...row, justification })}
            />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

/**
 * One of the two quantity choices, a button of its own. Before either is
 * locked both are outlined in the action blue, so the choice reads as due;
 * the locked one fills, the other stays outlined to switch to.
 */
function LockButton({
  due,
  chosen,
  label,
  title,
  onClick,
}: {
  due: boolean
  chosen: boolean
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        chosen
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : due
            ? "border-action bg-action/5 text-action hover:bg-action/10"
            : "border-border bg-background text-foreground hover:border-action hover:text-action"
      )}
    >
      {chosen && <Lock className="size-3" aria-hidden />}
      {label}
    </button>
  )
}

/** A unit price with its cents: "R 59,745.08". */
function rand(amount: number): string {
  return `R ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * What taking the suggestion saves on the row, under the choice: the rand
 * amount and the sum behind it. Dimmed when the requester keeps their own
 * number, since that saving is then not counted.
 */
function SavingStrip({
  saving,
  price,
  ownChosen,
}: {
  saving: LineSaving | null
  price: number | null
  ownChosen: boolean
}) {
  if (saving === null || saving.units === null) return null
  if (saving.units === 0) {
    return <span className="text-[11px] text-muted-foreground">No saving: you need no more than the suggestion.</span>
  }
  const units = `${saving.units} unit${saving.units === 1 ? "" : "s"}`
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border-l-[3px] border-success bg-success/10 px-2.5 py-1.5",
        ownChosen && "opacity-60"
      )}
    >
      <PiggyBank className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold whitespace-nowrap text-success">
          Saves {saving.value === null ? units : formatZAR(saving.value)}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {saving.value !== null && price !== null
            ? `${saving.units} × ${rand(price)}`
            : `${units} · ${saving.priceNote ?? "No price"}`}
        </span>
        {ownChosen && (
          <span className="text-[11px] leading-snug text-muted-foreground">Not counted: your own number is used.</span>
        )}
      </div>
    </div>
  )
}

/** A backend figure as a plain number ("4.000" -> "4"); a dash when absent. */
export function figure(value: unknown): string {
  const n = toNumber(value)
  // At most two decimals: a monthly rate of 1/3 reads 0.33, not 0.3333333333.
  return n === null ? "—" : String(Math.round(n * 100) / 100)
}

export function RowStatus({
  declined,
  issues,
  declinedLabel = "Not needed",
}: {
  declined: boolean
  issues: string[]
  declinedLabel?: string
}) {
  if (declined) return <Chip tone="muted">{declinedLabel}</Chip>
  if (issues.length === 0) return <Chip tone="ready">Ready</Chip>
  return (
    <div className="flex flex-col gap-0.5">
      <Chip tone="todo" className="whitespace-normal">Needs {issues.length === 1 ? issues[0] : `${issues.length} things`}</Chip>
      {issues.length > 1 && <span className="text-[11px] leading-snug text-muted-foreground">{issues.join(", ")}</span>}
    </div>
  )
}
