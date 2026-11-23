import { MATERIAL_CLASSIFICATIONS, type MaterialClassification } from "@/lib/api/materials"

/**
 * The Materials page's filters. They live in the URL, like the audit trail's:
 * a filtered list is a link somebody can send, back and forward work, and the
 * page is a server component that reads them.
 */
export interface MaterialsFilters {
  search?: string
  plant?: string
  classification?: MaterialClassification
  /** 1-based. */
  page: number
}

export type RawParams = Record<string, string | string[] | undefined>

export const MATERIALS_PATH = "/materials"

/** One value, or nothing. A repeated parameter is a malformed link, not a list to guess from. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseMaterialsFilters(raw: RawParams): MaterialsFilters {
  const page = Number.parseInt(single(raw.page) ?? "", 10)
  const classification = MATERIAL_CLASSIFICATIONS.find((c) => c === single(raw.classification))
  return {
    search: single(raw.search),
    plant: single(raw.plant),
    classification,
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}

/** The page's URL for these filters; page 1 is left out. */
export function materialsHref(filters: MaterialsFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set("search", filters.search)
  if (filters.plant) params.set("plant", filters.plant)
  if (filters.classification) params.set("classification", filters.classification)
  if (filters.page > 1) params.set("page", String(filters.page))
  const query = params.toString()
  return query ? `${MATERIALS_PATH}?${query}` : MATERIALS_PATH
}
