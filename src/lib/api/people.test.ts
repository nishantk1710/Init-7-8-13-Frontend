import { describe, expect, it, vi } from "vitest"

import { isEntraObjectId, PersonDirectory, type PersonName } from "./people"

const ADA = "11111111-1111-1111-1111-111111111111"
const BOB = "22222222-2222-2222-2222-222222222222"
const NOBODY = "33333333-3333-3333-3333-333333333333"

const people: Record<string, PersonName> = {
  [ADA]: { oid: ADA, name: "Ada King", email: "ada@example.com" },
  [BOB]: { oid: BOB, name: "Bob", email: "bob@example.com" },
}

describe("isEntraObjectId", () => {
  it("accepts the 8-4-4-4-12 form only", () => {
    expect(isEntraObjectId(ADA)).toBe(true)
    expect(isEntraObjectId(ADA.toUpperCase())).toBe(true)
    expect(isEntraObjectId("UNAUTHENTICATED-FRONTEND")).toBe(false)
    expect(isEntraObjectId("U1")).toBe(false)
    expect(isEntraObjectId("ada@example.com")).toBe(false)
    expect(isEntraObjectId(null)).toBe(false)
  })
})

describe("PersonDirectory", () => {
  it("asks once for everything queued and remembers the answers, including the unknown ones", async () => {
    const fetcher = vi.fn(async (oids: string[]) => Object.fromEntries(oids.filter((o) => o in people).map((o) => [o, people[o]])))
    const directory = new PersonDirectory(fetcher)

    const answers = Promise.all([directory.lookup(ADA), directory.lookup(BOB), directory.lookup(NOBODY), directory.lookup(ADA)])
    await directory.flushNow()

    expect(await answers).toEqual([people[ADA], people[BOB], null, people[ADA]])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toEqual([ADA, BOB, NOBODY])

    // a second round costs nothing
    expect(await directory.lookup(ADA)).toEqual(people[ADA])
    expect(await directory.lookup(NOBODY)).toBeNull()
    expect(directory.peek(ADA)).toEqual(people[ADA])
    expect(directory.peek(NOBODY)).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("matches ids whatever their case", async () => {
    const directory = new PersonDirectory(async () => ({ [ADA.toUpperCase()]: people[ADA] }))
    const answer = directory.lookup(ADA)
    await directory.flushNow()
    expect(await answer).toEqual(people[ADA])
    expect(directory.peek(ADA.toUpperCase())).toEqual(people[ADA])
  })

  it("splits a long list into batches", async () => {
    const fetcher = vi.fn(async (oids: string[]): Promise<Record<string, PersonName>> => (oids.length ? {} : {}))
    const directory = new PersonDirectory(fetcher, 2)
    const ids = [ADA, BOB, NOBODY]
    const answers = Promise.all(ids.map((id) => directory.lookup(id)))
    await directory.flushNow()
    expect(await answers).toEqual([null, null, null])
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([[ADA, BOB], [NOBODY]])
  })

  it("forgets a failed request so the next screen asks again", async () => {
    let calls = 0
    const directory = new PersonDirectory(async (oids) => {
      calls++
      if (calls === 1) throw new Error("backend down")
      return Object.fromEntries(oids.map((o) => [o, people[o]]))
    })

    const first = directory.lookup(ADA)
    await directory.flushNow()
    expect(await first).toBeNull()
    expect(directory.peek(ADA)).toBeUndefined()

    const second = directory.lookup(ADA)
    await directory.flushNow()
    expect(await second).toEqual(people[ADA])
    expect(calls).toBe(2)
  })

  it("flushes on its own after a tick", async () => {
    const fetcher = vi.fn(async (oids: string[]) => Object.fromEntries(oids.map((o) => [o, people[o]])))
    const directory = new PersonDirectory(fetcher)
    expect(await directory.lookup(ADA)).toEqual(people[ADA])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
