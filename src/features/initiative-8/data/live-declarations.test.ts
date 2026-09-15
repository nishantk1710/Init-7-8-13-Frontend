import { describe, expect, it } from "vitest"

import { toDeclarationItem } from "@/features/initiative-8/data/live-declarations"
import type { ApiDeclarationItem } from "@/lib/api/i8"

/**
 * W5.4 — the declaration-queue adapter.
 *
 * The domain type requires `pr`, `requester` and `source`; the API can send
 * null for all three, for measured reasons. These tests pin that each one
 * becomes an explicit unknown rather than a plausible-looking value — a
 * fabricated PR number or an invented provenance on a real purchase is exactly
 * the class of mistake Initiative 8 exists to stop.
 */

function apiRow(overrides: Partial<ApiDeclarationItem> = {}): ApiDeclarationItem {
  return {
    id: "D-4500001052-1310",
    pr: { type: "PR", documentNumber: "2000028376", line: "10" },
    material: {
      materialId: "8000004665",
      materialCode: "8000004665",
      description: "CYLINDER HYDRAULIC PN:3128008216",
    },
    plant: { plantId: "1300", name: "Black Mountain" },
    requester: "10316",
    source: null,
    hasActiveRepair: true,
    relatedRepairId: "4500001052-1310",
    status: "Required",
    declaredBy: null,
    declaredAt: null,
    condition: null,
    nextAction:
      "Declare the condition of this part. It is out for repair now and no assessment is on record.",
    createdAt: "2025-04-07",
    ...overrides,
  }
}

describe("toDeclarationItem", () => {
  it("carries the plant, which the attestation form needs", () => {
    // An attestation is recorded per material-PLANT. Without this the form
    // could only guess a site, and a guessed site on an audit record is worse
    // than no record.
    expect(toDeclarationItem(apiRow()).plant).toEqual({
      plantId: "1300",
      name: "Black Mountain",
    })
  })

  it("never renders source as Manual when the API does not know", () => {
    // The SAP table that would decide covers 521 of 1,201 repair requisitions,
    // and every one of those reads "created from an order" — neither Manual nor
    // MRP-generated. Guessing either would invent a provenance for a purchase.
    const row = toDeclarationItem(apiRow({ source: null }))
    expect(row.source).not.toBe("Manual")
    expect(row.source).not.toBe("MRP-generated")
    expect(row.source).toBe("—")
  })

  it("passes a real source through when there is one", () => {
    expect(toDeclarationItem(apiRow({ source: "MRP-generated" })).source).toBe(
      "MRP-generated",
    )
  })

  it("shows the requester code rather than inventing a name", () => {
    // 27 distinct codes across the register. No person directory was delivered.
    expect(toDeclarationItem(apiRow()).requester).toBe("10316")
    expect(toDeclarationItem(apiRow({ requester: null })).requester).toBe("—")
  })

  it("does not fabricate a PR document number", () => {
    const row = toDeclarationItem(apiRow({ pr: null }))
    expect(row.pr.documentNumber).toBe("—")
  })

  it("formats dates rather than passing ISO strings to the table", () => {
    const row = toDeclarationItem(apiRow())
    expect(row.createdAt).not.toContain("-")
    expect(row.createdAt).toContain("2025")
  })

  it("formats a declaredAt timestamp, not just a date", () => {
    // The API sends attestedAt as a full ISO timestamp here, unlike createdAt.
    const row = toDeclarationItem(
      apiRow({
        status: "Completed",
        declaredBy: "DEMO_SEED",
        declaredAt: "2025-04-07T09:00:00Z",
        condition: "Repairable",
      }),
    )
    expect(row.declaredAt).toContain("2025")
    expect(row.declaredAt).not.toContain("T")
  })

  it("carries the three real statuses and the condition wording", () => {
    for (const status of ["Required", "Completed", "Flagged"] as const) {
      expect(toDeclarationItem(apiRow({ status })).status).toBe(status)
    }
    expect(
      toDeclarationItem(apiRow({ condition: "Beyond Economical Repair" })).condition,
    ).toBe("Beyond Economical Repair")
  })

  it("falls back rather than crashing on an unrecognised status", () => {
    // Guards the day one side adds a value: an unknown status must not go
    // through a Record<Union, Tone> lookup and take the table down.
    const row = toDeclarationItem({
      ...apiRow(),
      status: "Teleported",
    } as unknown as ApiDeclarationItem)
    expect(row.status).toBe("Required")
  })

  it("keeps nextAction verbatim — it is the instruction a person acts on", () => {
    expect(toDeclarationItem(apiRow()).nextAction).toContain("no assessment is on record")
  })
})
