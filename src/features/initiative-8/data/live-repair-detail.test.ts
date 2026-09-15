import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import type { ApiLifecycleStage, ApiRepairDetail } from "@/lib/api/i8"

/**
 * W5.4 — the repair detail adapter.
 *
 * The thing worth testing here is the timeline. The backend explains every
 * stage it cannot prove, and those explanations are the product: a blank stage
 * looks like a bug, a stage that says why it is blank is the answer.
 */

const REGISTER_LINE = {
  id: "4500001052-1310",
  material: { materialId: "8000004665", materialCode: "8000004665", description: "PUMP" },
  plant: { plantId: "1300", name: "Black Mountain" },
  stockOnHand: "0",
  reorderPoint: null,
  qtyUnderRepair: "1",
  repairPr: { type: "PR", documentNumber: "2000028376", line: "10" },
  repairPo: { type: "PO", documentNumber: "4500001052", line: "1310" },
  vendor: null,
  vendorName: null,
  repairStatus: "PO Issued",
  receiptStatus: "Not Yet Shipped",
  overdueStatus: "OVERDUE",
  declarationStatus: "Required",
  daysOpen: 526,
  agingBucket: "60+",
  daysAtVendor: null,
  daysInCurrentStage: 526,
  daysRemainingInRepair: -509,
  raisedAt: "2025-04-07",
  poIssuedAt: null,
  sentToVendorAt: null,
  expectedReturn: "2025-04-24",
  receivedAt: null,
  orderedQty: "1",
  receivedQty: "0",
  unit: "EA",
  repairCost: "8914.34",
  newUnitLeadTimeDays: null,
  itemCategory: "3",
  docType: null,
  corroboratedByDocType: false,
  hasPoHeader: false,
  deliveryCompleted: false,
  reversals: 0,
  scheduleLines: 1,
} as ApiRepairDetail["line"]

const STAGES: ApiLifecycleStage[] = [
  {
    stage: "removed",
    label: "Removed from machine",
    occurredAt: null,
    evidence:
      "MSEG 261/201 carries no PO reference at all, so removal cannot be tied to this line.",
    daysSince: null,
  },
  {
    stage: "attested",
    label: "Condition attested",
    occurredAt: null,
    evidence:
      "No condition-to-repair attestation covers this line. The part was sent for repair with no recorded assessment.",
    daysSince: null,
  },
  {
    stage: "po_raised",
    label: "Repair PO raised",
    occurredAt: "2025-04-07",
    evidence: "EKPO line 4500001052/1310, item category 3",
    daysSince: 526,
  },
]

function mockDetail(stages: ApiLifecycleStage[] = STAGES) {
  return { line: REGISTER_LINE, timeline: stages } satisfies ApiRepairDetail
}

describe("loadLiveRepairDetail", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function load(id: string, detail = mockDetail()) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => detail,
      })),
    )
    const module = await import("@/features/initiative-8/data/live-repair-detail")
    const result = await module.loadLiveRepairDetail(id)
    // Every caller of this helper expects a hit; the 404 contract has its own
    // test below.
    if (result === null) throw new Error(`unexpected 404 for ${id}`)
    return result
  }

  it("splits the register id on the LAST hyphen", async () => {
    // Purchasing documents carry none today. Splitting on the first would send
    // the wrong item number the day one does, and the failure would be a 404 on
    // a line that exists — the hardest kind to diagnose.
    const seen: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        seen.push(String(input))
        return { ok: true, status: 200, json: async () => mockDetail() }
      }),
    )
    const module = await import("@/features/initiative-8/data/live-repair-detail")
    await module.loadLiveRepairDetail("4500-001052-1310")

    expect(seen[0]).toContain("/i8/register/4500-001052/1310")
  })

  it("returns null for a repair line the backend does not have", async () => {
    // A 404 is an answer, not a failure. The page renders "no such repair",
    // which is what the reader needs -- not "the server could not be reached".
    //
    // Detected by reading .status off the error rather than `instanceof
    // ApiError`: Next bundles the route and this module separately, so the two
    // ApiError classes can differ and instanceof silently returns false. It
    // did, and a missing line rendered as a server failure until this changed.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    )
    const module = await import("@/features/initiative-8/data/live-repair-detail")
    await expect(module.loadLiveRepairDetail("4500001052-1310")).resolves.toBeNull()
  })

  it("still throws when the backend is unreachable", async () => {
    // The other half of the contract. This one must NOT read as "not found".
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed")
      }),
    )
    const module = await import("@/features/initiative-8/data/live-repair-detail")
    await expect(module.loadLiveRepairDetail("4500001052-1310")).rejects.toThrow(
      "fetch failed",
    )
  })

  it("rejects an id that is not a repair line", async () => {
    const module = await import("@/features/initiative-8/data/live-repair-detail")
    await expect(module.loadLiveRepairDetail("nonsense")).rejects.toThrow(
      "is not a repair line id",
    )
  })

  it("carries each stage's evidence through as its description", async () => {
    // The whole reason to prefer the backend's timeline over the locally built
    // one. A stage rendered blank looks like a forgotten field; a stage that
    // explains itself is the deliverable.
    const { timeline } = await load("4500001052-1310")
    const removed = timeline.find((e: { id: string }) => e.id === "removed")
    expect(removed?.description).toContain("carries no PO reference")
  })

  it("marks a stage that never happened as 'Not recorded', not as a date", async () => {
    const { timeline } = await load("4500001052-1310")
    const attested = timeline.find((e: { id: string }) => e.id === "attested")
    expect(attested?.timestamp).toBe("Not recorded")
    expect(attested?.tone).toBe("warning")
  })

  it("formats a stage that did happen as a display date", async () => {
    const { timeline } = await load("4500001052-1310")
    const raised = timeline.find((e: { id: string }) => e.id === "po_raised")
    expect(raised?.timestamp).not.toContain("-")
    expect(raised?.timestamp).toContain("2025")
  })

  it("shows a recorded attestation as a completed stage", async () => {
    const { timeline } = await load(
      "4500001052-1310",
      mockDetail([
        {
          stage: "attested",
          label: "Condition attested",
          occurredAt: "2025-04-07",
          evidence: "Attestation ATT-ABC123: Repairable (bearing failure), by DEMO_SEED",
          daysSince: 526,
        },
      ]),
    )
    const attested = timeline.find((e: { id: string }) => e.id === "attested")
    expect(attested?.tone).toBe("success")
    expect(attested?.description).toContain("ATT-ABC123")
  })

  it("adapts the line through the same mapper the register uses", async () => {
    // One adapter, so the detail page and the row it was opened from cannot
    // disagree about the same repair.
    const { chain } = await load("4500001052-1310")
    expect(chain.id).toBe("4500001052-1310")
    expect(chain.repairPR.documentNumber).toBe("2000028376")
    expect(chain.reorderPoint).toBeUndefined()
    expect(chain.newUnitLeadTimeDays).toBeUndefined()
  })
})
