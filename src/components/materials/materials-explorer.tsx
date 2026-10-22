"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { ALL_FILTER, MaterialSearch } from "@/components/materials/material-search"
import { MaterialTable } from "@/components/materials/material-table"
import { CappedNotice } from "@/components/shared/load-status"
import type { Category, LifecycleStatus, Material } from "@/lib/types"

const CATEGORY_VALUES: Category[] = [
  "Flotation",
  "Conveyance",
  "Milling",
  "Instrumentation",
]

export function MaterialsExplorer({ materials }: { materials: Material[] }) {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get("category")

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<Category | typeof ALL_FILTER>(ALL_FILTER)
  const [manufacturer, setManufacturer] = useState(ALL_FILTER)
  const [lifecycle, setLifecycle] = useState<LifecycleStatus | typeof ALL_FILTER>(
    ALL_FILTER
  )

  useEffect(() => {
    if (
      categoryParam &&
      CATEGORY_VALUES.includes(categoryParam as Category)
    ) {
      setCategory(categoryParam as Category)
    }
  }, [categoryParam])

  const manufacturers = useMemo(
    () => Array.from(new Set(materials.map((m) => m.manufacturer))).sort(),
    [materials]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return materials.filter((material) => {
      if (category !== ALL_FILTER && material.category !== category) return false
      if (manufacturer !== ALL_FILTER && material.manufacturer !== manufacturer)
        return false
      if (lifecycle !== ALL_FILTER && material.lifecycleStatus !== lifecycle)
        return false
      if (!q) return true
      return (
        material.id.toLowerCase().includes(q) ||
        material.description.toLowerCase().includes(q) ||
        material.manufacturerPartNo.toLowerCase().includes(q)
      )
    })
  }, [materials, query, category, manufacturer, lifecycle])

  return (
    <div className="flex flex-col gap-4">
      <CappedNotice shown={filtered.length} total={materials.length} noun="materials" description={null} />
      <MaterialSearch
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        manufacturer={manufacturer}
        onManufacturerChange={setManufacturer}
        manufacturers={manufacturers}
        lifecycle={lifecycle}
        onLifecycleChange={setLifecycle}
      />
      {/* Keyed on the dropdown filters, so the results fade in when one changes -- not on every keystroke in the search.
          Dropped for reduced motion. */}
      <div
        key={`${category}|${manufacturer}|${lifecycle}`}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none"
      >
        <MaterialTable materials={filtered} />
      </div>
    </div>
  )
}
