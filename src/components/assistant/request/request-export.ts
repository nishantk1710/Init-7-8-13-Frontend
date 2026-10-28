/**
 * The request summary as a file -- Word, PDF or plain text -- with the same
 * content and wording as the screen. The writers are the shared ones in
 * `lib/export-document`.
 */

import { formatDate, reasonLabel } from "@/components/assistant/request/request-parts"
import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"
import { formatInstant } from "@/lib/assistant/trace-format"
import { departmentLabel, isDeclined, outcomeSentence } from "@/lib/assistant/request/record"
import {
  downloadDocument,
  exportFilename,
  type ExportBlock,
  type ExportCell,
  type ExportDocument,
  type ExportFormat,
} from "@/lib/export-document"

export const LINE_COLUMNS = [
  "Reference",
  "Material",
  "Decision",
  "Window · purpose",
  "Reason given",
  "SAP link",
] as const

export type RequestExportModel = {
  title: string
  subtitle: string
  generatedAt: string
  details: [string, string][]
  note: string
  lines: ExportCell[][]
  skipped: { materialId: string; plant: string; reason: string }[]
  linkSummary: string
}

function plain(value: string | null): string {
  if (value === null) return "—"
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

function lineCells(line: ApiRequestLine): ExportCell[] {
  const procured = line.flow === "i13" && line.decision === "proceed"
  const material = [
    `${line.materialId} (${line.flow === "i13" ? "OAR" : "Repairable"})`,
    line.materialDescription ?? "No description",
    `Plant ${line.plant}`,
  ]
  const decision = procured
    ? [`${plain(line.plannedQuantity)} (suggested ${plain(line.suggestedQuantity)})`, outcomeSentence(line)]
    : [outcomeSentence(line)]
  const window = procured
    ? [`${formatDate(line.windowStart)} – ${formatDate(line.windowEnd)}`, ...(line.purpose ? [line.purpose] : [])]
    : ["—"]
  const reason = line.justification
    ? [reasonLabel(line.justification.reasonCategory), ...(line.justification.freeText ? [line.justification.freeText] : [])]
    : ["—"]
  const link =
    line.linkedReservations.length === 0
      ? ["Not linked yet"]
      : line.linkedReservations.map(
          (l) => `${l.reservationNumber}/${l.reservationItem} · SGTXT "${l.sgtxt}"${l.note ? ` · ${l.note}` : ""}`
        )
  return [[line.reference], material, decision, window, reason, link]
}

/** Everything the summary page shows, as text. */
export function requestExportModel(request: ApiRequest, now: Date = new Date()): RequestExportModel {
  const toReserve = request.lines.filter((l) => !isDeclined(l)).length
  const linked = request.lines.reduce((n, l) => n + l.linkedReservations.length, 0)
  return {
    title: `Request ${request.requestId}`,
    subtitle: "What was decided for each material, and how to quote it in SAP.",
    generatedAt: formatInstant(now.toISOString()),
    details: [
      ["Type in SAP", request.requestId],
      ["Requested for", request.requestedFor ?? "—"],
      ["Plant", request.plant],
      ["Department", departmentLabel(request)],
      ["Department note", request.departmentNote ?? "—"],
      ["Issued", formatInstant(request.issuedAt)],
      ["Lines", String(request.lines.length)],
      ["To reserve", String(toReserve)],
      ["No session", String(request.skipped.length)],
    ],
    note:
      `Create one SAP reservation for this request and type ${request.requestId} into its header text, without /1, /2. ` +
      "SAP copies it to every item's text (SGTXT), and each item is matched to its line by material and plant.",
    lines: request.lines.map(lineCells),
    skipped: request.skipped.map((s) => ({ materialId: s.materialId, plant: s.plant, reason: s.reason })),
    linkSummary:
      linked === 0
        ? "No SAP reservation item carries these references yet. Links appear once a SAP extract with the item texts is loaded."
        : `${linked} SAP reservation item${linked === 1 ? "" : "s"} linked so far.`,
  }
}

/** The model as a document for the shared Word / PDF / text writers. */
export function requestDocument(model: RequestExportModel): ExportDocument {
  return {
    title: model.title,
    subtitle: model.subtitle,
    generatedAt: model.generatedAt,
    blocks: [
      { kind: "fields", rows: model.details },
      { kind: "paragraph", text: model.note },
      { kind: "heading", text: "Lines" },
      { kind: "table", columns: [...LINE_COLUMNS], rows: model.lines },
      ...(model.skipped.length > 0
        ? ([
            { kind: "heading", text: "No session: reserve as usual" },
            {
              kind: "table",
              columns: ["Material", "Plant", "Reason"],
              rows: model.skipped.map((s) => [[s.materialId], [s.plant], [s.reason]]),
            },
          ] satisfies ExportBlock[])
        : []),
      { kind: "paragraph", text: model.linkSummary },
    ],
  }
}

export function downloadRequest(request: ApiRequest, format: ExportFormat): Promise<boolean> {
  const now = new Date()
  return downloadDocument(
    requestDocument(requestExportModel(request, now)),
    format,
    exportFilename("request", request.requestId, format, now)
  )
}
