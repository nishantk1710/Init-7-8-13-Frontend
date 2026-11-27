import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { columnTitle } from "@/features/initiative-8/components/kit/table"
import { I08_COLUMN_SOURCES } from "@/features/initiative-8/data/column-sources"

const COMPONENTS = join(process.cwd(), "src/features/initiative-8/components")

/** The heading's visible text, tags stripped and whitespace collapsed. */
function label(inner: string): string {
  return inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

describe("column sources", () => {
  it("every I08 column heading says where its value comes from", () => {
    // A <Head> with a visible label and no `source` has nothing on hover.
    // Three headings may stay bare, and only these three:
    //   - the screen-reader-only Signals legend, which is not a label;
    //   - "#", a rank rather than a column of data, explained by the
    //     InfoPopover beside it;
    //   - New item price, whose sort button carries the source itself, so the
    //     cell does not offer a second, different tooltip.
    const bare = readdirSync(COMPONENTS)
      .filter((file) => file.endsWith(".tsx"))
      .flatMap((file) =>
        [...readFileSync(join(COMPONENTS, file), "utf8").matchAll(/<Head\b([^>]*)>([\s\S]*?)<\/Head>/g)]
          .filter(([, attributes]) => !/\bsource=/.test(attributes))
          .filter(([, , inner]) => !inner.includes("sr-only"))
          .filter(([, , inner]) => !inner.includes("columnTitle("))
          .filter(([, , inner]) => !label(inner).startsWith("#"))
          .map(([, , inner]) => `${file}: ${label(inner)}`),
      )
    expect(bare).toEqual([])
  })

  it("names an SAP table-field, a calculation, or Spares AI -- never nothing", () => {
    for (const text of Object.values(I08_COLUMN_SOURCES)) {
      expect(text).toMatch(/^(SAP: |Calculated from SAP: |Spares AI: )/)
    }
  })

  it("keeps a column's own explanation first, then the source", () => {
    expect(columnTitle("repairPo")).toBe("SAP: EKPO-EBELN / EBELP (PO / item)")
    expect(columnTitle("repairPo", "Sort by PO")).toBe("Sort by PO\n\nSAP: EKPO-EBELN / EBELP (PO / item)")
  })

  it("keeps every entry in use: a key nothing reads is a column that went", () => {
    const source = readdirSync(COMPONENTS)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(join(COMPONENTS, file), "utf8"))
      .join("\n")
    const unused = Object.keys(I08_COLUMN_SOURCES).filter((key) => !source.includes(`"${key}"`))
    expect(unused).toEqual([])
  })
})
