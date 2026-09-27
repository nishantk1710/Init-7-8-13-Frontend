/**
 * The live coding-candidate screen — `GET /api/i8/coding-candidates` as the
 * `CodingCandidate` the UI renders.
 *
 * Same shape as `live-register.ts`, with one difference worth noting: this
 * endpoint is not paginated. `CodingCandidatesQuery.limit` caps how many
 * MATERIALS get the (slow, opt-in) model pass, not how many rows come back —
 * every screened material is always in `items`, so this is a single fetch,
 * not the `for (;;)` page loop the register/declarations loaders use.
 */

import type {
  CodingCandidate,
  CodingCandidateLine,
  CodingCandidateTwin,
} from "@/features/initiative-8/types/repair"
import type {
  ApiCodingCandidateItem,
  ApiCodingCandidateLine,
  ApiCodingCandidateMeta,
  ApiCodingCandidateTwin,
  CodingCandidatesQuery,
} from "@/lib/api/i8"
import { formatApiDate, getCodingCandidates } from "@/lib/api/i8"

/** `null` -> `undefined`, matching every other live-* adapter in this module. */
function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

function toLine(row: ApiCodingCandidateLine): CodingCandidateLine {
  return {
    purchasingDocument: row.purchasingDocument,
    item: row.item,
    plant: row.plant ? { plantId: row.plant.plantId, name: row.plant.name } : undefined,
    shortText: row.shortText,
    matchedKeywords: row.matchedKeywords,
    raisedAt: row.raisedAt ? formatApiDate(row.raisedAt) : undefined,
    itemCategory: orUndefined(row.itemCategory),
  }
}

function toTwin(row: ApiCodingCandidateTwin): CodingCandidateTwin {
  return { materialId: row.materialId, sharedText: row.sharedText }
}

/** One API row as the `CodingCandidate` the table renders. */
export function toCodingCandidate(row: ApiCodingCandidateItem): CodingCandidate {
  return {
    material: {
      materialId: row.materialId,
      materialCode: row.materialId,
      // No material-master description exists for these — that is close to
      // the point of the screen. The first PO short text is the only
      // descriptive text that actually exists for the material.
      description: row.distinctTexts[0] ?? row.materialId,
    },
    verdict: row.verdict,
    confidence: row.confidence,
    reason: row.reason,
    plants: row.plants,
    lines: row.lines.map(toLine),
    distinctTexts: row.distinctTexts,
    twins: row.twins.map(toTwin),
    isCorroborated: row.isCorroborated,
    isActionable: row.isActionable,
    meetsConfidenceThreshold: row.meetsConfidenceThreshold,
    inRepairableUniverse: row.inRepairableUniverse,
    model: row.model,
    provider: row.provider,
    screenedAt: orUndefined(row.screenedAt),
  }
}

export type LiveCodingCandidates = {
  candidates: CodingCandidate[]
  meta: ApiCodingCandidateMeta
}

/**
 * Fetch the coding-candidate screen and adapt it.
 *
 * Defaults to the fast keyword-only pass (`screen` omitted) — every verdict
 * comes back UNSCREENED, in under a second, with no model credentials
 * needed. Pass `{ screen: true }` for the slow language-judgement pass (the
 * "Run AI screen" action), which the caller should treat as a multi-minute
 * operation, not a page load.
 *
 * Throws on failure — the caller renders that visibly, same contract as
 * `loadLiveRegister`.
 */
export async function loadLiveCodingCandidates(
  query: CodingCandidatesQuery = {},
): Promise<LiveCodingCandidates> {
  const body = await getCodingCandidates(query)
  return { candidates: body.items.map(toCodingCandidate), meta: body.meta }
}
