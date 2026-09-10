// Stable import point for the shared material catalog. Re-exports the
// existing MATERIALS/getMaterialById as-is — this file does NOT move,
// duplicate, or fork that data. Initiatives should import from here
// (`@/lib/shared-data/material-catalog`) rather than reaching into
// `@/lib/mock-data` directly, so `lib/mock-data.ts` stays a single stable
// owner for that data.
//
// Initiative-specific materials that don't exist in the shared catalog
// (e.g. Initiative 8's 80-series repairable spares, some Initiative 13 OAR
// items) are NOT added here — they live as local mock entries inside that
// initiative's own `data/` folder, each carrying a `MaterialReference` shape
// for cross-linking.

export { MATERIALS, getMaterialById } from "@/lib/mock-data"

/**
 * A handful of stable, real catalog material IDs — useful when an
 * initiative wants a recommendation/repair/utilization scenario to visibly
 * connect to a real shared-catalog material (so Material 360 has something
 * to show). Not exhaustive; any MATERIALS id works.
 */
export const REFERENCE_MATERIAL_IDS = [
  "500-14892", // Seal Assy, Mech Type XR-200 — Milling
  "500-15134", // Milling
  "500-08823", // Conveyance
  "500-22140", // Flotation
  "500-31005", // Instrumentation
  "500-40011",
  "500-19560",
  "500-55210",
] as const
