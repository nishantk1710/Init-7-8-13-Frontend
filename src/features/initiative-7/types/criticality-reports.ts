// Monthly criticality reports (ZMM065) -- wire shapes from /api/criticality
// and the camelCase shapes the page renders.
//
// The route is shared, not I07's: the same current criticality feeds I07, I08
// and I13. The page lives under Inventory Planning because that is where the
// business looks after criticality.

/** `current` -- the plant's report every initiative reads; `previous` -- an
 * older month (its tiers still fill materials newer reports leave out);
 * `replaced` -- superseded by a newer upload for the same month. */
export type CriticalityUploadStatus = "current" | "previous" | "replaced"

/** `july_delivery` is the July 2026 workbook delivery, imported as each
 * plant's first report; nobody uploaded it. */
export type CriticalityUploadSource = "upload" | "july_delivery"

export type ApiCriticalityPlant = {
  code: string
  name: string
  current_month: string | null
  materials: number
}

export type ApiCriticalityUpload = {
  id: number
  plant: string
  plant_name: string
  report_month: string
  file_name: string
  source: CriticalityUploadSource
  uploaded_by: string | null
  uploaded_at: string
  row_count: number
  status: CriticalityUploadStatus
}

export type ApiCriticalityUploadResult = {
  upload: ApiCriticalityUpload
  stats: {
    rows_read: number
    tiers: number
    duplicates: number
    blank_tiers: number
    skipped_blank_material: number
    file_plant: string
  }
  is_current: boolean
  current_month: string
  replaced_upload_id: number | null
  file_stored: boolean
}

export type CriticalityPlant = {
  code: string
  name: string
  /** `YYYY-MM-01`, or null before any report is loaded for the plant. */
  currentMonth: string | null
  materials: number
}

export type CriticalityUpload = {
  id: number
  plant: string
  /** `YYYY-MM-01`. */
  reportMonth: string
  fileName: string
  source: CriticalityUploadSource
  uploadedBy: string | null
  uploadedAt: string
  rowCount: number
  status: CriticalityUploadStatus
}

export type CriticalityUploadResult = {
  upload: CriticalityUpload
  rowsRead: number
  tiers: number
  duplicates: number
  blankTiers: number
  skippedBlankMaterial: number
  filePlant: string
  isCurrent: boolean
  currentMonth: string
  replacedUploadId: number | null
  fileStored: boolean
}
