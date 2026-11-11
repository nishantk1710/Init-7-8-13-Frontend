// The values an approver puts in place of the recommended ones when they Adjust.
//
// The backend checks the same rules again (app/initiatives/i7/recommendations/ledger.py) and is the
// authority; this is so the form can say what is wrong before a request is sent.

import type { StockParameters } from "@/features/initiative-7/types/inventory"

export type AdjustFieldText = { rop: string; safetyStock: string; maxStock: string }

/** The form's starting text: the values as they are now. */
export function adjustFieldsFrom(current: StockParameters): AdjustFieldText {
  return {
    rop: String(Math.round(current.rop)),
    safetyStock: String(Math.round(current.safetyStock)),
    maxStock: String(Math.round(current.maxStock)),
  }
}

export type AdjustCheck =
  | { ok: true; values: { rop: number; safetyStock: number; maxStock: number } }
  | { ok: false; reason: string }

const WHOLE_NUMBER = /^\d+$/

/** Whole numbers, safety stock <= ROP <= max, and at least one different from `current`. */
export function checkAdjustedValues(fields: AdjustFieldText, current: StockParameters): AdjustCheck {
  const texts = [fields.rop.trim(), fields.safetyStock.trim(), fields.maxStock.trim()]
  if (!texts.every((text) => WHOLE_NUMBER.test(text))) {
    return { ok: false, reason: "Enter whole numbers, zero or more, for all three values." }
  }
  const [rop, safetyStock, maxStock] = texts.map(Number)
  if (!(safetyStock <= rop && rop <= maxStock)) {
    return { ok: false, reason: "Safety stock must not be above the reorder point, and the reorder point must not be above the maximum." }
  }
  if (
    rop === Math.round(current.rop) &&
    safetyStock === Math.round(current.safetyStock) &&
    maxStock === Math.round(current.maxStock)
  ) {
    return { ok: false, reason: "These are the current values. Change at least one." }
  }
  return { ok: true, values: { rop, safetyStock, maxStock } }
}
