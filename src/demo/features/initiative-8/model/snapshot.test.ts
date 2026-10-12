import { describe, expect, it } from "vitest"

import { summarise } from "@demo/features/initiative-8/model/metrics"
import { BASE_SNAPSHOT, NO_ACTIONS, buildSnapshot } from "@demo/features/initiative-8/model/snapshot"
import type { DeclarationRecord, JustificationEntry } from "@demo/features/initiative-8/types/repair"

const line = (id: string) => BASE_SNAPSHOT.lines.find((l) => l.id === id)!
const exception = (snapshot: typeof BASE_SNAPSHOT, id: string) =>
  snapshot.exceptions.find((e) => e.id === id)

describe("repair lines (FR-3, FR-9)", () => {
  it("reads overdue only after the 7-day grace", () => {
    expect(line("RC-8006").overdueStatus).toBe("OVERDUE")
    expect(line("RC-8006").daysPastDue).toBe(14)
    expect(line("RC-8011")).toMatchObject({ overdueStatus: "ON_TIME", inGrace: true, daysPastDue: 4 })
    expect(line("RC-8014").overdueStatus).toBe("NO_DUE_DATE")
  })

  it("keeps a partly received line open for the units still out", () => {
    expect(line("RC-8007")).toMatchObject({
      repairStatus: "At Vendor",
      receiptStatus: "Partially Received",
      qtyUnderRepair: 1,
      stage: "AT_VENDOR",
    })
  })

  it("walks the FRS stages, removed through back in stock or scrapped", () => {
    expect(line("RC-8009").stages.map((s) => s.stage)).toEqual([
      "REMOVED",
      "PR_RAISED",
      "PO_ISSUED",
      "AT_VENDOR",
      "RETURNED",
      "BACK_IN_STOCK",
    ])
    expect(line("RC-8009").turnaroundDays).toBe(34)
    expect(line("RC-8004")).toMatchObject({ repairStatus: "Scrapped", qtyUnderRepair: 0, overdueStatus: "SCRAPPED" })
    expect(line("RC-8001").stages.map((s) => s.stage)).toContain("ATTESTED")
  })

  it("sets the declaration status from the explicitly linked declaration", () => {
    expect(line("RC-8003").declarationStatus).toBe("Required")
    expect(line("RC-8008").declarationStatus).toBe("Flagged")
    // Beyond Economical Repair and the line was scrapped: the two agree.
    expect(line("RC-8004")).toMatchObject({ declarationStatus: "Completed", declarationId: "DCL-1010" })
  })
})

describe("exception queue (FR-8, FR-11)", () => {
  it("raises all four types", () => {
    const types = new Set(BASE_SNAPSHOT.exceptions.map((e) => e.type))
    expect([...types].sort()).toEqual([
      "MISSING_ATTESTATION",
      "MISSING_SESSION_ID",
      "OVERDUE_REPAIR",
      "UNJUSTIFIED_ACQUISITION",
    ])
  })

  it("finds the purchase made while a unit sat at a vendor with no repair PO (FR-6 b)", () => {
    expect(exception(BASE_SNAPSHOT, "EX-UA-94930")).toMatchObject({ status: "OPEN" })
    expect(BASE_SNAPSHOT.purchases.find((p) => p.exceptionId === "EX-UA-94930")?.basis).toEqual([
      "AT_VENDOR_NO_PO",
    ])
  })

  it("keeps the stored history: owner, comments, status", () => {
    expect(exception(BASE_SNAPSHOT, "EX-OD-8006")).toMatchObject({ status: "IN_PROGRESS", owner: "Lindiwe Mahlangu" })
    expect(exception(BASE_SNAPSHOT, "EX-UA-94655")).toMatchObject({ status: "CLOSED", stillDetected: false })
  })

  it("flags every invalid session reference", () => {
    const links = Object.fromEntries(BASE_SNAPSHOT.reservations.map((r) => [r.reservation.documentNumber, r.sessionLink]))
    expect(links["0041318"]).toBe("MISSING")
    expect(links["0041292"]).toBe("UNKNOWN_SESSION")
    expect(links["0041274"]).toBe("OTHER_PART")
    expect(links["0041207"]).toBe("VALID")
  })
})

describe("session actions", () => {
  it("a declaration resolves the missing-attestation item and completes the line", () => {
    const declaration: DeclarationRecord = {
      ...BASE_SNAPSHOT.declarations.find((d) => d.id === "DCL-1001")!,
      id: "DCL-2001",
      material: line("RC-8003").material,
      plant: line("RC-8003").plant,
      repairLineIds: ["RC-8003"],
      declaredBy: "You",
      declaredAt: "3 Sep 2026, 10:00",
    }
    const after = buildSnapshot({ ...NO_ACTIONS, declarations: [declaration] })
    expect(after.lines.find((l) => l.id === "RC-8003")?.declarationStatus).toBe("Completed")
    const item = exception(after, "EX-MA-8003")!
    expect(item.status).toBe("RESOLVED")
    expect(item.history.at(-1)).toMatchObject({ kind: "AUTO_RESOLVED", actor: "System" })
  })

  it("a justification resolves the unjustified-acquisition item", () => {
    const purchase = BASE_SNAPSHOT.purchases.find((p) => p.exceptionId === "EX-UA-90112")!
    const justification: JustificationEntry = {
      id: "J-8001",
      material: purchase.material,
      plant: purchase.plant,
      source: "EXCEPTION",
      reasonCategory: "PRODUCTION_CRITICAL",
      freeText: "Pump is the only feed path.",
      author: "You",
      recordedAt: "3 Sep 2026, 11:00",
      acquisitionLine: purchase.line,
      exceptionId: "EX-UA-90112",
    }
    const after = buildSnapshot({ ...NO_ACTIONS, justifications: [justification] })
    expect(exception(after, "EX-UA-90112")?.status).toBe("RESOLVED")
    expect(after.lines.find((l) => l.id === "RC-8006")?.justification?.status).toBe("RECORDED")
  })
})

describe("metrics (FR-10)", () => {
  it("counts compliance and the avoided-purchase benefit", () => {
    const m = summarise(BASE_SNAPSHOT)
    expect(m.declarationCompliance).toMatchObject({ count: 11, total: 13 })
    expect(m.sessionCompliance).toMatchObject({ count: 17, total: 20 })
    expect(m.justificationCompliance.total).toBeGreaterThan(m.justificationCompliance.count)
    expect(m.avoided.sessions).toBeGreaterThan(0)
    expect(m.avoided.value).toBeGreaterThan(0)
  })

  it("ranks coding candidates, actionable first", () => {
    const ranked = BASE_SNAPSHOT.codingCandidates
    expect(ranked[0]).toMatchObject({ rank: 1, verdict: "MISCODED_REPAIRABLE", isCorroborated: true })
    expect(ranked.at(-1)?.verdict).toBe("CONSUMABLE_FOR_REPAIR")
    expect(new Set(ranked.flatMap((c) => c.sources))).toEqual(new Set(["PR", "PO", "MOVEMENT"]))
  })
})
