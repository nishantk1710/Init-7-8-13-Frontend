// The report as a PDF file: built in the browser and handed over as a download, with the charts drawn into it.
//
// It carries what the report page shows, in the page's order and in its words: the cards, the two material tables, the charts, the
// activity by month, the data coverage and how each number is worked out. Every figure is read from the saved report's `management`
// section (the same object the page and the Excel are drawn from) and from the two material lists the page shows; nothing is
// recalculated here. A figure that is not available is written as "Not available" with its reason, never as a dash or a 0.
//
// Charts are drawn with the PDF library's own shapes, not captured from the screen, so they stay sharp and never split across a
// page. Their colours are the page's chart colours, read from the theme at build time (with a fallback where there is no theme).

import type { jsPDF } from "jspdf"

import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { formatCount, formatIsoDateDMY } from "@/lib/utils"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation, StockParameters } from "@/features/initiative-7/types/inventory"
import {
  activityCell,
  adoptionSummaryOf,
  hasPoints,
  seriesGaps,
  trendPoints,
  cardCaption,
  isWorkingCapitalKey,
  kpiValueText,
  moneyExact,
  monthBasisLabel,
  num,
  orderedKpis,
  pageCardTitle,
  pageDenominatorLabel,
  stockoutUsable,
} from "@/features/initiative-7/utils/quarterly-management"
import { CARD_FORMULA, approvalStageRows, coverageItemsOf } from "@/features/initiative-7/utils/quarterly-sections"
import { reportKindOf, reportNoun } from "@/features/initiative-7/utils/report-period"
import { stockFigure } from "@/features/initiative-7/utils/stock-figure"

type RGB = [number, number, number]

const NOT_AVAILABLE = "Not available"

/** Where there is no theme to read (a test, or a browser that cannot resolve a colour): the page's own palette, as plain RGB. */
const FALLBACK: Record<string, RGB> = {
  "--chart-1": [37, 99, 235],
  "--chart-2": [13, 148, 136],
  "--chart-3": [124, 58, 237],
  "--chart-4": [234, 88, 12],
  "--chart-5": [219, 39, 119],
  "--primary": [79, 70, 229],
  "--success": [22, 163, 74],
  "--warning": [217, 119, 6],
  "--destructive": [220, 38, 38],
  "--muted-foreground": [100, 116, 139],
  "--border": [226, 232, 240],
  "--foreground": [15, 23, 42],
}

/** A theme colour as RGB, read from the page's CSS variable by painting one pixel (so any colour syntax the browser knows works). */
function themeColor(name: string): RGB {
  const fallback = FALLBACK[name] ?? [100, 116, 139]
  if (typeof document === "undefined") return fallback
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const context = document.createElement("canvas").getContext("2d")
    if (!value || !context) return fallback
    context.fillStyle = "#000000"
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return a === 0 ? fallback : [r, g, b]
  } catch {
    return fallback
  }
}

export interface ReportPdfInput {
  report: ApiQuarterlyReport
  management: ApiQuarterManagement
  /** The "Current vs recommended" table: eligible OAR material-plants of the period, newest first. */
  eligibleOar: Recommendation[]
  eligibleOarTotal: number
  /** The "Adopted recommendations" table: the period's recommendations SAP has adopted, newest first. */
  adopted: Recommendation[]
  adoptedTotal: number
}

/** "Oct 2026" for a one-month report, the quarter's own name otherwise: the same name the page puts on its tables. */
export function periodNameOf(report: ApiQuarterlyReport): string {
  const start = new Date(`${report.metadata.period_start}T00:00:00`)
  const end = new Date(`${report.metadata.period_end}T00:00:00`)
  return start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
    ? start.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : report.metadata.quarter
}

export function reportPdfFilename(report: ApiQuarterlyReport): string {
  const kind = reportKindOf(report.metadata.quarter) === "monthly" ? "monthly" : "quarterly"
  return `i7-${kind}-report-${report.metadata.quarter.replace(/\s+/g, "_")}.pdf`
}

/** The PDF's built-in font has no glyph for a few characters the page uses (the true minus sign and arrows, and the narrow spaces some
 * browsers put in a time); a line holding one is drawn as spaced-out garbage. Write the plain equivalent instead. */
function safe(value: string): string {
  return value
    .replace(/\u2212/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/[\u00a0\u2007\u2009\u202f]/g, " ")
}
const safeAll = (value: string | string[]) => (Array.isArray(value) ? value.map(safe) : safe(value))

const dash = (value: number | null) => (value === null ? "—" : formatCount(value))
const date = (iso: string | null) => (iso ? formatIsoDateDMY(iso.slice(0, 10)) : NOT_AVAILABLE)

interface Series {
  name: string
  color: RGB
  values: (number | null)[]
}

export async function composeReportPdf(input: ReportPdfInput): Promise<jsPDF> {
  const { jsPDF: PDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")
  const { report, management } = input
  const meta = report.metadata
  const kind = reportKindOf(meta.quarter)
  const noun = reportNoun(kind)
  const periodName = periodNameOf(report)

  const pdf = new PDF({ orientation: "portrait", unit: "mm", format: "a4" })
  // Everything written or measured goes through `safe`, so no line is drawn with a character the font lacks.
  const drawText = pdf.text.bind(pdf)
  const splitText = pdf.splitTextToSize.bind(pdf)
  pdf.text = ((value: string | string[], ...rest: unknown[]) => drawText(safeAll(value), ...(rest as [number, number]))) as typeof pdf.text
  pdf.splitTextToSize = ((value: string | string[], width: number, options?: object) => splitText(safeAll(value) as string, width, options)) as typeof pdf.splitTextToSize
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 14
  const W = pageW - margin * 2
  const bottom = pageH - 16
  let y = margin

  const c = {
    ink: themeColor("--foreground"),
    muted: themeColor("--muted-foreground"),
    border: themeColor("--border"),
    primary: themeColor("--primary"),
    success: themeColor("--success"),
    warning: themeColor("--warning"),
    danger: themeColor("--destructive"),
    s1: themeColor("--chart-1"),
    s2: themeColor("--chart-2"),
    s3: themeColor("--chart-3"),
    s4: themeColor("--chart-4"),
    s5: themeColor("--chart-5"),
  }
  const lastY = () => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const ensure = (height: number) => {
    if (y + height > bottom) {
      pdf.addPage()
      y = margin
    }
  }
  const text = (value: string | string[], x: number, yy: number, size: number, color: RGB, style: "normal" | "bold" | "italic" = "normal") => {
    pdf.setFont("helvetica", style).setFontSize(size).setTextColor(color[0], color[1], color[2])
    pdf.text(value, x, yy)
  }
  const heading = (value: string, subtitle?: string) => {
    ensure(subtitle ? 18 : 12)
    y += 3
    text(value, margin, y + 4, 12, c.ink, "bold")
    y += 7
    if (subtitle) {
      const lines = pdf.setFont("helvetica", "normal").setFontSize(8.5).splitTextToSize(subtitle, W) as string[]
      text(lines, margin, y + 2.5, 8.5, c.muted)
      y += lines.length * 4 + 1
    }
    y += 1
  }
  const paragraph = (value: string, muted = true, size = 8) => {
    const lines = pdf.setFont("helvetica", "normal").setFontSize(size).splitTextToSize(value, W) as string[]
    ensure(lines.length * (size * 0.42 + 0.6) + 2)
    text(lines, margin, y + 3, size, muted ? c.muted : c.ink)
    y += lines.length * (size * 0.42 + 0.6) + 2
  }
  const table = (head: string[], body: string[][], opts: { columnStyles?: Record<number, object>; fontSize?: number } = {}) => {
    autoTable(pdf, {
      startY: y + 1,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: opts.fontSize ?? 8, cellPadding: 1.8, valign: "top", lineColor: c.border, lineWidth: 0.2, textColor: c.ink },
      headStyles: { fillColor: [235, 240, 250], textColor: c.ink, fontStyle: "bold" },
      columnStyles: opts.columnStyles as never,
      rowPageBreak: "avoid",
      head: [head.map(safe)],
      body: body.map((row) => row.map(safe)),
    })
    y = lastY() + 3
  }

  // --- Charts, drawn with the library's own shapes ---------------------------------------------------------------
  const frame = (x: number, top: number, w: number, h: number, title: string, subtitle?: string) => {
    pdf.setDrawColor(c.border[0], c.border[1], c.border[2]).setLineWidth(0.3).roundedRect(x, top, w, h, 2, 2)
    text(title, x + 3, top + 5.5, 9, c.ink, "bold")
    if (subtitle) {
      const lines = pdf.setFont("helvetica", "normal").setFontSize(7).splitTextToSize(subtitle, w - 6) as string[]
      text(lines.slice(0, 2), x + 3, top + 9.5, 7, c.muted)
    }
  }
  const unavailable = (x: number, top: number, w: number, h: number, message: string) => {
    const lines = pdf.setFont("helvetica", "normal").setFontSize(8).splitTextToSize(message, w - 10) as string[]
    text(lines, x + 5, top + h / 2 - ((lines.length - 1) * 3.6) / 2, 8, c.muted)
  }
  /** The legend's rows: items run left to right and wrap when the frame is full. */
  const legendLayout = (w: number, series: Series[]) => {
    const rows: Series[][] = [[]]
    let used = 0
    for (const item of series) {
      const itemW = 3.6 + pdf.setFont("helvetica", "normal").setFontSize(7).getTextWidth(safe(item.name)) + 5
      if (used + itemW > w - 6 && rows[rows.length - 1].length > 0) {
        rows.push([])
        used = 0
      }
      rows[rows.length - 1].push(item)
      used += itemW
    }
    return rows
  }
  const legend = (x: number, yy: number, w: number, series: Series[]) => {
    legendLayout(w, series).forEach((row, line) => {
      let cursor = x
      for (const item of row) {
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]).circle(cursor + 1.2, yy + line * 3.8 - 1, 1.2, "F")
        text(item.name, cursor + 3.6, yy + line * 3.8, 7, c.muted)
        cursor += 3.6 + pdf.getTextWidth(safe(item.name)) + 5
      }
    })
  }
  /** Vertical bars: one group per category, one bar per series. A category with no figure draws no bar -- never a bar of 0. */
  const groupedBars = (x: number, top: number, w: number, h: number, categories: string[], series: Series[], format: (n: number) => string = formatCount) => {
    const values = series.flatMap((s) => s.values).filter((v): v is number => v !== null)
    if (values.length === 0) {
      unavailable(x, top, w, h, "No figure for these months.")
      return
    }
    const max = Math.max(1, ...values)
    const plotTop = top + 5
    const legendRows = series.length > 1 ? legendLayout(w, series).length : 0
    const plotBottom = top + h - 9 - (legendRows > 0 ? 1.5 + legendRows * 3.8 : 0)
    pdf.setDrawColor(c.border[0], c.border[1], c.border[2]).setLineWidth(0.15)
    for (let i = 0; i <= 3; i++) pdf.line(x + 2, plotBottom - ((plotBottom - plotTop) * i) / 3, x + w - 2, plotBottom - ((plotBottom - plotTop) * i) / 3)
    const groupW = (w - 4) / categories.length
    const barW = Math.min(12, (groupW * 0.72) / series.length)
    categories.forEach((category, i) => {
      const groupX = x + 2 + groupW * i + (groupW - barW * series.length) / 2
      series.forEach((s, j) => {
        const value = s.values[i]
        if (value === null || value === undefined) return
        const barH = Math.max(0.4, (value / max) * (plotBottom - plotTop))
        pdf.setFillColor(s.color[0], s.color[1], s.color[2]).rect(groupX + barW * j, plotBottom - barH, barW - 0.6, barH, "F")
        const label = format(value)
        text(label, groupX + barW * j + (barW - 0.6) / 2 - pdf.getTextWidth(label) / 2, plotBottom - barH - 1, 6.5, c.ink)
      })
      const label = pdf.setFont("helvetica", "normal").setFontSize(6.5).splitTextToSize(category, groupW) as string[]
      text(label.slice(0, 2), x + 2 + groupW * i + groupW / 2 - pdf.getTextWidth(label[0] ?? "") / 2, plotBottom + 3.6, 6.5, c.muted)
    })
    if (legendRows > 0) legend(x + 3, top + h - 2.5 - (legendRows - 1) * 3.8, w, series)
  }
  /** Horizontal bars: one row per label, drawn to the largest value. */
  const rowBars = (x: number, top: number, w: number, rows: { label: string; value: number; color: RGB }[], format: (n: number) => string = formatCount, step = 7.2) => {
    const labelW = Math.min(46, w * 0.42)
    const barX = x + 3 + labelW
    const barMax = w - labelW - 22
    const max = Math.max(1, ...rows.map((r) => r.value))
    rows.forEach((row, i) => {
      const rowY = top + i * step
      const lines = pdf.setFont("helvetica", "normal").setFontSize(7.5).splitTextToSize(row.label, labelW - 1) as string[]
      text(lines.slice(0, 2), x + 3, rowY + 3.6, 7.5, c.ink)
      pdf.setFillColor(243, 244, 246).rect(barX, rowY + 1.2, barMax, 3.6, "F")
      const barW = row.value > 0 ? Math.max(0.8, (row.value / max) * barMax) : 0
      if (barW > 0) pdf.setFillColor(row.color[0], row.color[1], row.color[2]).rect(barX, rowY + 1.2, barW, 3.6, "F")
      text(format(row.value), barX + barMax + 2, rowY + 4.3, 7.5, c.ink, "bold")
    })
  }
  /** Two charts side by side, each in its own frame. */
  const pair = (height: number, left: (x: number, top: number, w: number) => void, right?: (x: number, top: number, w: number) => void) => {
    ensure(height + 3)
    const w = (W - 4) / 2
    left(margin, y, w)
    right?.(margin + w + 4, y, w)
    y += height + 4
  }
  /** Three charts side by side. */
  const triple = (height: number, draw: ((x: number, top: number, w: number) => void)[]) => {
    ensure(height + 3)
    const w = (W - 8) / 3
    draw.forEach((chart, i) => chart(margin + i * (w + 4), y, w))
    y += height + 4
  }
  /** A line over the months: a point and its value for each month with a figure, the line broken (never joined across) where a month has
   * none -- the way the page draws its monthly trends. */
  const lineChart = (x: number, top: number, w: number, h: number, categories: string[], values: (number | null)[], color: RGB, format: (n: number) => string) => {
    const present = values.filter((v): v is number => v !== null)
    if (present.length === 0) {
      unavailable(x, top, w, h, "No month has a measured value yet.")
      return
    }
    const min = Math.min(...present, 0)
    const max = Math.max(...present, 0)
    const span = max - min || 1
    const plotTop = top + 7
    const plotBottom = top + h - 8
    const px = (i: number) => x + 8 + ((w - 16) * (categories.length === 1 ? 0.5 : i / (categories.length - 1)))
    const py = (v: number) => plotBottom - ((v - min) / span) * (plotBottom - plotTop)
    pdf.setDrawColor(c.border[0], c.border[1], c.border[2]).setLineWidth(0.15)
    for (let i = 0; i <= 3; i++) pdf.line(x + 2, plotBottom - ((plotBottom - plotTop) * i) / 3, x + w - 2, plotBottom - ((plotBottom - plotTop) * i) / 3)
    pdf.setDrawColor(color[0], color[1], color[2]).setLineWidth(0.6)
    values.forEach((value, i) => {
      const next = values[i + 1]
      if (value !== null && next !== null && next !== undefined) pdf.line(px(i), py(value), px(i + 1), py(next))
    })
    values.forEach((value, i) => {
      if (value === null) return
      pdf.setFillColor(color[0], color[1], color[2]).circle(px(i), py(value), 0.9, "F")
      const label = format(value)
      text(label, Math.min(Math.max(px(i) - pdf.getTextWidth(safe(label)) / 2, x + 2), x + w - 2 - pdf.getTextWidth(safe(label))), py(value) - 2, 6.5, c.ink)
    })
    categories.forEach((category, i) => text(category, px(i) - pdf.getTextWidth(safe(category)) / 2, plotBottom + 4, 6.5, c.muted))
  }

  // --- Title ------------------------------------------------------------------------------------------------------
  text("Initiative 07 — Predictive Inventory & Safety Stock", margin, y + 3, 8, c.muted)
  text(kind === "monthly" ? "Monthly Report" : "Quarterly Deep-Dive Report", margin, y + 11, 19, c.ink, "bold")
  text(meta.quarter, margin, y + 18, 13, c.primary, "bold")
  y += 22
  const facts: [string, string][] = [
    ["Reporting period", `${meta.period_start} to ${meta.period_end}`],
    ["Period", `${management.period.status === "COMPLETE" ? "Complete" : "In progress"} · figures to ${date(management.period.cutoff)}`],
    ["Generated", new Date(meta.generated_at).toLocaleString()],
    ["Figures are", management.data_coverage.basis === "snapshot" ? "Saved month-end snapshot, with current calculations" : "Current calculations"],
  ]
  facts.forEach(([label, value], i) => {
    text(label.toUpperCase(), margin + (i % 2) * (W / 2), y + 3, 6.5, c.muted)
    text(value, margin + (i % 2) * (W / 2), y + 7, 8.5, c.ink)
    if (i % 2 === 1) y += 9.5
  })
  y += 2
  if (management.period.note) paragraph(management.period.note)

  // --- Cards ------------------------------------------------------------------------------------------------------
  heading("Key figures")
  const cards = orderedKpis(management.kpis)
  const gap = 3
  const cardW = (W - gap * 2) / 3
  const cardH = 37
  const tone = (card: ApiKpiCard): RGB =>
    card.key === "critical_stockout_risk" ? c.danger : isWorkingCapitalKey(card.key) || card.key === "approved" || card.key === "min_max_conversion" ? c.success : c.primary
  cards.forEach((card, i) => {
    if (i % 3 === 0) ensure(cardH + gap)
    const x = margin + (i % 3) * (cardW + gap)
    const top = y
    pdf.setDrawColor(c.border[0], c.border[1], c.border[2]).setLineWidth(0.3).roundedRect(x, top, cardW, cardH, 2, 2)
    const accent = tone(card)
    pdf.setFillColor(accent[0], accent[1], accent[2]).rect(x, top + 3, 1.1, cardH - 6, "F")
    text((pdf.splitTextToSize(pageCardTitle(card), cardW - 8) as string[]).slice(0, 2), x + 4, top + 5.2, 8, c.muted)
    const value = kpiValueText(card)
    const money = card.key === "excess_inventory_opportunity" || isWorkingCapitalKey(card.key)
    const big = value === NOT_AVAILABLE || value === "Not yet measured" ? value : money ? value : `${value} ${card.unit}`
    text((pdf.setFontSize(13).splitTextToSize(big, cardW - 8) as string[]).slice(0, 2), x + 4, top + 14, 13, c.ink, "bold")
    text((pdf.setFontSize(7.2).splitTextToSize(cardCaption(card), cardW - 8) as string[]).slice(0, 2), x + 4, top + 22, 7.2, c.muted)
    const detail = `${card.period_label}${card.denominator !== null ? ` · of ${formatCount(card.denominator)} ${pageDenominatorLabel(card)}` : ""}`
    text((pdf.setFontSize(6.5).splitTextToSize(detail, cardW - 8) as string[]).slice(0, 2), x + 4, top + 29, 6.5, c.muted)
    text(card.basis === "snapshot" ? "SAVED AT MONTH END" : "BASED ON TODAY'S FIGURES", x + 4, top + cardH - 2, 5.5, accent, "bold")
    if (i % 3 === 2 || i === cards.length - 1) y += cardH + gap
  })

  // --- The two material tables --------------------------------------------------------------------------------------
  const levels: { key: keyof StockParameters; label: string }[] = [
    { key: "safetyStock", label: "Safety stock" },
    { key: "rop", label: "Reorder point" },
    { key: "maxStock", label: "Maximum stock" },
  ]
  const figure = (rec: Recommendation, side: "current" | "recommended", key: keyof StockParameters) => dash(stockFigure(rec, side, key))
  const materialRows = (recs: Recommendation[]) =>
    recs.map((rec) => [
      `${rec.material.description}\n${rec.material.materialCode}`,
      rec.plantId,
      ...levels.flatMap((level) => [figure(rec, "current", level.key), figure(rec, "recommended", level.key)]),
    ])
  const materialHead = ["Material", "Plant", ...levels.flatMap((level) => [`${level.label}: SAP now`, `${level.label}: suggested`])]
  const materialStyles = { 0: { cellWidth: 52 }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" }, 4: { halign: "right" }, 5: { halign: "right", fontStyle: "bold" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } }

  heading(`Current vs recommended in ${periodName}`, "These are the eligible OAR materials only (OAR materials that can move to Min-Max ordering), newest first.")
  if (input.eligibleOar.length > 0) {
    table(materialHead, materialRows(input.eligibleOar), { columnStyles: materialStyles, fontSize: 7.5 })
    paragraph(
      `${formatCount(input.eligibleOar.length)} of ${formatCount(input.eligibleOarTotal)} eligible OAR materials. “SAP now” is the value SAP held when each recommendation was generated. ` +
        "Stock items and other materials are on the Recommendations page.",
    )
  } else {
    paragraph("No eligible OAR material with a recommended value was generated in this period. Stock items and other materials are on the Recommendations page.")
  }

  heading(`Adopted recommendations in ${periodName}`, "Only adopted recommendations are listed: those SAP now holds. The numbers above cover all recommendations, not only these.")
  if (input.adopted.length > 0) {
    table(materialHead, materialRows(input.adopted), { columnStyles: materialStyles, fontSize: 7.5 })
    paragraph(`${formatCount(input.adopted.length)} of ${formatCount(input.adoptedTotal)} adopted recommendations, newest first.`)
  } else {
    paragraph("No recommendation generated in this period has been adopted in SAP yet.")
  }

  // --- Charts -----------------------------------------------------------------------------------------------------
  heading("Charts", "Each chart is drawn from the same figures as the tables that follow.")
  const usable = stockoutUsable(management)
  const stockout = management.position.stockout
  const unavailableReason = stockout.stale_note ?? "The stockout usage has not been built, so nothing can be judged."
  const performance = management.performance
  const plantName = (code: string | null) => (code === null ? "All plants" : sapPlantLabel(code))
  const chartH = 58

  const stockoutDistribution = (x: number, top: number, w: number) => {
    frame(x, top, w, chartH, "Stockout Risk Distribution", "Fast and slow moving material-plants against their lead-time need.")
    if (!usable) return unavailable(x, top + 8, w, chartH - 8, `${NOT_AVAILABLE}. ${unavailableReason}`)
    const low = Math.max(stockout.evaluated - stockout.at_risk, 0)
    rowBars(x, top + 17, w, [
      { label: "High: below lead-time need", value: stockout.at_risk, color: c.danger },
      { label: "Low: covers lead time", value: low, color: c.success },
      { label: "Could not be judged", value: stockout.insufficient_data, color: c.muted },
    ])
    text(`As of ${date(stockout.as_of)}`, x + 3, top + chartH - 3, 6.5, c.muted)
  }
  const stockoutByPlant = (x: number, top: number, w: number) => {
    frame(x, top, w, chartH, "Stockout risk by plant", "Where those materials are held.")
    if (!usable) return unavailable(x, top + 8, w, chartH - 8, `${NOT_AVAILABLE}. ${unavailableReason}`)
    groupedBars(x, top + 12, w, chartH - 12, management.plant_positions.map((p) => plantName(p.plant)), [
      { name: "At stockout risk", color: c.danger, values: management.plant_positions.map((p) => p.figures.stockout.at_risk) },
    ])
  }
  const excessByPlant = (x: number, top: number, w: number) => {
    frame(x, top, w, chartH, "Excess inventory by plant", "Materials holding more than the recommended maximum.")
    groupedBars(x, top + 12, w, chartH - 12, management.plant_positions.map((p) => plantName(p.plant)), [
      { name: "Material-plants with excess", color: c.s1, values: management.plant_positions.map((p) => p.figures.excess_count) },
    ])
  }
  const approvalStatus = (x: number, top: number, w: number) => {
    frame(x, top, w, chartH, "Approval status", "Where this period's recommendations stand in the approval chain.")
    const stages = approvalStageRows(management.adoption)
    if (!stages) return unavailable(x, top + 8, w, chartH - 8, "The approval stages were not saved with this report. Generate it again to see them.")
    rowBars(
      x, top + 14, w,
      stages.map((stage, i) => ({ label: stage.label, value: stage.count, color: [c.s3, c.warning, c.s5, c.success, c.s2, c.danger][i % 6] })),
      formatCount,
      6.2,
    )
    text(`${formatCount(management.adoption.stages?.total ?? 0)} recommendations with something to change in SAP, as they stand today.`, x + 3, top + chartH - 3, 6.5, c.muted)
  }
  const sapAdoption = (x: number, top: number, w: number) => {
    frame(x, top, w, chartH, "SAP adoption", "Recommendations SAP has actually changed. Separate from approval.")
    const adoption = adoptionSummaryOf(management.adoption)
    if (!adoption) return unavailable(x, top + 8, w, chartH - 8, `${NOT_AVAILABLE}.`)
    rowBars(x, top + 14, w, [
      { label: "Adopted", value: adoption.adoptedCount, color: c.success },
      { label: "Partially adopted", value: adoption.partiallyAdoptedCount, color: c.warning },
      { label: "Not adopted", value: adoption.notAdoptedCount, color: c.danger },
      { label: "Pending (no SAP change yet)", value: adoption.unknownCount, color: c.muted },
    ])
    text(
      `${formatCount(adoption.totalEvaluated)} tracked. ${adoption.adoptionRatePercentage === null ? "Not yet measured." : `Adoption rate ${adoption.adoptionRatePercentage}%.`}`,
      x + 3, top + chartH - 3, 6.5, c.muted,
    )
  }

  pair(chartH, stockoutDistribution, stockoutByPlant)
  if (kind === "monthly") {
    // The monthly report's charts: the last months' recommendation volume, approval activity and month-end excess.
    pair(
      chartH,
      excessByPlant,
      (x, top, w) => {
        frame(x, top, w, chartH, "Recommendations generated", "Records created each month, beside the distinct material-plants they cover.")
        if (!performance) return unavailable(x, top + 8, w, chartH - 8, `${NOT_AVAILABLE} for this report.`)
        const months = performance.months.slice(-2)
        groupedBars(x, top + 12, w, chartH - 12, months.map((m) => m.label), [
          { name: "Records", color: c.s1, values: months.map((m) => m.records_generated) },
          { name: "Distinct material-plants", color: c.s2, values: months.map((m) => m.material_plants_generated) },
        ])
      },
    )
    pair(
      chartH,
      (x, top, w) => {
        frame(x, top, w, chartH, "Approval activity", "Decisions recorded each month, counted when they happened.")
        if (!performance) return unavailable(x, top + 8, w, chartH - 8, `${NOT_AVAILABLE} for this report.`)
        const months = performance.months
        const anyFigure = months.some((m) => [m.submitted, m.approved, m.rejected, m.sent_back].some((v) => v !== null))
        if (!anyFigure) return unavailable(x, top + 8, w, chartH - 8, "No approval event has been recorded in these months.")
        groupedBars(x, top + 12, w, chartH - 12, months.map((m) => m.label), [
          { name: "Sent for approval", color: c.s1, values: months.map((m) => m.submitted) },
          { name: "Approval decisions", color: c.s3, values: months.map((m) => m.approved) },
          { name: "Rejections", color: c.s4, values: months.map((m) => m.rejected) },
          { name: "Sent back", color: c.s5, values: months.map((m) => m.sent_back) },
        ])
      },
      (x, top, w) => {
        frame(x, top, w, chartH, "Excess inventory trend", "Estimated value of stock above the recommended maximum, at each month's end.")
        const points = (performance?.months ?? [])
          .filter((m) => m.excess_state === "MONTH_END" && num(m.excess_opportunity) !== null)
          .map((m) => ({ label: m.label, value: num(m.excess_opportunity) as number }))
        if (points.length < 2) {
          return unavailable(x, top + 8, w, chartH - 8, `Only ${points.length === 1 ? "one month has" : "no month has"} a saved month-end snapshot, so there is no trend yet. A past month cannot be rebuilt from today's data.`)
        }
        groupedBars(x, top + 12, w, chartH - 12, points.map((p) => p.label), [{ name: "Excess value", color: c.s1, values: points.map((p) => p.value) }])
      },
    )
    pair(chartH, approvalStatus, sapAdoption)
  } else {
    // The quarterly report's charts, as the quarterly page draws them: the position charts here, the three monthly trends below.
    pair(chartH, excessByPlant, approvalStatus)
    pair(chartH, sapAdoption)
  }

  // --- Excess by plant, in money ------------------------------------------------------------------------------------
  heading("Excess inventory by plant", "An estimate of stock above the recommended maximum, not a saving.")
  table(
    ["Plant", "Material-plants with excess", "Estimated excess value"],
    management.plant_positions.map((p) => [plantName(p.plant), formatCount(p.figures.excess_count), moneyExact(num(p.figures.excess_opportunity), p.figures.currency)]),
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } },
  )

  // --- Activity by month --------------------------------------------------------------------------------------------
  heading("Activity by month", `What happened each month, counted in the month it happened. The months add up to the ${noun.singular} total.`)
  table(
    ["Metric", ...management.monthly_activity.months.map((m) => m.label), noun.total],
    management.monthly_activity.rows.map((row) => [
      `${row.label} (${row.unit})`,
      ...row.months.map((value) => (num(value) === null ? NOT_AVAILABLE : activityCell(value))),
      num(row.quarter_total) === null ? NOT_AVAILABLE : activityCell(row.quarter_total),
    ]),
    { columnStyles: { 0: { cellWidth: 56 } } },
  )
  paragraph("Not available means the month has not started, the data does not cover it, or it is not tracked by month. It is not a count of zero.")
  for (const row of management.monthly_activity.rows.filter((r) => r.note)) paragraph(`${row.label}. ${row.note}`)

  // --- Monthly trends and the quarter-end position (the quarterly report) --------------------------------------------------
  const trends = management.trends
  if (kind === "quarterly" && trends) {
    heading("Monthly Trends", "What was measured at the time, from saved monthly snapshots. A month with no snapshot is not available, not zero.")
    const points = trendPoints(trends)
    const currency = trends.months.find((m) => m.currency)?.currency ?? null
    const labels = points.map((p) => p.label)
    const trendCharts: { key: "stockout" | "excessOpportunity" | "workingCapital"; title: string; subtitle: string; color: RGB; money: boolean }[] = [
      { key: "stockout", title: "At stockout risk", subtitle: "Materials at risk each month", color: c.danger, money: false },
      { key: "excessOpportunity", title: "Excess inventory opportunity", subtitle: "Stock above the recommended maximum", color: c.s1, money: true },
      { key: "workingCapital", title: "Working capital impact", subtitle: "Cash freed (+) or tied up (-)", color: c.s3, money: true },
    ]
    triple(
      52,
      trendCharts.map((series) => (x, top, w) => {
        frame(x, top, w, 52, series.title, series.subtitle)
        const drawable = hasPoints(points, series.key)
        const show = (value: number) => (series.money ? moneyExact(value, currency, series.key === "workingCapital") : formatCount(Math.round(value)))
        if (!drawable) return unavailable(x, top + 8, w, 44, "No month has a measured value yet.")
        lineChart(x, top + 11, w, 41, labels, points.map((p) => p[series.key]), series.color, show)
        const gaps = seriesGaps(points, series.key)
        if (gaps.length > 0) text(`No figure for ${gaps.join(", ")}.`, x + 3, top + 50.5, 6, c.muted, "italic")
      }),
    )
    table(
      ["Month", "Snapshot", "Measured", "At stockout risk", "Excess opportunity", "Working capital (estimate)", "Change from last month"],
      trends.months.map((m) => [
        m.label,
        monthBasisLabel(m),
        date(m.measured_on),
        m.stockout_at_risk === null ? NOT_AVAILABLE : `${formatCount(m.stockout_at_risk)}${m.stockout_evaluated !== null ? ` of ${formatCount(m.stockout_evaluated)}` : ""}`,
        m.state === "MISSING" ? NOT_AVAILABLE : moneyExact(num(m.excess_opportunity), m.currency),
        m.state === "MISSING" ? NOT_AVAILABLE : moneyExact(num(m.net_rop_value_impact), m.currency, true),
        num(m.net_rop_change_from_previous) === null ? NOT_AVAILABLE : moneyExact(num(m.net_rop_change_from_previous), m.currency, true),
      ]),
      { fontSize: 7.5 },
    )
    for (const note of [...trends.months.filter((m) => m.note).map((m) => `${m.label}: ${m.note}`), ...trends.notes]) paragraph(note)
    paragraph("Counts are positions on a date: each month shows its own, and they are never added into a quarter total.")

    const end = trends.quarter_end
    heading("Quarter-end position", end.status === "AVAILABLE" && end.measured_on ? `The saved ${end.label} month-end snapshot, measured ${date(end.measured_on)}.` : "The last month's saved snapshot, shown only when it is valid for the end of the quarter.")
    if (end.status === "AVAILABLE") {
      table(
        ["Stock level", "Current (SAP), mean", "Recommended, mean", "Records"],
        end.stock_levels.map((level) => [
          level.label,
          num(level.current) === null ? NOT_AVAILABLE : (num(level.current) as number).toFixed(1),
          num(level.recommended) === null ? NOT_AVAILABLE : (num(level.recommended) as number).toFixed(1),
          formatCount(level.records),
        ]),
        { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } },
      )
      paragraph("Means over the recommendations in force on the last day of the month, counting only those with both a current and a recommended value, so Records says how many each is over.")
    } else {
      paragraph(`${NOT_AVAILABLE}. ${end.reason ?? ""}`, false)
      if (end.latest_available_label && end.latest_available_measured_on) {
        paragraph(`The latest snapshot available is ${end.latest_available_label}, measured ${date(end.latest_available_measured_on)}. It is not shown as the quarter-end.`)
      }
    }
  }

  // --- Forecast ------------------------------------------------------------------------------------------------------
  const forecast = management.forecast_actual
  heading("Forecast vs actual demand", "The champion model's one-month-ahead forecast against what was actually used in the same month.")
  if (forecast.status === "AVAILABLE" && forecast.months.length > 0) {
    table(
      ["Month", "Forecast", "Actual", "Materials"],
      forecast.months.map((m) => [m.month, num(m.forecast) === null ? NOT_AVAILABLE : formatCount(num(m.forecast) as number), num(m.actual) === null ? NOT_AVAILABLE : formatCount(num(m.actual) as number), formatCount(m.material_count)]),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } },
    )
  } else {
    paragraph(`${NOT_AVAILABLE}. ${forecast.note}`)
  }

  // --- Data coverage ------------------------------------------------------------------------------------------------
  const coverage = management.data_coverage
  heading("Data coverage and limitations", "Where these figures come from, and anything missing or old.")
  const items = coverageItemsOf(management)
  if (items) {
    const problems = items.filter((item) => item.status !== "Available")
    if (problems.length > 0) {
      text("NEEDS ATTENTION", margin, y + 3, 7, c.warning, "bold")
      y += 4
      table(["What", "Last data", "Status", "What this means"], problems.map((item) => [item.label, item.value ?? "—", item.status, item.detail ?? ""]), { columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 26 }, 2: { cellWidth: 24 } } })
    } else {
      paragraph("Everything this report uses is up to date.", false)
    }
    text("EVERY SOURCE", margin, y + 3, 7, c.muted, "bold")
    y += 4
    table(["What", "Last data", "Status", "What this means"], items.map((item) => [item.label, item.value ?? "—", item.status, item.detail ?? ""]), { columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 26 }, 2: { cellWidth: 24 } }, fontSize: 7.5 })
  }
  paragraph(`Figures are: ${coverage.basis === "snapshot" ? "saved month-end snapshots" : "current calculations"}.`, false)
  table(
    ["Month", "SAP consumption data", "Recommendations generated"],
    coverage.months.map((m) => [
      m.label,
      { AVAILABLE: "Covered", NO_ACTIVITY: "Covered, no movements", NOT_COVERED: "Not covered", NO_SOURCE_DATA: "No data loaded" }[m.consumption_status],
      formatCount(m.recommendations_generated),
    ]),
    { columnStyles: { 2: { halign: "right" } } },
  )
  for (const warning of coverage.warnings) paragraph(`• ${warning}`)
  if (management.definitions.length > 0) {
    text("WHAT THE FIGURES ON THIS PAGE MEAN", margin, y + 3, 7, c.muted, "bold")
    y += 4
    for (const definition of management.definitions) paragraph(`• ${definition}`)
  }

  // --- How each number is worked out ---------------------------------------------------------------------------------
  heading("How each number is worked out", "What each card measures and how it is calculated.")
  for (const card of cards) {
    const formula = CARD_FORMULA[card.key]
    const body = `${card.explanation}${card.note ? ` ${card.note}` : ""}${kpiValueText(card) === NOT_AVAILABLE && card.unavailable_reason ? ` Not available: ${card.unavailable_reason}` : ""}`
    const bodyLines = pdf.setFont("helvetica", "normal").setFontSize(7.5).splitTextToSize(body, W) as string[]
    ensure(8 + (formula?.length ?? 0) * 3.6 + bodyLines.length * 3.4)
    text(pageCardTitle(card), margin, y + 3.5, 8.5, c.ink, "bold")
    y += 5
    for (const line of formula ?? []) {
      pdf.setFont("courier", "normal").setFontSize(7).setTextColor(c.ink[0], c.ink[1], c.ink[2]).text(line, margin + 2, y + 2.6)
      y += 3.6
    }
    text(bodyLines, margin, y + 3, 7.5, c.muted)
    y += bodyLines.length * 3.4 + 3
  }

  // --- Page numbers -------------------------------------------------------------------------------------------------
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page)
    text(`Initiative 07 · ${meta.quarter} · generated ${new Date(meta.generated_at).toLocaleDateString()}`, margin, pageH - 8, 7, c.muted)
    const label = `Page ${page} of ${pages}`
    text(label, pageW - margin - pdf.getTextWidth(label), pageH - 8, 7, c.muted)
  }
  return pdf
}

/** The report as a PDF file's bytes. */
export async function buildReportPdf(input: ReportPdfInput): Promise<Blob> {
  const pdf = await composeReportPdf(input)
  return pdf.output("blob")
}
