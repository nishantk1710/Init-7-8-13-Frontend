// W2.6b — read the platform-owned generated data.
//
// The split matters: `generated/sap/` is data SAP produces and we consume;
// `generated/platform/` is data THIS system owns (recommendations, repair
// cases, consumption plans, approvals). A view model is almost always a join
// of the two, and confusing which side owns a field is how you end up asking
// SAP for something it will never have.
//
// Node-only, like the gateway's CSV source.

import { existsSync, readFileSync } from "node:fs"

const GENERATED_PLATFORM = "./data-generator/generated/platform"

export type PlatformRow = Record<string, string>

export type PlatformFile =
  | "inventory_recommendations"
  | "approvals"
  | "consumption_plans"
  | "utilisation_status"
  | "repair_cases"
  | "repair_attestations"
  | "exceptions"

const cache = new Map<string, PlatformRow[]>()

export function loadPlatform(file: PlatformFile): PlatformRow[] {
  const cached = cache.get(file)
  if (cached) return cached

  const path = `${GENERATED_PLATFORM}/${file}.csv`
  if (!existsSync(path)) throw new Error(`Missing platform data file: ${path}. Run data-generator/generate.py.`)

  const text = readFileSync(path, "utf-8").trim()
  const lines = text.split(/\r?\n/)
  const header = splitCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    return Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""]))
  })

  cache.set(file, rows)
  return rows
}

export function clearPlatformCache(): void {
  cache.clear()
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      cells.push(current)
      current = ""
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}
