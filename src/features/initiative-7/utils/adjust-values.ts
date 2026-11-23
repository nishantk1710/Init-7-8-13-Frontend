// The values an approver puts in place of the recommended ones when they Adjust.
//
// The backend checks the same rules again (app/initiatives/i7/recommendations/ledger.py) and is the
// authority; this is so the form can say what is wrong before a request is sent.
//
// Safety stock is part of the form only when the recommendation carries one (`current.safetyStock` is not
// null). A recommendation without one -- the current behaviour -- adjusts the reorder point and the maximum
// only: no safety stock input is offered and none is sent, so it is never read as 0.

import type { StockParameters } from "@/features/initiative-7/types/inventory"

export type AdjustFieldText = { rop: string; safetyStock?: string; maxStock: string }

/** Whether the form carries a safety stock input: only when the recommendation has a safety stock. */
export function hasAdjustSafetyStock(current: StockParameters): boolean {
  return current.safetyStock != null
}

/** The form's starting text: the values as they are now. */
export function adjustFieldsFrom(current: StockParameters): AdjustFieldText {
  const fields: AdjustFieldText = {
    rop: String(Math.round(current.rop)),
    maxStock: String(Math.round(current.maxStock)),
  }
  if (current.safetyStock != null) fields.safetyStock = String(Math.round(current.safetyStock))
  return fields
}

export type AdjustCheck =
  | { ok: true; values: { rop: number; safetyStock: number | null; maxStock: number } }
  | { ok: false; reason: string }

const WHOLE_NUMBER = /^\d+$/

/** Whole numbers, ROP <= max (and safety stock <= ROP when the form has a safety stock), and at least one
 * different from `current`. */
export function checkAdjustedValues(fields: AdjustFieldText, current: StockParameters): AdjustCheck {
  const withSafetyStock = hasAdjustSafetyStock(current)
  const texts = [fields.rop.trim(), fields.maxStock.trim()]
  if (withSafetyStock) texts.push((fields.safetyStock ?? "").trim())
  if (!texts.every((text) => WHOLE_NUMBER.test(text))) {
    return {
      ok: false,
      reason: withSafetyStock
        ? "Enter whole numbers, zero or more, for all three values."
        : "Enter whole numbers, zero or more, for both values.",
    }
  }
  const rop = Number(texts[0])
  const maxStock = Number(texts[1])
  const safetyStock = withSafetyStock ? Number(texts[2]) : null

  if (safetyStock !== null && !(safetyStock <= rop && rop <= maxStock)) {
    return {
      ok: false,
      reason: "Safety stock must not be above the reorder point, and the reorder point must not be above the maximum.",
    }
  }
  if (safetyStock === null && !(rop <= maxStock)) {
    return { ok: false, reason: "The reorder point must not be above the maximum." }
  }
  if (
    rop === Math.round(current.rop) &&
    maxStock === Math.round(current.maxStock) &&
    (safetyStock === null || safetyStock === Math.round(current.safetyStock ?? 0))
  ) {
    return { ok: false, reason: "These are the current values. Change at least one." }
  }
  return { ok: true, values: { rop, safetyStock, maxStock } }
}
