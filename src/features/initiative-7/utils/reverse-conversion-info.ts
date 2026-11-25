// The words behind the (i) buttons on the Min-Max to OAR filters: Category, Reason and Lead time.
//
// Pure data builders, so they are tested without a browser; the popup that shows them is
// components/min-max-to-oar-info.tsx (the same FilterInfoPopup the Demand Pattern button uses).
//
// Every number in a sentence is read from the policy the backend returned (the same `parameters` the "How these
// were generated" section shows), so an explanation can never disagree with what was applied. Until a response has
// arrived, the approved values below stand in.

import type { FilterInfoItem } from "@/features/initiative-7/components/filter-info-popup"
import { REVERSE_CATEGORIES, REVERSE_CONFIDENCES, REVERSE_LEAD_TIME_BUCKETS, REVERSE_REASONS } from "@/features/initiative-7/types/reverse-conversion"

export type PolicyParameters = Record<string, unknown>

/** The approved policy values (reverse-conversion-v1): the fallback while the first response is on its way. */
export const APPROVED_POLICY_PARAMETERS = {
  window_months: 12,
  zero_use_window_months: 24,
  minimum_history_span_months: 12,
  maximum_lead_time_days: 90,
  recommended_max_issues: 2,
  recommended_max_months: 2,
  maximum_months_since_last_movement: 9,
  frequent_issues_above: 4,
  frequent_months_above: 4,
  new_material_age_months: 24,
  new_material_minimum_lifetime_months: 3,
} as const

type Key = keyof typeof APPROVED_POLICY_PARAMETERS

function n(parameters: PolicyParameters | undefined, key: Key): number {
  const value = parameters?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : APPROVED_POLICY_PARAMETERS[key]
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

function label(list: readonly { code: string; label: string }[], code: string): string {
  return list.find((entry) => entry.code === code)?.label ?? code
}

/** The category a reason belongs to, as the screen names it (used as the tag on a reason). */
const CONVERT = label(REVERSE_CATEGORIES, "recommended_for_oar")
const NOT_ELIGIBLE = label(REVERSE_CATEGORIES, "not_eligible")

// --- Category --------------------------------------------------------------------------------------------

/** The categories, in the order the Category dropdown lists them. */
export function categoryInfoItems(parameters?: PolicyParameters): FilterInfoItem[] {
  const issues = n(parameters, "recommended_max_issues")
  const months = n(parameters, "recommended_max_months")
  const recency = n(parameters, "maximum_months_since_last_movement")
  const frequentIssues = n(parameters, "frequent_issues_above")
  const frequentMonths = n(parameters, "frequent_months_above")
  const window = n(parameters, "window_months")
  const zeroUse = n(parameters, "zero_use_window_months")
  return [
    {
      name: label(REVERSE_CATEGORIES, "recommended_for_oar"),
      tag: "High, Medium or Low confidence",
      definition:
        `Could be ordered only when needed instead of held on a reorder point. High confidence: used only a few times in the last ${window} months ` +
        `(at most ${plural(issues, "issue")} and ${plural(months, "month")} with use) and last used within ${plural(recency, "month")}. ` +
        `Medium or Low: a planner evaluates it, because it has no use in ${zeroUse} months, is borderline, or something the rule needs is missing. ` +
        "The Reason column says which.",
      example: `1 issue in 1 month, last used 3 months ago (High)`,
      tone: "success",
    },
    {
      name: label(REVERSE_CATEGORIES, "not_eligible"),
      tag: "Stays on Min-Max",
      definition: `Used often (more than ${plural(frequentIssues, "issue")}), too critical to risk, or too little history to judge. It stays as it is.`,
      example: `${frequentIssues + 2} issues in ${frequentMonths + 1} months`,
      tone: "neutral",
    },
  ]
}

// --- Reason ----------------------------------------------------------------------------------------------

const REASON_TONE: Record<string, FilterInfoItem["tone"]> = {
  [CONVERT]: "success",
  [NOT_ELIGIBLE]: "neutral",
}

/** Every reason a row can carry, in the order the Reason dropdown lists them, each tagged with its category. */
export function reasonInfoItems(parameters?: PolicyParameters): FilterInfoItem[] {
  const issues = n(parameters, "recommended_max_issues")
  const months = n(parameters, "recommended_max_months")
  const recency = n(parameters, "maximum_months_since_last_movement")
  const frequentIssues = n(parameters, "frequent_issues_above")
  const frequentMonths = n(parameters, "frequent_months_above")
  const window = n(parameters, "window_months")
  const zeroUse = n(parameters, "zero_use_window_months")
  const history = n(parameters, "minimum_history_span_months")
  const leadTime = n(parameters, "maximum_lead_time_days")
  const newAge = n(parameters, "new_material_age_months")
  const newMin = n(parameters, "new_material_minimum_lifetime_months")

  const detail: Record<string, { category: string; definition: string; example: string }> = {
    sparse_recurring_demand: {
      category: CONVERT,
      definition: `Used only a few times in the last ${window} months (at most ${plural(issues, "issue")}, in at most ${plural(months, "month")}), and used recently. High confidence.`,
      example: "2 issues in 2 months, last used 3 months ago",
    },
    unknown_criticality: {
      category: CONVERT,
      definition: "No criticality is recorded. It is never read as Normal, so a planner has to evaluate it manually. Low confidence.",
      example: "Criticality blank in SAP",
    },
    lead_time: {
      category: CONVERT,
      definition: `The delivery time is not known, or is longer than ${plural(leadTime, "day")}, so waiting to order may be too slow. A planner evaluates it manually. Low confidence.`,
      example: `Lead time ${leadTime + 30} days`,
    },
    lapsed: {
      category: CONVERT,
      definition: `No issues in the last ${window} months, but it was used before. A planner decides whether the demand has stopped. Medium confidence.`,
      example: "Last used 15 months ago",
    },
    borderline_frequency: {
      category: CONVERT,
      definition: `Used more than a rare item (over ${plural(issues, "issue")} or ${plural(months, "month")}), but not often enough to stay on Min-Max for certain (up to ${frequentIssues} issues and ${frequentMonths} months). Medium confidence.`,
      example: "3 issues in 3 months",
    },
    stale_last_movement: {
      category: CONVERT,
      definition: `Its latest use was more than ${plural(recency, "month")} ago, so the demand may be fading. Medium confidence.`,
      example: `Last used ${recency + 1} months ago`,
    },
    lifetime_criterion: {
      category: CONVERT,
      definition: `A new material (first used in the last ${newAge} months) with fewer than ${plural(newMin, "month")} of use so far. Too early to tell. Medium confidence.`,
      example: "First used 8 months ago, used in 2 months so far",
    },
    inconsistent_movement: {
      category: CONVERT,
      definition:
        "The issue count and the months with consumption do not agree (for example reversals cancel the count while the quantity still moved), so the movements need checking. Low confidence.",
      example: "0 issues counted, but 1 month with consumption",
    },
    never_moved: {
      category: CONVERT,
      definition: `No issues in the last ${zeroUse} months and it has never moved. A planner evaluates it manually. Medium confidence.`,
      example: "Stocked, never issued",
    },
    zero_use_24m: {
      category: CONVERT,
      definition: `No issues in the last ${zeroUse} months, but it moved before. A planner evaluates it manually. Medium confidence.`,
      example: "Last used 30 months ago",
    },
    obsolete_criticality: {
      category: CONVERT,
      definition:
        "SAP classifies the material as Obsolete: no longer needed in operation. Ordering it only when required is a natural fit, " +
        "but a planner must first decide whether the stock should be kept or disposed of. Medium confidence.",
      example: "Criticality OBSOLETE",
    },
    protected_criticality: {
      category: NOT_ELIGIBLE,
      definition: "Criticality CRITICAL, IMPACT or INSURANCE. These always stay on Min-Max.",
      example: "Criticality CRITICAL",
    },
    frequent_consumption: {
      category: NOT_ELIGIBLE,
      definition: `More than ${plural(frequentIssues, "issue")} or more than ${plural(frequentMonths, "month")} with consumption in the last ${window} months. Frequent use keeps it on Min-Max.`,
      example: `${frequentIssues + 2} issues in ${frequentMonths + 1} months`,
    },
    insufficient_history: {
      category: NOT_ELIGIBLE,
      definition: `Fewer than ${plural(history, "month")} between its first and latest consumption, which is not enough to judge.`,
      example: `First and latest use ${history - 4} months apart`,
    },
  }

  return REVERSE_REASONS.map(({ code, label: name }) => {
    const entry = detail[code]
    return { name, tag: entry.category, definition: entry.definition, example: entry.example, tone: REASON_TONE[entry.category] ?? "neutral" }
  })
}

// --- Lead time -------------------------------------------------------------------------------------------

/** The five lead-time buckets, in the order the Lead time dropdown lists them. */
export function leadTimeInfoItems(parameters?: PolicyParameters): FilterInfoItem[] {
  const limit = n(parameters, "maximum_lead_time_days")
  const accepted = (days: string) => ({
    tag: "No extra restriction",
    definition: `Delivered within the ${limit} days the rule accepts. A rarely used material here can be converted like any other.`,
    example: days,
    tone: "success" as const,
  })
  const byBucket: Record<string, Omit<FilterInfoItem, "name">> = {
    "0-30d": accepted("Lead time 21 days"),
    "31-60d": accepted("Lead time 45 days"),
    "61-90d": accepted(`Lead time ${Math.min(limit, 80)} days`),
    ">90d": {
      tag: "Low confidence",
      definition: `A long wait (over ${limit} days) after ordering. A planner checks whether ordering only when needed is realistic.`,
      example: `Lead time ${limit + 30} days`,
      tone: "warning",
    },
    unknown: {
      tag: "Low confidence",
      definition: "No planned delivery time is recorded in SAP (or it is zero), so the wait cannot be judged.",
      example: "Planned delivery time blank",
      tone: "warning",
    },
  }
  return REVERSE_LEAD_TIME_BUCKETS.map(({ code, label: name }) => ({ name, ...byBucket[code] }))
}

// --- Confidence ------------------------------------------------------------------------------------------

/** The three confidence levels, most confident first, with what puts a Convert to OAR material at each. */
export function confidenceInfoItems(parameters?: PolicyParameters): FilterInfoItem[] {
  const issues = n(parameters, "recommended_max_issues")
  const months = n(parameters, "recommended_max_months")
  const window = n(parameters, "window_months")
  const zeroUse = n(parameters, "zero_use_window_months")
  const leadTime = n(parameters, "maximum_lead_time_days")
  const detail: Record<string, Omit<FilterInfoItem, "name">> = {
    high: {
      tag: "Pattern fits OAR",
      definition: `Used only a few times in the last ${window} months (at most ${plural(issues, "issue")} and ${plural(months, "month")} with use) and used recently. The demand itself says ordering only when needed is enough.`,
      example: "Sparse recurring demand",
      tone: "success",
    },
    medium: {
      tag: "A planner evaluates it",
      definition: `The pattern is borderline or quiet: no issues in ${zeroUse} months, used before but not in the last ${window}, between rare and frequent use, a stale last movement, or too few months of use for a new material.`,
      example: `Zero issues in ${zeroUse} months but moved previously`,
      tone: "warning",
    },
    low: {
      tag: "Something is missing",
      definition: `An input the rule needs is missing or contradictory: criticality unknown, lead time unknown or over ${plural(leadTime, "day")}, or movement data that disagrees with itself. Check it before converting.`,
      example: "Unknown criticality",
      tone: "danger",
    },
  }
  return REVERSE_CONFIDENCES.map(({ code, label: name }) => ({ name, ...detail[code] }))
}

/** The note under the lead-time popup: where the figure comes from, and what the rule's issue cap means over it. */
export function leadTimeFootnote(parameters?: PolicyParameters): string {
  const issues = n(parameters, "recommended_max_issues")
  const limit = n(parameters, "maximum_lead_time_days")
  const expected = ((issues * limit) / 365).toFixed(2)
  return (
    "Lead time is SAP's planned delivery time, not the time deliveries actually took. " +
    `At most ${plural(issues, "issue")} a year means about ${expected} expected issues during even a ${limit}-day wait, which is why up to ${limit} days needs no extra restriction.`
  )
}
