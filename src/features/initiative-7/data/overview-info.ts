// What each Overview card and chart explains in its (i) popup: the rule in plain words, the formula,
// and one worked example with the numbers substituted in.
//
// "real" examples are materials from the pipeline run quoted in docs/I07_Solution_Walkthrough.md
// (Appendix B); "illustrative" ones use small made-up numbers because that run held no real
// material that shows the case. The popup says which, so a client never mistakes one for the other.
// Every sum in `substitution` is checked by overview-info.test.ts.
//
// SIBX's unit (KG) was confirmed against the material master, the staged consumption and the raw
// MARA/MSEG rows on 2026-10-22. Its currency is NOT recorded (null), so the money example carries no
// currency symbol, the same as the live card does for a null currency.

import type { InfoTone } from "@/components/shared/info-popup"

export type OverviewInfoId =
  | "stockoutRisk"
  | "excessInventory"
  | "workingCapital"
  | "adoptedRecommendation"
  | "stockoutDistribution"
  | "stockoutByPlant"
  | "excessByPlant"
  | "sapAdoption"

export interface OverviewInfoExample {
  kind: "real" | "illustrative"
  /** The material, e.g. "Sodium isobutyl xanthate (4000002882) · Gamsberg (1500)". */
  material: string
  /** The values read for it: label and value. */
  inputs: { label: string; value: string }[]
  /** The formula with the values put in, one line per step. */
  substitution: string[]
  /** The outcome, in a sentence. */
  result: string
}

export interface OverviewInfoSpec {
  title: string
  /** The popup's accent colour: the tone of the KPI card it explains, shared by that card's charts. */
  tone: InfoTone
  /** One sentence: the question this answers. */
  summary: string
  /** The formula, one line per row. */
  formula: string[]
  /** The rule in plain words. */
  steps: string[]
  example: OverviewInfoExample
  /** Anything a reader could trip on (population, what is left out). */
  note?: string
}

// The same real material runs through the stockout and working-capital examples, so a reader can
// follow one material from card to card.
const SIBX = "Sodium isobutyl xanthate (4000002882) · Gamsberg (1500)"

const STOCKOUT_FORMULA = [
  "Average daily use = units used in the last 90 days ÷ 90",
  "Stock needed = average daily use × lead time (days)",
  "At risk  when  stock on hand  <  stock needed",
]

const STOCKOUT_STEPS = [
  "Only Fast and Slow moving materials are judged (last issue within 2 years).",
  "Lead time is how long a new order takes to arrive.",
  "If stock, usage or lead time is missing the material is shown as “need data” — it is never counted as safe or at risk.",
]

const STOCKOUT_EXAMPLE: OverviewInfoExample = {
  kind: "real",
  material: SIBX,
  inputs: [
    { label: "Stock on hand", value: "10,000 kg" },
    { label: "Used in last 90 days", value: "110,500 kg" },
    { label: "Lead time", value: "15 days" },
  ],
  substitution: [
    "Average daily use = 110,500 ÷ 90 = 1,227.8 kg per day",
    "Stock needed = 1,227.8 × 15 = 18,417 kg",
    "10,000 < 18,417",
  ],
  result: "At risk: stock runs out before a new order could arrive.",
}

const EXCESS_FORMULA = [
  "Excess candidate  when  current maximum stock in SAP  >  recommended maximum stock",
]

const EXCESS_STEPS = [
  "Current maximum is the value held in SAP today; recommended maximum is what Spares AI calculated.",
  "Both numbers must exist. Any gap above zero counts — there is no minimum margin.",
  "It is a count of materials, not a money value.",
]

const EXCESS_EXAMPLE: OverviewInfoExample = {
  kind: "illustrative",
  material: "Example material at plant 1300",
  inputs: [
    { label: "Current maximum in SAP", value: "40 units" },
    { label: "Recommended maximum", value: "30 units" },
  ],
  substitution: ["40 > 30"],
  result: "Excess candidate: SAP allows 10 more units than the recommendation says are needed.",
}

const ADOPTION_STEPS = [
  "Only recommendations that propose a change are tracked.",
  "Adopted: SAP now holds the recommended values (for an OAR material, MRP type Min-Max with minimum and maximum filled in).",
  "Partially adopted: some of the values changed. Not adopted: none changed.",
  "Pending: SAP has not recorded any change yet.",
]

export const OVERVIEW_INFO: Record<OverviewInfoId, OverviewInfoSpec> = {
  stockoutRisk: {
    title: "High Stockout Risk",
    tone: "danger",
    summary: "Which materials are likely to run out before a new order could arrive?",
    formula: STOCKOUT_FORMULA,
    steps: [
      ...STOCKOUT_STEPS,
      "The percentage is at-risk materials ÷ materials that could be judged.",
    ],
    example: STOCKOUT_EXAMPLE,
  },
  excessInventory: {
    title: "Excess Inventory Candidates",
    tone: "info",
    summary: "Where does SAP allow more stock than the recommendation says is needed?",
    formula: EXCESS_FORMULA,
    steps: [...EXCESS_STEPS, "The percentage is candidates ÷ all recommendations, so it is a minimum."],
    example: EXCESS_EXAMPLE,
  },
  workingCapital: {
    title: "Working Capital Impact",
    tone: "success",
    summary: "If every recommendation were adopted, how much cash would be released or tied up?",
    formula: [
      "Impact per material = unit price × (current reorder point − recommended reorder point)",
      "Working Capital Impact = sum of the impact of every material",
    ],
    steps: [
      "Positive: the recommendation lowers the reorder point, so cash is released.",
      "Negative: the recommendation raises it, so more cash is invested in stock.",
      "A material needs a unit price, a current and a recommended reorder point to count.",
      "It adds up every recommendation, whether or not it has been approved.",
    ],
    example: {
      kind: "real",
      material: SIBX,
      inputs: [
        { label: "Unit price", value: "48.15 per kg" },
        { label: "Current reorder point (SAP)", value: "0 kg" },
        { label: "Recommended reorder point", value: "4,594 kg" },
      ],
      substitution: ["48.15 × (0 − 4,594)", "= 48.15 × −4,594", "= −221,201"],
      result: "−221,201: this material adds about 0.22M of investment. The card shows the total over all materials, in millions.",
    },
    note: "Reorder point already includes the safety stock, so safety stock is not added a second time. Amounts are in the price currency.",
  },
  adoptedRecommendation: {
    title: "Adopted recommendation",
    tone: "warning",
    summary: "How many recommendations has SAP actually taken up?",
    formula: ["Adopted share = adopted recommendations ÷ recommendations with a change to adopt"],
    steps: ADOPTION_STEPS,
    example: {
      kind: "illustrative",
      material: "Example: 40 recommendations with a change to adopt",
      inputs: [
        { label: "Adopted", value: "10" },
        { label: "Tracked in total", value: "40" },
      ],
      substitution: ["10 ÷ 40 = 0.25", "0.25 × 100 = 25%"],
      result: "10 of 40 recommendations are adopted (25%).",
    },
  },
  stockoutDistribution: {
    title: "Stockout Risk Distribution",
    tone: "danger",
    summary: "How many judged materials are at high risk, and how many are not?",
    formula: STOCKOUT_FORMULA,
    steps: [
      "High: stock on hand is below the stock needed (the High Stockout Risk card’s count).",
      "Low: the judged materials that are not at risk.",
      "Each share is the count ÷ all judged materials. Materials that need data are named under the chart and are not counted as Low.",
    ],
    example: {
      ...STOCKOUT_EXAMPLE,
      result: "10,000 < 18,417, so this material is counted in the High bar.",
    },
  },
  stockoutByPlant: {
    title: "Stockout risk by plant",
    tone: "danger",
    summary: "Where are the at-risk materials: Black Mountain, Gamsberg, or both?",
    formula: [
      ...STOCKOUT_FORMULA,
      "Bar height = at-risk materials in that plant",
    ],
    steps: [
      "The same test as the High Stockout Risk card, run per material and plant.",
      "“All plants” adds the plants together; hover a bar for its share of judged materials.",
      "Materials that need data are left out of every bar.",
    ],
    example: {
      ...STOCKOUT_EXAMPLE,
      result: "At risk, so it adds 1 to the Gamsberg bar and 1 to the All plants bar.",
    },
  },
  excessByPlant: {
    title: "Excess inventory by plant",
    tone: "info",
    summary: "Where does SAP allow more stock than the recommendation says is needed?",
    formula: [...EXCESS_FORMULA, "Bar height = excess candidates in that plant"],
    steps: [
      "The same test as the Excess Inventory Candidates card, run per material and plant.",
      "“All plants” adds the plants together; hover a bar for its share of all recommended materials.",
      "It counts materials, not money.",
    ],
    example: {
      ...EXCESS_EXAMPLE,
      result: "Excess candidate, so it adds 1 to the Black Mountain bar and 1 to the All plants bar.",
    },
  },
  sapAdoption: {
    title: "SAP adoption",
    tone: "warning",
    summary: "Of the recommendations SAP has responded to, how many were taken up?",
    formula: [
      "Adoption rate = (adopted + partially adopted) ÷ (adopted + partially adopted + not adopted)",
    ],
    steps: [
      ...ADOPTION_STEPS,
      "Pending is shown on its own and is left out of the rate, so waiting for SAP does not pull it down.",
      "Until at least one recommendation has SAP evidence the card says “Not yet measured”, never 0%.",
    ],
    example: {
      kind: "illustrative",
      material: "Example: 50 tracked recommendations",
      inputs: [
        { label: "Adopted", value: "10" },
        { label: "Partially adopted", value: "5" },
        { label: "Not adopted", value: "5" },
        { label: "Pending", value: "30" },
      ],
      substitution: ["(10 + 5) ÷ (10 + 5 + 5)", "= 15 ÷ 20", "= 75%"],
      result: "75% adoption rate. The 30 pending recommendations are shown but do not count against it.",
    },
  },
}
