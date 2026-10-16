"use client"

import { Fragment } from "react"
import { Trash2 } from "lucide-react"

import { RowStatus } from "@/components/assistant/request/oar-table"
import { Chip, DepartmentSelect, JustificationFields, formatDate } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import {
  lineIssues,
  repairableNeedsJustification,
  repairableUnitExists,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { cn } from "@/lib/utils"

/**
 * The repairable (I08) rows of a request.
 *
 * A row asks one question -- use the unit that exists, or proceed with a new
 * one -- and only when a unit exists at all. With nothing in stock and nothing
 * on repair there is nothing to decide, and the row is ready as added.
 */
export function RepairableTable({
  rows,
  lineNumbers,
  showErrors,
  onChange,
  onRemove,
}: {
  rows: RepairableLine[]
  lineNumbers: Map<string, number>
  showErrors: boolean
  onChange: (next: RepairableLine) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1040px] text-sm">
        <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Material</th>
            <th className="w-32 px-3 py-2 font-medium">Department</th>
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
  onChange,
  onRemove,
}: {
  row: RepairableLine
  lineNo: number
  showErrors: boolean
  onChange: (next: RepairableLine) => void
  onRemove: (key: string) => void
}) {
  const exists = repairableUnitExists(row.facts)
  const issues = lineIssues(row)
  const declined = row.decision === "use_existing"

  return (
    <Fragment>
      <tr className={cn("border-t border-border align-top", declined && "bg-muted/30")}>
        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">/{lineNo}</td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold text-foreground">{row.material.materialId}</span>
            <span className="text-sm text-foreground">{row.material.description}</span>
            <span className="text-[11px] text-muted-foreground">
              Plant <span className="font-mono">{row.material.plant}</span> {row.material.plantName}
            </span>
            {row.alsoMatchedOar && (
              <Chip tone="muted" className="mt-1" title="80-series and OAR: the repairable check runs, as the router decides.">
                Also OAR · checked as repairable
              </Chip>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          <DepartmentSelect
            plant={row.material.plant}
            label={`Department for ${row.material.materialId}`}
            value={row.department}
            invalid={showErrors && issues.includes("department")}
            onChange={(department) => onChange({ ...row, department })}
          />
        </td>
        <td className="px-3 py-3 text-xs">
          <ExistingUnits row={row} />
        </td>
        <td className="px-3 py-3">
          {exists ? (
            <div className="flex flex-col gap-1">
              <div
                role="radiogroup"
                aria-label={`Decision for ${row.material.materialId}`}
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
            aria-label={`Remove ${row.material.materialId}`}
            onClick={() => onRemove(row.key)}
          >
            <Trash2 className="text-destructive/80" />
          </Button>
        </td>
      </tr>
      {repairableNeedsJustification(row) && (
        <tr className="align-top">
          <td />
          <td colSpan={6} className="px-3 pb-3">
            <JustificationFields
              idPrefix={row.key}
              prompt="A unit already exists. Why is a new one needed?"
              value={row.justification}
              showErrors={showErrors}
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
  const f = row.facts
  if (!repairableUnitExists(f)) {
    return (
      <span className="text-muted-foreground">
        None in stock, none on repair. A new unit takes about {f.newUnitLeadTimeDays} days.
      </span>
    )
  }
  return (
    <ul className="flex flex-col gap-1">
      {f.stockOnHand > 0 && (
        <li className="flex items-center gap-1.5">
          <Chip tone="ready">{f.stockOnHand} in stock</Chip>
          <span className="text-muted-foreground">repaired, ready to issue</span>
        </li>
      )}
      {f.openRepairs.map((r) => (
        <li key={r.purchasingDocument} className="flex flex-wrap items-center gap-1.5">
          <Chip tone={r.daysOverdue > 0 ? "warn" : "muted"}>
            {r.quantity} on repair
          </Chip>
          <span className="text-muted-foreground">
            {r.vendorName}, due {formatDate(r.dueDate)}
            {r.daysOverdue > 0 ? (
              <span className="text-destructive"> · {r.daysOverdue} days overdue</span>
            ) : (
              " · on time"
            )}
          </span>
        </li>
      ))}
      <li className="text-[11px] text-muted-foreground">New unit lead time about {f.newUnitLeadTimeDays} days.</li>
    </ul>
  )
}
