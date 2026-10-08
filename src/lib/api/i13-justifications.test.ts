/**
 * The OAR justification log must not show I08's repairable-spares records.
 *
 * `/api/justifications` is shared by both initiatives. The I13 loader has to
 * ask for I13's kinds explicitly; a request without `kind` returns I08's
 * `NEW_ACQUISITION` rows too, and they rendered on the OAR dashboard.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import { getI13AllJustifications, I13_JUSTIFICATION_KINDS } from "@/lib/api/i13"

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getI13AllJustifications", () => {
  it("asks the shared table for I13's kinds only, never unfiltered", async () => {
    const urls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        urls.push(url)
        if (url.includes("/justifications")) return json({ items: [], total: 0 })
        return json([], { "X-Total-Count": "0" })
      })
    )

    await getI13AllJustifications({ plant: "1300" })

    const shared = urls.filter((u) => u.includes("/justifications"))
    const kinds = shared.map((u) => new URL(u).searchParams.get("kind"))
    expect(kinds.sort()).toEqual([...I13_JUSTIFICATION_KINDS].sort())
    expect(kinds).not.toContain("NEW_ACQUISITION")
    expect(shared.every((u) => new URL(u).searchParams.get("plant") === "1300")).toBe(true)
  })
})
