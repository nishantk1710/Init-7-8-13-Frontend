// Checks the committed demo dataset itself, not the resolver's logic (that is
// resolve.test.ts). A hand edit or a half-finished re-record fails here rather
// than as a blank screen in front of an audience.

import { describe, expect, it } from "vitest"

import dataset from "./demo-dataset.json"
import { mockKey } from "./key"
import type { RecordedResponse } from "./types"

const recordings = (dataset as { recordings: RecordedResponse[] }).recordings

describe("demo-dataset.json", () => {
  it("is not empty", () => {
    expect(recordings.length).toBeGreaterThan(0)
  })

  it("stores every recording under its normalised key, once", () => {
    const keys = recordings.map((r) => r.key)
    expect(keys.filter((key) => mockKey(key.split(" ")[0], key.slice(key.indexOf(" ") + 1)) !== key)).toEqual([])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("holds only successful GETs", () => {
    expect(recordings.filter((r) => !r.key.startsWith("GET ") || r.status >= 300)).toEqual([])
  })

  it("covers each initiative the demo is shown for", () => {
    for (const prefix of ["GET /i8/", "GET /i13/", "GET /assistant/"]) {
      expect(recordings.some((r) => r.key.startsWith(prefix)), prefix).toBe(true)
    }
  })
})
