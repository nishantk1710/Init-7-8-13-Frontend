import type { Recommendation, StockParameters } from "@/features/initiative-7/types/inventory"
import { stockFigure } from "@/features/initiative-7/utils/stock-figure"

// Whether a safety stock recommendation is shown follows the data, not a flag: only a recommendation that
// carries a safety stock (an older one, or one made while safety stock is switched on in the backend) shows
// it. A missing one (`null`) is never shown as 0, and the current SAP safety stock alone is not a recommendation.

/** True when the recommended values carry a safety stock (a real 0 counts: it is a value). */
export function hasRecommendedSafetyStock(recommended: Pick<StockParameters, "safetyStock">): boolean {
  return recommended.safetyStock != null
}

/** True when this recommendation carries a recommended safety stock. Honours `present` (what the backend really
 * sent) as well as the value, so a row mapped before safety stock could be null still reads as "none". */
export function recHasRecommendedSafetyStock(rec: Recommendation): boolean {
  return stockFigure(rec, "recommended", "safetyStock") !== null
}

/** True when at least one of the recommendations carries a safety stock -- the test for showing a safety stock
 * column in a table: a column with nothing in it for every row is left out. */
export function anyRecommendedSafetyStock(recs: readonly Recommendation[]): boolean {
  return recs.some(recHasRecommendedSafetyStock)
}

/** "650" for a figure, "—" for none -- never "0" for a missing one. */
export function safetyStockText(value: number | null | undefined): string {
  return value == null ? "—" : String(value)
}
