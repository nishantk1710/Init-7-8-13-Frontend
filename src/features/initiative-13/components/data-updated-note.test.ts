// Every OAR page says when its figures were last updated (UAT, 23-Nov-2026).

import { describe, expect, it } from "vitest"

import { dataUpdatedText } from "@/features/initiative-13/components/data-updated-note"
import type { I13SnapshotStatus } from "@/lib/api/i13"

const ready: I13SnapshotStatus = {
  status: "ready",
  enabled: true,
  version: 192,
  referenceDate: "2026-11-23",
  builtAt: "2026-11-23T00:31:01Z",
  buildSeconds: 711,
  buildingSince: null,
  rebuilding: false,
  lastError: null,
}

describe("dataUpdatedText", () => {
  it("gives the SAP data date and the update time in South African time", () => {
    const text = dataUpdatedText(ready)
    expect(text).toContain("SAP data as of 23 Nov 2026")
    expect(text).toContain("updated 23 Nov 2026")
    expect(text).toContain("02:31") // 00:31 UTC is 02:31 SAST
  })

  it("says when a new update is running", () => {
    expect(dataUpdatedText({ ...ready, rebuilding: true })).toContain("new update running")
  })

  it("never breaks the page when the time cannot be read", () => {
    expect(dataUpdatedText(null)).toBe("Update time not available")
    expect(dataUpdatedText({ ...ready, builtAt: null, referenceDate: null })).toBe("Update time not available")
  })
})
