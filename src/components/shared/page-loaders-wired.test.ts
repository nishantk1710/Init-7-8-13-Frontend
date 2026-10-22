import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8")
const F = "features/initiative-7"

describe("every Inventory Planning page opens with the hourglass", () => {
  it("the route has a loading.tsx, so a refresh or a click in the sidebar shows it at once", () => {
    const src = read("app/(live)/inventory-planning/loading.tsx")
    expect(src).toContain("<PageLoader")
    expect(src).toContain("export default function Loading")
  })

  it.each([
    [`${F}/components/live-overview-workspace.tsx`],
    [`${F}/components/recommendations-workspace.tsx`],
    [`${F}/components/live-pipeline-workspace.tsx`],
    [`${F}/components/adoption-tracking-workspace.tsx`],
    [`${F}/components/quarterly-reports-workspace.tsx`],
    [`${F}/pages/recommendations-page.tsx`],
    [`${F}/pages/recommendation-detail-page.tsx`],
  ])("%s uses PageLoader for its first load", (rel) => {
    const src = read(rel)
    expect(src).toContain('from "@/components/shared/page-loader"')
    expect(src).toContain("<PageLoader")
  })

  it("the Criticality Reports upload history uses the chart ring, like the charts", () => {
    const src = read(`${F}/components/criticality-history-card.tsx`)
    expect(src).toContain('from "@/components/shared/chart-loader"')
    expect(src).toContain("<ChartLoader")
    expect(src).not.toContain("<LoadingSpinner")
  })

  it.each([
    [`${F}/components/quarterly-management-view.tsx`],
    [`${F}/components/quarterly-reports-workspace.tsx`],
  ])("%s keeps the petal spinner for a small area", (rel) => {
    expect(read(rel)).toContain("<LoadingSpinner")
  })
})
