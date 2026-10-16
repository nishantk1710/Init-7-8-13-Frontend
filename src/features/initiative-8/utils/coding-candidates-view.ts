import type { CodingCandidate, NewItemPrice } from "@/features/initiative-8/types/repair"
import { UNKNOWN } from "@/features/initiative-8/utils/status"
import { formatZAR } from "@/lib/utils"

/**
 * The coding-candidate screen's New Item Price column, its sort and its
 * search, as plain functions.
 *
 * Pulled out of the table for the same reason `register-view.ts` was: the
 * rules are testable without React, and the export is built from exactly the
 * array the table renders.
 *
 * ## The price
 *
 * MBEW's moving average price (VERPR), per plant — what the part costs new,
 * so a reviewer can weigh recoding it against what it is worth. It is
 * deliberately the ONLY source: no purchase-order price stands in for a
 * missing one (ruled 16-Oct-2026). A missing price shows as "—" with the
 * reason on hover, never as R 0, which would read as a free part.
 */

/** Why a material-plant has no price, as the backend names it. */
export const MISSING_PRICE = {
  TOKEN_VALUE: "TOKEN_VALUE",
  NO_NEW_VALUATION: "NO_NEW_VALUATION",
  NOT_IN_MBEW: "NOT_IN_MBEW",
} as const

/** Rand to the cent — the hover text quotes the exact value MBEW holds. */
function formatRandExact(amount: number): string {
  return `R ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** What one plant's price cell says on hover: where the number came from, or
 *  why there is none. */
export function newItemPriceTitle(price: NewItemPrice): string {
  const at = `plant ${price.plant}`
  if (price.price !== undefined) {
    const type = price.valuationType ? `, valuation type ${price.valuationType}` : ""
    return `MBEW moving average price (VERPR) at ${at}${type}: ${formatRandExact(price.price)}.`
  }
  switch (price.missing) {
    case MISSING_PRICE.TOKEN_VALUE:
      return price.mbewValue !== undefined
        ? `No price: MBEW holds a placeholder value of ${formatRandExact(price.mbewValue)} at ${at}, not a real valuation.`
        : `No price: MBEW holds a placeholder value at ${at}, not a real valuation.`
    case MISSING_PRICE.NO_NEW_VALUATION:
      return `No price: this material is valued by condition at ${at}, with no NEW valuation.`
    case MISSING_PRICE.NOT_IN_MBEW:
      return `No price: this material has no MBEW valuation record at ${at}.`
    default:
      // A reason this build does not know yet still says something true.
      return price.missing ? `No price at ${at} (${price.missing}).` : `No price at ${at}.`
  }
}

export type NewItemPriceCellLine = {
  /** Shown before the amount when the candidate has more than one plant. */
  plant?: string
  label: string
  title: string
}

/**
 * The cell, one line per plant.
 *
 * With one plant the amount stands alone — the Plants column already names
 * it. With two, each line leads with its plant, so the two numbers cannot be
 * confused (ruled 16-Oct-2026: per-plant prices, not a range).
 */
export function newItemPriceCell(prices: readonly NewItemPrice[]): NewItemPriceCellLine[] {
  if (prices.length === 0) {
    return [{ label: UNKNOWN, title: "No price: no plant on the lines this material was found on." }]
  }
  const labelled = prices.length > 1
  return prices.map((price) => ({
    plant: labelled ? price.plant : undefined,
    label: price.price !== undefined ? formatZAR(price.price) : UNKNOWN,
    title: newItemPriceTitle(price),
  }))
}

/** What the column sorts on: the highest price across the candidate's plants,
 *  or `undefined` when no plant has one. */
export function newItemPriceSortValue(candidate: CodingCandidate): number | undefined {
  const priced = candidate.newItemPrices
    .map((price) => price.price)
    .filter((price): price is number => price !== undefined)
  return priced.length > 0 ? Math.max(...priced) : undefined
}

/** `none` is the backend's ranking — the screen's default order. */
export type PriceSort = "none" | "desc" | "asc"

/** What a click on the header moves to: highest first, lowest first, back to
 *  the ranking. */
export function nextPriceSort(current: PriceSort): PriceSort {
  return current === "none" ? "desc" : current === "desc" ? "asc" : "none"
}

/**
 * The candidates in the order the column asks for.
 *
 * Candidates with no price go last in BOTH directions: they have nothing to
 * compare, and leading an ascending sort with a page of "—" would hide the
 * cheapest parts. Ties — and every unpriced row — keep the backend's ranking,
 * because the sort is stable and the input arrives ranked.
 */
export function sortByNewItemPrice<T extends CodingCandidate>(candidates: readonly T[], sort: PriceSort): T[] {
  if (sort === "none") return [...candidates]
  const direction = sort === "desc" ? -1 : 1
  return [...candidates].sort((a, b) => {
    const left = newItemPriceSortValue(a)
    const right = newItemPriceSortValue(b)
    if (left === undefined || right === undefined) {
      return left === right ? 0 : left === undefined ? 1 : -1
    }
    return (left - right) * direction
  })
}

/**
 * Does this candidate match what was typed into the search box?
 *
 * Case-insensitive, contains-style, like the declaration queue's search. It
 * reads two things:
 *
 * - **the material number.** An all-digit query loses its leading zeros
 *   first, so a number pasted from SAP padded to 18 digits still matches the
 *   unpadded one the screen shows;
 * - **every text the material carries** — all of its distinct PO/PR texts,
 *   not only the first one shown as its description. That text IS the
 *   material's name on this screen: there is no material-master description
 *   for these.
 */
export function matchesCandidateSearch(candidate: CodingCandidate, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const number = /^\d+$/.test(needle) ? needle.replace(/^0+(?=\d)/, "") : needle
  if (candidate.material.materialCode.toLowerCase().includes(number)) return true
  return candidate.distinctTexts.some((text) => text.toLowerCase().includes(needle))
}
