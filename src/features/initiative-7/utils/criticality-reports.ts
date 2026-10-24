// Display helpers for the Criticality Reports page. Pure, so they are tested
// without a DOM.

import type { CriticalityUpload, CriticalityUploadStatus } from "@/features/initiative-7/types/criticality-reports"

/** Shown in the File column for the July 2026 delivery, which nobody uploaded. */
export const JULY_DELIVERY_LABEL = "(July delivery)"

/** `2026-08-01` (or `2026-08`) -> `Aug 2026`. */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [year, month] = iso.split("-").map(Number)
  if (!year || !month) return iso
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function monthValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** This month as `YYYY-MM` -- the latest month a report can be for. */
export function thisMonth(now: Date = new Date()): string {
  return monthValue(now)
}

/** Last month as `YYYY-MM` -- the report usually uploaded at month start. */
export function previousMonth(now: Date = new Date()): string {
  return monthValue(new Date(now.getFullYear(), now.getMonth() - 1, 1))
}

export const STATUS_LABEL: Record<CriticalityUploadStatus, string> = {
  current: "Current",
  previous: "Previous",
  replaced: "Replaced",
}

export const STATUS_TONE: Record<CriticalityUploadStatus, "success" | "default"> = {
  current: "success",
  previous: "default",
  replaced: "default",
}

/** Uploads for one plant, or all of them when `plant` is null. Keeps the
 * backend's order (newest month first). */
export function filterUploads(uploads: CriticalityUpload[], plant: string | null): CriticalityUpload[] {
  return plant ? uploads.filter((u) => u.plant === plant) : uploads
}
