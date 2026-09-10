// Regenerates src/lib/sap/contract/generated-contract.ts from the committed
// discovery sweep. Run after every `cpi_discovery.py` run:
//
//   npm run contract:generate
//
// Then `git diff` the generated file — that diff IS the drift report, and it
// is how the Netpr/Netwr Edm.Decimal -> Edm.String change would have been
// caught the moment it happened.

import { readFileSync, writeFileSync } from "node:fs"

const DISCOVERY = "./data-generator/discovery"
const OUTPUT = "./src/lib/sap/contract/generated-contract.ts"

function readCsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, "utf-8").trim().split(/\r?\n/)
  const header = lines[0].split(",")
  return lines.slice(1).map((line) => {
    const cells = line.split(",")
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))
  })
}

const entitySets = readCsv(`${DISCOVERY}/entity_sets.csv`)
const properties = readCsv(`${DISCOVERY}/properties.csv`)

const duplicates = entitySets
  .map((row) => row.entity_set)
  .filter((name, i, all) => all.indexOf(name) !== i)
if (duplicates.length > 0) {
  throw new Error(
    `Entity set names are not unique across services: ${duplicates.join(", ")}. ` +
      `The contract is keyed by set name, so this needs a service-qualified key instead.`
  )
}

const entries = entitySets.map((set) => {
  const setProperties = properties.filter(
    (p) => p.entity_set === set.entity_set && p.service === set.service
  )
  if (setProperties.length === 0) {
    throw new Error(`No properties found for ${set.entity_set} — is the discovery sweep complete?`)
  }
  return {
    service: set.service,
    entitySet: set.entity_set,
    entityType: set.entity_type,
    keys: set.keys ? set.keys.split(";").sort() : [],
    properties: setProperties.map((p) => ({
      name: p.property,
      type: p.type,
      nullable: p.nullable === "true",
      isKey: p.is_key === "K",
    })),
  }
})

const body = entries
  .map((entry) => {
    const props = entry.properties
      .map(
        (p) =>
          `      { name: ${JSON.stringify(p.name)}, type: ${JSON.stringify(p.type)}, ` +
          `nullable: ${p.nullable}, isKey: ${p.isKey} },`
      )
      .join("\n")
    return `  ${JSON.stringify(entry.entitySet)}: {
    service: ${JSON.stringify(entry.service)},
    entitySet: ${JSON.stringify(entry.entitySet)},
    entityType: ${JSON.stringify(entry.entityType)},
    keys: ${JSON.stringify(entry.keys)},
    properties: [
${props}
    ],
  },`
  })
  .join("\n")

const totalProperties = entries.reduce((sum, e) => sum + e.properties.length, 0)

const output = `// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run contract:generate
// Source: data-generator/discovery/{entity_sets,properties}.csv
//
// ${entries.length} entity sets, ${totalProperties} properties, as measured by the
// committed discovery sweep. Checked in on purpose: this is the baseline every
// drift check compares against, and its git diff is the drift report.

import type { SapContract } from "./types"

export const SAP_CONTRACT: SapContract = {
${body}
}
`

writeFileSync(OUTPUT, output)
console.log(`Wrote ${OUTPUT}: ${entries.length} entity sets, ${totalProperties} properties.`)
