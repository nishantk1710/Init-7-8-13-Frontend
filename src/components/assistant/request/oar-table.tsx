"use client"

import { Fragment } from "react"
import { Ban, RefreshCw, RotateCcw, Sparkles, Trash2, Undo2 } from "lucide-react"

import { Chip, DepartmentSelect, JustificationFields } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import {
  lineIssues,
  oarNeedsJustification,
  parseQuantity,
  toNumber,
  withSuggestedWindow,
  type OarLine,
} from "@/lib/assistant/request/lines"
import { justificationPrompt, suggestionKind, suggestionLabel, suggestWindow } from "@/lib/assistant/request/suggest"
import { cn } from "@/lib/utils"

/**
 * The OAR (I13) rows of a request.
 *
 * Reads left to right in the order the assistant asks: what is on hand, what
 * it suggests, the quantity (prefilled with that suggestion), a reason only if
 * the quantity goes above it, then the consumption window (prefilled from the
 * quantity and the usage rate) and the purpose. Every figure is the backend's
 * assessment, exactly as a conversation would show it.
 */
export function OarTable({
  rows,
  lineNumbers,
  showErrors,
  departments,
  reasons,
  refusedKey,
  onChange,
  onRemove,
}: {
  rows: OarLine[]
  lineNumbers: Map<string, number>
  showErrors: boolean
  departments: readonly string[]
  reasons: readonly ApiReasonCategory[]
  /** The row submit refused, outlined until it is changed. */
  refusedKey: string | null
  onChange: (next: OarLine) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1240px] text-sm">
        <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="min-w-44 px-3 py-2 font-medium">Material</th>
            <th className="w-32 px-3 py-2 font-medium">Department</th>
            <th className="px-3 py-2 font-medium">On hand</th>
            <th className="w-48 px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3 text-ai-2" aria-hidden />1 · Suggested
              </span>
            </th>
            <th className="w-24 px-3 py-2 font-medium">2 · Quantity</th>
            <th className="w-[19rem] px-3 py-2 font-medium">3 · Consumption window</th>
            <th className="px-3 py-2 font-medium">4 · Purpose</th>
            <th className="w-40 px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OarRow
              key={row.key}
              row={row}
              lineNo={lineNumbers.get(row.key) ?? 0}
              showErrors={showErrors}
              departments={departments}
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

function OarRow({
  row,
  lineNo,
  showErrors,
  departments,
  reasons,
  refused,
  onChange,
  onRemove,
}: {
  row: OarLine
  lineNo: number
  showErrors: boolean
  departments: readonly string[]
  reasons: readonly ApiReasonCategory[]
  refused: boolean
  onChange: (next: OarLine) => void
  onRemove: (key: string) => void
}) {
  const declined = row.decision === "not_needed"
  const issues = lineIssues(row)
  const quantity = parseQuantity(row.quantity)
  const justify = oarNeedsJustification(row)
  const kind = suggestionKind(row.suggested)
  const facts = row.preview.facts ?? {}
  const crossPlant = Array.isArray(facts.crossPlantStock)
    ? (facts.crossPlantStock as { plant: string; stockOnHand: string }[])
    : []
  const err = (name: string) => showErrors && issues.includes(name)
  const suggestedWindow = suggestWindow(quantity, row.rate)
  const windowDiffers =
    row.windowEdited &&
    suggestedWindow !== null &&
    (suggestedWindow.start !== row.windowStart || suggestedWindow.end !== row.windowEnd)

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
        <td className="px-3 py-3">
          <DepartmentSelect
            codes={departments}
            label={`Department for ${row.materialId}`}
            value={row.department}
            disabled={declined}
            invalid={err("department")}
            onChange={(department) => onChange({ ...row, department })}
          />
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
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-fit rounded-md px-2 py-0.5 font-mono text-base font-bold",
                  kind === "suggested" && "ai-gradient text-white",
                  kind === "covered" && "bg-success/15 text-success",
                  kind === "none" && "bg-muted font-sans text-xs font-medium text-muted-foreground"
                )}
              >
                {suggestionLabel(row.suggested)}
              </span>
              {row.changed && (
                <Chip tone="warn" title="The stock figures moved since this row was added; review the quantity.">
                  <RefreshCw className="size-3" /> Updated
                </Chip>
              )}
            </span>
            <span className="text-[11px] leading-snug text-muted-foreground">{row.preview.suggestion?.reason}</span>
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1">
            <Input
              inputMode="numeric"
              aria-label={`Quantity for ${row.materialId}`}
              value={row.quantity}
              disabled={declined}
              aria-invalid={err("quantity")}
              placeholder={row.suggested === null ? "Enter" : "0"}
              onChange={(e) => onChange(withSuggestedWindow({ ...row, quantity: e.target.value, changed: false }))}
              className="h-8 w-20 font-mono"
            />
            {!declined && row.suggested !== null && row.suggested > 0 && quantity !== row.suggested && (
              <button
                type="button"
                className="inline-flex w-fit items-center gap-1 text-[11px] text-ai-2 hover:underline"
                onClick={() => onChange(withSuggestedWindow({ ...row, quantity: String(row.suggested), changed: false }))}
              >
                <RotateCcw className="size-3" aria-hidden />
                Use {row.suggested}
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                aria-label="Window start"
                value={row.windowStart}
                disabled={declined}
                aria-invalid={err("window start") || err("window ends before it starts")}
                onChange={(e) => onChange({ ...row, windowStart: e.target.value, windowEdited: true })}
                className="h-8 w-[8.5rem] text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Window end"
                value={row.windowEnd}
                disabled={declined}
                aria-invalid={err("window end") || err("window ends before it starts")}
                onChange={(e) => onChange({ ...row, windowEnd: e.target.value, windowEdited: true })}
                className="h-8 w-[8.5rem] text-xs"
              />
            </div>
            {!declined && !row.windowEdited && suggestedWindow && (
              <span className="text-[11px] text-muted-foreground">
                Suggested: {suggestedWindow.months} month{suggestedWindow.months === 1 ? "" : "s"} at {figure(row.rate)}/month
              </span>
            )}
            {!declined && !suggestedWindow && row.rate <= 0 && (
              <span className="text-[11px] text-muted-foreground">No usage rate -- enter the window.</span>
            )}
            {!declined && windowDiffers && (
              <button
                type="button"
                className="inline-flex w-fit items-center gap-1 text-[11px] text-ai-2 hover:underline"
                onClick={() => onChange(withSuggestedWindow({ ...row, windowEdited: false }))}
              >
                <RotateCcw className="size-3" aria-hidden />
                Use suggested ({suggestedWindow.months} mo)
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          <Input
            aria-label={`Purpose for ${row.materialId}`}
            value={row.purpose}
            disabled={declined}
            aria-invalid={err("purpose")}
            placeholder="What it is for"
            onChange={(e) => onChange({ ...row, purpose: e.target.value })}
            className="h-8 min-w-40"
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
              onClick={() => onChange({ ...row, decision: declined ? "proceed" : "not_needed" })}
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
          <td colSpan={8} className="px-3 pb-3">
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
      <Chip tone="todo">Needs {issues.length === 1 ? issues[0] : `${issues.length} things`}</Chip>
      {issues.length > 1 && <span className="text-[11px] leading-snug text-muted-foreground">{issues.join(", ")}</span>}
    </div>
  )
}
