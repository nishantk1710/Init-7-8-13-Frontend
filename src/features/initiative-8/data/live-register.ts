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
 *
 * ## Two ways in
 *
 * The Repair Register screen asks for ONE page (`loadRegisterPage`), and the
 * server searches, filters, counts and pages -- and serves each line's
 * exceptions with it. Until 18-Oct-2026 it loaded every line and the whole
 * exception queue: an 8-35 MB page and some 23 backend calls per visit.
 *
 * `loadLiveRegister` still loads every line, for the Overview, whose charts
 * and tiles describe the whole register rather than a page of it.
 *
 * ## Open lines only
 *
 * Since 19-Oct-2026 every line the backend serves is open in SAP: a line
 * marked "Delivery completed", deleted or blocked is not in the register, and
 * goods receipts are not read. The register `meta` counts what was left out.
 */

import { DROPPED_TYPES } from "@/features/initiative-8/data/live-exceptions"
import { single, type RawSearchParams } from "@/features/initiative-8/data/url-params"
import type {
  DeclarationCondition,
  RepairChain,
  RepairJustification,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
import {
  DECLARATION_STATUSES,
  DEFAULT_AGING_BUCKETS,
  NO_CRITICALITY,
  REPAIR_STATUS_ORDER,
  UNKNOWN_VENDOR,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import type {
  ApiRegisterPage,
  ApiRegisterViewCounts,
  ApiRepairChain,
  ApiRegisterMeta,
  ApiRepairJustification,
  RegisterQuery,
} from "@/lib/api/i8"
import { getRegister, getSnapshot, toNumber } from "@/lib/api/i8"
import { i08Date, i08DateTime } from "@/features/initiative-8/utils/format"
import { formatApiDateTime } from "@/lib/api/format"
import type { SAPDocumentReference } from "@/lib/domain/contracts"
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination"

/** The backend's max_page_size: as few round trips as the API allows, for the
 *  Overview's full load and the Register's export. */
const PAGE_SIZE = 500

const CONDITIONS: readonly DeclarationCondition[] = [
  "Repairable",
  "Beyond Economical Repair",
  "Scrap",
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

/**
 * The line's Justification cell. Every display value the backend leaves null
 * stays undefined: a justification with no author is "not recorded", never a
 * blank name.
 */
export function toRepairJustification(
  value: ApiRepairJustification,
): RepairJustification {
  return {
    status: value.status === "MISSING" ? "MISSING" : "RECORDED",
    entries: value.entries.map((entry) => ({
      id: orUndefined(entry.id),
      reasonCategory: orUndefined(entry.reasonCategory),
      freeText: orUndefined(entry.freeText),
      author: orUndefined(entry.author),
      recordedAt: entry.recordedAt ? i08DateTime(entry.recordedAt) : undefined,
      sessionId: orUndefined(entry.sessionId),
    })),
    unjustifiedPurchases: value.unjustifiedPurchases.map((purchase) => ({
      exceptionId: purchase.exceptionId,
      purchase: document_(purchase.purchase) ?? { type: "PO", documentNumber: "—" },
      raisedAt: purchase.raisedAt ? i08Date(purchase.raisedAt) : undefined,
      preAutomation: purchase.preAutomation,
    })),
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

    repairStatus: oneOf(row.repairStatus, REPAIR_STATUS_ORDER, "PR Raised"),
    declarationStatus: oneOf(row.declarationStatus, DECLARATION_STATUSES, "Required"),
    overdueStatus: row.overdueStatus,
    // A second signal beside overdueStatus, never a replacement for it: this
    // one measures against MARC.PLIFZ, the material's planned delivery time,
    // and a row can be ON_TIME and BEYOND_LEAD_TIME at the same time.
    leadTimeStatus: row.leadTimeStatus,

    // Both run to the reference date: the line is open in SAP. daysElapsed is
    // what the lead-time verdict is measured on; daysOpen is the same clock,
    // served for the column.
    daysOpen: row.daysOpen ?? 0,
    daysElapsed: orUndefined(row.daysElapsed),
    // Not a closed-set oneOf(): the bands are backend configuration
    // (I8_AGING_BAND_BOUNDARIES) and can change without a frontend deploy, so
    // any non-empty string from the API is trusted as-is.
    agingBucket: row.agingBucket ?? DEFAULT_AGING_BUCKETS[0],

    // Dates: the API sends ISO, everything in this app renders "28 Jul 2026".
    // i08Date is the one place that conversion happens.
    raisedAt: i08Date(row.raisedAt),
    poIssuedAt: row.poIssuedAt ? i08Date(row.poIssuedAt) : undefined,
    daysInCurrentStage: row.daysInCurrentStage ?? undefined,
    sentToVendorAt: row.sentToVendorAt ? i08Date(row.sentToVendorAt) : undefined,
    // Undefined on the 63 lines with no schedule line. Nobody ever agreed a
    // return date for them, and those are precisely the lines nobody is
    // chasing — so no placeholder date is invented.
    expectedReturn: row.expectedReturn ? i08Date(row.expectedReturn) : undefined,
    daysRemainingInRepair: orUndefined(row.daysRemainingInRepair),

    // Undefined when the repair line carries no net price -- never 0, which
    // would render as R 0.00 and read as a free repair.
    repairCost: toNumber(row.repairCost),
    // Undefined on 357 of 1,225 — every Gamsberg line, since the July MARC
    // extract has rows for plant 1300 only.
    newUnitLeadTimeDays: orUndefined(row.newUnitLeadTimeDays),

    // Same MARC gap, same 357 lines: no planned delivery time means no
    // lead-time verdict, which the status reports as NO_LEAD_TIME rather than
    // as compliance.
    leadTimeDays: orUndefined(row.leadTimeDays),
    daysOverLeadTime: orUndefined(row.daysOverLeadTime),

    // Undefined when ZMM065 has no rating -- never defaulted to NORMAL, which
    // would quietly downgrade an unrated part.
    criticality: orUndefined(row.criticality),

    // What the Declaration Queue used to show per row. The attestation is a
    // full timestamp; the register shows its date, the way the queue did.
    declarationId: orUndefined(row.declarationId),
    declaredBy: orUndefined(row.declaredBy),
    declaredAt: row.declaredAt ? i08Date(row.declaredAt) : undefined,
    // An unrecognised condition reads as not recorded, never as Repairable --
    // that fallback would be the one answer that makes a Flagged line look fine.
    condition: CONDITIONS.includes(row.condition as DeclarationCondition)
      ? (row.condition as DeclarationCondition)
      : undefined,
    declarationNextAction: orUndefined(row.nextAction),
    requester: orUndefined(row.requester),
    justification: row.justification ? toRepairJustification(row.justification) : undefined,
  }
}

/**
 * A register row with the exceptions the backend served on it, for the
 * Register screen and its export.
 *
 * Kept out of `toRepairChain` on purpose: the Overview adapts every line with
 * that, and its charts never read a line's exceptions -- carrying them would
 * add about half a megabyte to its page for nothing.
 */
export function toRegisterLine(row: ApiRepairChain): RepairChain {
  return {
    ...toRepairChain(row),
    // Undefined, not [], when the backend did not compute them: the column
    // then says "Not checked" instead of implying the line is clean.
    exceptions: row.exceptions?.map((item) => ({
      id: item.id,
      type: item.type,
      severity: item.severity,
    })),
  }
}

/** The filter dropdowns' choices, every one read off the rows themselves. */
export type RegisterOptions = {
  /** Distinct plants present in the data, for the filter. Built from the rows
   *  rather than the fixture plant list, whose ids do not exist here. */
  plantOptions: { plantId: string; name: string }[]
  /** Distinct vendor labels, same reasoning. Includes "Unknown vendor" so the
   *  455 lines with no PO header stay findable instead of vanishing from both
   *  the dropdown and the results. */
  vendorOptions: string[]
  /** The repair statuses that actually occur, in lifecycle order — three in
   *  the July extract, not the six the type allows. Offering a status no row
   *  has is a filter that can only ever return nothing. */
  repairStatusOptions: RepairStatus[]
  /** Criticality ratings present, most severe first, with `NO_CRITICALITY`
   *  last when any line is unrated — so unrated lines can be found, not just
   *  excluded. */
  criticalityOptions: string[]
}

const CRITICALITY_ORDER = ["CRITICAL", "IMPACT", "INSURANCE", "NORMAL", "OBSOLETE"]

/** Rank in a fixed order, with anything unlisted after it, alphabetically. */
function byKnownOrder(order: readonly string[]) {
  return (a: string, b: string) => {
    const rankA = order.includes(a) ? order.indexOf(a) : order.length
    const rankB = order.includes(b) ? order.indexOf(b) : order.length
    return rankA - rankB || a.localeCompare(b)
  }
}

/** Every dropdown's options, derived from the rows rather than a fixed list. */
export function buildRegisterOptions(chains: RepairChain[]): RegisterOptions {
  const plants = new Map<string, string>()
  const vendors = new Set<string>()
  const statuses = new Set<RepairStatus>()
  const criticalities = new Set<string>()
  let hasUnrated = false
  for (const chain of chains) {
    plants.set(chain.plant.plantId, chain.plant.name)
    vendors.add(vendorLabel(chain))
    statuses.add(chain.repairStatus)
    if (chain.criticality) criticalities.add(chain.criticality)
    else hasUnrated = true
  }

  return {
    plantOptions: [...plants]
      .map(([plantId, name]) => ({ plantId, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    vendorOptions: [...vendors].sort((a, b) => a.localeCompare(b)),
    repairStatusOptions: [...statuses].sort(byKnownOrder(REPAIR_STATUS_ORDER)),
    criticalityOptions: [
      ...[...criticalities].sort(byKnownOrder(CRITICALITY_ORDER)),
      ...(hasUnrated ? [NO_CRITICALITY] : []),
    ],
  }
}

/**
 * The register page's header line. Says what is left out as well as what is
 * in: the register lists only the repair lines SAP still has open (since
 * 19-Oct-2026), and a total with nothing to say what SAP closed would not
 * reconcile with an EKPO row count or with SAP's own open-PO list. Each "not
 * shown" figure appears only when the backend serves it and it is not zero.
 * Lines on a request for quotation (left out since 21-Oct-2026) are named
 * apart from the rest: an RFQ is not in a state SAP put it in, it was never an
 * order.
 *
 * **It does not name the source, and that is deliberate.** This line used to
 * begin "N repair lines from the July extract", in static text, while the
 * backend sent no provenance at all. When a CSV full pull replaced every raw
 * table underneath, the caption went on crediting the July extract — the one
 * sentence on the page a reader would use to tell the two apart was the one
 * sentence that could not know. The frontend may report how fresh the data is,
 * from `sourceLoadedAt`; it may not assert where the data came from.
 */
export function registerDescription(
  meta: ApiRegisterMeta,
  referenceDate: string,
  sourceLoadedAt?: string | null,
): string {
  let text = `${meta.openLines.toLocaleString()} open repair lines, as at ${referenceDate}.`
  const inSap = [
    [meta.excludedDeliveryCompletedLines, "delivery completed"],
    [meta.excludedBlockedLines, "blocked"],
    [meta.excludedDeletedLines, "deleted"],
  ]
    .filter((entry): entry is [number, string] => Boolean(entry[0]))
    .map(([count, what]) => `${count.toLocaleString()} ${what}`)
  const notShown = inSap.length > 0 ? [`${listed(inSap)} in SAP`] : []
  const rfq = meta.excludedRfqLines
  if (rfq) {
    notShown.push(
      `${rfq.toLocaleString()} on ${rfq === 1 ? "a request" : "requests"} for quotation`,
    )
  }
  if (notShown.length > 0) {
    text += ` Not shown: ${notShown.join(", and ")}.`
  }
  if (sourceLoadedAt) {
    text += ` SAP data loaded ${formatApiDateTime(sourceLoadedAt)}.`
  }
  return text
}

/** "a", "a and b", "a, b and c". */
function listed(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]
}

/**
 * The aging bands and the source's load time, from `GET /api/i8/snapshot`.
 *
 * Best-effort: the register itself is the primary fetch, and a snapshot
 * failure should not take the whole page down over a chart's axis labels.
 */
async function loadRegisterSettings(
  fetchSnapshot: typeof getSnapshot = getSnapshot,
): Promise<{ agingBands: string[]; sourceLoadedAt: string | null }> {
  try {
    const snapshot = await fetchSnapshot()
    const parsed = String(snapshot.rules.agingBands ?? "")
      .split(",")
      .map((band) => band.trim())
      .filter(Boolean)
    return {
      agingBands: parsed.length > 0 ? parsed : DEFAULT_AGING_BUCKETS,
      sourceLoadedAt: snapshot.sourceLoadedAt ?? null,
    }
  } catch {
    // Keep the defaults silently -- this is presentation, not data integrity.
    // The caption drops its freshness clause rather than guessing at one.
    return { agingBands: DEFAULT_AGING_BUCKETS, sourceLoadedAt: null }
  }
}

export type LiveRegister = RegisterOptions & {
  chains: RepairChain[]
  /** The currently configured aging bands (`GET /api/i8/snapshot`'s
   *  `rules.agingBands`), for the chart and the filter dropdown to render
   *  instead of a hard-coded list. Falls back to `DEFAULT_AGING_BUCKETS` if
   *  the snapshot fetch fails, so a config-endpoint outage degrades rather
   *  than breaking the page. */
  agingBands: string[]
  meta: ApiRegisterMeta
  referenceDate: string
  /** When the SAP tables behind the register were last loaded, from the same
   *  best-effort snapshot fetch as `agingBands`. Null when that fetch failed
   *  or the backend does not serve it — the caption then says nothing about
   *  freshness rather than inventing a source. */
  sourceLoadedAt: string | null
}

/**
 * Fetch the whole register and adapt it, for the Overview: its charts and
 * tiles describe every line, not a page of them. The Register screen itself
 * asks for one page (`loadRegisterPage`).
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

  const { agingBands, sourceLoadedAt } = await loadRegisterSettings()

  return {
    chains,
    ...buildRegisterOptions(chains),
    agingBands,
    meta: meta!,
    referenceDate,
    sourceLoadedAt,
  }
}

// --- One page, for the Register screen --------------------------------------

export const REGISTER_PATH = "/repairable-spares/repair-register"

/** `?vendor=none` finds the lines with no vendor; `?criticality=none` the
 *  unrated ones. */
export const NONE = "none"

/** A ceiling on export requests, so a backend that ignored `page` and kept
 *  returning full pages could never loop forever. 200 x 500 rows. */
const MAX_EXPORT_PAGES = 200

/** What the register can be narrowed by. Each is a URL parameter of the same name. */
export type RegisterFilters = {
  /** Material number or description, repair line, or the PO or PR number. */
  q?: string
  plant?: string
  /** A vendor code, or `none` for the lines with no vendor. */
  vendor?: string
  repairStatus?: string
  /** An `OverdueStatus`. */
  overdue?: string
  /** A rating, or `none` for the unrated lines. */
  criticality?: string
  declarationStatus?: string
  aging?: string
  /** The aging band of the days in the current stage: what one cell of the
   *  Overview's stage-by-age table opens. */
  stageAging?: string
  /** `?exceptions=1`: only lines a check has raised something against. */
  exceptions?: boolean
  /** A quick view: `overdue`, `undeclared`, `atVendor` or `withExceptions`. */
  view?: string
}

/** The register's quick views, in the order the screen shows them. */
export const REGISTER_VIEWS = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "undeclared", label: "Not declared" },
  { value: "atVendor", label: "At vendor" },
  { value: "withExceptions", label: "With exceptions" },
] as const

/** The dropdowns' choices: the server's, over the whole listed register. */
export type RegisterFacets = {
  plants: { plantId: string; name: string }[]
  /** `value` is what the filter takes: a vendor code, or `none`. */
  vendors: { value: string; label: string }[]
  /** In lifecycle order. */
  repairStatuses: string[]
  /** Most severe first; `none` ("Not recorded") last when any line is unrated. */
  criticalities: { value: string; label: string }[]
}

export type RegisterPage = {
  chains: RepairChain[]
  /** Matching the filters. */
  total: number
  /** The listed register's counts, whatever the filters -- the caption's. */
  meta: ApiRegisterMeta
  facets: RegisterFacets
  referenceDate: string
  agingBands: string[]
  sourceLoadedAt: string | null
  /** Each quick view's count over the filtered lines; null from a backend
   *  older than the quick views, when the buttons show no numbers. */
  viewCounts: ApiRegisterViewCounts | null
}

type FetchRegister = typeof getRegister

const TEXT_FILTERS = [
  "q",
  "plant",
  "vendor",
  "repairStatus",
  "overdue",
  "criticality",
  "declarationStatus",
  "aging",
  "stageAging",
  "view",
] as const

export function parseRegisterParams(raw: RawSearchParams): {
  filters: RegisterFilters
  page: number
} {
  const filters: RegisterFilters = { exceptions: single(raw.exceptions) === "1" }
  for (const key of TEXT_FILTERS) filters[key] = single(raw[key])
  return { filters, page: parsePage(raw.page) ?? 1 }
}

/** How many filters narrow the register. */
export function activeRegisterFilters(filters: RegisterFilters): number {
  return Object.values(filters).filter(Boolean).length
}

/**
 * The link to one page of the register, keeping the filters. Page 1 drops
 * `page`, so the plain screen and its first page are one URL.
 */
export function registerHref(filters: RegisterFilters, page = 1): string {
  const params = new URLSearchParams()
  for (const key of TEXT_FILTERS) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  if (filters.exceptions) params.set("exceptions", "1")
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `${REGISTER_PATH}?${query}` : REGISTER_PATH
}

/**
 * The request for what the screen shows.
 *
 * One parameter is always on, because it says what this listing is rather
 * than narrows it: `excludeExceptionType` keeps the Exceptions column to the
 * checks the exception queue carries (`DROPPED_TYPES`). Nothing is held back
 * from the listing itself any more -- every line the backend serves is open
 * in SAP.
 */
function registerQuery(filters: RegisterFilters): RegisterQuery {
  return {
    q: filters.q,
    plant: filters.plant,
    vendor: filters.vendor,
    status: filters.repairStatus,
    overdueStatus: filters.overdue,
    criticality: filters.criticality,
    declarationStatus: filters.declarationStatus,
    agingBucket: filters.aging,
    stageAgingBucket: filters.stageAging,
    withExceptions: filters.exceptions || undefined,
    view: filters.view,
    excludeExceptionType: [...DROPPED_TYPES].join(","),
  }
}

/**
 * The dropdown values, ordered as they always were: plants by name, statuses
 * in lifecycle order, ratings most severe first. "Unknown vendor" and "Not
 * recorded" come last, so the lines with neither stay findable. A backend
 * older than paging sends no facets; the page's rows are then the best there
 * is.
 */
function facetsOf(body: ApiRegisterPage, chains: RepairChain[]): RegisterFacets {
  const facets = body.facets ?? {
    plants: chains.map((c) => c.plant),
    vendors: [
      ...new Map(
        chains.flatMap((c) => (c.vendor ? [[c.vendor, c.vendorName ?? null] as const] : [])),
      ),
    ]
      .map(([vendor, name]) => ({ vendor, name }))
      .sort((a, b) => (a.name ?? a.vendor).localeCompare(b.name ?? b.vendor)),
    hasUnknownVendor: chains.some((c) => !c.vendor),
    repairStatuses: [...new Set(chains.map((c) => c.repairStatus))],
    criticalities: [...new Set(chains.flatMap((c) => (c.criticality ? [c.criticality] : [])))],
    hasUnrated: chains.some((c) => !c.criticality),
  }
  return {
    plants: [...new Map(facets.plants.map((p) => [p.plantId, p.name]))]
      .map(([plantId, name]) => ({ plantId, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    vendors: [
      ...facets.vendors.map((v) => ({ value: v.vendor, label: v.name ?? v.vendor })),
      ...(facets.hasUnknownVendor ? [{ value: NONE, label: UNKNOWN_VENDOR }] : []),
    ],
    repairStatuses: [...facets.repairStatuses].sort(byKnownOrder(REPAIR_STATUS_ORDER)),
    criticalities: [
      ...[...facets.criticalities]
        .sort(byKnownOrder(CRITICALITY_ORDER))
        .map((rating) => ({ value: rating, label: rating })),
      ...(facets.hasUnrated ? [{ value: NONE, label: NO_CRITICALITY }] : []),
    ],
  }
}

/**
 * One page of the register, with the counts, dropdown values and aging bands
 * around it.
 *
 * One request for the register: its meta describes the listed register
 * whatever the filters, and the facets are taken before them. The snapshot
 * settings come alongside, best-effort.
 *
 * Throws on failure, so a failed request is never shown as an empty register.
 */
export async function loadRegisterPage(
  filters: RegisterFilters,
  page: number,
  {
    pageSize = DEFAULT_PAGE_SIZE,
    fetchPage = getRegister,
    fetchSnapshot = getSnapshot,
  }: { pageSize?: number; fetchPage?: FetchRegister; fetchSnapshot?: typeof getSnapshot } = {},
): Promise<RegisterPage> {
  const [body, settings] = await Promise.all([
    fetchPage({ ...registerQuery(filters), page, pageSize }),
    loadRegisterSettings(fetchSnapshot),
  ])
  const chains = body.items.map(toRegisterLine)
  return {
    chains,
    total: body.total,
    meta: body.meta,
    facets: facetsOf(body, chains),
    referenceDate: body.referenceDate,
    ...settings,
    viewCounts: body.viewCounts ?? null,
  }
}

/**
 * Every line the filters match, for the export: the register, not the page.
 *
 * Fetched in the largest pages the backend serves and deduplicated by id, in
 * case the register is rebuilt while the export runs.
 */
export async function fetchAllRegisterLines(
  filters: RegisterFilters,
  fetchPage: FetchRegister = getRegister,
): Promise<RepairChain[]> {
  const byId = new Map<string, RepairChain>()
  for (let page = 1; page <= MAX_EXPORT_PAGES; page++) {
    const body = await fetchPage({ ...registerQuery(filters), page, pageSize: PAGE_SIZE })
    for (const chain of body.items.map(toRegisterLine)) {
      if (!byId.has(chain.id)) byId.set(chain.id, chain)
    }
    if (body.items.length < PAGE_SIZE || page * PAGE_SIZE >= body.total) break
  }
  return [...byId.values()]
}
