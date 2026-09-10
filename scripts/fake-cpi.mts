// Run the fake CPI gateway for local development:
//
//   npm run gateway
//
// Then point the app at it by setting, in your local env:
//   CPI_BASE_URL=http://127.0.0.1:4010
//   CPI_TOKEN_URL=http://127.0.0.1:4010/oauth/token
//   CPI_CLIENT_ID=fake
//   CPI_CLIENT_SECRET=fake
//
// It serves all 21 entity sets from data-generator/generated/sap/*.csv and
// reproduces the current live quirks on purpose. Pass --honest to switch those
// simulations off and see how things behave once SAP fixes them.

import { startGateway } from "../src/lib/sap/gateway/server"
import { availableEntitySets } from "../src/lib/sap/gateway/csv-source"
import { COUNT_BROKEN_SETS, EMPTY_SETS } from "../src/lib/sap/contract/known-conditions"

const honest = process.argv.includes("--honest")
const port = Number(process.env.GATEWAY_PORT ?? 4010)

const { baseUrl } = await startGateway({
  port,
  simulateEmptySets: !honest,
  simulateBrokenCount: !honest,
})

console.log(`Fake CPI gateway listening on ${baseUrl}`)
console.log(`  serving ${availableEntitySets().length} entity sets from data-generator/generated/sap/`)
if (honest) {
  console.log("  --honest: live quirks are NOT simulated (every $count works, no forced-empty sets)")
} else {
  console.log(`  $count returns HTTP 500 on: ${COUNT_BROKEN_SETS.join(", ")}`)
  console.log(`  forced to zero rows:        ${EMPTY_SETS.join(", ")}`)
}
console.log("\nEvery response is marked synthetic in __metadata. Nothing here is real data.")
