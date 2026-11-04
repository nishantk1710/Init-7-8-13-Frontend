import type { Recommendation, StockParameters } from "@/features/initiative-7/types/inventory"

/** One of a recommendation's stock figures, or null when the backend did not send it -- the mapped `current` and
 * `recommended` read a missing figure as 0, and a list must not show that as a real 0 (nor a comparison call it "set to 0 in SAP"). */
export function stockFigure(rec: Recommendation, side: "current" | "recommended", key: keyof StockParameters): number | null {
  return rec.present?.[side][key] === false ? null : rec[side][key]
}
