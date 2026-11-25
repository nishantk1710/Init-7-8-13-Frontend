import { apiFetch, apiFetchBlob, apiFetchList } from "@/lib/api/client"

/**
 * More -> Materials: every active material and plant with its stock on hand
 * (`GET /materials`). The backend owns the rule -- MARC rows at the in-scope
 * plants, without MARC-LVORM or MARA-LVORM, stock = MARD-LABST summed over
 * storage locations -- see the backend's `app/shared/materials_list.py`.
 */

export type MaterialClassification = "OAR" | "NON_OAR"

export const MATERIAL_CLASSIFICATIONS: readonly MaterialClassification[] = ["OAR", "NON_OAR"]

export const CLASSIFICATION_LABEL: Record<MaterialClassification, string> = {
  OAR: "OAR",
  NON_OAR: "Non-OAR",
}

export interface MaterialStock {
  material: string
  materialDescription: string | null
  plant: string
  classification: MaterialClassification
  /** As the backend sent it: a decimal string, never rounded through a float on the way. */
  stockOnHand: string
  unit: string | null
}

export interface MaterialCounts {
  total: number
  oar: number
  nonOar: number
  /** When the backend read MARC/MARD/MARA for the list it is serving (ISO). */
  loadedAt: string | null
}

export interface MaterialFilterParams {
  search?: string
  plant?: string
  classification?: MaterialClassification
}

type RawRecord = Record<string, unknown>

export function materialsQuery(
  params: MaterialFilterParams & { limit?: number; offset?: number }
): string {
  const search = new URLSearchParams()
  if (params.search) search.set("search", params.search)
  if (params.plant) search.set("plant", params.plant)
  if (params.classification) search.set("classification", params.classification)
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  const query = search.toString()
  return query ? `?${query}` : ""
}

export function toMaterialStock(raw: RawRecord): MaterialStock {
  return {
    material: String(raw.material ?? ""),
    materialDescription: typeof raw.material_description === "string" ? raw.material_description : null,
    plant: String(raw.plant ?? ""),
    classification: raw.classification === "OAR" ? "OAR" : "NON_OAR",
    stockOnHand: raw.stock_on_hand === null || raw.stock_on_hand === undefined ? "0" : String(raw.stock_on_hand),
    unit: typeof raw.unit === "string" && raw.unit ? raw.unit : null,
  }
}

function toCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** One page of materials and the filtered total (`X-Total-Count`). */
export async function getMaterials(
  params: MaterialFilterParams & { limit: number; offset: number }
): Promise<{ items: MaterialStock[]; total: number | null }> {
  const { items, total } = await apiFetchList<RawRecord>(`/materials${materialsQuery(params)}`)
  return { items: items.map(toMaterialStock), total }
}

/** The totals behind All / OAR / Non-OAR, under the search and plant filters. */
export async function getMaterialCounts(params: Omit<MaterialFilterParams, "classification">): Promise<MaterialCounts> {
  const raw = await apiFetch<RawRecord>(
    `/materials/counts${materialsQuery({ search: params.search, plant: params.plant })}`
  )
  return {
    total: toCount(raw.total),
    oar: toCount(raw.oar),
    nonOar: toCount(raw.non_oar),
    loadedAt: typeof raw.loaded_at === "string" ? raw.loaded_at : null,
  }
}

/** The whole filtered list as an Excel workbook -- every page, not just the one on screen. */
export function fetchMaterialsWorkbook(params: MaterialFilterParams): Promise<{ blob: Blob; filename: string }> {
  return apiFetchBlob(`/materials/export.xlsx${materialsQuery(params)}`, "materials-stock.xlsx")
}
