/**
 * A request's materials from an Excel file (UAT, 22 Oct). The backend reads
 * and checks the file itself (`POST /assistant/requests/upload`: the template's
 * format, one plant, one department, the cap). What it cannot know is the
 * request on screen, so the three rules that depend on it are checked here:
 * the file must be for the request's plant and department, materials already
 * on the request are skipped, and the rows on screen count against the cap.
 */

import type { ApiUploadResult } from "@/lib/api/assistant-requests"

export type UploadContext = {
  maxLines: number
  /** The request's plant once it has rows; the file must agree. */
  requestPlant: string | null
  /** The department already picked on the request, if any; the file must agree. */
  requestDepartment: string | null
  /** Materials already on the request: skipped, never added twice. */
  existing: readonly { materialId: string; plant: string }[]
}

export type UploadPlan = {
  ok: true
  plant: string
  department: string
  departmentName: string | null
  /** In file order: duplicates and materials already on the request removed. */
  materials: string[]
  rowCount: number
  duplicates: string[]
  alreadyAdded: string[]
}

export type UploadCheck = UploadPlan | { ok: false; errors: string[] }

/** Leading zeros are not part of a material's identity: Excel drops them. */
export function bareMaterial(materialId: string): string {
  return materialId.trim().toUpperCase().replace(/^0+(?=.)/, "")
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

/** The backend's reading of the file, held to the request on screen. */
export function checkAgainstRequest(file: ApiUploadResult, context: UploadContext): UploadCheck {
  const errors: string[] = []
  if (context.requestPlant && file.plant !== context.requestPlant) {
    errors.push(
      `This request is for plant ${context.requestPlant}; the file is for ${file.plant}. Start another request for ${file.plant}.`
    )
  }
  if (context.requestDepartment && file.department !== context.requestDepartment) {
    errors.push(
      `This request's department is ${context.requestDepartment}; the file says ${file.department}. Change the department on screen or fix the file.`
    )
  }

  const onRequest = new Set(
    context.existing.filter((e) => e.plant === file.plant).map((e) => bareMaterial(e.materialId))
  )
  const materials = file.materials.filter((m) => !onRequest.has(bareMaterial(m)))
  const alreadyAdded = file.materials.filter((m) => onRequest.has(bareMaterial(m)))

  const maxLines = Math.min(context.maxLines, file.maxLines)
  if (context.existing.length > 0 && context.existing.length + materials.length > maxLines) {
    errors.push(
      `The request has ${plural(context.existing.length, "material")} and the file adds ${materials.length}: a request holds up to ${maxLines}. Submit this one and upload the rest as another request.`
    )
  }
  if (errors.length === 0 && materials.length === 0) {
    errors.push("Every material in the file is already on this request.")
  }
  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    plant: file.plant,
    department: file.department,
    departmentName: file.departmentName,
    materials,
    rowCount: file.rowCount,
    duplicates: file.duplicates,
    alreadyAdded,
  }
}
