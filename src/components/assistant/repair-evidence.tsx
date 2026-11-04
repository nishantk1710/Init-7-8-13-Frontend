import { formatDate } from "@/components/assistant/request/request-parts"
import type { I08OpenRepair, I08OpenRepairRequest } from "@/lib/api/assistant-facts"
import {
  repairPoReference,
  repairsByDueDate,
  requestAgePhrase,
  requestDepartmentText,
  requestReference,
  unitsText,
} from "@/lib/assistant/i08-facts-format"
import { cn } from "@/lib/utils"

/**
 * The repairs behind an I08 assessment, as the chat's card and the request
 * builder both show them (4-Nov-2026: the two had drifted apart -- one showed
 * the PO number and no date, the other the date and no PO number, and its
 * vendor name read like a second material).
 *
 * Repair POs first, earliest due back first, each saying what a planner
 * types into SAP (PO and item), how many units, when it is due and whether it
 * is late, and -- labelled -- the vendor. Then the PRs raised for repair that
 * have no PO yet, which have neither a vendor nor a date: who raised them and
 * how long ago instead. `compact` is the chat card's smaller type.
 */
export function RepairEvidenceList({
  repairs,
  requests,
  compact = false,
}: {
  repairs: I08OpenRepair[]
  requests: I08OpenRepairRequest[]
  compact?: boolean
}) {
  if (repairs.length === 0 && requests.length === 0) return null
  return (
    <div className={cn("flex flex-col gap-3", compact ? "text-xs" : "text-[13px]")}>
      {repairs.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="On repair">
          <SectionLabel count={repairs.length}>On repair</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {repairsByDueDate(repairs).map((repair) => (
              // Keyed by PO and item: two items of one repair PO are two rows.
              <RepairItem key={`po-${repair.purchasingDocument}-${repair.item}`} repair={repair} />
            ))}
          </ul>
        </section>
      )}
      {requests.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="PR raised, no PO">
          <SectionLabel count={requests.length}>PR raised, no PO</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {requests.map((request) => (
              <RequestItem key={`pr-${request.purchaseRequisition}-${request.item}`} request={request} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * A line of facts that wraps between facts, never inside a date: the request
 * builder's column is narrow, and "Sent to vendor 24 / Jul 2026" broke there.
 * Each fact draws its separating dot in a gutter on its left, and the line is
 * shifted left by that gutter inside a clipping box (:func:`Facts`), so the
 * dot of whichever fact starts a line is clipped and only the dots between
 * facts show.
 */
const FACTS =
  "-ml-3 flex flex-wrap text-muted-foreground [&>span]:relative [&>span]:pl-3 " +
  "[&>span]:before:absolute [&>span]:before:left-0 [&>span]:before:w-3 [&>span]:before:text-center [&>span]:before:content-['·']"

function Facts({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden">
      <p className={FACTS}>{children}</p>
    </div>
  )
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
      {children} <span className="font-medium tabular-nums">· {count}</span>
    </p>
  )
}

function RepairItem({ repair }: { repair: I08OpenRepair }) {
  const overdue = repair.daysOverdue !== null && repair.daysOverdue > 0
  // The supplier master does not name every vendor: show the code rather than
  // a blank, and never invent a name.
  const vendor = repair.vendorName ?? repair.vendor
  return (
    <li
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border bg-background/60 px-3 py-2",
        overdue ? "border-destructive/30" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span>
          <span className="font-semibold text-foreground">{repairPoReference(repair)}</span>
          <span className="text-muted-foreground"> · {unitsText(repair.quantity)}</span>
        </span>
        {overdue ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium whitespace-nowrap text-destructive">
            {repair.daysOverdue} days overdue
          </span>
        ) : repair.dueDate ? (
          <span className="whitespace-nowrap text-muted-foreground">on time</span>
        ) : null}
      </div>
      <Facts>
        <span className="whitespace-nowrap">
          {repair.dueDate ? `Due ${formatDate(repair.dueDate)}` : "No due date recorded"}
        </span>
        {vendor && (
          <span>
            Vendor: <span className="text-foreground/80">{vendor}</span>
          </span>
        )}
        {repair.dispatched && (
          <span className="whitespace-nowrap">
            {repair.dispatchedAt ? `Sent to vendor ${formatDate(repair.dispatchedAt)}` : "Sent to vendor"}
          </span>
        )}
      </Facts>
    </li>
  )
}

function RequestItem({ request }: { request: I08OpenRepairRequest }) {
  const department = requestDepartmentText(request)
  return (
    <li className="flex flex-col gap-0.5 rounded-lg border border-dashed border-border bg-background/60 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span>
          <span className="font-semibold text-foreground">{requestReference(request)}</span>
          <span className="text-muted-foreground"> · {unitsText(request.quantity)}</span>
        </span>
        <span className="whitespace-nowrap text-muted-foreground">{requestAgePhrase(request.daysSinceRequested)}</span>
      </div>
      <Facts>
        <span>No PO yet, so no vendor or due date</span>
        {department && (
          <span>
            Raised by <span className="text-foreground/80">{department}</span>
          </span>
        )}
      </Facts>
    </li>
  )
}
