import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { loadLiveValidation } from "@/features/initiative-13/data/live-loaders"

/**
 * Validation — FR-6's monthly reconciliation, and FRS acceptance criterion 4.
 *
 * Every comparison runs in the backend, which reads ZMM065 and the 30-Day GR
 * Report from its own database (they arrive as workbook exports — no SAP route
 * carries a report). Nothing is compared here: two implementations of one
 * reconciliation rule would disagree eventually, and this is the screen whose
 * entire purpose is to say whether two sources agree.
 *
 * `REFERENCE_UNAVAILABLE` means a report is not loaded in the backend — a
 * missing input, not a failure. The tolerance itself is still an open item
 * with VZI.
 */
export async function ValidationPage() {
  await connection()

  let result: Awaited<ReturnType<typeof loadLiveValidation>> | null = null
  let loadError: string | null = null
  try {
    result = await loadLiveValidation()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Validation"
          description="The platform's aging bands reconciled against ZMM065 as of the report's run date, and every 30-Day GR Report receipt confirmed against the platform's SAP data. All reconciliation runs in the backend."
        />

        {result === null ? (
          <LoadFailure what="validation data" message={loadError} />
        ) : (
          <ValidationPanel result={result} />
        )}
      </div>
    </div>
  )
}
