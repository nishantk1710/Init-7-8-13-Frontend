// The monthly criticality reports -- the only place the Criticality Reports
// page talks to the backend.
//
// Mounted at API_BASE_URL + "/criticality" (app/api/criticality/router.py),
// outside /v1/i7 on purpose: the same current criticality feeds I07, I08 and
// I13, so the upload is not one initiative's route. Errors come back as plain
// `detail` sentences, which `ApiError.detailText()` shows as written.

import { apiFetch, apiPostForm, ApiError } from "@/lib/api/client"
import type {
  ApiCriticalityPlant,
  ApiCriticalityUpload,
  ApiCriticalityUploadResult,
  CriticalityPlant,
  CriticalityUpload,
  CriticalityUploadResult,
} from "@/features/initiative-7/types/criticality-reports"

const BASE = "/criticality"

export function mapPlant(plant: ApiCriticalityPlant): CriticalityPlant {
  return {
    code: plant.code,
    name: plant.name,
    currentMonth: plant.current_month,
    materials: plant.materials,
  }
}

export function mapUpload(upload: ApiCriticalityUpload): CriticalityUpload {
  return {
    id: upload.id,
    plant: upload.plant,
    reportMonth: upload.report_month,
    fileName: upload.file_name,
    source: upload.source,
    uploadedBy: upload.uploaded_by,
    uploadedAt: upload.uploaded_at,
    rowCount: upload.row_count,
    status: upload.status,
  }
}

export function mapUploadResult(result: ApiCriticalityUploadResult): CriticalityUploadResult {
  return {
    upload: mapUpload(result.upload),
    rowsRead: result.stats.rows_read,
    tiers: result.stats.tiers,
    duplicates: result.stats.duplicates,
    blankTiers: result.stats.blank_tiers,
    skippedBlankMaterial: result.stats.skipped_blank_material,
    filePlant: result.stats.file_plant,
    isCurrent: result.is_current,
    currentMonth: result.current_month,
    replacedUploadId: result.replaced_upload_id,
    fileStored: result.file_stored,
  }
}

export async function fetchCriticalityPlants(): Promise<CriticalityPlant[]> {
  return (await apiFetch<ApiCriticalityPlant[]>(`${BASE}/plants`)).map(mapPlant)
}

/** Every upload, newest month first. `plant` narrows to one plant. */
export async function fetchCriticalityUploads(plant?: string): Promise<CriticalityUpload[]> {
  const query = plant ? `?plant=${encodeURIComponent(plant)}` : ""
  return (await apiFetch<ApiCriticalityUpload[]>(`${BASE}/uploads${query}`)).map(mapUpload)
}

export type UploadCriticalityInput = {
  plant: string
  /** `YYYY-MM`. */
  reportMonth: string
  file: File
  /** Replace an earlier upload for the same plant and month. */
  replace?: boolean
}

/** The outcome of an upload, in the three shapes the card handles. */
export type UploadCriticalityOutcome =
  | { kind: "stored"; result: CriticalityUploadResult }
  /** 409: this plant already has a report for that month. Not an error --
   * the card offers to replace it. */
  | { kind: "conflict"; message: string }
  | { kind: "refused"; message: string }

/**
 * POST one report. Never retried: every upload is an append-only row, and a
 * retry after a timeout that actually landed would file the report twice.
 */
export async function uploadCriticalityReport(input: UploadCriticalityInput): Promise<UploadCriticalityOutcome> {
  const form = new FormData()
  form.set("plant", input.plant)
  form.set("report_month", input.reportMonth)
  form.set("replace", input.replace ? "true" : "false")
  form.set("file", input.file, input.file.name)
  try {
    const result = await apiPostForm<ApiCriticalityUploadResult>(`${BASE}/uploads`, form)
    return { kind: "stored", result: mapUploadResult(result) }
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 409
        ? { kind: "conflict", message: error.detailText() }
        : { kind: "refused", message: error.detailText() }
    }
    return {
      kind: "refused",
      message: error instanceof Error ? error.message : "The report could not be uploaded.",
    }
  }
}
