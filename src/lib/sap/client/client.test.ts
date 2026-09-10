import { describe, expect, it } from "vitest"
import { CpiClient } from "./client"
import { TokenProvider } from "./token"
import { AuthError, ContractError, NotFoundError, RequestError, TransientError } from "./errors"
import { toODataFilter } from "../scope"
import type { CpiConfig } from "./config"

const config: CpiConfig = {
  baseUrl: "https://cpi.example",
  tokenUrl: "https://auth.example/oauth/token",
  clientId: "id",
  clientSecret: "secret",
  cpiPath: "/http/SAPECC/OdataConsumption",
  pageSize: 1000,
}

interface Call {
  url: string
  init?: RequestInit
}

/** A fake CPI that records calls and replies from a queue of responses. */
function harness(responses: (Response | (() => Response))[]) {
  const calls: Call[] = []
  let index = 0
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const asString = String(url)
    if (asString.startsWith(config.tokenUrl)) {
      return new Response(JSON.stringify({ access_token: "token-1", expires_in: 3600 }), { status: 200 })
    }
    calls.push({ url: asString, init })
    const next = responses[Math.min(index++, responses.length - 1)]
    return typeof next === "function" ? next() : next
  }) as unknown as typeof fetch

  const slept: number[] = []
  const client = new CpiClient({
    config,
    fetchImpl,
    tokenProvider: new TokenProvider(config, { fetchImpl }),
    sleep: async (ms) => {
      slept.push(ms)
    },
  })
  return { client, calls, slept }
}

function odata(rows: Record<string, unknown>[]) {
  return new Response(JSON.stringify({ d: { results: rows } }), { status: 200 })
}

describe("request construction — the double envelope stays hidden", () => {
  it("resolves the owning service from the contract, not from the caller", async () => {
    const { client, calls } = harness([odata([])])
    await client.read("MaterialPlantSet")
    const url = new URL(calls[0].url)
    expect(url.origin + url.pathname).toBe("https://cpi.example/http/SAPECC/OdataConsumption")
    expect(url.searchParams.get("APIPath")).toBe(
      "sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/MaterialPlantSet"
    )
  })

  it("routes a ZMM set to the other service", async () => {
    const { client, calls } = harness([odata([])])
    await client.read("ReservationItemSet")
    expect(new URL(calls[0].url).searchParams.get("APIPath")).toBe(
      "sap/opu/odata/sap/ZMM_KPI02_SRV/ReservationItemSet"
    )
  })

  it("encodes a filter containing spaces and quotes so it survives the round trip", async () => {
    const { client, calls } = harness([odata([])])
    const filter = toODataFilter("oar", "MaterialPlantSet")!
    await client.read("MaterialPlantSet", { query: `$filter=${filter}&$top=10` })

    const raw = calls[0].url
    expect(raw).not.toContain("'") // quotes must be percent-encoded on the wire
    expect(raw).not.toMatch(/APIQuery=[^&]*\s/) // no raw spaces
    // ...and decode back to exactly what we asked for.
    expect(new URL(raw).searchParams.get("APIQuery")).toBe(
      "$filter=(Dismm eq 'ND' or Dismm eq 'PD')&$top=10&$format=json"
    )
  })

  it("asks for JSON, since the OData default is XML", async () => {
    const { client, calls } = harness([odata([])])
    await client.read("MaterialSet")
    expect(new URL(calls[0].url).searchParams.get("APIQuery")).toContain("$format=json")
  })

  it("refuses an entity set the contract has never heard of", async () => {
    const { client } = harness([odata([])])
    await expect(client.read("NoSuchSet")).rejects.toBeInstanceOf(ContractError)
  })
})

describe("response parsing", () => {
  it("decodes each declared type: date, time, decimal, and leaves null alone", async () => {
    const { client } = harness([
      odata([{ __metadata: { uri: "x" }, Objectclas: "MATERIAL", Udate: "/Date(0)/", Utime: "PT14H16M00S", Tcode: null }]),
    ])
    const result = await client.read("ChangeDocHeaderSet")
    expect(result.status).toBe("rows")
    const row = result.rows[0]
    expect(row.Udate).toEqual(new Date(0))
    expect(row.Utime).toEqual({ hours: 14, minutes: 16, seconds: 0 })
    expect(row.Tcode).toBeNull()
  })

  it("does NOT turn a numeric-looking Edm.String into a number — the Netpr case", async () => {
    const { client } = harness([odata([{ Ebeln: "4500001", Ebelp: "10", Netpr: "1234.56", Netwr: "9876.54" }])])
    const result = await client.read("PurchaseOrderItemSet")
    expect(result.rows[0].Netpr).toBe("1234.56")
    expect(typeof result.rows[0].Netpr).toBe("string")
  })

  it("decodes a genuine Edm.Decimal to a number", async () => {
    // ReservationItemSet.Bdmng, not MaterialPlantSet.Plifz — the 09-Sep 2026
    // sweep changed Plifz (and most other MaterialPlantSet quantity fields)
    // from Edm.Decimal to Edm.String. Bdmng is still a genuine Edm.Decimal.
    const { client } = harness([odata([{ Rsnum: "1", Rspos: "1", Bdmng: "58.000" }])])
    const result = await client.read("ReservationItemSet")
    expect(result.rows[0].Bdmng).toBe(58)
  })

  it("keeps zero-padded material numbers intact", async () => {
    const { client } = harness([odata([{ Matnr: "000000000012345", Werks: "1000" }])])
    const result = await client.read("MaterialPlantSet")
    expect(result.rows[0].Matnr).toBe("000000000012345")
  })

  it("strips __metadata rather than treating it as a field", async () => {
    const { client } = harness([odata([{ __metadata: { uri: "x" }, Matnr: "1", Werks: "1000" }])])
    const result = await client.read("MaterialPlantSet")
    expect(Object.keys(result.rows[0])).not.toContain("__metadata")
  })

  it("reports properties the contract does not know about instead of throwing", async () => {
    const { client } = harness([odata([{ Matnr: "1", Werks: "1000", BrandNewField: "surprise" }])])
    const result = await client.read("MaterialPlantSet")
    expect(result.status === "rows" && result.unknownProperties).toEqual(["BrandNewField"])
  })

  it("raises ContractError when a value cannot be what the contract says it is", async () => {
    const { client } = harness([odata([{ Objectclas: "MATERIAL", Udate: "not-a-date" }])])
    await expect(client.read("ChangeDocHeaderSet")).rejects.toBeInstanceOf(ContractError)
  })

  it("raises ContractError on a non-OData body, quoting what came back", async () => {
    const { client } = harness([new Response("<html>gateway error</html>", { status: 200 })])
    await expect(client.read("MaterialSet")).rejects.toThrow(/gateway error/)
  })
})

describe("empty is not broken (§1.3)", () => {
  it("a zero-row response is its own reportable status, not a bland empty array", async () => {
    const { client } = harness([odata([])])
    // MaterialValuationSet is one of the two sets still genuinely empty live
    // as of the 09-Sep 2026 sweep (ReservationItemSet, previously the
    // textbook example here, was fixed then — see known-conditions.ts).
    const result = await client.read("MaterialValuationSet")
    expect(result.status).toBe("empty")
    expect(result.rows).toEqual([])
    expect(result.entitySet).toBe("MaterialValuationSet")
  })

  it("rows and empty are distinguishable without inspecting array length", async () => {
    const { client } = harness([odata([{ Matnr: "1", Werks: "1000" }])])
    expect((await client.read("MaterialPlantSet")).status).toBe("rows")
  })
})

describe("retry and error mapping", () => {
  it("backs off and retries on 500, then succeeds", async () => {
    let call = 0
    const { client, slept } = harness([
      () => (++call < 3 ? new Response("boom", { status: 500 }) : odata([{ Matnr: "1", Werks: "1000" }])),
    ])
    const result = await client.read("MaterialPlantSet")
    expect(result.status).toBe("rows")
    expect(slept).toEqual([1000, 2000]) // exponential, not a tight loop
  })

  it("gives up on 500 after the retry budget, as TransientError", async () => {
    const { client, slept } = harness([new Response("boom", { status: 500 })])
    await expect(client.read("MaterialPlantSet")).rejects.toBeInstanceOf(TransientError)
    expect(slept).toHaveLength(2)
  })

  it("does NOT retry a 404 — retrying a wrong URL cannot fix it", async () => {
    const { client, calls, slept } = harness([new Response("", { status: 404 })])
    await expect(client.read("MaterialPlantSet")).rejects.toBeInstanceOf(NotFoundError)
    expect(calls).toHaveLength(1)
    expect(slept).toEqual([])
  })

  it("does NOT retry a 400 — a bad filter stays bad", async () => {
    const { client, calls } = harness([new Response("bad filter", { status: 400 })])
    await expect(client.read("MaterialPlantSet")).rejects.toBeInstanceOf(RequestError)
    expect(calls).toHaveLength(1)
  })

  it("re-authenticates exactly once on 401, then retries the call", async () => {
    let call = 0
    const { client, calls } = harness([() => (++call === 1 ? new Response("", { status: 401 }) : odata([]))])
    const result = await client.read("MaterialPlantSet")
    expect(result.status).toBe("empty")
    expect(calls).toHaveLength(2)
  })

  it("gives up as AuthError when a second 401 follows the re-auth", async () => {
    const { client, calls } = harness([new Response("", { status: 401 })])
    await expect(client.read("MaterialPlantSet")).rejects.toBeInstanceOf(AuthError)
    expect(calls).toHaveLength(2) // original + one re-auth attempt, then stop
  })

  it("retries a network failure with backoff", async () => {
    let call = 0
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).startsWith(config.tokenUrl)) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 })
      }
      if (++call < 2) throw new Error("ECONNRESET")
      return odata([])
    }) as unknown as typeof fetch

    const client = new CpiClient({ config, fetchImpl, sleep: async () => {} })
    expect((await client.read("MaterialSet")).status).toBe("empty")
  })
})

describe("$count", () => {
  it("returns the number for a working set", async () => {
    const { client } = harness([new Response("11074", { status: 200 })])
    expect(await client.count("PurchaseOrderItemSet")).toBe(11074)
  })

  it("returns null — not a throw — when $count 500s (W2.3's auto mode demotes to fallback paging on this)", async () => {
    const { client } = harness([new Response("error", { status: 500 })])
    expect(await client.count("PurchaseRequisitionSet")).toBeNull()
  })

  it("distinguishes a real zero from a broken count", async () => {
    const { client } = harness([new Response("0", { status: 200 })])
    // MaterialValuationSet genuinely counts 0 live (§1.3) — unlike a 500, this
    // is a real answer and must come back as a number, not null.
    expect(await client.count("MaterialValuationSet")).toBe(0)
  })

  it("raises ContractError when $count returns something that is not a number", async () => {
    const { client } = harness([new Response("<html>nope</html>", { status: 200 })])
    await expect(client.count("MaterialSet")).rejects.toBeInstanceOf(ContractError)
  })
})
