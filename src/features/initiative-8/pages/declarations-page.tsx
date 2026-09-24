import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { DeclarationQueueTable } from "@/features/initiative-8/components/declaration-queue-table"
import { loadLiveDeclarations } from "@/features/initiative-8/data/live-declarations"
import type { DeclarationItem } from "@/features/initiative-8/types/repair"
import { getAttestations } from "@/lib/api/i8"

/**
 * The Declaration Queue (W5.3's read side, wired in W5.4).
 *
 * Same shape as the register: an async server component fetches, and the
 * "use client" table filters and submits. **Live-only** — there is no fixture
 * fallback, because "declaring" against a fixture wrote nothing anywhere, and
 * a queue of simulated sign-offs is a worse answer than an honest failure.
 *
 * **Expect this screen to be almost entirely "Required", and do not treat that
 * as a bug.** All 1,225 repair lines read Required until somebody records an
 * attestation, because until this platform there was nowhere to record one.
 * That is the business case for W5.3.
 */
export async function DeclarationQueuePage() {
  // Not statically prerendered: this page both reads and writes the attestation
  // table, so a build-time snapshot would show a queue that can never change.
  await connection()

  // The try/catch wraps ONLY the fetch -- see the note on the register page.
  //
  // The fault-category list comes from the API rather than the UI, because it
  // is VZI's vocabulary, it will change, and the backend validates against the
  // same list it serves. Fetched alongside the queue so the form has it before
  // anybody opens the dialog.
  let live: Awaited<ReturnType<typeof loadLiveDeclarations>> | null = null
  let faultCategories: string[] = []
  let loadError: string | null = null
  try {
    const [queue, attestations] = await Promise.all([
      loadLiveDeclarations(),
      getAttestations(),
    ])
    live = queue
    faultCategories = attestations.faultCategories
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (live === null) {
    return (
      <Shell
        description="Condition-to-repair declarations — mandatory, and tracked separately from Duplicate Guard."
        items={[]}
        loadError={loadError}
      />
    )
  }

  const outstanding = live.meta.outstanding.toLocaleString()
  const total = live.meta.total.toLocaleString()

  return (
    <Shell
      description={
        `${outstanding} of ${total} repair lines have no condition assessment on ` +
        `record. Matched on material, plant and a ±${live.meta.attestationWindowDays}-day window.`
      }
      items={live.items}
      faultCategories={faultCategories}
    />
  )
}

function Shell({
  description,
  items,
  faultCategories,
  loadError,
}: {
  description: string
  items?: DeclarationItem[]
  faultCategories?: string[]
  loadError?: string | null
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader title="Declaration Queue" description={description} />
        <DeclarationQueueTable
          items={items}
          faultCategories={faultCategories}
          loadError={loadError}
        />
      </div>
    </div>
  )
}
