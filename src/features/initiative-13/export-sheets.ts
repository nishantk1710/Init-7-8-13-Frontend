"use server"

import {
  getI13ActExceptionsList,
  getI13ConsumptionPlansList,
  getI13Grni,
  getI13LedgerList,
  getI13ReservationLedgerList,
  getI13UsagePatterns,
} from "@/lib/api/i13"
import type { ApiList } from "@/lib/api/client"
import type { ExportCell } from "@/lib/export-excel"
import type {
  ActExceptionFilters,
  LedgerFilters,
  ProcurementLedgerFilters,
} from "@/features/initiative-13/data/live-loaders"
import { PROCUREMENT_STATUS_LABELS } from "@/features/initiative-13/utils/delivery-status"
import { requiredByText } from "@/features/initiative-13/utils/required-by"
import { lifecycleView, reservationStatusQuery } from "@/features/initiative-13/utils/reservation-lifecycle"
import {
  AGING_BAND_LABEL,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_TYPE_LABEL,
  planIssuedStatus,
} from "@/features/initiative-13/utils/status-labels"
import { monthLabel } from "@/features/initiative-13/utils/usage-pattern"

/**
 * The Excel exports of the screens that had none (UAT, 25 Nov 2026): Usage
 * pattern, 30-Day GR-not-issued, both Ledger tabs, Exceptions and Captured
 * plans. As Server Actions, like `export-actions.ts`.
 *
 * Every export is every row the screen's filters match, not the 25 on screen,
 * fetched page by page in the screen's own order. Each returns the sheet ready
 * for `downloadExcel` -- headers and flat rows -- so only what the file holds
 * crosses to the browser. Read-only.
 */

export type Sheet = { headers: string[]; rows: ExportCell[][] }

/** Pages fetched at once after the first, which tells the total. */
const PARALLEL = 4

async function fetchAll<T>(page: (limit: number, offset: number) => Promise<ApiList<T>>, size: number): Promise<T[]> {
  const first = await page(size, 0)
  const rows = [...first.items]
  if (first.items.length < size) return rows
  if (first.total === null) {
    for (let offset = size; ; offset += size) {
      const next = await page(size, offset)
      rows.push(...next.items)
      if (next.items.length < size) return rows
    }
  }
  const offsets: number[] = []
  for (let offset = size; offset < first.total; offset += size) offsets.push(offset)
  for (let i = 0; i < offsets.length; i += PARALLEL) {
    const pages = await Promise.all(offsets.slice(i, i + PARALLEL).map((offset) => page(size, offset)))
    for (const next of pages) rows.push(...next.items)
  }
  return rows
}

/**
 * The Ledger tabs export their first rows only (agreed with the user,
 * 27 Nov 2026): unfiltered they hold about 250,000 rows each, which no request
 * can fetch inside Azure's 230-second limit and no workbook is read whole.
 * Newest first, with the screen's filters -- filter to narrow what is exported.
 */
const LEDGER_EXPORT_ROWS = 1000

/** The first `size` rows, in the screen's order: one request. */
async function firstRows<T>(page: (limit: number, offset: number) => Promise<ApiList<T>>, size: number): Promise<T[]> {
  return (await page(size, 0)).items
}

const scope = (filters: LedgerFilters) => ({
  plant: filters.plant || undefined,
  material: filters.material || undefined,
})

const reservation = (number: string | null | undefined, item: string | null | undefined) =>
  number ? (item ? `${number}/${item}` : number) : null

/** Usage pattern: one row per material and plant, a column per month of history. */
export async function exportUsageSheet(filters: LedgerFilters & { agingBand?: string } = {}): Promise<Sheet> {
  const rows = await fetchAll(
    (limit, offset) =>
      getI13UsagePatterns({ ...scope(filters), agingBand: filters.agingBand || undefined, limit, offset }),
    2000
  )
  const months = rows.find((r) => r.months.length > 0)?.months.map((m) => m.month) ?? []
  return {
    headers: [
      "Material",
      "Description",
      "Plant",
      "Aging band",
      "Stock on hand",
      "Issued in history",
      "Active months",
      "Last issue month",
      ...months.map((m) => `Issued ${monthLabel(m)}`),
    ],
    rows: rows.map((r) => {
      const byMonth = new Map(r.months.map((m) => [m.month, m.issuedQuantity]))
      return [
        r.material,
        r.materialDescription ?? null,
        r.plant,
        r.agingBand ? (AGING_BAND_LABEL[r.agingBand] ?? r.agingBand) : null,
        r.stockOnHand,
        r.issuedQuantityTotal,
        r.activeMonths,
        r.lastIssueMonth ? monthLabel(r.lastIssueMonth) : null,
        ...months.map((m) => byMonth.get(m) ?? 0),
      ]
    }),
  }
}

/** 30-Day GR-not-issued: one row per PO line, oldest receipt first. */
export async function exportGrniSheet(filters: LedgerFilters = {}): Promise<Sheet> {
  const rows = await fetchAll((limit, offset) => getI13Grni({ ...scope(filters), limit, offset }), 1000)
  return {
    headers: [
      "Material",
      "Description",
      "Plant",
      "PO",
      "PR",
      "Reservation",
      "Received qty",
      "Issued qty",
      "Not issued qty",
      "First receipt",
      "Last receipt",
      "Days since receipt",
    ],
    rows: rows.map((r) => [
      r.material,
      r.materialDescription ?? null,
      r.plant,
      reservation(r.poNumber, r.poItem),
      reservation(r.prNumber, r.prItem),
      reservation(r.reservationNumber, r.reservationItem),
      r.receivedQuantity,
      r.issuedQuantity,
      r.outstandingQuantity,
      r.firstGrDate,
      r.lastGrDate,
      r.daysSinceGr,
    ]),
  }
}

/** Ledger, Reservations tab: the first `LEDGER_EXPORT_ROWS` reservation items, newest first. */
export async function exportReservationLedgerSheet(
  filters: LedgerFilters & { session?: string; reservation?: string; reservationStatus?: string; issued?: string } = {}
): Promise<Sheet> {
  const number = filters.reservation?.trim()
  const rows = await firstRows(
    (limit, offset) =>
      getI13ReservationLedgerList({
        ...scope(filters),
        sessionId: filters.session || undefined,
        reservationNumber: number ? (/^\d+$/.test(number) ? number.replace(/^0+(?=\d)/, "") : number) : undefined,
        lifecycleStatus: reservationStatusQuery(filters.reservationStatus, filters.issued),
        limit,
        offset,
      }),
    LEDGER_EXPORT_ROWS
  )
  return {
    headers: [
      "Material",
      "Description",
      "Plant",
      "Reservation",
      "Required by",
      "SAP requirement date",
      "Qty",
      "Issued qty",
      "Last issue",
      "Stage",
      "Session",
      "Item text",
      "Requester",
    ],
    rows: rows.map((r) => [
      r.material,
      r.materialDescription ?? null,
      r.plant,
      reservation(r.reservationNumber, r.reservationItem),
      requiredByText(r),
      r.requirementDate,
      r.reservationQuantity,
      r.issuedQuantity,
      r.lastIssueDate,
      lifecycleView(r.lifecycleStatus).label,
      r.sessionReference,
      r.sgtxt,
      r.requesterName ?? (r.sessionId ? "Not given" : "Non-AI"),
    ]),
  }
}

/** Ledger, Procurement lines tab: the first `LEDGER_EXPORT_ROWS` PO / PR lines, newest first. */
export async function exportProcurementLinesSheet(filters: ProcurementLedgerFilters = {}): Promise<Sheet> {
  const rows = await firstRows(
    (limit, offset) =>
      getI13LedgerList({
        ...scope(filters),
        procurementStatus: filters.procurementStatus || undefined,
        utilisationStatus: filters.utilisationStatus || undefined,
        deliveryStatus: filters.deliveryStatus || undefined,
        document: filters.document || undefined,
        hasReservation:
          filters.reservationCreated === "yes" ? true : filters.reservationCreated === "no" ? false : undefined,
        limit,
        offset,
      }),
    LEDGER_EXPORT_ROWS
  )
  return {
    headers: [
      "Material",
      "Description",
      "Plant",
      "PO",
      "PR",
      "Reservation",
      "Ordered qty",
      "Received qty",
      "Issued qty",
      "First receipt",
      "Latest receipt",
      "Expected delivery",
      "Procurement",
    ],
    rows: rows.map((r) => [
      r.material,
      r.materialDescription ?? null,
      r.plant,
      reservation(r.poNumber, r.poItem),
      reservation(r.prNumber, r.prItem),
      reservation(r.reservationNumber, r.reservationItem),
      r.orderedQuantity,
      r.receivedQuantity,
      r.issuedQuantity,
      r.firstGrDate,
      r.latestGrDate,
      r.expectedDeliveryDate,
      PROCUREMENT_STATUS_LABELS[r.procurementStatus] ?? r.procurementStatus,
    ]),
  }
}

/** Exceptions: the queue the filters show -- the open ones unless a status is picked, as on screen. */
export async function exportExceptionsSheet(filters: ActExceptionFilters = {}): Promise<Sheet> {
  const rows = await fetchAll(
    (limit, offset) =>
      getI13ActExceptionsList({
        ...scope(filters),
        type: filters.type || undefined,
        status: filters.status || undefined,
        openOnly: !filters.status,
        limit,
        offset,
      }),
    5000
  )
  return {
    headers: [
      "Exception",
      "Type",
      "Status",
      "Material",
      "Description",
      "Plant",
      "Reservation",
      "Session",
      "Owner",
      "Detected",
      "Due",
      "Escalated",
      "Closed",
      "Reason",
    ],
    rows: rows.map((r) => [
      r.exceptionId,
      EXCEPTION_TYPE_LABEL[r.exceptionType] ?? r.exceptionType,
      EXCEPTION_STATUS_LABEL[r.status] ?? r.status,
      r.material,
      r.materialDescription ?? null,
      r.plant,
      reservation(r.reservationNumber, r.reservationItem),
      r.sessionId,
      r.ownerRequesterId,
      r.detectedAt,
      r.requesterDueAt,
      r.escalatedAt,
      r.resolvedAt,
      r.reason,
    ]),
  }
}

/** The dashboard's Captured plans tab: every plan captured in the assistant. */
export async function exportCapturedPlansSheet(filters: LedgerFilters = {}): Promise<Sheet> {
  const rows = await fetchAll(
    (limit, offset) => getI13ConsumptionPlansList({ ...scope(filters), limit, offset }),
    500
  )
  return {
    headers: [
      "Material",
      "Description",
      "Plant",
      "Purpose",
      "Required qty",
      "Window start",
      "Window end",
      "Issued qty",
      "Acquired vs required",
      "Reservation",
      "Session",
      "Captured",
      "Captured by",
    ],
    rows: rows.map((r) => [
      r.material,
      r.materialDescription ?? null,
      r.plant,
      r.purpose,
      r.plannedQuantity,
      r.windowStart,
      r.windowEnd,
      r.acquiredVsPlanStatus === "NO_RESERVATION" ? null : (r.issuedQuantity ?? null),
      r.acquiredVsPlanStatus ? planIssuedStatus(r.acquiredVsPlanStatus, r.issuedQuantity).label : "Not measured",
      reservation(r.reservationNumber, r.reservationItem) ?? "Not linked",
      r.sessionId,
      r.capturedAt,
      r.capturedBy,
    ]),
  }
}
