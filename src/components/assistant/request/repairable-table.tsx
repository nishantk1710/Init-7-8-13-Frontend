"use client"

import { Fragment } from "react"
import { Trash2 } from "lucide-react"

import { RowStatus, figure } from "@/components/assistant/request/oar-table"
import { Chip, JustificationFields, formatDate } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import {
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
 * one -- and only when a unit exists at all. With nothing in stock and nothing
 * on repair there is nothing to decide, and the row is ready as added. The
 * figures are the backend's I08 assessment record, as a conversation shows it.
 */

type OpenRepair = {
  purchasingDocument: string
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
  refusedKey,
  onChange,
  onRemove,
}: {
  rows: RepairableLine[]
  lineNumbers: Map<string, number>
  showErrors: boolean
  reasons: readonly ApiReasonCategory[]
  refusedKey: string | null
  onChange: (next: RepairableLine) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Material</th>
            <th className="px-3 py-2 font-medium">What already exists</th>
            <th className="w-[18rem] px-3 py-2 font-medium">Decision</th>
            <th className="w-36 px-3 py-2 font-medium">Status</th>
            <th className="w-12 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RepairableRow
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

function RepairableRow({
  row,
  lineNo,
  showErrors,
  reasons,
  refused,
  onChange,
  onRemove,
}: {
  row: RepairableLine
  lineNo: number
  showErrors: boolean
  reasons: readonly ApiReasonCategory[]
  refused: boolean
  onChange: (next: RepairableLine) => void
  onRemove: (key: string) => void
}) {
  const exists = row.unitExists
  const issues = lineIssues(row)
  const declined = row.decision === "use_existing"

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
            <span className="text-sm text-foreground">
              {row.description ?? <span className="text-muted-foreground italic">No description</span>}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Plant <span className="font-mono">{row.plant}</span>
            </span>
            {row.preview.alsoMatched && (
              <Chip tone="muted" className="mt-1" title="80-series and OAR: the repairable check runs, as the router decides.">
                Also OAR · checked as repairable
              </Chip>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-xs">
          <ExistingUnits row={row} />
        </td>
        <td className="px-3 py-3">
          {exists ? (
            <div className="flex flex-col gap-1">
              <div
                role="radiogroup"
                aria-label={`Decision for ${row.materialId}`}
                className={cn(
                  "inline-flex w-fit rounded-lg border border-border p-0.5",
                  showErrors && row.decision === null && "border-destructive"
                )}
              >
                <Segment
                  active={row.decision === "use_existing"}
                  onClick={() => onChange({ ...row, decision: "use_existing" })}
                >
                  Use existing
                </Segment>
                <Segment
                  active={row.decision === "proceed_new"}
                  onClick={() => onChange({ ...row, decision: "proceed_new" })}
                >
                  Proceed with new
                </Segment>
              </div>
              {row.decision === "use_existing" && (
                <span className="text-[11px] text-muted-foreground">No new unit will be reserved.</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Nothing to decide -- no unit in stock or on repair. Proceed with a new one.
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          <RowStatus declined={declined} issues={issues} declinedLabel="Use existing" />
        </td>
        <td className="px-3 py-3">
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
        </td>
      </tr>
      {repairableNeedsJustification(row) && (
        <tr className="align-top">
          <td />
          <td colSpan={5} className="px-3 pb-3">
            <JustificationFields
              idPrefix={row.key}
              prompt="A unit already exists. Why is a new one needed?"
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
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "ai-gradient text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function ExistingUnits({ row }: { row: RepairableLine }) {
  const f = row.preview.facts ?? {}
  const stock = toNumber(f.stockOnHand) ?? 0
  const repairs = Array.isArray(f.openRepairs) ? (f.openRepairs as OpenRepair[]) : []
  const leadTime = typeof f.newUnitLeadTimeDays === "number" ? f.newUnitLeadTimeDays : null
  const lead = leadTime !== null ? `A new unit takes about ${leadTime} days.` : ""
  if (!row.unitExists) {
    return <span className="text-muted-foreground">None in stock, none on repair. {lead}</span>
  }
  return (
    <ul className="flex flex-col gap-1">
      {stock > 0 && (
        <li className="flex items-center gap-1.5">
          <Chip tone="ready">{stock} in stock</Chip>
          <span className="text-muted-foreground">repaired, ready to issue</span>
        </li>
      )}
      {repairs.map((r) => {
        const overdue = (r.daysOverdue ?? 0) > 0
        return (
          <li key={`${r.purchasingDocument}`} className="flex flex-wrap items-center gap-1.5">
            <Chip tone={overdue ? "warn" : "muted"}>{figure(r.quantity)} on repair</Chip>
            <span className="text-muted-foreground">
              {r.vendorName ?? r.vendor ?? "vendor"}, due {formatDate(r.dueDate)}
              {overdue ? <span className="text-destructive"> · {r.daysOverdue} days overdue</span> : " · on time"}
            </span>
          </li>
        )
      })}
      {lead && <li className="text-[11px] text-muted-foreground">{lead}</li>}
    </ul>
  )
}
