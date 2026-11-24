import { Clock } from "lucide-react"

import { InfoChip } from "@/features/initiative-13/components/ui/oar-scope"
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"
import { getI13SnapshotStatus } from "@/lib/api/i13"
import type { I13SnapshotStatus } from "@/lib/api/i13"

/**
 * When the OAR figures were last updated, for the top right of every OAR page
 * (UAT, 23-Nov-2026): the SAP data date and when the backend last rebuilt the
 * I13 snapshot, in South African time (`GET /i13/snapshot`).
 *
 * A server component: it reads the status on each render, so it is never a
 * stale build-time value. A failure to read it never costs the page -- it says
 * so in the chip.
 */
export async function DataUpdatedNote() {
  const status = await getI13SnapshotStatus().catch(() => null)
  return <InfoChip icon={<Clock className="size-3.5" aria-hidden />}>{dataUpdatedText(status)}</InfoChip>
}

/** The chip's words, apart from the fetch so they can be tested. */
export function dataUpdatedText(status: I13SnapshotStatus | null): string {
  if (!status) return "Update time not available"
  if (!status.builtAt) {
    return status.buildingSince
      ? `First update running since ${formatApiDateTime(status.buildingSince)}`
      : "Update time not available"
  }
  const asOf = status.referenceDate ? `SAP data as of ${formatApiDate(status.referenceDate)} · ` : ""
  const updated = `updated ${formatApiDateTime(status.builtAt)}`
  return status.rebuilding || status.buildingSince
    ? `${asOf}${updated} · new update running`
    : `${asOf}${updated}`
}
