/**
 * The live exception queue — `GET /api/i8/exceptions` as the rows the
 * Exceptions screen renders.
 *
 * ## Expect this to be large, and say so
 *
 * Every historical repair line raises `MISSING_ATTESTATION`, because the
 * control did not exist before this platform. That number is the business case
 * for the declaration work, not a bug in it — which is exactly why the summary
 * carries `actionable` (total less pre-automation) alongside `total`. Quoting
 * either one on its own misleads, in opposite directions.
 *
 * `preAutomation` depends on `attestationCutoverDate`, which is unset on the
 * deployed backend -- so every row currently reads as actionable, and
 * `actionable === total`. Hiding pre-automation rows, on this screen, hides
 * nothing today. It stays applied because it is correct and will matter the
 * day VZI supplies the date (FRS open item, audit §10 item 5's sibling), but
 * it must not be read as a way to make this fetch shorter right now.
 *
 * ## Paged, to the end
 *
 * The backend caps a page at `maxPageSize` (500), and the queue can run to
 * thousands of rows. The loop below follows pages until it has everything,
 * the same way `live-register.ts` and `live-declarations.ts` do. There used
 * to be a `MAX_ROWS` ceiling here, and it is why this screen showed "first
 * 2,000 of 5,975" -- a limit this file imposed on itself, not one the API or
 * the browser required. Removed 13-Oct-2026 for the same reason it came out
 * of the declaration queue: a cap with a caption still shows a partial queue,
 * and the caption does not make that true.
 */

import type {
  ExceptionEvent,
  ExceptionQueueRow,
  ExceptionQueueSummary,
  ExceptionStatus,
  RepairChain,
  RepairLineException,
} from "@/features/initiative-8/types/repair"
import type {
  ApiExceptionEvent,
  ApiExceptionItem,
  ApiExceptionMeta,
  ExceptionQuery,
} from "@/lib/api/i8"
import { formatApiDateTime } from "@/lib/api/format"
import { formatApiDate, getExceptions } from "@/lib/api/i8"

function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

function toRow(row: ApiExceptionItem): ExceptionQueueRow {
  return {
    id: row.id,
    // A plain string, never switched over exhaustively: the backend declares
    // more types than it raises, and one this build has not heard of must
    // still render.
    type: row.type,
    severity: row.severity,
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode ?? row.material.materialId,
      description: row.material.description ?? row.material.materialId,
    },
    plant: row.plant
      ? { plantId: row.plant.plantId, name: row.plant.name }
      : undefined,
    repairLine: row.repairLine.line
      ? `${row.repairLine.documentNumber}-${row.repairLine.line}`
      : row.repairLine.documentNumber,
    // The register's detail route is keyed {document}-{item}, so a line
    // without an item cannot be linked -- and is served unlinked rather than
    // linked to a page that will 404.
    repairId: row.repairLine.line
      ? `${row.repairLine.documentNumber}-${row.repairLine.line}`
      : undefined,
    acquisitionLine: row.acquisitionLine
      ? row.acquisitionLine.line
        ? `${row.acquisitionLine.documentNumber}-${row.acquisitionLine.line}`
        : row.acquisitionLine.documentNumber
      : undefined,
    title: row.title,
    detail: row.detail,
    raisedAt: row.raisedAt ? formatApiDate(row.raisedAt) : undefined,
    isOpenRepair: row.isOpenRepair,
    preAutomation: row.preAutomation,
    // Defaults for a backend that does not serve the lifecycle yet. OPEN and
    // unassigned is what an untouched item genuinely is, so an older API and
    // a brand-new finding read the same way -- which is correct, because they
    // are the same thing.
    status: row.status ?? "OPEN",
    owner: row.owner ?? undefined,
    stillDetected: row.stillDetected ?? true,
    history: (row.history ?? []).map(toEvent),
  }
}

function toEvent(event: ApiExceptionEvent): ExceptionEvent {
  return {
    id: event.id,
    kind: event.kind,
    status: (event.status as ExceptionStatus | null) ?? undefined,
    owner: event.owner ?? undefined,
    actor: event.actor,
    text: event.text,
    at: formatApiDateTime(event.at),
  }
}

function toSummary(meta: ApiExceptionMeta): ExceptionQueueSummary {
  return {
    total: meta.total,
    actionable: meta.actionable,
    preAutomation: meta.preAutomation,
    byType: meta.byType,
    bySeverity: meta.bySeverity,
    linesChecked: meta.linesChecked,
    linesCovered: meta.linesCovered,
    typesRaised: meta.typesRaised,
    attestationWindowDays: meta.attestationWindowDays,
    attestationCutoverDate: orUndefined(meta.attestationCutoverDate),
    justificationWindowDays: meta.justificationWindowDays,
    acquisitionsChecked: meta.acquisitionsChecked,
  }
}

export type LiveExceptions = {
  rows: ExceptionQueueRow[]
  summary: ExceptionQueueSummary
  referenceDate?: string
  truncated: boolean
}

const PAGE_SIZE = 500

/**
 * Checks the queue no longer carries.
 *
 * `UNJUSTIFIED_ACQUISITION` — "bought new while a repair was open, with no
 * justification" — came out on 14-Oct-2026. FR-5b asks the requester for that
 * reason at the moment of the reservation, and the Spares Assistant is where
 * it is asked, so a purchase that reaches this queue unjustified is the case
 * the control upstream exists to prevent. Raising it again afterwards gives
 * nobody work they do not already have.
 *
 * The backend still runs the check and still serves its count. The
 * Justifications screen is where that number belongs — beside the reasons
 * themselves and the share of purchases that carry one — rather than in a
 * queue somebody is meant to work through.
 *
 * Dropped here rather than in the table so that everything reading this
 * loader agrees about what the queue holds: the summary band, the type
 * filter, the CSV export, and the register's per-line exception chips.
 */
const DROPPED_TYPES: ReadonlySet<string> = new Set(["UNJUSTIFIED_ACQUISITION"])

/**
 * The summary, describing the rows that are left.
 *
 * Subtracted from the backend's own counts rather than recomputed from the
 * rows: `linesChecked`, `linesCovered` and the window settings are facts about
 * the run that no amount of row counting reproduces, and `total` has to keep
 * meaning what the band above the table says it means.
 *
 * `acquisitionsChecked` and `justificationWindowDays` are left alone. They
 * describe the justification check, which still runs — the Justifications
 * screen reads them from the same meta and reports them there.
 */
function withoutDroppedTypes(
  summary: ExceptionQueueSummary,
  dropped: ExceptionQueueRow[],
): ExceptionQueueSummary {
  const preAutomation = dropped.filter((row) => row.preAutomation).length
  const bySeverity = { ...summary.bySeverity }
  for (const row of dropped) {
    if (bySeverity[row.severity] !== undefined) {
      bySeverity[row.severity] = Math.max(0, bySeverity[row.severity] - 1)
    }
  }

  return {
    ...summary,
    total: Math.max(0, summary.total - dropped.length),
    actionable: Math.max(0, summary.actionable - (dropped.length - preAutomation)),
    preAutomation: Math.max(0, summary.preAutomation - preAutomation),
    byType: Object.fromEntries(
      Object.entries(summary.byType).filter(([type]) => !DROPPED_TYPES.has(type)),
    ),
    bySeverity,
    // Out of `typesRaised` too, and this is the half that shows today: the
    // deployed backend raises none of these but still declares the check, so
    // the type sat in the filter dropdown and in "How each check works" with
    // nothing behind it either way.
    typesRaised: summary.typesRaised.filter((type) => !DROPPED_TYPES.has(type)),
  }
}

/**
 * Fetch the exception queue, following pages.
 *
 * Throws on failure — a failed request is not an empty queue, and on this
 * screen above all the two must never render the same: "no exceptions" is the
 * single most expensive wrong answer here.
 */
export async function loadLiveExceptions(
  query: Omit<ExceptionQuery, "page" | "pageSize"> = {},
): Promise<LiveExceptions> {
  const rows: ExceptionQueueRow[] = []
  let summary: ExceptionQueueSummary | null = null
  let referenceDate: string | undefined
  let page = 1
  let total = 0

  for (;;) {
    const body = await getExceptions({ ...query, page, pageSize: PAGE_SIZE })
    summary ??= toSummary(body.meta)
    referenceDate ??= body.referenceDate
      ? formatApiDate(body.referenceDate)
      : undefined
    total = body.total

    rows.push(...body.items.map(toRow))

    // Stops on the total, or on an empty page -- never on a row count of its
    // own, which is what let the fetch stop short of everything before.
    if (rows.length >= total || body.items.length === 0) break
    page += 1
  }

  // Truncation is measured on what was FETCHED against what the backend said
  // it had, before anything is dropped -- the dropped rows arrived, they are
  // just not shown, and counting them as missing would raise the partial-queue
  // banner on a complete queue.
  const truncated = rows.length < total
  const kept = rows.filter((row) => !DROPPED_TYPES.has(row.type))
  const dropped = rows.filter((row) => DROPPED_TYPES.has(row.type))

  return {
    rows: kept,
    summary: withoutDroppedTypes(
      summary ?? {
        total: 0,
        actionable: 0,
        preAutomation: 0,
        byType: {},
        bySeverity: {},
        linesChecked: 0,
        linesCovered: 0,
        typesRaised: [],
        attestationWindowDays: 0,
      },
      dropped,
    ),
    referenceDate,
    truncated,
  }
}

/**
 * Hang each line's exception items off the register rows.
 *
 * The register and the exception queue are two different endpoints: the
 * register knows nothing about the checks, and the checks are recomputed from
 * it on every read. The join is by `repairId`, which the queue serves exactly
 * so this is possible.
 *
 * `rows === null` means the exception fetch failed, and every chain comes back
 * with `exceptions` left undefined — the register then shows "Not checked"
 * rather than an empty cell. An empty array means the checks ran and found
 * nothing against that line, which is a different and much stronger claim.
 */
export function attachLineExceptions(
  chains: RepairChain[],
  rows: ExceptionQueueRow[] | null,
): RepairChain[] {
  if (rows === null) return chains

  const byLine = new Map<string, RepairLineException[]>()
  for (const row of rows) {
    // An item the queue could not tie back to a register line (no repairId)
    // is still a real finding; it just has no row here to sit on.
    if (!row.repairId) continue
    const found = byLine.get(row.repairId)
    const item = { id: row.id, type: row.type, severity: row.severity }
    if (found) found.push(item)
    else byLine.set(row.repairId, [item])
  }

  return chains.map((chain) => ({
    ...chain,
    exceptions: byLine.get(chain.id) ?? [],
  }))
}
