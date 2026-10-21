/**
 * A page's content as a downloadable file -- Word, PDF or plain text.
 *
 * A page describes what it shows as an {@link ExportDocument} (headings,
 * paragraphs, label/value fields, tables) and the three writers turn that into
 * files, so every format carries the same content and wording. docx and jspdf
 * are loaded on first use, as exceljs is, so a page costs nothing until
 * somebody clicks Download.
 */

import { toast } from "sonner"

import { saveBlob } from "@/lib/download-file"

export type ExportFormat = "docx" | "pdf" | "txt"

export const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "docx", label: "Word (.docx)" },
  { format: "pdf", label: "PDF (.pdf)" },
  { format: "txt", label: "Text (.txt)" },
]

const MIME: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain;charset=utf-8",
}

/** One table cell: its lines, top to bottom. */
export type ExportCell = string[]

export type ExportBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string; muted?: boolean }
  | { kind: "fields"; rows: [string, string][] }
  | { kind: "table"; columns: string[]; rows: ExportCell[][] }

export type ExportDocument = {
  title: string
  subtitle?: string
  generatedAt: string
  blocks: ExportBlock[]
}

/** `<prefix>-<id>-<yyyy-mm-dd>.<ext>`, the day in local time. */
export function exportFilename(prefix: string, id: string, format: ExportFormat, now: Date = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-")
  return `${prefix}-${id}-${day}.${format}`
}

// --- writers --------------------------------------------------------------------

/** Plain text. A table becomes one block per row: seven columns do not survive Notepad. */
export function toTxt(doc: ExportDocument): string {
  const out: string[] = [doc.title, ...(doc.subtitle ? [doc.subtitle] : []), `Generated ${doc.generatedAt}`]
  for (const block of doc.blocks) {
    switch (block.kind) {
      case "heading":
        out.push("", block.text.toUpperCase(), "=".repeat(block.text.length))
        break
      case "paragraph":
        out.push("", block.text)
        break
      case "fields": {
        const width = Math.max(...block.rows.map(([k]) => k.length))
        out.push("")
        for (const [k, v] of block.rows) out.push(`${`${k}:`.padEnd(width + 2)}${v}`)
        break
      }
      case "table": {
        const width = Math.max(...block.columns.map((c) => c.length))
        for (const row of block.rows) {
          out.push("")
          row.forEach((cell, i) => {
            cell.forEach((text, j) => out.push(`${(j === 0 ? `${block.columns[i]}:` : "").padEnd(width + 2)}${text}`))
          })
        }
        break
      }
    }
  }
  out.push("")
  return out.join("\r\n")
}

export async function toDocx(doc: ExportDocument): Promise<Blob> {
  const {
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
        (text, i) => new Paragraph({ children: [new TextRun({ text, bold: header || i === 0, size: 18 })] })
      ),
    })

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(doc.title)] }),
    ...(doc.subtitle ? [new Paragraph({ children: [new TextRun({ text: doc.subtitle, italics: true })] })] : []),
    new Paragraph({ children: [new TextRun({ text: `Generated ${doc.generatedAt}`, size: 16, color: "666666" })] }),
  ]
  for (const block of doc.blocks) {
    switch (block.kind) {
      case "heading":
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(block.text)] }))
        break
      case "paragraph":
        children.push(
          new Paragraph({
            spacing: { before: 120 },
            children: [new TextRun({ text: block.text, size: 18, color: block.muted ? "666666" : undefined })],
          })
        )
        break
      case "fields":
        children.push(
          new Table({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders,
            rows: block.rows.map(([k, v]) => new TableRow({ children: [cell([k], true), cell([v])] })),
          })
        )
        break
      case "table":
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders,
            rows: [
              new TableRow({ tableHeader: true, children: block.columns.map((h) => cell([h], true)) }),
              ...block.rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
            ],
          })
        )
        break
    }
  }

  const document = new Document({
    creator: "Spares AI",
    title: doc.title,
    sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children }],
  })
  return Packer.toBlob(document)
}

export async function toPdf(doc: ExportDocument): Promise<Blob> {
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const margin = 40
  const width = pdf.internal.pageSize.getWidth() - margin * 2
  const bottom = pdf.internal.pageSize.getHeight() - margin
  const lastY = () => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  /** Room for `height` more points, or a new page. */
  const ensure = (height: number) => {
    if (y + height > bottom) {
      pdf.addPage()
      y = margin
    }
  }

  let y = margin + 8
  pdf.setFont("helvetica", "bold").setFontSize(18).text(doc.title, margin, y)
  if (doc.subtitle) pdf.setFont("helvetica", "italic").setFontSize(10).text(doc.subtitle, margin, (y += 18))
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(110).text(`Generated ${doc.generatedAt}`, margin, (y += 14))
  pdf.setTextColor(0)
  y += 6

  const styles = { fontSize: 8, cellPadding: 4, valign: "top" as const, lineColor: 210, lineWidth: 0.5 }
  const headStyles = { fillColor: 239, textColor: 30, fontStyle: "bold" as const }

  for (const block of doc.blocks) {
    switch (block.kind) {
      case "heading":
        ensure(30)
        pdf.setFont("helvetica", "bold").setFontSize(11).text(block.text, margin, (y += 20))
        pdf.setFont("helvetica", "normal")
        y += 4
        break
      case "paragraph": {
        const lines = pdf.setFontSize(8).splitTextToSize(block.text, width) as string[]
        ensure(lines.length * 10 + 8)
        if (block.muted) pdf.setTextColor(110)
        pdf.text(lines, margin, (y += 12))
        pdf.setTextColor(0)
        y += (lines.length - 1) * 10
        break
      }
      case "fields":
        autoTable(pdf, {
          startY: y + 6,
          margin: { left: margin, right: margin },
          tableWidth: width * 0.55,
          theme: "grid",
          styles,
          columnStyles: { 0: { fontStyle: "bold", fillColor: 239, cellWidth: 130 } },
          body: block.rows,
        })
        y = lastY()
        break
      case "table":
        autoTable(pdf, {
          startY: y + 6,
          margin: { left: margin, right: margin },
          theme: "grid",
          styles,
          headStyles,
          head: [block.columns],
          body: block.rows.map((cells) => cells.map((c) => c.join("\n"))),
        })
        y = lastY()
        break
    }
  }
  return pdf.output("blob")
}

/** Builds the file and hands it to the browser; a failure is a toast, not a crash. */
export async function downloadDocument(doc: ExportDocument, format: ExportFormat, filename: string): Promise<boolean> {
  try {
    const blob =
      format === "txt"
        ? // The BOM makes older Notepad read "·" and "–" as UTF-8.
          new Blob(["﻿", toTxt(doc)], { type: MIME.txt })
        : format === "docx"
          ? await toDocx(doc)
          : await toPdf(doc)
    saveBlob(blob, filename)
    return true
  } catch (error) {
    console.error(`${format} export failed`, error)
    toast.error("Could not create the file. Please try again.")
    return false
  }
}
