import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { columnTitle } from "@/features/initiative-13/components/ui/column-head"
import { COLUMN_SOURCES } from "@/features/initiative-13/data/column-sources"

const COMPONENTS = join(process.cwd(), "src/features/initiative-13/components")

describe("column sources", () => {
  it("every OAR Utilization column heading says where its value comes from", () => {
    // A plain <TableHead> with a label has no source on hover. Only the
    // label-less details column (screen-reader text) may stay plain.
    const plain = readdirSync(COMPONENTS)
      .filter((file) => file.endsWith(".tsx"))
      .flatMap((file) =>
        [...readFileSync(join(COMPONENTS, file), "utf8").matchAll(/<TableHead\b[^>]*>([\s\S]*?)<\/TableHead>/g)]
          .filter((m) => !m[1].includes("sr-only"))
          .map((m) => `${file}: ${m[1].trim()}`)
      )
    expect(plain).toEqual([])
  })

  it("names an SAP table-field, a calculation, or Spares AI -- never nothing", () => {
    for (const text of Object.values(COLUMN_SOURCES)) {
      expect(text).toMatch(/^(SAP: |Calculated|Spares AI: )/)
    }
  })

  it("keeps a column's own explanation first, then the source", () => {
    expect(columnTitle("required")).toBe("SAP: RESB-BDTER (requirement date)")
    expect(columnTitle("required", "Requirement date")).toBe("Requirement date\n\nSAP: RESB-BDTER (requirement date)")
  })
})
