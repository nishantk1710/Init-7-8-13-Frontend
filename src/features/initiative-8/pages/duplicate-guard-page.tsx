import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { DuplicateGuardFlow } from "@/features/initiative-8/components/duplicate-guard-flow"
import {
  DEFAULT_MATERIAL,
  DEFAULT_PLANT,
  loadRepairableUnit,
  type RepairableUnitAnswer,
} from "@/features/initiative-8/data/live-repairable-unit"

/**
 * The Duplicate Guard (FR-6), live.
 *
 * Same split as the register: this server component asks the backend once,
 * for the default material, so the page opens on a real answer; the "use
 * client" flow asks again for anything the user types.
 */
export async function DuplicateGuardPage() {
  // The answer reads the register and the stock extract as they are now, so
  // a build-time snapshot would go stale the moment either changed.
  await connection()

  // The try/catch wraps ONLY the fetch -- see the note on the register page.
  let initialAnswer: RepairableUnitAnswer | null = null
  let initialError: string | null = null
  try {
    initialAnswer = await loadRepairableUnit(DEFAULT_MATERIAL, DEFAULT_PLANT)
  } catch (error) {
    initialError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader
          title="Duplicate Guard"
          description="Before a new unit is bought: does a repairable one already exist at the plant, in stock or on a repair order? Advisory — never blocks the requester."
        />
        <DuplicateGuardFlow initialAnswer={initialAnswer} initialError={initialError} />
      </div>
    </div>
  )
}
