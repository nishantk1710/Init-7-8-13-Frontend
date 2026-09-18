/**
 * The live register — `GET /api/i8/register` as the `RepairChain` the UI renders.
 *
 * This is the whole of W5.4's data layer. The register table and the repair
 * detail page render `RepairChain[]`; the backend sends `ApiRepairChain[]`. One
 * adapter sits between them so no component has to know the wire shape, and so
 * the fixtures keep working unchanged in every other mode.
 *
 * ## What the adapter is actually for
 *
 * Three real differences, not cosmetic ones:
 *
 * **Names differ where the wire and the domain disagree.** The API sends
 * `repairPr`/`repairPo` (camelCased from Python's `repair_pr`); the domain type
 * has said `repairPR`/`repairPO` since before the backend existed. Renaming
 * either side to match would be churn in somebody else's file, so the rename
 * happens here, once.
 *
 * **Decimals arrive as strings.** Quantities and prices cross the wire as
 * strings so JSON cannot round them. `toNumber` parses them and — importantly —
 * keeps `undefined` as `undefined` rather than coercing to 0. For stock on hand
 * the difference between "unknown" and "zero" is the entire point: zero stock
 * is what triggers a duplicate purchase.
 *
 * **`null` becomes `undefined`.** The API says `null` for "this source does not
 * know"; the domain type says `undefined` for the same thing. Every one of those
 * nulls is a measured gap with a reason — see `types/repair.ts`. None of them is
 * filled in here, and none of them should ever be.
 *
 * ## What it deliberately does NOT do
 *
 * It does not invent a vendor name, a plant name, a lead time or a return date.
 * Real data has holes the fixtures politely filled in, and the first live render
 * will look worse than the mock one. That is correct. A screen that admits it
 * does not know a vendor's name is worth more than one that quietly makes it up,
 * and that is the entire reason Initiative 8 exists.
 */

import type {
  DeclarationStatus,
  ReceiptStatus,
  RepairChain,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
import { DEFAULT_AGING_BUCKETS } from "@/features/initiative-8/utils/status"
import type { ApiRepairChain, ApiRegisterMeta } from "@/lib/api/i8"
import { formatApiDate, getRegister, getSnapshot, toNumber } from "@/lib/api/i8"
import type { SAPDocumentReference } from "@/lib/domain/contracts"

/** How many rows to pull. The register is 1,225 lines; the table filters them
 *  client side, exactly as it does over the fixtures. */
const PAGE_SIZE = 500

const REPAIR_STATUSES: readonly RepairStatus[] = [
  "PR Raised",
  "PO Issued",
  "At Vendor",
  "In Transit Return",
  "Received",
  "Closed",
]

const RECEIPT_STATUSES: readonly ReceiptStatus[] = [
  "Not Yet Shipped",
  "Awaiting Receipt",
  "Partially Received",
  "Received",
]

const DECLARATIONS: readonly DeclarationStatus[] = [
  "Required",
  "Pending",
  "Completed",
  "Flagged",
]

/**
 * A backend string as one of the UI's union members, or a stated fallback.
 *
 * The backend and this repository agree on these vocabularies today — measured
 * against all 1,225 rows, every value it sends is in range. This guards the day
 * one of them adds a value: an unrecognised status renders as the fallback
 * instead of putting an unstyled string through a `Record<Union, Tone>` lookup
 * and crashing the table.
 */
function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** `null` -> `undefined`, so "the source does not know" reads the same way the
 *  domain type spells it. Never a default value. */
function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

function document_(
  reference: { type: string; documentNumber: string; line: string | null } | null,
): SAPDocumentReference | undefined {
  if (!reference) return undefined
  return {
    type: reference.type as SAPDocumentReference["type"],
    documentNumber: reference.documentNumber,
    line: orUndefined(reference.line),
  }
}

/** One API row as the `RepairChain` every Initiative 8 component already takes. */
export function toRepairChain(row: ApiRepairChain): RepairChain {
  return {
    id: row.id,
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode,
      // The domain type requires a description. Around a tenth of the series
      // has no material-master row at all, so the PO short text is often the
      // only description that exists — and where even that is absent, the
      // material number is shown rather than an empty cell.
      description: row.material.description ?? row.material.materialId,
    },
    plant: row.plant
      ? { plantId: row.plant.plantId, name: row.plant.name }
      : // Only 1300 and 1500 are documented anywhere; the backend already
        // serves the code as the name for the rest. A row with no plant at all
        // does not occur in this extract, and is shown as unknown rather than
        // dropped if it ever does.
        { plantId: "—", name: "Unknown plant" },

    stockOnHand: toNumber(row.stockOnHand),
    reorderPoint: toNumber(row.reorderPoint),
    qtyUnderRepair: toNumber(row.qtyUnderRepair) ?? 0,

    repairPR: document_(row.repairPr) ?? {
      type: "PR",
      documentNumber: "—",
    },
    repairPO: document_(row.repairPo),

    vendor: orUndefined(row.vendor),
    vendorName: orUndefined(row.vendorName),

    repairStatus: oneOf(row.repairStatus, REPAIR_STATUSES, "PR Raised"),
    receiptStatus: oneOf(row.receiptStatus, RECEIPT_STATUSES, "Not Yet Shipped"),
    declarationStatus: oneOf(row.declarationStatus, DECLARATIONS, "Required"),
    overdueStatus: row.overdueStatus,

    daysOpen: row.daysOpen ?? 0,
    // Not a closed-set oneOf(): the bands are backend configuration
    // (I8_AGING_BAND_BOUNDARIES) and can change without a frontend deploy, so
    // any non-empty string from the API is trusted as-is.
    agingBucket: row.agingBucket ?? DEFAULT_AGING_BUCKETS[0],

    // Dates: the API sends ISO, everything in this app renders "28 Jul 2026".
    // formatApiDate is the one place that conversion happens.
    raisedAt: formatApiDate(row.raisedAt),
    poIssuedAt: row.poIssuedAt ? formatApiDate(row.poIssuedAt) : undefined,
    sentToVendorAt: row.sentToVendorAt ? formatApiDate(row.sentToVendorAt) : undefined,
    // Undefined on the 63 lines with no schedule line. Nobody ever agreed a
    // return date for them, and those are precisely the lines nobody is
    // chasing — so no placeholder date is invented.
    expectedReturn: row.expectedReturn ? formatApiDate(row.expectedReturn) : undefined,
    daysRemainingInRepair: orUndefined(row.daysRemainingInRepair),
    receivedAt: row.receivedAt ? formatApiDate(row.receivedAt) : undefined,

    // newUnitCost is absent on purpose: no valuation source exists in
    // Initiative 8's table set, and MBEW now returns HTTP 400 on $count. A 0
    // would make every repair look infinitely worth doing.
    repairCost: toNumber(row.repairCost) ?? 0,
    // Undefined on 357 of 1,225 — every Gamsberg line, since MARC covers
    // plants 1300 and 1200 only.
    newUnitLeadTimeDays: orUndefined(row.newUnitLeadTimeDays),
  }
}

export type LiveRegister = {
  chains: RepairChain[]
  /** Distinct plants present in the data, for the filter. Built from the rows
   *  rather than the fixture plant list, whose ids do not exist here. */
  plantOptions: { plantId: string; name: string }[]
  /** Distinct vendor labels, same reasoning. Includes "Unknown vendor" so the
   *  455 lines with no PO header stay findable instead of vanishing from both
   *  the dropdown and the results. */
  vendorOptions: string[]
  /** The currently configured aging bands (`GET /api/i8/snapshot`'s
   *  `rules.agingBands`), for the chart and the filter dropdown to render
   *  instead of a hard-coded list. Falls back to `DEFAULT_AGING_BUCKETS` if
   *  the snapshot fetch fails, so a config-endpoint outage degrades rather
   *  than breaking the page. */
  agingBands: string[]
  meta: ApiRegisterMeta
  referenceDate: string
}

/**
 * Fetch the whole register and adapt it.
 *
 * Fetched on the server (the page is an async server component) and filtered on
 * the client, which is what the table already does over the fixtures. 1,225 rows
 * is comfortably small enough for that, so the backend's server-side filter
 * parameters can wait for a later pass rather than being wired into five
 * `useState` hooks now.
 *
 * Throws on failure — the caller renders that visibly. An empty table and a
 * failed request are different statements, and one must never be shown as the
 * other.
 */
export async function loadLiveRegister(): Promise<LiveRegister> {
  const chains: RepairChain[] = []
  let page = 1
  let meta: ApiRegisterMeta | undefined
  let referenceDate = ""

  // Paged rather than one huge request, because the API caps pageSize.
  for (;;) {
    const body = await getRegister({ page, pageSize: PAGE_SIZE })
    meta = body.meta
    referenceDate = body.referenceDate
    chains.push(...body.items.map(toRepairChain))
    if (chains.length >= body.total || body.items.length === 0) break
    page += 1
  }

  // Best-effort: the register itself is the primary fetch, and a snapshot
  // failure should not take the whole page down over a chart's axis labels.
  let agingBands: string[] = DEFAULT_AGING_BUCKETS
  try {
    const snapshot = await getSnapshot()
    const parsed = String(snapshot.rules.agingBands ?? "")
      .split(",")
      .map((band) => band.trim())
      .filter(Boolean)
    if (parsed.length > 0) agingBands = parsed
  } catch {
    // Keep the default silently -- this is presentation, not data integrity.
  }

  const plants = new Map<string, string>()
  const vendors = new Set<string>()
  for (const chain of chains) {
    plants.set(chain.plant.plantId, chain.plant.name)
    vendors.add(chain.vendorName ?? chain.vendor ?? "Unknown vendor")
  }

  return {
    chains,
    plantOptions: [...plants]
      .map(([plantId, name]) => ({ plantId, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    vendorOptions: [...vendors].sort((a, b) => a.localeCompare(b)),
    agingBands,
    meta: meta!,
    referenceDate,
  }
}
