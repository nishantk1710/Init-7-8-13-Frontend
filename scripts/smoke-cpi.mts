// W2.2 — CPI connectivity smoke test.
//
//   npm run smoke:cpi
//
// THIS IS THE FIRST COMMAND TO RUN ON AZURE DAY. It answers, in about a
// minute, whether our code running inside Azure can reach CPI at all — and if
// not, which step failed. Without it, that question costs half a day of
// guessing about firewalls, private endpoints, TLS inspection and IP
// allow-lists.
//
// It doubles as a live re-verification of every known condition in
// docs-eng/WS2_INTEGRATION_PLAN.md §1, so W2.7 stops being a scheduled event
// and becomes a command anyone can run.
//
// Configuration comes from the environment:
//   CPI_BASE_URL, CPI_TOKEN_URL, CPI_CLIENT_ID, CPI_CLIENT_SECRET
// Point those at the fake gateway to run it offline (see npm run gateway).

import { connect } from "node:tls"
import { readFileSync, existsSync } from "node:fs"
import { CpiClient } from "../src/lib/sap/client/client"
import { loadCpiConfig } from "../src/lib/sap/client/config"
import { TokenProvider } from "../src/lib/sap/client/token"
import { extract } from "../src/lib/sap/paging/paginate"
import { parseEdmx } from "../src/lib/sap/contract/edmx"
import { compareContracts, describeDifference } from "../src/lib/sap/contract/compare"
import { SAP_CONTRACT } from "../src/lib/sap/contract/generated-contract"
import {
  COUNT_BROKEN_SETS,
  DISMM_VALUE_DOMAIN,
  EMPTY_SETS,
  EXPECTED_ABSENT_PROPERTIES,
} from "../src/lib/sap/contract/known-conditions"

// Load a .env file if one is around, so this works the same way cpi_discovery.py does.
for (const candidate of [".env", "data-generator/.env"]) {
  if (!existsSync(candidate)) continue
  for (const line of readFileSync(candidate, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const [key, ...rest] = trimmed.split("=")
    if (rest.length && !process.env[key.trim()]) process.env[key.trim()] = rest.join("=").trim()
  }
  break
}

type Outcome = "ok" | "changed" | "failed"

interface StepResult {
  step: string
  outcome: Outcome
  detail: string
}

const results: StepResult[] = []

/** A step reports either a plain "ok" detail string, or an explicit outcome. */
type StepReturn = string | { outcome: Outcome; detail: string }

function record(step: string, outcome: Outcome, detail: string) {
  const icon = outcome === "ok" ? "  ok  " : outcome === "changed" ? "CHANGED" : "FAILED"
  console.log(`${icon}  ${step}${detail ? ` — ${detail}` : ""}`)
  results.push({ step, outcome, detail })
}

async function step(name: string, run: () => Promise<StepReturn>): Promise<void> {
  try {
    const result = await run()
    if (typeof result === "string") record(name, "ok", result)
    else record(name, result.outcome, result.detail)
  } catch (error) {
    record(name, "failed", (error as Error).message)
  }
}

const config = loadCpiConfig()
const client = new CpiClient({ config })

console.log(`CPI smoke test against ${config.baseUrl}\n`)

// ---- 1. Token ----------------------------------------------------------
await step("1. fetch an OAuth token", async () => {
  const tokens = new TokenProvider(config)
  await tokens.getToken()
  // Never print the token itself — only when it expires.
  return `expires ${new Date(tokens.expiryTimestamp).toISOString()}`
})

// Everything below needs a token. Without one, each step would fail for the
// same reason and bury the actual cause under a dozen consequences.
if (results[0].outcome === "failed") {
  console.log("\nFAILED at: 1. fetch an OAuth token")
  console.log(`  ${results[0].detail}`)
  console.log("\nNothing else can run without a token. Check CPI_CLIENT_ID / CPI_CLIENT_SECRET /")
  console.log("CPI_TOKEN_URL, and whether this host is allowed to reach the token endpoint at all.")
  process.exit(1)
}

// ---- 2. $metadata for both services ------------------------------------
const EXPECTED_METADATA_BYTES: Record<string, number> = {
  ZVZI_KPI02_SHARED_SRV: 37_834,
  ZMM_KPI02_SRV: 19_129,
}
const metadataXml: Record<string, string> = {}

for (const [service, expectedBytes] of Object.entries(EXPECTED_METADATA_BYTES)) {
  await step(`2. $metadata ${service}`, async () => {
    const xml = await client.metadata(service)
    metadataXml[service] = xml
    const drift = Math.abs(xml.length - expectedBytes) / expectedBytes
    // A large deviation is itself a signal, even before parsing.
    if (drift > 0.1) throw new Error(`${xml.length} bytes, expected ~${expectedBytes} (${(drift * 100).toFixed(0)}% off)`)
    return `${xml.length} bytes (expected ~${expectedBytes})`
  })
}

// ---- 3 & 4. Read a page, then prove paging ------------------------------
await step("3. read one page of MaterialSet", async () => {
  const page = await client.read("MaterialSet", { query: "$top=10&$orderby=Matnr" })
  if (page.status === "empty") throw new Error("MaterialSet returned no rows — it should have thousands")
  return `${page.rows.length} rows`
})

await step("4. read two pages, proving paging works", async () => {
  const first = await client.read("MaterialSet", { query: "$top=10&$orderby=Matnr" })
  const second = await client.read("MaterialSet", { query: "$top=10&$skip=10&$orderby=Matnr" })
  const firstIds = new Set(first.rows.map((r) => String(r.Matnr)))
  const overlap = second.rows.filter((r) => firstIds.has(String(r.Matnr)))
  if (second.rows.length === 0) throw new Error("second page was empty")
  if (overlap.length > 0) throw new Error(`${overlap.length} rows appeared on both pages — paging is not stable`)
  return `${first.rows.length} + ${second.rows.length} rows, no overlap`
})

// ---- 5. Where did we actually connect, and to what certificate? ---------
await step("5. resolved endpoint and TLS issuer", async () => {
  const url = new URL(config.baseUrl)
  if (url.protocol !== "https:") {
    // Expected when pointed at the local fake gateway. Say so; do not fail.
    return `${url.hostname}:${url.port || 80} over ${url.protocol} — no TLS (fake gateway)`
  }
  const issuer = await new Promise<string>((resolve, reject) => {
    const socket = connect(
      { host: url.hostname, port: Number(url.port || 443), servername: url.hostname },
      () => {
        const cert = socket.getPeerCertificate()
        socket.end()
        // Certificate DN fields can be repeated, so node types them as string | string[].
        const field = cert?.issuer?.O ?? cert?.issuer?.CN
        resolve(Array.isArray(field) ? field.join(", ") : (field ?? "unknown issuer"))
      }
    )
    socket.on("error", reject)
    socket.setTimeout(15_000, () => {
      socket.destroy()
      reject(new Error("TLS connection timed out — check firewall / private endpoint rules"))
    })
  })
  return `${url.hostname} — certificate issued by ${issuer}`
})

// ---- 6. Known conditions: is §1 still true? -----------------------------
for (const entitySet of COUNT_BROKEN_SETS) {
  await step(`6a. $count still broken on ${entitySet}`, async () => {
    const count = await client.count(entitySet)
    if (count !== null) {
      // Good news, but it changes W2.3's routing — say so loudly.
      return {
        outcome: "changed",
        detail: `NOW WORKS, returned ${count}. Set this set's countMode to "counted" in lib/sap/paging/config.ts.`,
      }
    }
    return "still returns a server error, as expected"
  })
}

for (const entitySet of EMPTY_SETS) {
  await step(`6b. ${entitySet} still empty`, async () => {
    const count = await client.count(entitySet)
    if (count === null) return "count unavailable"
    if (count > 0) {
      return { outcome: "changed", detail: `NOW HAS ${count} ROWS — the §1.3 blocker is lifting.` }
    }
    return "still zero rows (§1.3 blocker)"
  })
}

await step("6c. Dismm value distribution", async () => {
  const result = await extract(client, "MaterialPlantSet", { select: ["Dismm"], pageSize: 1000 })
  const tally = new Map<string, number>()
  for (const row of result.rows) {
    const value = String(row.Dismm ?? "")
    tally.set(value, (tally.get(value) ?? 0) + 1)
  }
  const unexpected = [...tally.keys()].filter((v) => !(DISMM_VALUE_DOMAIN as readonly string[]).includes(v))
  const summary = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => `${value || "(blank)"}=${count}`)
    .join(" ")

  if (unexpected.length > 0) {
    return {
      outcome: "changed",
      detail: `NEW MRP TYPE(S) ${JSON.stringify(unexpected)} — the OAR rule may be incomplete. Take it to the team lead. ${summary}`,
    }
  }
  return summary
})

for (const { entitySet, property } of EXPECTED_ABSENT_PROPERTIES) {
  await step(`6d. ${entitySet}.${property} still not exposed`, async () => {
    const contract = SAP_CONTRACT[entitySet]
    const service = contract?.service
    const xml = service ? metadataXml[service] : undefined
    if (!xml) throw new Error(`no $metadata captured for ${entitySet}`)
    const parsed = parseEdmx(xml, service!)
    const exists = parsed[entitySet]?.properties.some((p) => p.name === property)
    if (exists) {
      return {
        outcome: "changed",
        detail: "NOW EXPOSED — good news. The config behind it can be switched on, and its known-condition entry updated.",
      }
    }
    return "still absent, as expected"
  })
}

// ---- 7. Contract drift --------------------------------------------------
await step("7. contract drift against the checked-in baseline", async () => {
  if (Object.keys(metadataXml).length < 2) {
    // Missing metadata is a read failure, already reported at step 2. Calling
    // it "drift" here would blame SAP for our own inability to reach it.
    throw new Error("$metadata could not be read, so drift cannot be assessed — see step 2")
  }
  const parsed = Object.entries(metadataXml).reduce(
    (all, [service, xml]) => ({ ...all, ...parseEdmx(xml, service) }),
    {}
  )
  const differences = compareContracts(SAP_CONTRACT, parsed, { checkForRemovedSets: true })
  if (differences.length > 0) {
    record(
      "7. contract drift",
      "changed",
      `${differences.length} change(s):\n        ${differences.map(describeDifference).join("\n        ")}` +
        `\n        Run: npm run contract:generate, then review the git diff.`
    )
    return `${differences.length} differences`
  }
  return "no drift — $metadata matches the contract exactly"
})

// ---- Verdict ------------------------------------------------------------
const failed = results.filter((r) => r.outcome === "failed")
const changed = results.filter((r) => r.outcome === "changed")

console.log("")
if (failed.length > 0) {
  console.log(`FAILED at: ${failed.map((r) => r.step).join(", ")}`)
  process.exit(1)
}
if (changed.length > 0) {
  console.log(`Reachable, but ${changed.length} known condition(s) CHANGED:`)
  for (const item of changed) console.log(`  - ${item.step}: ${item.detail}`)
  console.log("\nA change is not a failure — but it means a config or a plan assumption needs updating.")
  process.exit(0)
}
console.log("All steps passed, and every known condition is unchanged.")
