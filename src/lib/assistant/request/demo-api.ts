/**
 * The multi-material request routes, answered in the browser. **Demo only** --
 * loaded by `lib/api/assistant-requests.ts` when `NEXT_PUBLIC_ASSISTANT_DEMO`
 * is on, never in a live build.
 *
 * Same signatures and the same response shapes as the live routes, built from
 * the mock catalogue (`catalogue.ts`), so the screens cannot tell which they
 * are talking to. Requests are kept in this browser (`store.ts`).
 */

import { ApiError } from "@/lib/api/client"
import type { ApiDepartment, ApiMaterialMatch } from "@/lib/api/assistant"
import type {
  ApiPreviewLine,
  ApiRequest,
  ApiRequestLine,
  ApiRequestSummary,
  CreateRequestBody,
  PreviewResponse,
} from "@/lib/api/assistant-requests"
import { mintDemoSessionId } from "@/lib/assistant/demo/ids"
import {
  DEMO_DEPARTMENTS,
  DEMO_PLANTS,
  findDemoMaterial,
  searchRequestCatalogue,
} from "@/lib/assistant/request/catalogue"
import { DEFAULT_MAX_LINES, FALLBACK_REASONS } from "@/lib/assistant/request/lines"
import { lineReference, mintRequestId } from "@/lib/assistant/request/record"
import { allRequests, findByKey, getRequest as storedRequest, saveRequest } from "@/lib/assistant/request/store"
import { needsJustification, suggestQuantity, suggestWindow } from "@/lib/assistant/request/suggest"

function pause(min = 250, max = 550): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)))
}

function previewOf(materialId: string, plant: string): ApiPreviewLine {
  const material = findDemoMaterial(materialId, plant)
  const base = { materialId: materialId.trim(), plant, facts: null, unitExists: null, suggestion: null, alsoMatched: null }
  if (!material) {
    return {
      ...base,
      materialDescription: null,
      kind: "out_of_scope",
      reason: `Material ${materialId.trim()} was not found at plant ${plant}.`,
    }
  }
  const routing = material.routing
  const named = { ...base, materialId: material.materialId, materialDescription: material.description }
  switch (routing.kind) {
    case "out_of_scope":
    case "data_gap":
      return { ...named, kind: routing.kind, reason: routing.reason }
    case "i08": {
      const f = routing.facts
      const unitExists = f.stockOnHand > 0 || f.openRepairs.length > 0
      return {
        ...named,
        kind: "i08",
        reason: "80-series: a repairable part.",
        unitExists,
        alsoMatched: routing.alsoMatchedOar ? "i13" : null,
        facts: {
          repairableUnitExists: unitExists,
          stockOnHand: String(f.stockOnHand),
          openRepairs: f.openRepairs.map((r) => ({ ...r, quantity: String(r.quantity) })),
          newUnitLeadTimeDays: f.newUnitLeadTimeDays,
        },
      }
    }
    case "i13": {
      const f = routing.facts
      const s = suggestQuantity(f)
      const window = suggestWindow(s.quantity, f.averageMonthlyConsumption)
      return {
        ...named,
        kind: "i13",
        reason: "OAR by MRP type: planned on demand.",
        facts: {
          stockOnHand: String(f.stockOnHand),
          openPoQuantity: String(f.openPoQuantity),
          averageMonthlyConsumption: String(f.averageMonthlyConsumption),
          consumptionCount12m: f.consumptionCount12m,
          crossPlantStock: f.crossPlantStock.map((c) => ({ plant: c.plant, stockOnHand: String(c.stockOnHand) })),
        },
        suggestion: {
          quantity: s.quantity === null ? null : String(s.quantity),
          reason: s.explanation,
          windowStart: window?.start ?? null,
          windowEnd: window?.end ?? null,
          windowMonths: window?.months ?? null,
        },
      }
    }
  }
}

export async function previewRequest(materials: { materialId: string; plant: string }[]): Promise<PreviewResponse> {
  await pause()
  return {
    lines: materials.map((m) => previewOf(m.materialId, m.plant)),
    maxLines: DEFAULT_MAX_LINES,
    reasonCategories: [...FALLBACK_REASONS],
  }
}

function refuse(message: string, line: number | null): never {
  throw new ApiError("POST /assistant/requests failed with 422", 422, undefined, message, { message, line })
}

export async function createRequest(body: CreateRequestBody): Promise<ApiRequest> {
  await pause(500, 900)
  const existing = findByKey(body.idempotencyKey)
  if (existing) return { ...existing, replayed: true }
  if (body.lines.length > DEFAULT_MAX_LINES) refuse(`A request holds up to ${DEFAULT_MAX_LINES} materials.`, null)

  const requestId = mintRequestId()
  const lines: ApiRequestLine[] = []
  const skipped: ApiRequest["skipped"] = []
  body.lines.forEach((answers, index) => {
    const preview = previewOf(answers.materialId, answers.plant)
    if (preview.kind !== "i13" && preview.kind !== "i08") {
      skipped.push({ materialId: preview.materialId, plant: preview.plant, kind: preview.kind, reason: preview.reason })
      return
    }
    const lineNo = lines.length + 1
    const reason =
      answers.reasonCategory && answers.freeText
        ? { reasonCategory: answers.reasonCategory, freeText: answers.freeText }
        : null
    const common = {
      lineNo,
      reference: lineReference(requestId, lineNo),
      sessionId: mintDemoSessionId(),
      outcome: "COMPLETED",
      materialId: preview.materialId,
      materialDescription: preview.materialDescription,
      plant: preview.plant,
      linkedReservations: [],
    }
    if (preview.kind === "i08") {
      const decision = preview.unitExists ? answers.decision ?? null : "proceed_new"
      if (!decision) refuse(`${preview.materialId}: choose whether to use the existing unit.`, index + 1)
      const asked = decision === "proceed_new" && preview.unitExists
      if (asked && !reason) refuse(`A reason is needed: why a new ${preview.materialId}?`, index + 1)
      lines.push({
        ...common,
        flow: "i08",
        department: answers.department ?? null,
        decision,
        plannedQuantity: null,
        suggestedQuantity: null,
        acceptedQuantity: null,
        windowStart: null,
        windowEnd: null,
        purpose: null,
        justification: asked && reason ? { kind: "NEW_ACQUISITION", ...reason } : null,
      })
      return
    }
    const suggested = preview.suggestion?.quantity ?? null
    if (answers.decision === "not_needed") {
      lines.push({
        ...common,
        flow: "i13",
        department: null,
        decision: "not_needed",
        plannedQuantity: null,
        suggestedQuantity: null,
        acceptedQuantity: null,
        windowStart: null,
        windowEnd: null,
        purpose: null,
        justification: null,
      })
      return
    }
    const quantity = Number(answers.quantity)
    const asked = needsJustification(suggested === null ? null : Number(suggested), quantity)
    if (asked && !reason) refuse(`A reason is needed: why ${quantity} of ${preview.materialId}?`, index + 1)
    lines.push({
      ...common,
      flow: "i13",
      department: answers.department ?? null,
      decision: "proceed",
      plannedQuantity: String(quantity),
      suggestedQuantity: suggested,
      acceptedQuantity: String(quantity),
      windowStart: answers.windowStart ?? null,
      windowEnd: answers.windowEnd ?? null,
      purpose: answers.purpose ?? null,
      justification: asked && reason ? { kind: "QUANTITY_OVERRIDE", ...reason } : null,
    })
  })
  if (lines.length === 0) refuse("None of these materials needs the assistant, so there is nothing to record.", null)

  const request: ApiRequest & { idempotencyKey: string } = {
    requestId,
    plant: body.plant,
    requestedFor: body.requestedFor ?? null,
    requester: body.requestedFor ?? "demo",
    origin: body.origin ?? "PLATFORM",
    issuedAt: new Date().toISOString(),
    departments: [...new Set(lines.map((l) => l.department).filter((d): d is string => !!d))],
    lines,
    skipped,
    replayed: false,
    idempotencyKey: body.idempotencyKey,
  }
  saveRequest(request)
  return request
}

export async function getRequest(requestId: string): Promise<ApiRequest> {
  await pause(100, 250)
  const found = storedRequest(requestId)
  if (!found) {
    throw new ApiError(`GET request ${requestId} failed with 404`, 404, undefined, `No request ${requestId} in this browser.`)
  }
  return found
}

export async function listRequests(): Promise<ApiRequestSummary[]> {
  await pause(100, 250)
  return allRequests().map((r) => ({
    requestId: r.requestId,
    plant: r.plant,
    requestedFor: r.requestedFor,
    issuedAt: r.issuedAt,
    lineCount: r.lines.length,
    skippedCount: r.skipped.length,
    departments: r.departments,
  }))
}

export async function searchRequestMaterials(q: string): Promise<ApiMaterialMatch[]> {
  await pause(100, 200)
  return searchRequestCatalogue(q).map((m) => ({
    materialId: m.materialId,
    description: m.description,
    plant: m.plant,
    plantName: m.plantName,
    flowHint: m.routing.kind === "i13" ? "i13" : m.routing.kind === "i08" ? "i08" : "none",
    mrpType: null,
  }))
}

export async function requestDepartments(plant: string): Promise<{ items: ApiDepartment[]; loaded: boolean }> {
  const items: ApiDepartment[] = []
  const seen = new Set<string>()
  const plants: string[] = DEMO_PLANTS.map((d) => d.plant)
  for (const p of [plant, ...plants.filter((d) => d !== plant)]) {
    for (const code of DEMO_DEPARTMENTS[p] ?? []) {
      if (seen.has(code)) continue
      seen.add(code)
      const holding = plants.filter((d) => (DEMO_DEPARTMENTS[d] ?? []).includes(code))
      items.push({ code, plants: holding, primary: holding.includes(plant) })
    }
  }
  return { items, loaded: true }
}
