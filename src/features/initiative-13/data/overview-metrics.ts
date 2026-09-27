// Summary KPIs derived from the ledger seed data, for the synchronous
// cross-initiative selector (`selectors/summary.ts`) that feeds Home and the
// global Action Center. The illustrative chart datasets that used to live here
// went with the old Overview page's demo charts.

import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"

function unutilizedQty(): number {
  return LEDGER_LINES.reduce((sum, line) => sum + Math.max(line.qtyRequested - line.qtyConfirmedUsed, 0), 0)
}

function unutilizedValue(): number {
  return LEDGER_LINES.reduce(
    (sum, line) => sum + Math.max(line.qtyRequested - line.qtyConfirmedUsed, 0) * line.unitPrice,
    0
  )
}

function complianceRate(): number {
  const due = LEDGER_LINES.filter((line) => line.stage !== "Reserved" && line.stage !== "PR Raised")
  if (due.length === 0) return 100
  const onPlan = due.filter((line) => line.exception === "None").length
  return Math.round((onPlan / due.length) * 100)
}

export function getOverviewKpis() {
  return {
    unutilizedValue: unutilizedValue(),
    unutilizedQty: unutilizedQty(),
    complianceRate: complianceRate(),
    agedLines: LEDGER_LINES.filter((l) => l.exception !== "None").length,
    replannedLines: LEDGER_LINES.filter((l) => l.replanReason).length,
  }
}
