"use client"

import { FilterInfoPopup } from "@/features/initiative-7/components/filter-info-popup"
import {
  categoryInfoItems,
  confidenceInfoItems,
  leadTimeFootnote,
  leadTimeInfoItems,
  reasonInfoItems,
  type PolicyParameters,
} from "@/features/initiative-7/utils/reverse-conversion-info"

// The (i) buttons beside the Category, Reason and Lead time filters of the Min-Max to OAR view -- the same popup the
// Demand Pattern filter uses. `parameters` is the policy the backend returned (undefined until the first response),
// so every number in the text is the one that was actually applied.

/** The (i) beside the Category filter: the groups and what puts a material in each. */
export function CategoryInfo({ parameters }: { parameters?: PolicyParameters }) {
  return (
    <FilterInfoPopup
      title="Categories"
      description="Every Min-Max material (VM or VB) at plants 1300 and 1500 lands in exactly one of three groups, per plant."
      triggerLabel="What do the categories mean?"
      items={categoryInfoItems(parameters)}
      footnote="The rules are checked from the top and the first one that fits decides the group. This is a suggestion only: nothing is changed in SAP. Stock value only orders the list inside a group; it never decides the group, and a material with no stock or no price stays in the list."
    />
  )
}

/** The (i) beside the Confidence filter: how sure the rule is about a Convert to OAR material. */
export function ConfidenceInfo({ parameters }: { parameters?: PolicyParameters }) {
  return (
    <FilterInfoPopup
      title="Confidence"
      description="How sure the rule is that a Convert to OAR material should be ordered only when needed. Only Convert to OAR materials have one."
      triggerLabel="What does confidence mean?"
      items={confidenceInfoItems(parameters)}
      footnote="Medium and Low mean a planner evaluates the material manually. The Reason column says exactly what to check."
    />
  )
}

/** The (i) beside the Reason filter: why a material is in its group, in the order the dropdown lists them. */
export function ReasonInfo({ parameters }: { parameters?: PolicyParameters }) {
  return (
    <FilterInfoPopup
      title="Reasons"
      description="The one thing that put a material in its group. Each card shows the group it belongs to."
      triggerLabel="What do the reasons mean?"
      items={reasonInfoItems(parameters)}
      footnote="A month counts as used only when more was issued than reversed. Examples are illustrative."
    />
  )
}

/** The (i) beside the Lead time filter: the five buckets and what each means for the recommendation. */
export function LeadTimeInfo({ parameters }: { parameters?: PolicyParameters }) {
  return (
    <FilterInfoPopup
      title="Lead time"
      description="How long SAP says the material takes to arrive after it is ordered. It matters because a material ordered only when needed has to wait that long."
      triggerLabel="What does lead time mean?"
      items={leadTimeInfoItems(parameters)}
      footnote={leadTimeFootnote(parameters)}
    />
  )
}
