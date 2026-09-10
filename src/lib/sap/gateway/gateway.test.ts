import type { Server } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startGateway } from "./server"
import { availableEntitySets, loadEntitySet } from "./csv-source"
import { CpiClient } from "../client/client"
import { NotFoundError } from "../client/errors"
import { isInScope, toODataFilter } from "../scope"
import { COUNT_BROKEN_SETS, EMPTY_SETS } from "../contract/known-conditions"
import { SapRouter, sourceFor } from "../routing"
import type { CpiConfig } from "../client/config"

let server: Server
let client: CpiClient
let config: CpiConfig

beforeAll(async () => {
  const started = await startGateway()
  server = started.server
  config = {
    baseUrl: started.baseUrl,
    tokenUrl: `${started.baseUrl}/oauth/token`,
    clientId: "fake",
    clientSecret: "fake",
    cpiPath: "/http/SAPECC/OdataConsumption",
    pageSize: 1000,
  }
  client = new CpiClient({ config })
})

afterAll(() => {
  server.close()
})

describe("the real W2.1 client talks to the gateway with no changes", () => {
  it("reads rows through the double envelope", async () => {
    const result = await client.read("MaterialSet", { query: "$top=3" })
    expect(result.status).toBe("rows")
    expect(result.rows).toHaveLength(3)
    expect(typeof result.rows[0].Matnr).toBe("string")
  })

  it("reads EVERY generated entity set end to end — W2.1's done-when", async () => {
    const sets = availableEntitySets()
    expect(sets.length).toBeGreaterThan(15)

    for (const entitySet of sets) {
      const result = await client.read(entitySet, { query: "$top=2" })
      expect(["rows", "empty"], `${entitySet} returned neither rows nor empty`).toContain(result.status)
      if (result.status === "rows") {
        // Decoding succeeded against the contract, and nothing unexpected came back.
        expect(result.unknownProperties, `${entitySet} returned unknown properties`).toEqual([])
      }
    }
  })

  it("serves $metadata as XML, not JSON — the HTTP 406 case from phase 4", async () => {
    const xml = await client.metadata("ZMM_KPI02_SRV")
    expect(xml).toContain("<EntityType")
  })

  it("404s an entity set that does not exist", async () => {
    const raw = await fetch(
      `${config.baseUrl}/http/SAPECC/OdataConsumption?APIPath=${encodeURIComponent("sap/opu/odata/sap/X/NopeSet")}`
    )
    expect(raw.status).toBe(404)
  })
})

describe("SAP's awkward wire formats are reproduced, not tidied up", () => {
  it("decimals arrive as strings, exactly as SAP sends them", async () => {
    const raw = await fetch(
      `${config.baseUrl}/http/SAPECC/OdataConsumption?` +
        `APIPath=${encodeURIComponent("sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/MaterialPlantSet")}&` +
        `APIQuery=${encodeURIComponent("$top=1")}`
    )
    const payload = (await raw.json()) as { d: { results: Record<string, unknown>[] } }
    expect(typeof payload.d.results[0].Plifz).toBe("string")
  })

  it("dates arrive in /Date(ms)/ form and the client turns them back into Dates", async () => {
    const result = await client.read("ChangeDocHeaderSet", { query: "$top=1" })
    if (result.status === "rows") expect(result.rows[0].Udate).toBeInstanceOf(Date)
  })

  it("every synthetic row is marked as synthetic (§7.6)", async () => {
    const raw = await fetch(
      `${config.baseUrl}/http/SAPECC/OdataConsumption?` +
        `APIPath=${encodeURIComponent("sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/MaterialSet")}&` +
        `APIQuery=${encodeURIComponent("$top=1")}`
    )
    const payload = (await raw.json()) as { d: { results: { __metadata: { synthetic?: boolean } }[] } }
    expect(payload.d.results[0].__metadata.synthetic).toBe(true)
  })
})

describe("the current live conditions are reproduced deliberately (§7.3)", () => {
  // COUNT_BROKEN_SETS is empty as of the 09-Sep 2026 sweep (both sets that
  // used to be here were fixed), so this runs zero cases right now — that is
  // expected, not a mistake. See gateway/server.ts's forceCountBroken for
  // exercising a broken $count in a test regardless of live SAP's state.
  it.each(COUNT_BROKEN_SETS)("$count returns HTTP 500 on %s, as it really does", async (entitySet) => {
    expect(await client.count(entitySet)).toBeNull()
  })

  it("$count works everywhere else, and matches the CSV row count", async () => {
    const rows = loadEntitySet("MaterialSet") ?? []
    expect(await client.count("MaterialSet")).toBe(rows.length)
  })

  it.each(EMPTY_SETS)("%s returns zero rows, matching §1.3", async (entitySet) => {
    const result = await client.read(entitySet, { query: "$top=10" })
    expect(result.status).toBe("empty")
  })

  it("the zero-row simulation can be switched off, so we can also test the fixed future", async () => {
    const honest = await startGateway({ simulateEmptySets: false, simulateBrokenCount: false })
    try {
      const honestClient = new CpiClient({ config: { ...config, baseUrl: honest.baseUrl, tokenUrl: `${honest.baseUrl}/oauth/token` } })
      expect(await honestClient.count("PurchaseRequisitionSet")).not.toBeNull()
    } finally {
      honest.server.close()
    }
  })
})

describe("query surface (§7.2)", () => {
  it("$top and $skip page without overlap", async () => {
    const first = await client.read("MaterialSet", { query: "$top=5&$orderby=Matnr" })
    const second = await client.read("MaterialSet", { query: "$top=5&$skip=5&$orderby=Matnr" })
    const firstIds = first.rows.map((r) => r.Matnr)
    const secondIds = second.rows.map((r) => r.Matnr)
    expect(firstIds).toHaveLength(5)
    expect(secondIds).toHaveLength(5)
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([])
  })

  it("$orderby actually orders", async () => {
    const result = await client.read("MaterialSet", { query: "$top=5&$orderby=Matnr desc" })
    const ids = result.rows.map((r) => String(r.Matnr))
    expect([...ids].sort().reverse()).toEqual(ids)
  })

  it("$select returns only the requested fields", async () => {
    const result = await client.read("MaterialPlantSet", { query: "$top=1&$select=Matnr,Werks" })
    if (result.status === "rows") {
      expect(Object.keys(result.rows[0]).sort()).toEqual(["Matnr", "Werks"])
    }
  })

  it("$filter with and — the FR-9 change-document case from §1.4", async () => {
    const all = await client.count("ChangeDocItemSet")
    const filtered = await client.count("ChangeDocItemSet", {
      query: "$filter=Objectclas eq 'MATERIAL' and Tabname eq 'MARC'",
    })
    // NOTE: this fixture is 100% MATERIAL/MARC, so this particular filter
    // matches everything. On live SAP the same filter cuts 929,151 rows to
    // 7,220 — the fixture simply cannot express that, which is a generator
    // gap, not a filter bug. See phase_summary.md Phase 5.
    expect(filtered).toBe(all)

    // A filter the fixture CAN narrow, proving `and` really is applied:
    const oneField = await client.count("ChangeDocItemSet", {
      query: "$filter=Objectclas eq 'MATERIAL' and Fname eq 'MINBE'",
    })
    expect(oneField).toBeGreaterThan(0)
    expect(oneField!).toBeLessThan(all!)
  })

  it("a filter matching nothing returns zero, not everything", async () => {
    expect(await client.count("ChangeDocItemSet", { query: "$filter=Objectclas eq 'NOPE'" })).toBe(0)
  })

  it("a malformed filter is a 400, not a silent full-table scan", async () => {
    await expect(client.read("MaterialSet", { query: "$filter=Matnr neq 'x'" })).rejects.toThrow()
  })
})

describe("scope pushdown equals the in-memory predicate (the W2.4 equivalence test)", () => {
  it("the gateway's Dismm filter selects exactly the rows the predicate selects", async () => {
    const filter = toODataFilter("oar", "MaterialPlantSet")!
    const viaGateway = await client.read("MaterialPlantSet", { query: `$filter=${filter}&$top=5000` })

    const plants = loadEntitySet("MaterialPlantSet") ?? []
    const inMemory = plants.filter((plant) => {
      // Only the MaterialPlantSet half of the rule — the Mstae half is a
      // separate read joined on Matnr, exactly as §5 describes.
      const dismm = plant.Dismm
      return dismm === "ND" || dismm === "PD"
    })

    const gatewayKeys = viaGateway.rows.map((r) => `${r.Matnr}|${r.Werks}`).sort()
    const memoryKeys = inMemory.map((r) => `${r.Matnr}|${r.Werks}`).sort()
    expect(gatewayKeys).toEqual(memoryKeys)
    expect(gatewayKeys.length).toBeGreaterThan(0)
  })

  it("the two-read join gives the same answer as isInScope over the whole fixture", async () => {
    const plantFilter = toODataFilter("oar", "MaterialPlantSet")!
    const materialFilter = toODataFilter("oar", "MaterialSet")!

    const plants = await client.read("MaterialPlantSet", { query: `$filter=${plantFilter}&$top=5000` })
    const materials = await client.read("MaterialSet", { query: `$filter=${materialFilter}&$top=5000` })
    const allowedMatnr = new Set(materials.rows.map((m) => String(m.Matnr)))
    const viaPushdown = plants.rows
      .filter((p) => allowedMatnr.has(String(p.Matnr)))
      .map((p) => `${p.Matnr}|${p.Werks}`)
      .sort()

    const allMaterials = new Map((loadEntitySet("MaterialSet") ?? []).map((m) => [m.Matnr, m]))
    const viaPredicate = (loadEntitySet("MaterialPlantSet") ?? [])
      .filter((plant) => isInScope("oar", allMaterials.get(plant.Matnr) ?? {}, plant) === "in-scope")
      .map((plant) => `${plant.Matnr}|${plant.Werks}`)
      .sort()

    expect(viaPushdown).toEqual(viaPredicate)
    expect(viaPushdown.length).toBeGreaterThan(0)
  })
})

describe("per-set routing (§7.4)", () => {
  it("defaults every set to mock, because nothing has read a real SAP row yet", () => {
    expect(sourceFor("MaterialSet")).toBe("mock")
  })

  it("routes per set, and marks mocked results as synthetic", async () => {
    const unreachable = new CpiClient({
      config: { ...config, baseUrl: "http://127.0.0.1:1" },
      maxRetries: 1,
    })
    const router = new SapRouter({
      live: unreachable,
      mock: client,
      sources: { MaterialSet: "live", MaterialPlantSet: "mock" },
    })

    const mocked = await router.read("MaterialPlantSet", { query: "$top=1" })
    expect(mocked.synthetic).toBe(true)
    expect(mocked.source).toBe("mock")

    // Flipping one set to an unreachable live endpoint fails ONLY that set.
    await expect(router.read("MaterialSet", { query: "$top=1" })).rejects.toThrow()
    expect((await router.read("MaterialPlantSet", { query: "$top=1" })).status).toBe("rows")
  })

  it("reports which sets are still synthetic, for the UI banner", () => {
    const router = new SapRouter({ live: client, mock: client, sources: { MaterialSet: "live" } })
    expect(router.syntheticSets(["MaterialSet", "MaterialPlantSet"])).toEqual(["MaterialPlantSet"])
  })
})
