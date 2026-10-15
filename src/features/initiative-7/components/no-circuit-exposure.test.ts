// The Overview and the Quarterly Report no longer show the "Critical circuit exposure" chart or the
// Overview's Circuit filter. These read the page sources, the same way no-leakage.test.ts guards the
// scope rule, so the chart cannot drift back in through a merge.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const DIR = join(process.cwd(), "src/features/initiative-7/components")
const read = (file: string) => readFileSync(join(DIR, file), "utf8")

describe("circuit exposure is removed from the live pages", () => {
  for (const file of ["live-overview-workspace.tsx", "quarterly-reports-workspace.tsx", "report-print-view.tsx"]) {
    it(`${file} does not render the circuit exposure chart`, () => {
      const source = read(file)
      expect(source).not.toContain("CircuitExposureChart")
      expect(source).not.toContain("Critical circuit exposure")
    })
  }

  it("the Overview's filter rail has the Circuit filter switched off", () => {
    expect(read("live-overview-workspace.tsx")).toContain("showCircuitFilter={false}")
  })

  it("the Overview no longer filters its rows by circuit", () => {
    expect(read("live-overview-workspace.tsx")).not.toContain("filters.circuit")
  })
})
