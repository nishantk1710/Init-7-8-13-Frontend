// How the Quarterly Report's source-activity section is worded and formatted.
//
// The one rule here: a missing figure is a dash, never 0. A month the staged data does not cover
// has no counts (null); a month it covers but where nothing moved has a confirmed 0. They look
// different on purpose.

import type { ApiSourceMonthStatus } from "@/features/initiative-7/types/api"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** "2026-07-01" -> "July 2026". Anything that is not a date is returned as it is. */
export function sourceMonthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-")
  const index = Number(month) - 1
  return index >= 0 && index < 12 ? `${MONTHS[index]} ${year}` : isoDate
}

/** A count, or an em dash when there is none to show. 0 stays "0". */
export function countOrDash(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-US")
}

export const SOURCE_STATUS_LABEL: Record<ApiSourceMonthStatus, string> = {
  AVAILABLE: "Data present",
  NO_ACTIVITY: "No activity (confirmed)",
  NOT_COVERED: "Not in the data",
  NO_SOURCE_DATA: "No source data",
}

export const SOURCE_STATUS_EXPLANATION: Record<ApiSourceMonthStatus, string> = {
  AVAILABLE: "Consumption was recorded in this month.",
  NO_ACTIVITY: "The data covers this month and holds no consumption in it: a confirmed zero.",
  NOT_COVERED: "This month is outside the months the data covers (not delivered or not yet loaded). It is not zero.",
  NO_SOURCE_DATA: "No consumption has been loaded at all.",
}

/** The badge tone for a status: only a confirmed zero or real data read as settled. */
export function sourceStatusTone(status: ApiSourceMonthStatus): "success" | "default" | "warning" {
  if (status === "AVAILABLE") return "success"
  if (status === "NO_ACTIVITY") return "default"
  return "warning"
}
