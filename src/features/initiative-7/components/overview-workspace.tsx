"use client"

import { LiveInventoryOptimizationOverviewWorkspace } from "@/features/initiative-7/components/live-overview-workspace"

/** Overview page body for the live route tree — always renders the live,
 * backend-backed workspace. Mock/scenario rendering lives only in the
 * separate demo route tree (src/demo/features/initiative-7/...). */
export function InventoryOptimizationOverviewWorkspace() {
  return <LiveInventoryOptimizationOverviewWorkspace />
}
