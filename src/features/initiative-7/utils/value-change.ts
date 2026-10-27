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
