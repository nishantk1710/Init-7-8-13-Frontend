"use client"

import { Check, Trash2 } from "lucide-react"

import { DeclarationFields } from "@/components/assistant/request/declaration-fields"
import { RowStatus, figure } from "@/components/assistant/request/oar-table"
import { Chip, JustificationFields, formatDate } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import {
  I08_WANT_NEW_NOTE,
  isPositiveQuantity,
  noUsableUnitText,
  repairRequestsOf,
  requestAgePhrase,
  requestReference,
  stockView,
  type I08StockView,
} from "@/lib/assistant/i08-facts-format"
import {
  EMPTY_DECLARATION,
  lineIssues,
  repairableNeedsJustification,
  toNumber,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { cn } from "@/lib/utils"

/**
 * The repairable (I08) rows of a request.
 *
 * A row asks one question -- use the unit that exists, or proceed with a new
 * one -- and only when a unit exists at all. With nothing usable in stock and
 * nothing on repair or requested there is nothing to decide, and the row is
 * ready as added. The figures are the backend's I08 assessment record, read
 * through the same formatter as the conversation's card, so a record from
 * before the 27-Oct usable/damaged split and repair requests shows as before.
 */

type OpenRepair = {
  purchasingDocument: string
  item?: string
  quantity: string
  dueDate: string | null
  daysOverdue: number | null
  vendorName: string | null
  vendor: string | null
}
export function RepairableTable({
  rows,
  lineNumbers,
  showErrors,
  reasons,
  faultCategories = [],
  recommendations = [],
  refusedKey,
  onChange,
  onRemove,
}: {
  rows: RepairableLine[]
  lineNumbers: Map<string, number>
  showErrors: boolean
  reasons: readonly ApiReasonCategory[]
  /** From the preview; none (an older backend) hides the declaration section. */
  faultCategories?: readonly string[]
  recommendations?: readonly ApiReasonCategory[]
  refusedKey: string | null
  onChange: (next: RepairableLine) => void
  onRemove: (key: string) => void
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key}>
          <RepairableCard
            row={row}
            lineNo={lineNumbers.get(row.key) ?? 0}
            showErrors={showErrors}
            reasons={reasons}
            faultCategories={faultCategories}
            recommendations={recommendations}
            refused={row.key === refusedKey}
            onChange={onChange}
            onRemove={onRemove}
          />
        </li>
      ))}
    </ul>
  )
}

/** One repairable material as a card: what it is, what exists, the decision, and the reason when one is needed. */
function RepairableCard({
  row,
  lineNo,
  showErrors,
  reasons,
  faultCategories,
  recommendations,
  refused,
  onChange,
  onRemove,
}: {
  row: RepairableLine
  lineNo: number
  showErrors: boolean
  reasons: readonly ApiReasonCategory[]
  faultCategories: readonly string[]
  recommendations: readonly ApiReasonCategory[]
  refused: boolean
  onChange: (next: RepairableLine) => void
  onRemove: (key: string) => void
}) {
  const exists = row.unitExists
  const issues = lineIssues(row)
  const declined = row.decision === "use_existing"
  const needsReason = repairableNeedsJustification(row)

  return (
    <article
      aria-label={`Line ${lineNo}: ${row.materialId}`}
      className={cn(
        "overflow-hidden rounded-card border border-line bg-card",
        refused && "outline-2 -outline-offset-2 outline-destructive"
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground">/{lineNo}</span>
        <span className="font-mono text-sm font-bold text-foreground">{row.materialId}</span>
        <span className="min-w-0 text-sm text-foreground">
          {row.description ?? <span className="text-muted-foreground italic">No description</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          Plant <span className="font-mono">{row.plant}</span>
        </span>
        {row.preview.alsoMatched && (
          <Chip tone="muted" title="80-series and OAR: the repairable check runs, as the router decides.">
            Also OAR · checked as repairable
          </Chip>
        )}
        <span className="ml-auto flex items-center gap-2">
          <Chip tone="warn">Repairable</Chip>
          <RowStatus declined={declined} issues={issues} declinedLabel="Use existing" />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            title="Remove from request"
            aria-label={`Remove ${row.materialId}`}
            onClick={() => onRemove(row.key)}
          >
            <Trash2 className="text-destructive/80" aria-hidden />
          </Button>
        </span>
      </header>
      <div className="grid gap-5 p-4 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">What already exists</span>
          <ExistingUnits row={row} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Your decision</span>
          {exists ? (
            <>
              <div
                role="radiogroup"
                aria-label={`Decision for ${row.materialId}`}
                className={cn(
                  "grid grid-cols-2 gap-1 rounded-lg border border-line bg-muted/50 p-1",
                  showErrors && row.decision === null && "border-destructive"
                )}
              >
                <Segment active={row.decision === "use_existing"} onClick={() => onChange({ ...row, decision: "use_existing" })}>
                  Use existing
                </Segment>
                <Segment active={row.decision === "proceed_new"} onClick={() => onChange({ ...row, decision: "proceed_new" })}>
                  Proceed with new
                </Segment>
              </div>
              {row.decision === "use_existing" && (
                <span className="text-xs text-muted-foreground">No new unit will be reserved.</span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Nothing to decide -- no usable unit in stock or on repair. Proceed with a new one.
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className={cn("text-xs font-semibold", needsReason ? "text-muted-foreground" : "text-muted-foreground/60")}>
            Why a new one?
          </span>
          {needsReason ? (
            <JustificationFields
              idPrefix={row.key}
              prompt="A unit already exists. Why is a new one needed?"
              note={I08_WANT_NEW_NOTE}
              value={row.justification}
              showErrors={showErrors}
              reasons={reasons}
              onChange={(justification) => onChange({ ...row, justification })}
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {declined ? "Not needed: the existing unit is used." : "Asked only when you proceed with a new unit."}
            </span>
          )}
        </div>
      </div>
      {faultCategories.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <DeclarationFields
            idPrefix={row.key}
            value={row.declaration ?? EMPTY_DECLARATION}
            showErrors={showErrors}
            faultCategories={faultCategories}
            recommendations={recommendations}
            onChange={(declaration) => onChange({ ...row, declaration })}
          />
        </div>
      )}
    </article>
  )
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "bg-card text-foreground shadow-sm ring-1 ring-line" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function ExistingUnits({ row }: { row: RepairableLine }) {
  const f = row.preview.facts ?? {}
  const view = stockView(f)
  const repairs = Array.isArray(f.openRepairs) ? (f.openRepairs as OpenRepair[]) : []
  const requests = repairRequestsOf(f)
  const leadTime = typeof f.newUnitLeadTimeDays === "number" ? f.newUnitLeadTimeDays : null
  const lead = leadTime !== null ? `A new unit takes about ${leadTime} days.` : ""
  if (!row.unitExists) {
    return (
      <span className="text-sm text-muted-foreground">
        {noUsableUnitText(f)} {lead}
      </span>
    )
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      <StockItems view={view} legacyStock={toNumber(f.stockOnHand) ?? 0} />
      {repairs.map((r) => {
        const overdue = (r.daysOverdue ?? 0) > 0
        return (
          // Keyed by PO and item: two items of one repair PO are two rows.
          <li key={`po-${r.purchasingDocument}-${r.item ?? ""}`} className="flex flex-wrap items-center gap-1.5">
            <Chip tone={overdue ? "warn" : "muted"}>{figure(r.quantity)} on repair</Chip>
            <span className="text-muted-foreground">
              {r.vendorName ?? r.vendor ?? "vendor"}, due {formatDate(r.dueDate)}
              {overdue ? <span className="text-destructive"> · {r.daysOverdue} days overdue</span> : " · on time"}
            </span>
          </li>
        )
      })}
      {requests.map((r) => (
        // A repair request has no PO yet, so no vendor and no date to show.
        <li key={`pr-${r.purchaseRequisition}-${r.item}`} className="flex flex-wrap items-center gap-1.5">
          <Chip tone="muted">{figure(r.quantity)} requested</Chip>
          <span className="text-muted-foreground">
            {requestReference(r)} · {requestAgePhrase(r.daysSinceRequested)}, not yet ordered
          </span>
        </li>
      ))}
      {lead && <li className="text-xs text-muted-foreground">{lead}</li>}
    </ul>
  )
}

/** The highlighted "ready to issue" block, in the card style. */
function ReadyStock({ figureText, note }: { figureText: string; note: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
        <Check className="size-4" strokeWidth={3} />
      </span>
      <span className="flex flex-col">
        <span className="font-bold text-foreground">{figureText}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </span>
    </li>
  )
}

/**
 * Stock as the record splits it. Only usable units can be issued; damaged ones
 * are shown so the planner knows why they are not offered. An older record
 * keeps the single block it always had.
 */
function StockItems({ view, legacyStock }: { view: I08StockView; legacyStock: number }) {
  if (view.state === "known") {
    return (
      <>
        {isPositiveQuantity(view.usable) && (
          <ReadyStock figureText={`${figure(view.usable)} usable`} note="New or refurbished, ready to issue." />
        )}
        {isPositiveQuantity(view.damaged) && (
          <li className="flex items-center gap-1.5">
            <Chip tone="muted">{figure(view.damaged)} damaged</Chip>
            <span className="text-muted-foreground">not usable</span>
          </li>
        )}
      </>
    )
  }
  if (view.state === "condition-unknown") {
    if (!isPositiveQuantity(view.total)) return null
    return <ReadyStock figureText={`${figure(view.total)} in stock`} note="Condition unknown." />
  }
  if (legacyStock <= 0) return null
  return <ReadyStock figureText={`${legacyStock} in stock`} note="Repaired, ready to issue." />
}
