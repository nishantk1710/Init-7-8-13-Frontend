/**
 * The Declarations screen, from the backend (FR-4).
 *
 *   records       `GET /api/i8/attestations` -- every declaration ever recorded,
 *                 amended ones included, each with the repair lines it covers
 *   repair lines  `GET /api/i8/declarations` -- its `meta` only: how many repair
 *                 lines in the register still have no declaration
 *
 * The records are required; the repair-line count is best-effort, and a
 * failure shows as "could not be loaded" on the one tile that needs it.
 */

import type {
  DeclarationCondition,
  DeclarationRecord,
} from "@/features/initiative-8/types/repair"
import { orUndefined, toNumber } from "@/lib/api/format"
import type { ApiAttestation, ApiDeclarationMeta } from "@/lib/api/i8"
import { getAttestations, getDeclarations } from "@/lib/api/i8"

const CONDITIONS: Record<string, DeclarationCondition> = {
  Repairable: "Repairable",
  "Beyond Economical Repair": "Beyond Economical Repair",
  Scrap: "Scrap",
}

/** One API attestation as a screen record. */
export function toDeclarationRecord(api: ApiAttestation): DeclarationRecord {
  return {
    id: api.id,
    material: {
      materialId: api.material.materialId,
      materialCode: api.material.materialCode,
      // A material the universe has no description for shows its number, the
      // way every other I08 table does -- never a blank cell.
      description: api.material.description ?? api.material.materialCode,
    },
    plant: { plantId: api.plant.plantId, name: api.plant.name },
    quantity: toNumber(api.quantity) ?? 0,
    // The backend sends the three DeclarationCondition words and nothing else;
    // an unknown one is shown as the API said it, not coerced to Repairable.
    condition: CONDITIONS[api.condition] ?? (api.condition as DeclarationCondition),
    faultCategory: api.faultCategory,
    conditionDescription: api.conditionDescription,
    serialNumber: orUndefined(api.serialNumber),
    evidenceReference: orUndefined(api.evidenceReference),
    declaredBy: api.attestor,
    declaredAt: api.attestedAt,
    // Null only from a backend older than this screen, which listed history
    // without coverage. Read as "nothing matched", the cautious answer.
    repairLineIds: api.coversRepairLines ?? [],
    supersedes: orUndefined(api.supersedes),
    supersededBy: orUndefined(api.supersededBy),
  }
}

export type LiveDeclarationLog = {
  /** Newest first. */
  records: DeclarationRecord[]
  /** VZI's fault-category list, served with the data -- the form's options. */
  faultCategories: string[]
  /** The register's declaration counts. Null when that source failed. */
  repairLines: ApiDeclarationMeta | null
}

/** Throws only if the declarations themselves fail; the count degrades to null. */
export async function loadLiveDeclarationLog(): Promise<LiveDeclarationLog> {
  const [attestations, repairLines] = await Promise.all([
    getAttestations(),
    getDeclarations({ pageSize: 1 })
      .then((body) => body.meta)
      .catch(() => null),
  ])
  const records = attestations.items
    .map(toDeclarationRecord)
    .sort((a, b) => b.declaredAt.localeCompare(a.declaredAt))
  return { records, faultCategories: attestations.faultCategories, repairLines }
}
