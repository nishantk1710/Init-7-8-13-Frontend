// Node-only. Reads the committed discovery sweep so contract tests can run
// offline against measured reality. Never import this from app/UI code — it
// touches the filesystem and reads files that only exist in the repo.

import { readFileSync } from "node:fs"

const DISCOVERY = "./data-generator/discovery"

function readCsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, "utf-8").trim().split(/\r?\n/)
  const header = lines[0].split(",")
  return lines.slice(1).map((line) => {
    const cells = line.split(",")
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))
  })
}

/** entity set -> raw `$count` result: a number as text, or "HTTP 500". */
export function readCounts(): Record<string, string> {
  return Object.fromEntries(readCsv(`${DISCOVERY}/counts.csv`).map((row) => [row.entity_set, row.count]))
}

/** "EntitySet.Field" -> observed values with their row counts. */
export function readValueDomains(): Record<string, { value: string; count: number }[]> {
  const domains: Record<string, { value: string; count: number }[]> = {}
  for (const row of readCsv(`${DISCOVERY}/value_domains.csv`)) {
    const key = `${row.entity_set}.${row.field}`
    // The probe writes literal "(blank)" for an empty value, since CSV cannot
    // distinguish empty from absent.
    const value = row.value === "(blank)" ? "" : row.value
    ;(domains[key] ??= []).push({ value, count: Number(row.count) })
  }
  return domains
}

export function readMetadataXml(service: string): string {
  return readFileSync(`${DISCOVERY}/metadata_${service}.xml`, "utf-8")
}
