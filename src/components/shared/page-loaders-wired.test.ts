import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8")
const F = "features/initiative-7"
const SKELETONS = `from "@/${F}/components/skeletons"`

describe("every Inventory Planning page opens with a skeleton in its own shape", () => {
  it.each([
    ["inventory-planning", "OverviewSkeleton"],
    ["inventory-planning/recommendations", "RecommendationsSkeleton"],
    ["inventory-planning/recommendations/[id]", "RecommendationDetailSkeleton"],
    ["inventory-planning/pipeline", "PipelineSkeleton"],
    ["inventory-planning/adoption", "AdoptionSkeleton"],
    ["inventory-planning/reports", "ReportsSkeleton"],
    ["inventory-planning/calculation", "CalculationSkeleton"],
    ["inventory-planning/criticality-reports", "CriticalityReportsSkeleton"],
  ])("the %s route has a loading.tsx that renders %s, so a click in the sidebar shows that shape at once", (route, name) => {
    const src = read(`app/(live)/${route}/loading.tsx`)
    expect(src).toContain(SKELETONS)
    expect(src).toContain(`<${name} />`)
    expect(src).toContain("export default function Loading")
  })

  it.each([
    [`${F}/components/live-overview-workspace.tsx`, "OverviewSkeletonBody"],
    [`${F}/components/recommendations-workspace.tsx`, "RecommendationsTableSkeleton"],
    [`${F}/components/min-max-to-oar-workspace.tsx`, "RecommendationsTableSkeleton"],
    [`${F}/components/min-max-to-oar-detail.tsx`, "ConsumptionChartSkeleton"],
    [`${F}/components/live-pipeline-workspace.tsx`, "PipelineSkeletonBody"],
    [`${F}/components/live-pipeline-workspace.tsx`, "PipelineTableSkeleton"],
    [`${F}/components/adoption-tracking-workspace.tsx`, "AdoptionSkeletonBody"],
    [`${F}/components/quarterly-reports-workspace.tsx`, "ReportSkeletonBody"],
    [`${F}/pages/kpi-formulas-page.tsx`, "CalculationSkeletonBody"],
    [`${F}/pages/recommendations-page.tsx`, "RecommendationsSkeletonBody"],
    [`${F}/pages/recommendation-detail-page.tsx`, "RecommendationDetailSkeleton"],
  ])("%s shows %s for its first load -- the same shape as the route's loading screen, not the hourglass", (rel, name) => {
    const src = read(rel)
    expect(src).toContain(SKELETONS)
    expect(src).toContain(`<${name}`)
    expect(src).not.toContain("PageLoader")
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
