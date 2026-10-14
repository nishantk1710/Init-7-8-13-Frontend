import type { Recommendation } from "@/features/initiative-7/types/inventory"

/**
 * Whether any recommendation carries a real circuit.
 *
 * MARC supplies no circuit for most of the extract, so every live row reads
 * "Unassigned". A column, filter or chart of one repeated word says nothing;
 * callers hide those until a row has a real circuit, at which point they come
 * back on their own.
 */
export function hasRealCircuit(recommendations: ReadonlyArray<Pick<Recommendation, "circuit">>): boolean {
  return recommendations.some((rec) => rec.circuit !== "Unassigned")
}
