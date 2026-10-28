/**
 * The quantity a request line suggests, what a typed quantity then asks for,
 * and the consumption window that goes with it.
 *
 * **Live, the suggestion comes from the backend** (the preview's
 * `suggestion.quantity` and `reason`, from `quantity.py::suggest` uncapped).
 * The functions below only compare a typed quantity against it, word the
 * question, and size a window for a quantity the requester changed.
 *
 * {@link suggestQuantity} is the same arithmetic in the browser, for the
 * offline demo's catalogue only:
 *
 *     target   = average monthly consumption × cover ceiling (12 months)
 *     headroom = target − (stock on hand + open PO), rounded down
 */


export const COVER_CEILING_MONTHS = 12
export const MIN_HISTORY_CONSUMPTIONS = 3

export type QuantitySuggestion =
  /** A positive quantity to procure. */
  | { kind: "suggested"; quantity: number; target: number; available: number; explanation: string }
  /** Stock and open POs already cover the ceiling: suggest nothing. */
  | { kind: "covered"; quantity: 0; monthsCovered: number; available: number; explanation: string }
  /** Too few issues in 12 months for a rate worth trusting. */
  | { kind: "no_history"; quantity: null; explanation: string }
  /** Not consumed at all in 12 months. */
  | { kind: "no_rate"; quantity: null; explanation: string }

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Demo only -- the offline catalogue's suggestion. Live, the backend's preview is used. */
/** What is known about an OAR material at a plant, the inputs to a quantity suggestion. */
export type OarFacts = {
  stockOnHand: number
  openPoQuantity: number
  /** Per month, over the last 12 months. */
  averageMonthlyConsumption: number
  consumptionCount12m: number
  daysSinceLastMovement: number | null
  crossPlantStock: { plant: string; stockOnHand: number }[]
}

export function suggestQuantity(facts: OarFacts): QuantitySuggestion {
  const rate = facts.averageMonthlyConsumption
  const available = facts.stockOnHand + facts.openPoQuantity

  if (rate <= 0 || facts.consumptionCount12m === 0) {
    return {
      kind: "no_rate",
      quantity: null,
      explanation:
        "Not issued once in the last 12 months, so there is no consumption rate to suggest from.",
    }
  }
  if (facts.consumptionCount12m < MIN_HISTORY_CONSUMPTIONS) {
    return {
      kind: "no_history",
      quantity: null,
      explanation:
        `Only ${facts.consumptionCount12m} issue${facts.consumptionCount12m === 1 ? "" : "s"} in the last ` +
        `12 months: too few (minimum ${MIN_HISTORY_CONSUMPTIONS}) for a quantity worth suggesting.`,
    }
  }

  const target = rate * COVER_CEILING_MONTHS
  const headroom = Math.floor(target - available)
  const basis =
    `${rate}/month × ${COVER_CEILING_MONTHS} months = ${round1(target)} needed; ` +
    `stock ${facts.stockOnHand}` +
    (facts.openPoQuantity > 0 ? ` + open PO ${facts.openPoQuantity}` : "") +
    ` = ${available} available.`

  if (headroom <= 0) {
    const monthsCovered = round1(available / rate)
    return {
      kind: "covered",
      quantity: 0,
      monthsCovered,
      available,
      explanation: `Current stock covers about ${monthsCovered} months. ${basis}`,
    }
  }
  return { kind: "suggested", quantity: headroom, target: round1(target), available, explanation: basis }
}

/** What kind of suggestion a line has: a quantity, nothing needed, or none possible. */
export type SuggestionKind = "suggested" | "covered" | "none"

export function suggestionKind(suggested: number | null): SuggestionKind {
  if (suggested === null) return "none"
  return suggested > 0 ? "suggested" : "covered"
}

/** Short label for the Suggested column. */
export function suggestionLabel(suggested: number | null): string {
  return suggested === null ? "No suggestion" : String(suggested)
}

/**
 * Whether the chosen quantity has to be justified -- the backend's rule.
 *
 * Above the suggestion: yes. At or under it: no -- under-ordering is not the
 * risk this guards against. With no suggestion to compare against, any
 * quantity needs a reason, since nothing else supports it.
 */
export function needsJustification(suggested: number | null, quantity: number | null): boolean {
  if (quantity === null || !(quantity > 0)) return false
  if (suggested === null) return true
  return quantity > suggested
}

/** Why the justification is being asked for, in the requester's terms. */
export function justificationPrompt(suggested: number | null, quantity: number): string {
  switch (suggestionKind(suggested)) {
    case "suggested":
      return `${quantity} is above the suggested ${suggested}. Why the larger quantity?`
    case "covered":
      return `Stock and open orders already cover the next 12 months. Why procure ${quantity} more?`
    case "none":
      return `No quantity can be suggested for this part. Why ${quantity}?`
  }
}

function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
  // 31 Jan + 1 month rolls into March; pull it back to the month's last day.
  if (next.getDate() !== date.getDate()) next.setDate(0)
  return next
}

/**
 * A consumption window for a quantity: from today until the quantity would be
 * used up at the 12-month rate, between 1 and 12 months. Null when there is no
 * rate -- the requester enters the window themselves.
 */
export function suggestWindow(
  quantity: number | null,
  rate: number,
  today: Date = new Date()
): { start: string; end: string; months: number } | null {
  if (quantity === null || !(quantity > 0) || !(rate > 0)) return null
  const months = Math.min(COVER_CEILING_MONTHS, Math.max(1, Math.ceil(quantity / rate)))
  return { start: isoDate(today), end: isoDate(addMonths(today, months)), months }
}
