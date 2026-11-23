import type { Recommendation, StockParameters } from "@/features/initiative-7/types/inventory"

/** One of a recommendation's stock figures, or null when there is none. Safety stock is `null` on the mapped
 * recommendation itself when the backend sent none; `rop` and `maxStock` still read a missing figure as 0, and `present`
 * says which were really there. A list must not show a missing figure as a real 0 (nor a comparison call it "set to 0
 * in SAP"). `present` is filled by the list mapper only; without it the value is returned as it is. */
export function stockFigure(rec: Recommendation, side: "current" | "recommended", key: keyof StockParameters): number | null {
  return rec.present?.[side][key] === false ? null : rec[side][key]
}
