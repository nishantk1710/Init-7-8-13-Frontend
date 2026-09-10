import type { Server } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startGateway } from "../gateway/server"
import { loadEntitySet } from "../gateway/csv-source"
import { CpiClient } from "../client/client"
import { extract, UnfilteredExtractError } from "./paginate"
import { orderByFor, pagingConfigFor } from "./config"
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

afterAll(() => server.close())

const csvRowCount = (entitySet: string) => (loadEntitySet(entitySet) ?? []).length

describe("counted mode", () => {
  it("extracts exactly the number of rows the CSV holds", async () => {
    const result = await extract(client, "MaterialSet", { pageSize: 250 })
    expect(result.countMode).toBe("counted")
    expect(result.demoted).toBe(false)
    expect(result.rows).toHaveLength(csvRowCount("MaterialSet"))
    expect(result.reportedTotal).toBe(csvRowCount("MaterialSet"))
    expect(result.truncated).toBe(false)
  })

  it("pages more than once for a set larger than the page size", async () => {
    const result = await extract(client, "MaterialSet", { pageSize: 250 })
    expect(result.pages).toBeGreaterThan(1)
  })
})

describe("PurchaseRequisitionSet and GoodsMovementItemSet — SAP fixed $count on 09-Sep 2026", () => {
  // Both used to be pinned to "fallback" in SET_PAGING because $count really
  // did 500 on them. The sweep found SAP had fixed it, so the fix here was to
  // delete those two config lines — both now fall through to the default
  // "auto" mode and count normally, same as the PurchaseOrderItemSet case
  // below did when it was fixed earlier.
  it.each(["PurchaseRequisitionSet", "GoodsMovementItemSet"])(
    "%s is configured auto (not hard-coded fallback) and counts normally",
    async (entitySet) => {
      expect(pagingConfigFor(entitySet).countMode).toBe("auto")
      const result = await extract(client, entitySet, { pageSize: 300 })
      expect(result.countMode).toBe("counted")
      expect(result.demoted).toBe(false)
      expect(result.reportedTotal).toBe(csvRowCount(entitySet))
      expect(result.rows).toHaveLength(csvRowCount(entitySet))
    }
  )
})

describe("auto mode demotes itself and says so", () => {
  it("falls back when $count fails, reporting the demotion rather than hiding it", async () => {
    // forceCountBroken exercises the demotion path directly, rather than
    // depending on some set currently being broken in real SAP (as of the
    // 09-Sep 2026 sweep, none is — see known-conditions.ts COUNT_BROKEN_SETS).
    const broken = await startGateway({ forceCountBroken: ["MaterialSet"] })
    try {
      const brokenClient = new CpiClient({
        config: { ...config, baseUrl: broken.baseUrl, tokenUrl: `${broken.baseUrl}/oauth/token` },
      })
      const demotions: string[] = []
      const result = await extract(brokenClient, "MaterialSet", {
        pageSize: 500,
        onDemotion: (entitySet, reason) => demotions.push(`${entitySet}: ${reason}`),
      })
      expect(result.countMode).toBe("fallback")
      expect(result.demoted).toBe(true)
      expect(demotions).toHaveLength(1)
      expect(result.rows).toHaveLength(csvRowCount("MaterialSet"))
    } finally {
      broken.server.close()
    }
  })

  it("an auto set whose $count works stays counted — the PurchaseOrderItemSet self-promotion case", async () => {
    const result = await extract(client, "PurchaseOrderItemSet", { pageSize: 1000 })
    expect(result.countMode).toBe("counted")
    expect(result.demoted).toBe(false)
  })
})

describe("page boundaries", () => {
  it("is exact when the total is an exact multiple of the page size — the classic off-by-one", async () => {
    const total = csvRowCount("VendorSet")
    expect(total).toBeGreaterThan(0)
    // Page size chosen so the last page exactly fills, forcing one extra call.
    const result = await extract(client, "VendorSet", { pageSize: total })
    expect(result.rows).toHaveLength(total)
  })

  it("loses and duplicates nothing across page boundaries", async () => {
    const result = await extract(client, "MaterialPlantSet", { pageSize: 97 })
    const keys = result.rows.map((r) => `${r.Matnr}|${r.Werks}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(csvRowCount("MaterialPlantSet"))
  })

  it("loses and duplicates nothing on ChangeDocItemSet, whose declared key is NOT row-unique", async () => {
    const result = await extract(client, "ChangeDocItemSet", {
      filter: "Objectclas eq 'MATERIAL'",
      pageSize: 61,
    })

    // The declared 3-field key repeats across rows...
    const declaredKeys = result.rows.map((r) => `${r.Objectclas}|${r.Objectid}|${r.Changenr}`)
    expect(new Set(declaredKeys).size).toBeLessThan(declaredKeys.length)

    // ...but the composite identity we page by does not.
    const identity = result.rows.map(
      (r) => `${r.Objectclas}|${r.Objectid}|${r.Changenr}|${r.Tabname}|${r.Fname}`
    )
    expect(new Set(identity).size).toBe(identity.length)
    expect(identity).toHaveLength(csvRowCount("ChangeDocItemSet"))
  })

  it("orders ChangeDocItemSet by its composite identity, not by the non-unique declared key", () => {
    expect(orderByFor("ChangeDocItemSet")).toEqual([
      "Objectclas",
      "Objectid",
      "Changenr",
      "Tabname",
      "Fname",
    ])
    expect(orderByFor("MaterialPlantSet")).toEqual(["Matnr", "Werks"])
  })
})

describe("filtered-only sets", () => {
  it("refuses an unfiltered extract outright — impossible, not merely discouraged", async () => {
    await expect(extract(client, "ChangeDocItemSet")).rejects.toBeInstanceOf(UnfilteredExtractError)
    await expect(extract(client, "ChangeDocHeaderSet")).rejects.toThrow(/filtered-only/)
  })

  it("allows the filtered lookup I07 actually needs", async () => {
    const result = await extract(client, "ChangeDocItemSet", {
      filter: "Objectclas eq 'MATERIAL' and Fname eq 'MINBE'",
      pageSize: 500,
    })
    expect(result.status).toBe("rows")
    expect(result.rows.every((r) => r.Fname === "MINBE")).toBe(true)
  })
})

describe("safety ceilings", () => {
  it("stops and reports rather than running away, when the page ceiling trips", async () => {
    const result = await extract(client, "MaterialSet", { pageSize: 10, maxPages: 3 })
    expect(result.truncated).toBe(true)
    expect(result.pages).toBe(3)
    expect(result.rows.length).toBeLessThan(csvRowCount("MaterialSet"))
  })

  it("stops and reports when the row ceiling trips", async () => {
    const result = await extract(client, "MaterialSet", { pageSize: 100, maxRows: 250 })
    expect(result.truncated).toBe(true)
    expect(result.rows).toHaveLength(250)
  })

  it("a complete extraction is never marked truncated", async () => {
    const result = await extract(client, "VendorSet", { pageSize: 50 })
    expect(result.truncated).toBe(false)
  })
})

describe("empty is reportable, not ambiguous (§1.3)", () => {
  it("reports empty for a set that genuinely has no rows, after confirming once", async () => {
    // MaterialValuationSet is still one of the two live-empty sets as of the
    // 09-Sep 2026 sweep (ReservationItemSet, the third, was fixed then).
    const result = await extract(client, "MaterialValuationSet")
    expect(result.status).toBe("empty")
    expect(result.rows).toEqual([])
    // Asked twice before believing it: an empty first page could be a blip.
    expect(result.pages).toBe(2)
  })
})
