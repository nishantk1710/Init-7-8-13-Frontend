/**
 * The request summary as a file -- Word, PDF or plain text -- with the same
 * content and wording as the screen. One model ({@link requestExportModel})
 * feeds three writers, so the formats cannot drift apart. docx and jspdf are
 * loaded on first use, as exceljs is, so the page costs nothing until somebody
 * clicks Download.
 */

import { toast } from "sonner"

import { formatDate, reasonLabel } from "@/components/assistant/request/request-parts"
import type { ApiRequest, ApiRequestLine } from "@/lib/api/assistant-requests"
import { isDeclined, lineReference, outcomeSentence } from "@/lib/assistant/request/record"
import { saveBlob } from "@/lib/download-file"

export type RequestExportFormat = "docx" | "pdf" | "txt"

export const REQUEST_EXPORT_FORMATS: { format: RequestExportFormat; label: string }[] = [
  { format: "docx", label: "Word (.docx)" },
  { format: "pdf", label: "PDF (.pdf)" },
  { format: "txt", label: "Text (.txt)" },
]

const MIME: Record<RequestExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain;charset=utf-8",
}

export const LINE_COLUMNS = [
  "Reference for SGTXT",
  "Material",
  "Department",
  "Decision",
  "Window · purpose",
  "Reason given",
  "SAP link",
] as const

/** One cell: its lines, top to bottom. */
type Cell = string[]

export type RequestExportModel = {
  title: string
  subtitle: string
  generatedAt: string
  details: [string, string][]
  note: string
  lines: Cell[][]
  skipped: { materialId: string; plant: string; reason: string }[]
  linkSummary: string
}

function plain(value: string | null): string {
  if (value === null) return "—"
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

function lineCells(line: ApiRequestLine): Cell[] {
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
  return [[line.reference], material, [line.department ?? "—"], decision, window, reason, link]
}

/** Everything the summary page shows, as text. */
export function requestExportModel(request: ApiRequest, now: Date = new Date()): RequestExportModel {
  const toReserve = request.lines.filter((l) => !isDeclined(l)).length
  const linked = request.lines.reduce((n, l) => n + l.linkedReservations.length, 0)
  return {
    title: `Request ${request.requestId}`,
    subtitle: "What was decided for each material, and how to quote it in SAP.",
    generatedAt: now.toLocaleString("en-GB"),
    details: [
      ["Request reference", request.requestId],
      ["Requested for", request.requestedFor ?? "—"],
      ["Plant", request.plant],
      ["Departments", request.departments.length === 0 ? "No department" : request.departments.join(", ")],
      ["Issued", new Date(request.issuedAt).toLocaleString("en-GB")],
      ["Lines", String(request.lines.length)],
      ["To reserve", String(toReserve)],
      ["No session", String(request.skipped.length)],
    ],
    note:
      "On each SAP reservation item, type that line's reference into the item text (SGTXT), e.g. " +
      `${lineReference(request.requestId, 1)}. The /n helps a reader, but the link is made by request + material + plant, ` +
      "so a missing or wrong /n still links -- with a note.",
    lines: request.lines.map(lineCells),
    skipped: request.skipped.map((s) => ({ materialId: s.materialId, plant: s.plant, reason: s.reason })),
    linkSummary:
      linked === 0
        ? "No SAP reservation item carries these references yet. Links appear once a SAP extract with the item texts is loaded."
        : `${linked} SAP reservation item${linked === 1 ? "" : "s"} linked so far.`,
  }
}

export function requestExportFilename(request: ApiRequest, format: RequestExportFormat, now: Date = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-")
  return `request-${request.requestId}-${day}.${format}`
}

// --- writers --------------------------------------------------------------------

/** Plain text, one block per line: a seven-column table does not survive Notepad. */
export function toTxt(model: RequestExportModel): string {
  const out: string[] = [model.title, model.subtitle, `Generated ${model.generatedAt}`, ""]
  const width = Math.max(...model.details.map(([k]) => k.length))
  for (const [k, v] of model.details) out.push(`${`${k}:`.padEnd(width + 2)}${v}`)
  out.push("", model.note, "", "LINES", "=====")
  const labelWidth = Math.max(...LINE_COLUMNS.map((c) => c.length))
  for (const cells of model.lines) {
    out.push("")
    cells.forEach((cell, i) => {
      cell.forEach((text, j) => out.push(`${(j === 0 ? `${LINE_COLUMNS[i]}:` : "").padEnd(labelWidth + 2)}${text}`))
    })
  }
  if (model.skipped.length > 0) {
    out.push("", "NO SESSION -- RESERVE AS USUAL", "==============================")
    for (const s of model.skipped) out.push(`${s.materialId} (Plant ${s.plant}): ${s.reason}`)
  }
  out.push("", model.linkSummary, "")
  return out.join("\r\n")
}

export async function toDocx(model: RequestExportModel): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx")

  const border = { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" }
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }
  const cell = (texts: string[], header = false) =>
    new TableCell({
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "EFEFEF" } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: texts.map(
        (text, i) =>
          new Paragraph({
            children: [new TextRun({ text, bold: header || i === 0, size: 18 })],
          })
      ),
    })
  const table = (rows: string[][][], header: string[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({ tableHeader: true, children: header.map((h) => cell([h], true)) }),
        ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
      ],
    })

  const doc = new Document({
    creator: "Spares AI",
    title: model.title,
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(model.title)] }),
          new Paragraph({ children: [new TextRun({ text: model.subtitle, italics: true })] }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: `Generated ${model.generatedAt}`, size: 16, color: "666666" })],
          }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Request")] }),
          new Table({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders,
            rows: model.details.map(
              ([k, v]) => new TableRow({ children: [cell([k], true), cell([v])] })
            ),
          }),
          new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: model.note, size: 18 })] }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Lines")] }),
          table(model.lines, [...LINE_COLUMNS]),
          ...(model.skipped.length > 0
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  children: [new TextRun("No session -- reserve as usual")],
                }),
                table(
                  model.skipped.map((s) => [[s.materialId], [s.plant], [s.reason]]),
                  ["Material", "Plant", "Reason"]
                ),
              ]
            : []),
          new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: model.linkSummary, size: 18 })] }),
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}

export async function toPdf(model: RequestExportModel): Promise<Blob> {
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const margin = 40
  const width = doc.internal.pageSize.getWidth() - margin * 2
  let y = margin

  doc.setFont("helvetica", "bold").setFontSize(18).text(model.title, margin, (y += 8))
  doc.setFont("helvetica", "italic").setFontSize(10).text(model.subtitle, margin, (y += 18))
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110).text(`Generated ${model.generatedAt}`, margin, (y += 14))
  doc.setTextColor(0)

  const tableStyles = { fontSize: 8, cellPadding: 4, valign: "top" as const, lineColor: 210, lineWidth: 0.5 }
  const headStyles = { fillColor: 239, textColor: 30, fontStyle: "bold" as const }
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  autoTable(doc, {
    startY: y + 12,
    margin: { left: margin, right: margin },
    tableWidth: width * 0.55,
    theme: "grid",
    styles: tableStyles,
    columnStyles: { 0: { fontStyle: "bold", fillColor: 239, cellWidth: 110 } },
    body: model.details,
  })

  const note = doc.setFontSize(8).splitTextToSize(model.note, width)
  doc.text(note, margin, (y = lastY() + 16))
  y += note.length * 10

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: tableStyles,
    headStyles,
    head: [[...LINE_COLUMNS]],
    body: model.lines.map((cells) => cells.map((c) => c.join("\n"))),
  })

  if (model.skipped.length > 0) {
    doc.setFont("helvetica", "bold").setFontSize(10).text("No session -- reserve as usual", margin, lastY() + 20)
    doc.setFont("helvetica", "normal")
    autoTable(doc, {
      startY: lastY() + 26,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: tableStyles,
      headStyles,
      head: [["Material", "Plant", "Reason"]],
      body: model.skipped.map((s) => [s.materialId, s.plant, s.reason]),
    })
  }

  doc.setFontSize(8).text(doc.splitTextToSize(model.linkSummary, width), margin, lastY() + 16)
  return doc.output("blob")
}

/** Builds the file and hands it to the browser; a failure is a toast, not a crash. */
export async function downloadRequest(request: ApiRequest, format: RequestExportFormat): Promise<boolean> {
  try {
    const now = new Date()
    const model = requestExportModel(request, now)
    const blob =
      format === "txt"
        ? // The BOM makes older Notepad read "·" and "–" as UTF-8.
          new Blob(["﻿", toTxt(model)], { type: MIME.txt })
        : format === "docx"
          ? await toDocx(model)
          : await toPdf(model)
    saveBlob(blob, requestExportFilename(request, format, now))
    return true
  } catch (error) {
    console.error(`Request ${format} export failed`, error)
    toast.error("Could not create the file. Please try again.")
    return false
  }
}
