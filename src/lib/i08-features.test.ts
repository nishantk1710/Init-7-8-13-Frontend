import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/client"
import {
  completeFlowFromFeatures,
  completeFlowFromRules,
  loadCompleteFlowFromFeatures,
  loadCompleteFlowFromSnapshot,
  switchIsOn,
} from "@/lib/i08-features"

describe("switchIsOn", () => {
  it("reads every way the backend can say true", () => {
    for (const value of [true, 1, "true", "True", " TRUE ", "1", "yes", "on"]) expect(switchIsOn(value)).toBe(true)
  })

  it("reads absent, false, zero and anything else as off", () => {
    for (const value of [undefined, null, false, 0, "false", "False", "0", "", "maybe", {}, []]) {
      expect(switchIsOn(value)).toBe(false)
    }
  })
})

describe("completeFlowFromRules", () => {
  it("is on only when the snapshot's rules say so", () => {
    expect(completeFlowFromRules({ completeFlowEnabled: true })).toBe(true)
    expect(completeFlowFromRules({ completeFlowEnabled: 1 })).toBe(true)
    expect(completeFlowFromRules({ completeFlowEnabled: false })).toBe(false)
  })

  it("is off for a backend older than the switch", () => {
    expect(completeFlowFromRules({})).toBe(false)
    expect(completeFlowFromRules(null)).toBe(false)
    expect(completeFlowFromRules(undefined)).toBe(false)
  })
})

describe("completeFlowFromFeatures", () => {
  it("reads GET /api/i8/features", () => {
    expect(completeFlowFromFeatures({ completeFlowEnabled: true })).toBe(true)
    expect(completeFlowFromFeatures({ completeFlowEnabled: false })).toBe(false)
    expect(completeFlowFromFeatures({})).toBe(false)
    expect(completeFlowFromFeatures(null)).toBe(false)
  })
})

describe("loadCompleteFlowFromSnapshot", () => {
  it("reads the switch from the snapshot's rules", async () => {
    await expect(
      loadCompleteFlowFromSnapshot(vi.fn().mockResolvedValue({ rules: { completeFlowEnabled: true } })),
    ).resolves.toBe(true)
    await expect(
      loadCompleteFlowFromSnapshot(vi.fn().mockResolvedValue({ rules: { completeFlowEnabled: false } })),
    ).resolves.toBe(false)
  })

  it("is off when the rules do not carry it", async () => {
    await expect(loadCompleteFlowFromSnapshot(vi.fn().mockResolvedValue({ rules: {} }))).resolves.toBe(false)
    await expect(loadCompleteFlowFromSnapshot(vi.fn().mockResolvedValue({}))).resolves.toBe(false)
  })

  it("is off, never an error, when the snapshot cannot be read", async () => {
    await expect(
      loadCompleteFlowFromSnapshot(vi.fn().mockRejectedValue(new ApiError("GET /i8/snapshot failed with 503", 503))),
    ).resolves.toBe(false)
    await expect(loadCompleteFlowFromSnapshot(vi.fn().mockRejectedValue(new Error("fetch failed")))).resolves.toBe(
      false,
    )
  })
})

describe("loadCompleteFlowFromFeatures", () => {
  it("is on only when the route says so", async () => {
    await expect(
      loadCompleteFlowFromFeatures(vi.fn().mockResolvedValue({ completeFlowEnabled: true })),
    ).resolves.toBe(true)
    await expect(
      loadCompleteFlowFromFeatures(vi.fn().mockResolvedValue({ completeFlowEnabled: false })),
    ).resolves.toBe(false)
    await expect(loadCompleteFlowFromFeatures(vi.fn().mockResolvedValue({}))).resolves.toBe(false)
  })

  it("is off for a backend without the route (404)", async () => {
    await expect(
      loadCompleteFlowFromFeatures(vi.fn().mockRejectedValue(new ApiError("GET /i8/features failed with 404", 404))),
    ).resolves.toBe(false)
  })

  it("is off when the request fails", async () => {
    await expect(loadCompleteFlowFromFeatures(vi.fn().mockRejectedValue(new Error("timeout")))).resolves.toBe(false)
  })
})
