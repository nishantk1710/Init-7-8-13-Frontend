import { connection } from "next/server"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { ExceptionQueueTable } from "@/features/initiative-8/components/exception-queue-table"
import {
  exceptionTypeOptions,
  loadLiveExceptions,
} from "@/features/initiative-8/data/live-exceptions"
import { exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import type { ApiExceptionMeta } from "@/lib/api/i8"
import { formatCount } from "@/lib/utils"

const DESCRIPTION =
  "Repair lines sent out with no condition assessment, and new units bought " +
  "while a repair was open with no justification on record."

/**
 * The Exception Queue (FR-7's second half — "surfaced on the dashboard and in
 * the exception queue").
 *
 * Same server/client split as the register: this page fetches every exception
 * once, and the "use client" table filters and exports. Live-only — there was
 * never a fixture for it, and a synthetic finding would be exactly the thing
 * this screen exists to catch.
 */
export async function ExceptionQueuePage() {
  // Recomputed from the attestation and justification tables on every
  // request, so a build-time snapshot would never change.
  await connection()

  // The try/catch wraps ONLY the fetch -- see the note on the register page.
  let live: Awaited<ReturnType<typeof loadLiveExceptions>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveExceptions()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (live === null) {
    return (
      <Shell description={DESCRIPTION}>
        <ExceptionQueueTable loadError={loadError} />
      </Shell>
    )
  }

  return (
    <Shell description={DESCRIPTION}>
      <ExceptionCounts meta={live.meta} referenceDate={live.referenceDate} />
      <ExceptionQueueTable
        items={live.items}
        typeOptions={exceptionTypeOptions(live.meta)}
      />
    </Shell>
  )
}

/**
 * The headline numbers, always together. `total` is the business case and
 * `actionable` is the work; quoting either alone misleads, in opposite
 * directions. Then what each check looked at, so a small count reads as a
 * small count and not as a check that never ran.
 */
function ExceptionCounts({
  meta,
  referenceDate,
}: {
  meta: ApiExceptionMeta
  referenceDate: string
}) {
  const acquisitionCheckRuns = meta.typesRaised.includes("UNJUSTIFIED_ACQUISITION")
  const cutovers = [
    meta.attestationCutoverDate && `attestations from ${meta.attestationCutoverDate}`,
    meta.justificationCutoverDate && `justifications from ${meta.justificationCutoverDate}`,
  ].filter(Boolean)
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <p className="text-foreground">
        <strong>{formatCount(meta.total)}</strong> exceptions, of which{" "}
        <strong>{formatCount(meta.actionable)}</strong> are actionable and{" "}
        <strong>{formatCount(meta.preAutomation)}</strong> were raised before Spares
        Automation, as at {referenceDate}.
      </p>
      <p className="text-xs text-muted-foreground">
        {Object.entries(meta.byType)
          .map(([type, count]) => `${exceptionTypeLabel(type)}: ${formatCount(count)}`)
          .join(" · ")}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatCount(meta.linesChecked)} repair lines checked for an attestation within ±
        {meta.attestationWindowDays} days.{" "}
        {acquisitionCheckRuns
          ? `${formatCount(meta.acquisitionsChecked ?? 0)} new-unit purchases checked for a justification` +
            (meta.justificationWindowDays
              ? ` within ±${meta.justificationWindowDays} days.`
              : ".")
          : "The unjustified-acquisition check is not raising exceptions on this backend yet."}{" "}
        {cutovers.length > 0
          ? `Spares Automation cutover: ${cutovers.join(", ")}.`
          : "No Spares Automation cutover date is set, so nothing counts as pre-automation yet."}
      </p>
    </div>
  )
}

function Shell({ description, children }: { description: string; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader title="Exception Queue" description={description} />
        {children}
      </div>
    </div>
  )
}
