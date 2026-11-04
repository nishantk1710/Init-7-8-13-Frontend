/**
 * The request summary as a file -- Word, PDF or plain text -- with the same
 * content and wording as the screen. The writers are the shared ones in
 * `lib/export-document`.
 */

import { formatDate, reasonLabel } from "@/components/assistant/request/request-parts"
import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"
import { declarationViewOf } from "@/lib/assistant/session-view"
import { formatInstant } from "@/lib/assistant/trace-format"
import {
  departmentLabel,
  isDeclined,
  outcomeSentence,
  requestSavings,
  savingSentence,
} from "@/lib/assistant/request/record"
import { formatZAR } from "@/lib/utils"
import {
  downloadDocument,
  exportFilename,
  type ExportBlock,
  type ExportCell,
  type ExportDocument,
  type ExportFormat,
} from "@/lib/export-document"

/**
 * The line table's columns for this request. "Window · purpose" belongs to an
 * OAR plan and "Declaration" to a repairable line (4-Nov-2026): each is there
 * only when the request has a line of that kind, so a repairable-only request
 * no longer carries a column of dashes.
 */
export function lineColumns(lines: readonly Pick<ApiRequestLine, "flow">[]): string[] {
  const oar = lines.some((l) => l.flow === "i13")
  const repairable = lines.some((l) => l.flow !== "i13")
  return [
    "Reference",
    "Material",
    "Decision",
    ...(oar ? ["Window · purpose"] : []),
    ...(repairable ? ["Declaration"] : []),
    "Reason given",
    "SAP link",
  ]
}

/** A declaration in a line of text: "2 units · Seal leak · Repairable, declared by J Miller". */
export function declarationText(line: Pick<ApiRequestLine, "declaration">): string | null {
  if (!line.declaration) return null
  const d = declarationViewOf(line.declaration)
  const units = `${d.quantity} unit${d.quantity === "1" ? "" : "s"}`
  return `${units} · ${d.fault} · ${d.assessment}, declared by ${d.name}`
}

export type RequestExportModel = {
  title: string
  subtitle: string
  generatedAt: string
  details: [string, string][]
  note: string
  /** The line table's columns (`lineColumns`) and its rows, cell for cell. */
  columns: string[]
  lines: ExportCell[][]
  skipped: { materialId: string; plant: string; reason: string }[]
  linkSummary: string
}

function plain(value: string | null): string {
  if (value === null) return "—"
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

function lineCells(line: ApiRequestLine, columns: readonly string[]): ExportCell[] {
  const procured = line.flow === "i13" && line.decision === "proceed"
  const material = [
    `${line.materialId} (${line.flow === "i13" ? "OAR" : "Repairable"})`,
    line.materialDescription ?? "No description",
    `Plant ${line.plant}`,
  ]
  const shown = line.saving ? line.saving.suggestedQuantity : line.suggestedQuantity
  const saved = savingSentence(line)
  const decision = [
    ...(procured ? [`${plain(line.plannedQuantity)} (suggested ${plain(shown)})`] : []),
    outcomeSentence(line),
    ...(saved ? [saved] : []),
  ]
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
  const declared = declarationText(line)
  const declaration = [line.flow === "i13" ? "—" : (declared ?? "Not declared")]
  return [
    [line.reference],
    material,
    decision,
    ...(columns.includes("Window · purpose") ? [line.flow === "i13" ? window : ["—"]] : []),
    ...(columns.includes("Declaration") ? [declaration] : []),
    reason,
    link,
  ]
}

/** Everything the summary page shows, as text. */
export function requestExportModel(request: ApiRequest, now: Date = new Date()): RequestExportModel {
  const columns = lineColumns(request.lines)
  const toReserve = request.lines.filter((l) => !isDeclined(l)).length
  const linked = request.lines.reduce((n, l) => n + l.linkedReservations.length, 0)
  const savings = requestSavings(request)
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
      ...(savings.units > 0
        ? ([
            [
              "Saved by suggestions",
              `${savings.units} unit${savings.units === 1 ? "" : "s"}` +
                (savings.value > 0 ? ` · ${formatZAR(savings.value)}` : "") +
                (savings.unpriced > 0 ? ` (${savings.unpriced} without a price)` : ""),
            ],
          ] as [string, string][])
        : []),
    ],
    note:
      `Create one SAP reservation for this request and type ${request.requestId} into its header text, without /1, /2. ` +
      "SAP copies it to every item's text (SGTXT), and each item is matched to its line by material and plant.",
    columns,
    lines: request.lines.map((line) => lineCells(line, columns)),
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
      { kind: "table", columns: model.columns, rows: model.lines },
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
