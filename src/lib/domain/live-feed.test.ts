import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/client"
import { formatWhen } from "@/lib/api/format"
import { settle } from "@/lib/domain/live-feed"

describe("settle", () => {
  it("wraps a resolved value as ready", async () => {
    expect(await settle(Promise.resolve(42))).toEqual({ status: "ready", data: 42 })
  })

  it("turns a rejection into a value instead of throwing", async () => {
    const result = await settle(Promise.reject(new Error("backend down")))
    expect(result).toEqual({ status: "error", message: "backend down" })
  })

  it("treats a 404 as unavailable, not as a failure to retry", async () => {
    const result = await settle(Promise.reject(new ApiError("not found", 404)))
    expect(result.status).toBe("unavailable")
  })

  it("treats any other HTTP failure as an error", async () => {
    const result = await settle(Promise.reject(new ApiError("boom", 503)))
    expect(result).toEqual({ status: "error", message: "boom" })
  })

  it("never reports a failure as an empty ready value", async () => {
    // The whole point: an outage must not be renderable as "nothing to show".
    const result = await settle(Promise.reject(new Error("x")))
    expect(result.status).not.toBe("ready")
  })

  it("gives a readable message for a non-Error rejection", async () => {
    const result = await settle(Promise.reject("just a string"))
    expect(result).toEqual({ status: "error", message: "Unable to load data." })
  })
})

describe("formatWhen", () => {
  it("formats a bare ISO date without inventing a time", () => {
    expect(formatWhen("2026-07-28")).toMatch(/28/)
    expect(formatWhen("2026-07-28")).not.toMatch(/:/)
  })

  it("formats a full ISO timestamp with its time", () => {
    expect(formatWhen("2026-07-28T09:10:00Z")).toMatch(/:/)
  })

  it("returns a pre-formatted display string untouched rather than Invalid Date", () => {
    expect(formatWhen("18 Aug 2026 · 09:10 AM")).toBe("18 Aug 2026 · 09:10 AM")
  })

  it("shows the placeholder for an absent value", () => {
    expect(formatWhen(null)).toBe("—")
    expect(formatWhen("")).toBe("—")
    expect(formatWhen(undefined, "n/a")).toBe("n/a")
  })
})
