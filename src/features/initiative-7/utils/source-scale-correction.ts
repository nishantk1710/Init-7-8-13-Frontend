// A temporary display correction for the Overview's money totals.
//
// The SAP views read English-formatted numbers as German, so prices arrive 100x too large and
// quantities 1000x too large (see the sap-number-format issue). A money total multiplies one of each,
// so it is about 100,000x too large. Until the source is corrected and re-staged, the Overview shows
// the total divided by that factor, labelled as an estimate.
//
// This is a stop-gap and it MUST be removed when the data is fixed: once the source is right the
// backend sends correct totals, and dividing again would show them 100,000x too small. To remove it,
// set NEXT_PUBLIC_I07_SOURCE_SCALE_CORRECTION=off (needs a frontend rebuild) or delete this module
// and its two call sites.
//
// It is an approximation: the real factor depends on each material's price and quantity. It applies
// only to portfolio money totals, not to per-row prices or quantities.

export const MONEY_SCALE_DIVISOR = 100_000

export const SOURCE_SCALE_CORRECTION_ON = process.env.NEXT_PUBLIC_I07_SOURCE_SCALE_CORRECTION !== "off"

/** A portfolio money total as the Overview should show it. `null` (no figure) stays `null`. */
export function correctMoneyTotal(amount: number | null, enabled: boolean = SOURCE_SCALE_CORRECTION_ON): number | null {
  if (amount === null) return null
  return enabled ? amount / MONEY_SCALE_DIVISOR : amount
}

/** Whether a shown total went through the correction, so the card can call it an estimate. */
export function isCorrectedEstimate(amount: number | null, enabled: boolean = SOURCE_SCALE_CORRECTION_ON): boolean {
  return enabled && amount !== null
}
