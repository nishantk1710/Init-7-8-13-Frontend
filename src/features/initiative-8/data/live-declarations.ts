/**
 * The declaration log — `GET /api/i8/attestations` as the rows the Repair
 * Declarations screen lists.
 *
 * Log only since 3-Nov-2026. A declaration is made in the reservation
 * assistant, and the screen's queue ("To declare", "Historical"), which read
 * `GET /api/i8/declarations` page by page, went with the declare buttons. The
 * register still reads that endpoint's status for its Declaration column.
 */

import type { ApiAttestation } from "@/lib/api/i8"
import { getAttestations } from "@/lib/api/i8"
import { i08DateTime } from "@/features/initiative-8/utils/format"

/** `null` -> `undefined`, matching every other live-* adapter in this module. */
function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

/**
 * One recorded attestation, for the declaration LOG.
 *
 * What was actually judged, by whom, on what: quantity, fault category and
 * the assessment, and on a declaration made before 3-Nov-2026 the condition
 * text somebody typed and the optional serial and evidence.
 */
export type DeclarationLogRow = {
  id: string
  material: { materialId: string; materialCode: string; description: string }
  plant?: { plantId: string; name: string }
  quantity: string
  condition: string
  faultCategory: string
  conditionDescription: string
  serialNumber?: string
  /** Who declared: the requester's name the assistant recorded (typed into
   *  the form before 3-Nov-2026), else what the server stamped. As recorded. */
  attestor: string
  /** A reference someone can follow (a photo or report number). */
  evidenceReference?: string
  /** Why the amendment was made, on an amendment. */
  amendmentReason?: string
  attestedAt?: string
  /** Set when a later amendment replaced this one. The original is never
   *  edited or removed, so a reader needs this to know it is not current. */
  supersededBy?: string
  /** True when this row IS an amendment of an earlier one. */
  isAmendment: boolean
  /** The repair line it was declared against, as the register keys it --
   *  absent for a part declared with no repair line. */
  repairId?: string
  /** The same line, unjoined. */
  repairDocument?: string
  repairItem?: string
  repairDocumentType?: "PO" | "PR"
}

export function toLogRow(row: ApiAttestation): DeclarationLogRow {
  return {
    id: row.id,
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode ?? row.material.materialId,
      description: row.material.description ?? row.material.materialId,
    },
    plant: row.plant
      ? { plantId: row.plant.plantId, name: row.plant.name }
      : undefined,
    quantity: row.quantity,
    condition: row.condition,
    faultCategory: row.faultCategory,
    conditionDescription: row.conditionDescription,
    serialNumber: row.serialNumber ?? undefined,
    attestor: row.attestorName || row.attestor,
    evidenceReference: orUndefined(row.evidenceReference),
    amendmentReason: orUndefined(row.amendmentReason),
    // A full timestamp, so the date AND the time: the shared formatApiDate
    // turned a timestamp into an invalid date, and this column read "—" on
    // every row (I08_Live_UI_Redesign_Plan.md, Q11).
    attestedAt: row.attestedAt ? i08DateTime(row.attestedAt) : undefined,
    supersededBy: row.supersededBy ?? undefined,
    isAmendment: Boolean(row.supersedes),
    repairId:
      row.repairDocument && row.repairItem
        ? `${row.repairDocumentType === "PR" ? "PR-" : ""}${row.repairDocument}-${row.repairItem}`
        : undefined,
    repairDocument: orUndefined(row.repairDocument),
    repairItem: orUndefined(row.repairItem),
    repairDocumentType: orUndefined(row.repairDocumentType),
  }
}

/**
 * Every recorded attestation, newest first, for the declaration log. Null when
 * the call failed: an empty log must not be served in place of a failed one.
 *
 * Not paged. It holds what people have declared -- six rows today -- and grows
 * only as fast as they declare. Superseded rows are kept: they are the audit
 * history, and an amendment chain with the amended row hidden is not a chain.
 */
export async function loadDeclarationLog(): Promise<DeclarationLogRow[] | null> {
  return getAttestations()
    .then((body) => body.items.map(toLogRow))
    .catch(() => null)
}
