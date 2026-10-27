import { formatApiDate } from "@/lib/api/format"
import type { ApiJobMovement, ApiSessionJob } from "@/lib/api/i8"

/**
 * The job behind a repairable (I08) assistant session, as the session page
 * shows it: the reservation line(s) that carry its R-reference, the 261 that
 * issued the part to the job, the 262 that returned it to stock, and the
 * repair PR/PO raised under the same reference.
 *
 * The 262 is posted on the day the repaired unit comes back (measured 26-Oct:
 * the stores post it at receipt), so the label says that rather than
 * "returned unused".
 */

export const NOT_LINKED_TEXT = "Not linked yet: the reservation text does not carry this reference."

export const JOB_LABELS = {
  reserved: "Reserved",
  issued: "Issued to the job",
  returned: "Returned to stock (posted when the repaired unit came back)",
  repairs: "Repair",
} as const

export type JobMovementRow = { date: string; quantity: string }

export type JobReservationRow = {
  key: string
  /** `{reservation}/{item}`, the way the reservation is quoted elsewhere. */
  reference: string
  order: string | null
  quantity: string
  requirementDate: string
  issued: JobMovementRow[]
  returned: JobMovementRow[]
}

export type JobRepairRow = {
  rowId: string
  href: string
  label: string
  status: string
}

export type SessionJobView =
  | { kind: "not-linked"; text: string }
  | { kind: "linked"; reservations: JobReservationRow[]; repairs: JobRepairRow[] }

/** Strips a quantity's trailing zero decimals: "2.000" -> "2". Anything odd is shown as sent. */
function qty(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) && value.trim() !== "" ? String(n) : value
}

function movements(list: ApiJobMovement[] | undefined): JobMovementRow[] {
  return (list ?? []).map((m) => ({ date: formatApiDate(m.postedOn), quantity: qty(m.quantity) }))
}

export function repairRowHref(rowId: string): string {
  return `/repairable-spares/repair-register/${encodeURIComponent(rowId)}`
}

/**
 * The view for one session. `null` stands for a 404 (an unknown session, or
 * a backend without the route): both read as "not linked yet", never as an
 * error, because the reference simply has not reached SAP's reservation text.
 */
export function sessionJobView(job: ApiSessionJob | null): SessionJobView {
  const reservations = job?.reservations ?? []
  const repairs = job?.repairs ?? []
  if (reservations.length === 0 && repairs.length === 0) return { kind: "not-linked", text: NOT_LINKED_TEXT }
  return {
    kind: "linked",
    reservations: reservations.map((r) => ({
      key: `${r.reservation}-${r.item}`,
      reference: `${r.reservation}/${r.item}`,
      order: r.order || null,
      quantity: qty(r.quantity),
      requirementDate: formatApiDate(r.requirementDate),
      issued: movements(r.issued),
      returned: movements(r.returned),
    })),
    repairs: repairs.map((r) => ({
      rowId: r.rowId,
      href: repairRowHref(r.rowId),
      label: `${r.type === "PR" ? "Repair request" : "Repair order"} ${r.document}/${r.item}`,
      status: r.status,
    })),
  }
}
