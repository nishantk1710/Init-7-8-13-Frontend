"use client"

import { FilterInfoPopup, type FilterInfoItem } from "@/features/initiative-7/components/filter-info-popup"
import { DEMAND_PATTERNS, type DemandPattern } from "@/features/initiative-7/types/inventory"

type PatternInfo = Omit<FilterInfoItem, "name" | "example"> & {
  /** Monthly usage, oldest first. */
  example?: readonly number[]
}

export const DEMAND_PATTERN_INFO: Record<DemandPattern, PatternInfo> = {
  Smooth: {
    tag: "Frequent + Steady",
    definition: "Used almost every month, with similar quantities.",
    example: [10, 11, 9, 10, 12, 10],
    tone: "success",
  },
  Erratic: {
    tag: "Frequent + Varying",
    definition: "Used regularly, but quantities change a lot.",
    example: [2, 40, 5, 25, 1, 30],
    tone: "warning",
  },
  Intermittent: {
    tag: "Infrequent + Steady",
    definition: "Used occasionally, but quantities are similar.",
    example: [0, 5, 0, 0, 5, 0],
    tone: "info",
  },
  Lumpy: {
    tag: "Infrequent + Varying",
    definition: "Used occasionally, and quantities change significantly.",
    example: [0, 0, 30, 0, 0, 25],
    tone: "danger",
  },
  "Slow-Moving": {
    definition: "Used rarely, with very little taken overall.",
    tone: "neutral",
  },
  "Cold start": {
    definition: "Too little usage history to classify. Its figures are estimated from similar materials (OAR).",
    tone: "neutral",
  },
  Unclassified: {
    definition: "No demand pattern is available for this material.",
    tone: "neutral",
  },
}

/** The (i) icon beside the Demand Pattern filter. `patterns` is the list the dropdown shows (in its order), so the
 * popup and the dropdown always agree. */
export function DemandPatternInfo({ patterns = DEMAND_PATTERNS }: { patterns?: readonly DemandPattern[] }) {
  const items = patterns.map((name): FilterInfoItem => {
    const { example, ...rest } = DEMAND_PATTERN_INFO[name]
    return { name, ...rest, example: example?.join(", ") }
  })
  return (
    <FilterInfoPopup
      title="Demand patterns"
      description="How a material's usage behaves over time: how often it is used, and how much the quantity changes."
      triggerLabel="What do the demand patterns mean?"
      items={items}
      footnote="Examples show units used in each of six months. A pattern is worked out from the material's usage history: how often it is used, and how much the quantity varies when it is."
    />
  )
}
