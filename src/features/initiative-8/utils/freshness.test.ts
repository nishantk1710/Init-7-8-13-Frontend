import { describe, expect, it } from "vitest"

import { STALE_AFTER_DAYS, freshnessNote } from "@/features/initiative-8/utils/freshness"
import type { ApiI8Freshness } from "@/lib/api/i8"

/**
 * The words on every I08 screen about how current it is.
 *
 * The test that matters most is the last group: a load time and a coverage
 * date can disagree by weeks, and the note has to show both rather than let
 * the reassuring one stand for the data.
 */

const healthy: ApiI8Freshness = {
  referenceDate: "2026-11-27",
  loadedAt: "2026-11-27T07:05:00Z",
  newestLoadedAt: "2026-11-27T07:05:00Z",
  tables: [
    { table: "raw_ekpo", loadedAt: "2026-11-27T07:05:00Z" },
    { table: "raw_resb", loadedAt: "2026-11-27T07:05:00Z" },
  ],
  coverageTo: "2026-11-26",
  builtAt: "2026-11-27T07:06:30Z",
  buildingSince: null,
}

describe("the freshness note", () => {
  it("says when the data loaded and how far it reaches", () => {
    const note = freshnessNote(healthy)
    expect(note?.label).toContain("SAP data loaded")
    expect(note?.label).toContain("covers activity to")
    expect(note?.tone).toBe("muted")
  })

  it("says nothing at all when the status could not be read", () => {
    // A chip whose whole job is to be trusted about dates must not guess one.
    expect(freshnessNote(null)).toBeNull()
  })

  it("says nothing where neither a load nor a coverage date is recorded", () => {
    // The local dev copy: bulk-loaded from CSV, so no ingestion runs exist.
    expect(
      freshnessNote({ referenceDate: "2026-11-27", loadedAt: null, coverageTo: null, builtAt: null }),
    ).toBeNull()
  })

  it("explains itself during a first build rather than showing an empty screen", () => {
    const note = freshnessNote({
      referenceDate: "2026-11-27",
      buildingSince: "2026-11-27T07:00:00Z",
      builtAt: null,
    })
    expect(note?.label).toBe("Preparing SAP data…")
    expect(note?.title).toContain("fill in when it finishes")
  })
})

describe("when the feed goes quiet", () => {
  it("warns once coverage falls behind, and says by how much", () => {
    // The real case: nonprod loaded 90 seconds ago and held nothing newer
    // than 5 November. "Loaded today" on its own would be a wrong answer that
    // looks right.
    const note = freshnessNote({ ...healthy, coverageTo: "2026-11-05" })
    expect(note?.label).toContain("covers activity to 05 Nov 2026 — 22 days ago")
    expect(note?.tone).toBe("warn")
  })

  it("stays quiet while the gap is still ordinary", () => {
    const note = freshnessNote({ ...healthy, coverageTo: "2026-11-24" })
    expect(note?.label).not.toContain("ago")
    expect(note?.tone).toBe("muted")
  })

  it("turns at the threshold, not before it", () => {
    const onIt = freshnessNote({ ...healthy, coverageTo: "2026-11-20" })
    const pastIt = freshnessNote({ ...healthy, coverageTo: "2026-11-19" })
    expect(STALE_AFTER_DAYS).toBe(7)
    expect(onIt?.tone).toBe("muted")
    expect(pastIt?.tone).toBe("warn")
  })
})

describe("when one source table lags the rest", () => {
  const lagging: ApiI8Freshness = {
    ...healthy,
    loadedAt: "2026-11-03T02:10:00Z",
    newestLoadedAt: "2026-11-27T07:05:00Z",
    tables: [
      { table: "raw_resb", loadedAt: "2026-11-03T02:10:00Z" },
      { table: "raw_ekpo", loadedAt: "2026-11-27T07:05:00Z" },
    ],
  }

  it("shows the oldest load, not the newest", () => {
    // Thirteen tables loading this morning must not speak for the one that
    // stopped three weeks ago (raw_resb, 3-Nov-2026).
    expect(freshnessNote(lagging)?.label).toContain("3 Nov 2026")
    expect(freshnessNote(lagging)?.label).not.toContain("27 Nov 2026, 09:05")
  })

  it("names the table that is behind, in the detail", () => {
    const title = freshnessNote(lagging)?.title ?? ""
    expect(title).toContain("raw_resb last loaded")
    expect(title).toContain("Newest source loaded")
  })

  it("reports a table that has never loaded as never, not as old", () => {
    const title =
      freshnessNote({
        ...healthy,
        tables: [...(healthy.tables ?? []), { table: "criticality_current", loadedAt: null }],
      })?.title ?? ""
    expect(title).toContain("criticality_current has never loaded")
  })
})
