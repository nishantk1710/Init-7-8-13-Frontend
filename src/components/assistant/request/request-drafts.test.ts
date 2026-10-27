import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_DRAFTS,
  deleteDraft,
  getDraft,
  readDrafts,
  saveDraft,
  type RequestDraft,
} from "@/components/assistant/request/request-drafts"
import { pendingLine } from "@/lib/assistant/request/lines"

let store: Map<string, string>

function draft(id: string, savedAt: string): RequestDraft {
  return {
    id,
    savedAt,
    requester: "Werner",
    departmentPlant: "1300",
    department: "12345",
    departmentNote: "",
    origin: "PLATFORM",
    rows: [{ ...pendingLine("5000038151", "1300", "SIGN ON CHROMADECK"), kind: "out_of_scope", reason: "Not OAR" } as never],
  }
}

beforeEach(() => {
  store = new Map()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    dispatchEvent: () => true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("request drafts", () => {
  it("saves, reads newest first, replaces by id and deletes", () => {
    saveDraft(draft("a", "2026-10-27T08:00:00.000Z"))
    saveDraft(draft("b", "2026-10-27T09:00:00.000Z"))
    expect(readDrafts().map((d) => d.id)).toEqual(["b", "a"])

    saveDraft({ ...draft("a", "2026-10-27T10:00:00.000Z"), requester: "Lynn" })
    expect(readDrafts().map((d) => d.id)).toEqual(["a", "b"])
    expect(getDraft("a")?.requester).toBe("Lynn")

    deleteDraft("a")
    expect(readDrafts().map((d) => d.id)).toEqual(["b"])
    expect(getDraft("a")).toBeNull()
  })

  it(`keeps at most ${MAX_DRAFTS}, dropping the oldest`, () => {
    for (let i = 0; i < MAX_DRAFTS + 2; i++) {
      saveDraft(draft(`d${i}`, new Date(Date.UTC(2026, 9, 27, 0, i)).toISOString()))
    }
    const ids = readDrafts().map((d) => d.id)
    expect(ids).toHaveLength(MAX_DRAFTS)
    expect(ids).not.toContain("d0")
    expect(ids[0]).toBe(`d${MAX_DRAFTS + 1}`)
  })

  it("reads nothing, rather than throwing, from unreadable storage", () => {
    store.set("assistant.request-drafts", "{not json")
    expect(readDrafts()).toEqual([])
    store.set("assistant.request-drafts", JSON.stringify([{ id: 1 }, draft("ok", "2026-10-27T08:00:00.000Z")]))
    expect(readDrafts().map((d) => d.id)).toEqual(["ok"])
  })

  it("reports a save the browser refused", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError")
        },
      },
      dispatchEvent: () => true,
    })
    expect(saveDraft(draft("a", "2026-10-27T08:00:00.000Z"))).toBe(false)
  })
})
