import { toast } from "sonner"

/** One cell of an export. Empty (null/undefined/"") stays an empty cell. */
export type ExportCell = string | number | null | undefined

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

/**
 * ISO date strings become real Excel dates so a column sorts and filters as
 * dates. Everything else is written as given: a material number such as
 * "000000000010001234" stays text, which keeps its leading zeros -- the thing a
 * CSV opened in Excel used to lose.
 */
function toCellValue(value: ExportCell): string | number | Date | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00Z`)
  if (DATE_TIME.test(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed
  }
  return value
}

/**
 * Builds a one-sheet .xlsx from headers + rows and triggers a browser download.
 *
 * Bold, frozen header row with an autofilter, and columns sized to their
 * content. exceljs is loaded on first use, so it costs nothing until somebody
 * clicks Export. Failures are reported with a toast; the promise resolves to
 * whether the file was produced.
 */
export async function downloadExcel(
  filename: string,
  headers: string[],
  rows: ExportCell[][],
  sheetName = "Export"
): Promise<boolean> {
  try {
    const mod = await import("exceljs")
    const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
    const workbook = new ExcelJS.Workbook()
    workbook.created = new Date()
    // Excel caps sheet names at 31 characters and rejects : \ / ? * [ ].
    const sheet = workbook.addWorksheet(sheetName.replace(/[:\\/?*[\]]/g, " ").slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    })

    sheet.addRow(headers)
    for (const row of rows) sheet.addRow(row.map(toCellValue))

    const header = sheet.getRow(1)
    header.font = { bold: true }
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
    if (headers.length > 0) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
    }

    headers.forEach((title, index) => {
      const column = sheet.getColumn(index + 1)
      let width = title.length
      for (const row of rows) {
        const value = toCellValue(row[index])
        if (value instanceof Date) {
          column.numFmt ??= DATE_ONLY.test(String(row[index])) ? "yyyy-mm-dd" : "yyyy-mm-dd hh:mm"
          width = Math.max(width, 16)
        } else if (value !== null) {
          width = Math.max(width, String(value).length)
        }
      }
      column.width = Math.min(Math.max(width + 2, 8), 60)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error("Excel export failed", error)
    toast.error("Could not create the Excel file. Please try again.")
    return false
  }
}
