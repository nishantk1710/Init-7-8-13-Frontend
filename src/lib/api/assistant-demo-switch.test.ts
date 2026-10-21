import { afterEach, describe, expect, it, vi } from "vitest"

import { postTurn, searchMaterials, startSession } from "@/lib/api/assistant"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"

/**
 * With `NEXT_PUBLIC_ASSISTANT_DEMO` unset -- every live build -- the assistant
 * calls go to the backend and the demo module is never consulted.
 */
describe("with the demo switch off", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(body: unknown) {
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal("fetch", fetch)
    return fetch
  }

  it("is off by default", () => {
    expect(ASSISTANT_DEMO).toBe(false)
  })

  it("opens a session against the backend", async () => {
    const fetch = stubFetch({ routing: {}, sessionId: null, expiresAt: null, step: null, narrative: null })
    await startSession({ materialId: "8000005632", plant: "1300" })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/assistant\/sessions$/)
    expect(init.method).toBe("POST")
  })

  it("answers a turn against the backend", async () => {
    const fetch = stubFetch({ sessionId: "S00000000X", step: {} })
    await postTurn("S00000000X", { choice: "use_existing" })
    const [url] = fetch.mock.calls[0] as unknown as [string]
    expect(url).toMatch(/\/assistant\/sessions\/S00000000X\/turns$/)
  })

  it("searches materials against the backend, passing the query and limit", async () => {
    const fetch = stubFetch({ items: [], note: "" })
    await searchMaterials("slurry pump", { limit: 5 })
    const [url] = fetch.mock.calls[0] as unknown as [string]
    expect(url).toContain("/assistant/materials?")
    expect(url).toContain("q=slurry+pump")
    expect(url).toContain("limit=5")
  })
})
