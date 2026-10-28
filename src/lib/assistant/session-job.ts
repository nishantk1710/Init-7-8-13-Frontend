import type { ApiLinkedReservation } from "@/lib/api/assistant"
import type { ApiJobMovement, ApiSessionJob } from "@/lib/api/i8"
import { linkedReservationsHref } from "@/lib/assistant/session-reservations"
import { formatDay } from "@/lib/assistant/trace-format"

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
  returned: "Returned to stock",
  returnedNote: "Posted when the repaired unit came back.",
  repairs: "Repair raised under this reference",
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
  return (list ?? []).map((m) => ({ date: formatDay(m.postedOn), quantity: qty(m.quantity) }))
}

/** A register stage as the Repairable Spares screens word it. */
const STAGE_LABELS: Record<string, string> = {
  "PR Raised": "Repair requested",
  "PO Issued": "PO issued",
  "At Vendor": "At vendor",
}

function stageText(status: string): string {
  return STAGE_LABELS[status] ?? status
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
      requirementDate: formatDay(r.requirementDate),
      issued: movements(r.issued),
      returned: movements(r.returned),
    })),
    repairs: repairs.map((r) => ({
      rowId: r.rowId,
      href: repairRowHref(r.rowId),
      label: `${r.type === "PR" ? "Repair request PR" : "Repair PO"} ${r.document}/${r.item}`,
      status: stageText(r.status),
    })),
  }
}

// --- Linked in SAP -----------------------------------------------------------

/** One reservation item that carries the reference, with what moved against it. */
export type LinkedReservationRow = {
  key: string
  /** `{reservation}/{item}`. */
  reference: string
  /** Where it opens: the Utilization Ledger for OAR; none for a repairable part. */
  href: string | null
  /** Linked through the UAT stand-in, not read from SAP. */
  fromUat: boolean
  order: string | null
  /** `2 needed by 04 May 2026`, when the job read it. */
  needed: string | null
  /** Null when the job was not read (OAR, or an older backend): nothing to say. */
  issued: JobMovementRow[] | null
  returned: JobMovementRow[] | null
}

export type LinkedInSapView = {
  linked: boolean
  reservations: LinkedReservationRow[]
  repairs: JobRepairRow[]
}

/** `0000123/0001` and `123/1` are the same reservation item. */
function itemKey(reservation: string, item: string): string {
  const trim = (v: string) => v.replace(/^0+(?=\d)/, "")
  return `${trim(reservation)}/${trim(item)}`
}

/**
 * ONE panel for what SAP has linked to a session: the reservation items whose
 * text carries the reference (from the trace), merged with the job behind a
 * repairable session (its issues to the job, returns to stock and the repair
 * raised under the same reference). Before 28-Oct-2026 these were two panels
 * that both said "not linked yet".
 */
export function linkedInSapView({
  flow,
  sessionId,
  linked,
  job,
}: {
  flow: string
  sessionId: string
  linked: readonly ApiLinkedReservation[] | undefined
  job: SessionJobView | null
}): LinkedInSapView {
  const rows = new Map<string, LinkedReservationRow>()
  const href = flow === "i13" ? linkedReservationsHref({ flow, sessionId }) : null
  if (job?.kind === "linked") {
    for (const r of job.reservations) {
      const [reservation, item = ""] = r.reference.split("/")
      rows.set(itemKey(reservation, item), {
        key: r.key,
        reference: r.reference,
        href,
        fromUat: false,
        order: r.order,
        needed: `${r.quantity} needed by ${r.requirementDate}`,
        issued: r.issued,
        returned: r.returned,
      })
    }
  }
  for (const l of linked ?? []) {
    const key = itemKey(l.reservationNumber, l.reservationItem)
    const existing = rows.get(key)
    const fromUat = l.source === "UAT_SGTXT"
    if (existing) {
      existing.fromUat = existing.fromUat || fromUat
      continue
    }
    rows.set(key, {
      key: `linked-${l.reservationNumber}-${l.reservationItem}`,
      reference: `${l.reservationNumber}/${l.reservationItem}`,
      href,
      fromUat,
      order: null,
      needed: null,
      issued: null,
      returned: null,
    })
  }
  const repairs = job?.kind === "linked" ? job.repairs : []
  const reservations = [...rows.values()]
  return { linked: reservations.length > 0 || repairs.length > 0, reservations, repairs }
}
