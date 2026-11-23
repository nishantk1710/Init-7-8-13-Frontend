"use client"

import { FilterInfoPopup, type FilterInfoItem } from "@/features/initiative-7/components/filter-info-popup"

/** The three grades, in the order the Recommendation Confidence dropdown lists them. The numbers are the policy
 * defaults (`ConfidencePolicy` in the backend: 5 and 0.80 for High, 3 and 0.60 for Medium). */
const CONFIDENCE_INFO: readonly FilterInfoItem[] = [
  {
    name: "High",
    tag: "5+ similar materials, best match above 0.80",
    definition: "Many close matches. The estimate rests on solid evidence.",
    example: "6 similar materials, best match 0.88",
    tone: "success",
  },
  {
    name: "Medium",
    tag: "3+ similar materials, best match 0.60 or more",
    definition: "A fair number of reasonable matches, but not enough to be called High.",
    example: "4 similar materials, best match 0.72",
    tone: "warning",
  },
  {
    name: "Low",
    tag: "Fewer than 3 similar materials, or best match below 0.60",
    definition: "Thin evidence. Review the estimate with extra care.",
    example: "1 similar material, best match 0.97",
    tone: "danger",
  },
]

/** The (i) icon beside the Recommendation Confidence filter (OAR recommendations only). */
export function ConfidenceInfo() {
  return (
    <FilterInfoPopup
      title="Recommendation confidence"
      description="How much an OAR recommendation can be trusted. It is sized from similar materials, so confidence depends on how many there are and how close the best match is."
      triggerLabel="What does recommendation confidence mean?"
      items={CONFIDENCE_INFO}
      footnote="A match score runs from 0 to 1; closer to 1 is more alike. Confidence counts evidence, not just closeness: a single near-perfect match (0.97) is still Low, because one material is not enough to set a stocking level. The examples are illustrative."
    />
  )
}
