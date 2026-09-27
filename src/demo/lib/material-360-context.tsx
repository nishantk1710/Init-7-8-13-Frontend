"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

interface Material360ContextValue {
  openMaterialId: string | null
  openMaterial360: (materialId: string) => void
  closeMaterial360: () => void
}

const Material360Context = createContext<Material360ContextValue | null>(null)

/**
 * Mounted once in the root layout. Any component anywhere in the app can
 * call `useMaterial360().openMaterial360(materialId)` to pop the global
 * Material 360 drawer for that material — no routing involved.
 */
export function Material360Provider({ children }: { children: React.ReactNode }) {
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null)

  const openMaterial360 = useCallback((materialId: string) => {
    setOpenMaterialId(materialId)
  }, [])
  const closeMaterial360 = useCallback(() => setOpenMaterialId(null), [])

  const value = useMemo(
    () => ({ openMaterialId, openMaterial360, closeMaterial360 }),
    [openMaterialId, openMaterial360, closeMaterial360]
  )

  return (
    <Material360Context.Provider value={value}>{children}</Material360Context.Provider>
  )
}

export function useMaterial360() {
  const ctx = useContext(Material360Context)
  if (!ctx) {
    throw new Error("useMaterial360 must be used within a Material360Provider")
  }
  return ctx
}
