// The Recommendations page can be opened on a given view and material from a link -- a Convert to OAR notification,
// an Action Center entry, a Pipeline row: /inventory-planning/recommendations?type=min_max_to_oar&material=M&plant=P.
// Pure functions only, so the link a page builds and the link the Recommendations page reads are tested together.

import { MIN_MAX_TO_OAR_TYPE } from "@/features/initiative-7/types/reverse-conversion"

const RECOMMENDATIONS_PATH = "/inventory-planning/recommendations"

/** The views the page can open on: the three of its toggle. Anything else in a link is ignored. */
const VIEW_TYPES: readonly string[] = ["oar", MIN_MAX_TO_OAR_TYPE, "stock_item"]

/** A SAP plant code is four digits. Anything else in a link is ignored, not sent to the backend. */
const PLANT_CODE = /^\d{4}$/

const MAX_MATERIAL_LENGTH = 100

/** What a link asks the page to open on. Every field is optional: a link without any leaves the page as it opens. */
export interface RecommendationLink {
  /** "oar", "min_max_to_oar" or "stock_item". */
  type: string | null
  material: string
  /** A four-digit plant code, or "" for none. */
  plant: string
}

/** The view, material and plant a link asks for; whatever is missing or not valid is left empty. */
export function parseRecommendationLink(params: URLSearchParams): RecommendationLink | null {
  const rawType = params.get("type")
  const type = rawType !== null && VIEW_TYPES.includes(rawType) ? rawType : null
  const material = (params.get("material") ?? "").trim().slice(0, MAX_MATERIAL_LENGTH)
  const rawPlant = (params.get("plant") ?? "").trim()
  const plant = PLANT_CODE.test(rawPlant) ? rawPlant : ""
  return type === null && material === "" && plant === "" ? null : { type, material, plant }
}

/** Where an approver reviews and decides a material's Convert to OAR request (opened from the Action Center and the
 * Pipeline): the decision page, on that material and plant. */
export function convertToOarDecisionHref(material: string, plant: string): string {
  const search = new URLSearchParams({ material, plant })
  return `/inventory-planning/convert-to-oar?${search.toString()}`
}

/** The page's link to a material's Convert to OAR request: the Stock item to OAR view, on that material and plant. */
export function convertToOarHref(material: string, plant: string): string {
  const search = new URLSearchParams({ type: MIN_MAX_TO_OAR_TYPE, material, plant })
  return `${RECOMMENDATIONS_PATH}?${search.toString()}`
}
