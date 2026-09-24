/**
 * The live declaration queue — `GET /api/i8/declarations`.
 *
 * One row per repair line, saying whether anybody assessed the part before it
 * was sent away.
 *
 * ## The number this screen exists to show
 *
 * Under `live`, with no attestations recorded, **every one of the 1,225 repair
 * lines reads "Required"**. That is not a loading bug or an unseeded database:
 * no attestation has ever existed for any historical repair, because until this
 * platform there was nowhere to record one.
 *
 * That number is the business case for W5.3 and it should be read out at UAT,
 * not softened. The demo seeder (`python -m app.initiatives.i8.demo_seed`)
 * marks a handful of lines so the Completed and Flagged states have something
 * to show, and every seeded row is stamped `DEMO_SEED` precisely so nobody
 * mistakes it for evidence that the gap is smaller than it is.
 *
 * ## Two fields that arrive empty on purpose
 *
 * `source` is null on every row. The SAP table that would say Manual vs
 * MRP-generated covers 521 of the 1,201 repair requisitions, and every one of
 * those reads "created from an order" — which is neither. Both labels are false
 * for every row we can see, so neither is sent, and the column renders as
 * unknown rather than picking one.
 *
 * `requester` is a CODE, not a name. No person directory was delivered. It is
 * shown as a code, exactly the way an unnamed vendor is.
 */

import type {
  DeclarationCondition,
  DeclarationItem,
  DeclarationStatus,
} from "@/features/initiative-8/types/repair"
import type { ApiDeclarationItem, ApiDeclarationMeta } from "@/lib/api/i8"
import { formatApiDate, getDeclarations } from "@/lib/api/i8"

const PAGE_SIZE = 500

const STATUSES: readonly DeclarationStatus[] = [
  "Required",
  "Pending",
  "Completed",
  "Flagged",
]

const CONDITIONS: readonly DeclarationCondition[] = [
  "Repairable",
  "Beyond Economical Repair",
  "Scrap",
]

/** Placeholder for a value no source carries. Matches `utils/status.UNKNOWN`. */
const UNKNOWN = "—"

function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/**
 * One API row as the `DeclarationItem` the queue table already renders.
 *
 * The domain type requires `pr`, `requester` and `source`; the API can send
 * null for all three. Each is filled with an explicit unknown marker rather
 * than a plausible value — the table shows a dash, which is a true statement,
 * instead of a name or a provenance nobody recorded.
 */
export function toDeclarationItem(row: ApiDeclarationItem): DeclarationItem {
  return {
    id: row.id,
    pr: row.pr
      ? {
          type: row.pr.type,
          documentNumber: row.pr.documentNumber,
          line: row.pr.line ?? undefined,
        }
      : // No requisition number on the line. A PR chip reading "—" is honest;
        // inventing a document number would put a fake SAP reference on screen.
        { type: "PR", documentNumber: UNKNOWN },
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode,
      description: row.material.description ?? row.material.materialId,
    },
    // Needed by the attestation form: the record is per material-plant.
    plant: row.plant
      ? { plantId: row.plant.plantId, name: row.plant.name }
      : undefined,
    requester: row.requester ?? UNKNOWN,
    // Null on every row today. The domain type does not allow null, so the
    // unknown marker stands in -- never "Manual", which would be a guess about
    // how somebody bought something.
    source: (row.source ?? UNKNOWN) as DeclarationItem["source"],
    hasActiveRepair: row.hasActiveRepair,
    relatedRepairId: row.relatedRepairId,
    status: oneOf(row.status, STATUSES, "Required"),
    declaredBy: row.declaredBy ?? undefined,
    declaredAt: row.declaredAt ? formatApiDate(row.declaredAt.slice(0, 10)) : undefined,
    condition: row.condition
      ? oneOf(row.condition, CONDITIONS, "Repairable")
      : undefined,
    nextAction: row.nextAction,
    createdAt: row.createdAt ? formatApiDate(row.createdAt) : UNKNOWN,
  }
}

/**
 * Attach each row's quantity still under repair, joined from the register on
 * `relatedRepairId`.
 *
 * Only ever the attestation form's DEFAULT quantity. The declaration API does
 * not carry it, and asking the person to type a number the register already
 * knows invites a wrong one. A line that is back (0 under repair) or missing
 * from the register gets nothing, and the form falls back to 1.
 */
export function withQuantitiesUnderRepair(
  items: DeclarationItem[],
  chains: { id: string; qtyUnderRepair: number }[],
): DeclarationItem[] {
  const quantities = new Map(chains.map((chain) => [chain.id, chain.qtyUnderRepair]))
  return items.map((item) => {
    const quantity = item.relatedRepairId ? quantities.get(item.relatedRepairId) : undefined
    return quantity !== undefined && quantity > 0
      ? { ...item, quantityUnderRepair: quantity }
      : item
  })
}

/**
 * The form's quantity field as a number the API will accept, or `undefined`.
 *
 * Checked before the round trip so the button can say no; the backend applies
 * its own range check too and its 422 says why, which the form shows as-is.
 */
export function parseAttestationQuantity(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export type LiveDeclarations = {
  items: DeclarationItem[]
  meta: ApiDeclarationMeta
  referenceDate: string
}

/**
 * Fetch the whole declaration queue and adapt it.
 *
 * Throws on failure. The caller renders that visibly: an empty queue and an
 * unreachable backend are different statements, and "nothing to declare" is
 * the most misleading possible way to report a failed request on this screen.
 */
export async function loadLiveDeclarations(): Promise<LiveDeclarations> {
  const items: DeclarationItem[] = []
  let page = 1
  let meta: ApiDeclarationMeta | undefined
  let referenceDate = ""

  for (;;) {
    const body = await getDeclarations({ page, pageSize: PAGE_SIZE })
    meta = body.meta
    referenceDate = body.referenceDate
    items.push(...body.items.map(toDeclarationItem))
    if (items.length >= body.total || body.items.length === 0) break
    page += 1
  }

  return { items, meta: meta!, referenceDate }
}
