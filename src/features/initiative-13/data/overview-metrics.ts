// Overview KPIs derived from the ledger seed data, plus a handful of
// standalone illustrative chart datasets (aging buckets, plan vs actual,
// NM/SM inflow trend, redeployment/purchase-avoidance) that give the
// dashboard enough texture without inventing a second parallel ledger.

import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"
import { REDEPLOYMENT_CANDIDATES } from "@/features/initiative-13/data/redeployment"

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
    releasedQty: LEDGER_LINES.filter((l) => l.stage === "Available for Redeployment").reduce(
      (sum, l) => sum + l.qtyReceived,
      0
    ),
    redeploymentOpportunities: REDEPLOYMENT_CANDIDATES.length,
    nmSmInflow: 12,
  }
}

export const AGING_BUCKETS = [
  { bucket: "0–7d", count: 3 },
  { bucket: "8–15d", count: 2 },
  { bucket: "16–30d", count: 2 },
  { bucket: "31–60d", count: 1 },
  { bucket: ">60d", count: 0 },
]

export function getUnutilizedValueByDepartment() {
  const byDept = new Map<string, number>()
  for (const line of LEDGER_LINES) {
    const value = Math.max(line.qtyRequested - line.qtyConfirmedUsed, 0) * line.unitPrice
    byDept.set(line.department, (byDept.get(line.department) ?? 0) + value)
  }
  return Array.from(byDept.entries())
    .map(([department, value]) => ({ department, value }))
    .sort((a, b) => b.value - a.value)
}

export const PLAN_VS_ACTUAL = [
  { month: "Apr", planned: 9, actual: 8 },
  { month: "May", planned: 11, actual: 9 },
  { month: "Jun", planned: 10, actual: 10 },
  { month: "Jul", planned: 13, actual: 10 },
  { month: "Aug", planned: 12, actual: 8 },
]

export const NM_SM_INFLOW_TREND = [
  { month: "Apr", inflow: 7 },
  { month: "May", inflow: 8 },
  { month: "Jun", inflow: 10 },
  { month: "Jul", inflow: 9 },
  { month: "Aug", inflow: 12 },
]

export const REDEPLOYMENT_AVOIDANCE = [
  { label: "500-22140", avoidedValue: 3 * 8400 },
  { label: "500-40011", avoidedValue: 1 * 142000 },
  { label: "OAR-77002", avoidedValue: 2 * 22400 },
]
