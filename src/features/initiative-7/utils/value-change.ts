import type { Recommendation } from "@/features/initiative-7/types/inventory"

/** What the Value change cell shows for one recommendation.
 *
 * `released` / `tied-up` / `unchanged` carry an `amount` that is already absolute: the arrow carries the
 * direction, so the amount is never printed with a + or - sign. `not-computed` (a blocked recommendation) and
 * `not-available` (the backend could not price it) are never shown as 0 -- 0 means the reorder point stays put. */
export type ValueChangeView =
  | { kind: "not-computed" }
  | { kind: "not-available" }
  | { kind: "released" | "tied-up" | "unchanged"; amount: number; ropPercent: number | null }

export function valueChangeView(rec: Recommendation): ValueChangeView {
  if (rec.factors.some((factor) => factor.label === "Blocked")) return { kind: "not-computed" }

  // Unit price x (current ROP - recommended ROP), worked out by the backend: positive releases working
  // capital (the reorder point goes down), negative ties more up (it goes up). null: not calculable.
  const impact = rec.workingCapitalImpact
  if (impact === null) return { kind: "not-available" }

  const ropDelta = rec.recommended.rop - rec.current.rop
  const ropPercent =
    rec.current.rop === 0 || ropDelta === 0 ? null : Math.round((ropDelta / rec.current.rop) * 100)
  const kind = impact > 0 ? "released" : impact < 0 ? "tied-up" : "unchanged"
  return { kind, amount: Math.abs(impact), ropPercent }
}

/** How the Value change column is ordered. `released-first` puts the largest release of working capital at the
 * top (green down arrows), `tied-up-first` the largest amount tied up (amber up arrows). `null` keeps the order
 * the backend sent. */
export type ValueChangeSort = "released-first" | "tied-up-first" | null

/** The signed figure a row is ordered by: positive releases capital, negative ties it up, 0 is an unchanged
 * reorder point. `null` for a row with no figure (blocked, or not priceable) -- it is never ranked as 0. */
function valueChangeSortKey(rec: Recommendation): number | null {
  const view = valueChangeView(rec)
  if (view.kind === "not-computed" || view.kind === "not-available") return null
  return view.kind === "released" ? view.amount : view.kind === "tied-up" ? -view.amount : 0
}

/** The rows ordered by Value change. Rows with no figure always come last, whichever way it is sorted, and rows
 * that tie keep the order they came in. Orders what it is given: a page, not the catalogue. */
export function sortByValueChange(recs: Recommendation[], sort: ValueChangeSort): Recommendation[] {
  if (sort === null) return recs
  const direction = sort === "released-first" ? -1 : 1
  return recs
    .map((rec, index) => ({ rec, index, key: valueChangeSortKey(rec) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) return a.key === b.key ? a.index - b.index : a.key === null ? 1 : -1
      return direction * (a.key - b.key) || a.index - b.index
    })
    .map(({ rec }) => rec)
}
