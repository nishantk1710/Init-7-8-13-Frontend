"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { ActiveFormulas } from "@/features/initiative-7/types/kpi-formulas"

const OverviewFormulasContext = createContext<ActiveFormulas | null>(null)

/** Hands the formulas in force to every `OverviewInfo` beneath it, so the cards and charts need no new
 * prop. `null` (not loaded, or the request failed) means the built-in text -- the cards never go blank. */
export function OverviewFormulasProvider({ value, children }: { value: ActiveFormulas | null; children: ReactNode }) {
  return <OverviewFormulasContext.Provider value={value}>{children}</OverviewFormulasContext.Provider>
}

export function useOverviewFormulas(): ActiveFormulas | null {
  return useContext(OverviewFormulasContext)
}
