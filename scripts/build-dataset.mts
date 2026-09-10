// W2.6b — bake the app's datasets from SAP-shaped data.
//
//   npm run dataset:build
//
// This starts the fake CPI gateway, reads every SAP set it needs THROUGH THE
// REAL CLIENT (token, double envelope, OData v2 parsing, paging and all), runs
// the initiative mappers, and writes the result as JSON the app imports.
//
// So the app's data really is produced by reading SAP-shaped rows through the
// production code path — not hand-typed, and not shortcut past the client.
//
// Re-run it after regenerating synthetic data, or after pointing the gateway
// at different sources.

import { mkdirSync, writeFileSync, statSync } from "node:fs"
import { startGateway } from "../src/lib/sap/gateway/server"
import { CpiClient } from "../src/lib/sap/client/client"
import { extract } from "../src/lib/sap/paging/paginate"
import { loadPlatform } from "../src/lib/sap/mapping/platform-source"
import { mapRecommendation } from "../src/lib/sap/mapping/initiative-7"
import { mapRepairChain } from "../src/lib/sap/mapping/initiative-8"
import { mapLedgerLine } from "../src/lib/sap/mapping/initiative-13"
import type { SapRow } from "../src/lib/sap/client/decode-row"

/**
 * How many recommendations to bake into the app. The generator produces one
 * per material (~2,000), which is far more than the UI was built to display
 * and would ship megabytes to the browser. This keeps the app responsive; the
 * full set is always available through the gateway at runtime.
 */
const RECOMMENDATION_LIMIT = Number(process.env.RECOMMENDATION_LIMIT ?? 200)

const OUT = {
  recommendations: "./src/features/initiative-7/data/generated/recommendations.json",
  ledger: "./src/features/initiative-13/data/generated/ledger.json",
  repairChains: "./src/features/initiative-8/data/generated/repair-chains.json",
}

const started = await startGateway({ simulateEmptySets: true, simulateBrokenCount: true })
const client = new CpiClient({
  config: {
    baseUrl: started.baseUrl,
    tokenUrl: `${started.baseUrl}/oauth/token`,
    clientId: "build",
    clientSecret: "build",
    cpiPath: "/http/SAPECC/OdataConsumption",
    pageSize: 1000,
  },
})

async function readAll(entitySet: string): Promise<SapRow[]> {
  const result = await extract(client, entitySet)
  if (result.truncated) throw new Error(`${entitySet} extraction hit a safety ceiling — dataset would be incomplete`)
  return result.rows
}

console.log("Reading SAP sets through the client...")
const [materials, materialPlants, descriptions, stock, purchaseOrders, purchaseOrderItems, vendors, reservations] =
  await Promise.all([
    readAll("MaterialSet"),
    readAll("MaterialPlantSet"),
    readAll("MaterialDescriptionSet"),
    readAll("StorageLocationStockSet"),
    readAll("PurchaseOrderSet"),
    readAll("PurchaseOrderItemSet"),
    readAll("VendorSet"),
    // Empty against live SAP and against the gateway's default simulation
    // (§1.3) — read anyway, so the day it has rows the dataset picks them up.
    readAll("ReservationItemSet"),
  ])

const key = (row: SapRow, ...fields: string[]) => fields.map((f) => String(row[f] ?? "")).join("|")

const materialsByMatnr = new Map(materials.map((m) => [String(m.Matnr), m]))
const plantsByKey = new Map(materialPlants.map((p) => [key(p, "Matnr", "Werks"), p]))
const descriptionByMatnr = new Map(descriptions.map((d) => [String(d.Matnr), String(d.Maktx ?? "")]))
const purchaseOrdersByEbeln = new Map(purchaseOrders.map((p) => [String(p.Ebeln), p]))
const poItemsByKey = new Map(purchaseOrderItems.map((i) => [key(i, "Ebeln", "Ebelp"), i]))
const vendorsByLifnr = new Map(vendors.map((v) => [String(v.Lifnr), v]))
const reservationsByKey = new Map(reservations.map((r) => [key(r, "Rsnum", "Rspos"), r]))

const stockOnHand = new Map<string, number>()
for (const row of stock) {
  const k = key(row, "Matnr", "Werks")
  stockOnHand.set(k, (stockOnHand.get(k) ?? 0) + Number(row.Labst ?? 0))
}

console.log(
  `  ${materials.length} materials, ${materialPlants.length} material-plants, ` +
    `${purchaseOrderItems.length} PO items, ${reservations.length} reservations`
)

// ---- Initiative 7 ----
const recommendationRows = loadPlatform("inventory_recommendations")
const approvals = loadPlatform("approvals")
const recommendations = recommendationRows.slice(0, RECOMMENDATION_LIMIT).map((row) =>
  mapRecommendation(row, {
    recommendations: recommendationRows,
    materials: materialsByMatnr,
    materialPlants: plantsByKey,
    descriptions: descriptionByMatnr,
    approvals,
  })
)

// ---- Initiative 8 ----
const repairCases = loadPlatform("repair_cases")
const attestations = loadPlatform("repair_attestations")
const repairChains = repairCases.map((row) =>
  mapRepairChain(row, {
    cases: repairCases,
    attestations,
    materialPlants: plantsByKey,
    descriptions: descriptionByMatnr,
    purchaseOrders: purchaseOrdersByEbeln,
    vendors: vendorsByLifnr,
    purchaseOrderItems: poItemsByKey,
    stockOnHand,
  })
)

// ---- Initiative 13 ----
const plans = loadPlatform("consumption_plans")
const utilisation = new Map(loadPlatform("utilisation_status").map((r) => [`${r.Rsnum}|${r.Rspos}`, r]))
const exceptions = loadPlatform("exceptions")
const ledger = plans.map((plan) =>
  mapLedgerLine(plan, {
    plans,
    utilisation,
    exceptions,
    descriptions: descriptionByMatnr,
    reservations: reservationsByKey,
  })
)

for (const [name, path, rows] of [
  ["recommendations", OUT.recommendations, recommendations],
  ["repair chains", OUT.repairChains, repairChains],
  ["ledger lines", OUT.ledger, ledger],
] as const) {
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true })
  // One row per line: compact enough not to bloat the repo, still diffable.
  writeFileSync(path, "[\n" + rows.map((row) => JSON.stringify(row)).join(",\n") + "\n]\n")
  const kb = Math.round(statSync(path).size / 1024)
  console.log(`  ${String(rows.length).padStart(5)} ${name.padEnd(14)} -> ${path} (${kb} KB)`)
}

started.server.close()
console.log("\nDone. These files are generated — do not edit them by hand.")
