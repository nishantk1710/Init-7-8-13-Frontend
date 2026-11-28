"use client"

import { ExportButton } from "@/features/initiative-13/components/export-button"
import {
  exportCapturedPlansSheet,
  exportExceptionsSheet,
  exportGrniSheet,
  exportProcurementLinesSheet,
  exportReservationLedgerSheet,
  exportUsageSheet,
  type Sheet,
} from "@/features/initiative-13/export-sheets"
import { downloadExcel } from "@/lib/utils"

/** Each export, by what it exports: the file name and its server action. */
const EXPORTS = {
  usage: { file: "oar-usage-pattern.xlsx", sheet: "Usage pattern", load: exportUsageSheet },
  grni: { file: "oar-30-day-gr-not-issued.xlsx", sheet: "GR not issued", load: exportGrniSheet },
  // The Ledger tabs export their first 1,000 rows (LEDGER_EXPORT_ROWS), and say so.
  reservations: {
    file: "oar-ledger-reservations.xlsx",
    sheet: "Reservations",
    load: exportReservationLedgerSheet,
    label: "Export first 1,000",
  },
  procurementLines: {
    file: "oar-ledger-procurement-lines.xlsx",
    sheet: "Procurement lines",
    load: exportProcurementLinesSheet,
    label: "Export first 1,000",
  },
  exceptions: { file: "oar-exceptions.xlsx", sheet: "Exceptions", load: exportExceptionsSheet },
  capturedPlans: { file: "oar-captured-plans.xlsx", sheet: "Captured plans", load: exportCapturedPlansSheet },
} as const

export type SheetExportKind = keyof typeof EXPORTS

/**
 * "Export Excel" for a screen that had no export (UAT, 25 Nov 2026): every row
 * the screen's current filters match, not the page on screen, fetched by a
 * Server Action when pressed (`export-sheets.ts`). A client component so the
 * page around it stays a server component; `filters` are the screen's own,
 * from its URL.
 */
export function SheetExport({ kind, filters = {} }: { kind: SheetExportKind; filters?: Record<string, string | undefined> }) {
  return (
    <ExportButton
      label={(EXPORTS[kind] as { label?: string }).label ?? "Export Excel"}
      onExport={async () => {
        const { file, sheet, load } = EXPORTS[kind]
        const { headers, rows }: Sheet = await (load as (f: Record<string, string | undefined>) => Promise<Sheet>)(filters)
        if (!(await downloadExcel(file, headers, rows, sheet))) throw new Error("The workbook could not be built")
      }}
    />
  )
}
