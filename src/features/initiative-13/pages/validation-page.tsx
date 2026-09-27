import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { ReferenceCountForm } from "@/features/initiative-13/components/reference-count-form"
import { ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { loadLiveValidation } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"

/**
 * Validation — FR-6's monthly reconciliation, and FRS acceptance criterion 4.
 *
 * Every tolerance comparison runs in the backend. The reference counts typed
 * into the form are passed straight through as query parameters and never
 * compared here: two implementations of one reconciliation rule would disagree
 * eventually, and this is the screen whose entire purpose is to say whether two
 * numbers agree.
 *
 * Expect `REFERENCE_UNAVAILABLE` until somebody supplies the counts. Neither
 * report exists as an export in this repository, and the reconciliation
 * tolerance itself is still an open item with VZI — so an empty result here is
 * a missing input, not a failure.
 */
export async function ValidationPage({
  searchParams,
}: {
  searchParams: I13SearchParams
}) {
  await connection()

  let result: Awaited<ReturnType<typeof loadLiveValidation>> | null = null
  let loadError: string | null = null
  try {
    result = await loadLiveValidation({
      zmm065ReferenceCount: searchParams.zmm065,
      gr30DayReferenceCount: searchParams.gr30Day,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Validation"
          description="Reconciliation of backend-computed counts against ZMM065 and the 30-Day GR Report. All reconciliation math runs in the backend — reference counts entered here are passed straight through as query parameters."
        />

        <ReferenceCountForm />

        {result === null ? (
          <LoadFailure what="validation data" message={loadError} />
        ) : (
          <ValidationPanel result={result} />
        )}
      </div>
    </div>
  )
}
