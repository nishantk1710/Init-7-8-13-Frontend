"use client"

import { Search } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CATEGORIES } from "@/lib/constants"
import type { Category, LifecycleStatus } from "@/lib/types"

export const ALL_FILTER = "all"

export function MaterialSearch({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  manufacturer,
  onManufacturerChange,
  manufacturers,
  lifecycle,
  onLifecycleChange,
}: {
  query: string
  onQueryChange: (value: string) => void
  category: Category | typeof ALL_FILTER
  onCategoryChange: (value: Category | typeof ALL_FILTER) => void
  manufacturer: string
  onManufacturerChange: (value: string) => void
  manufacturers: string[]
  lifecycle: LifecycleStatus | typeof ALL_FILTER
  onLifecycleChange: (value: LifecycleStatus | typeof ALL_FILTER) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by code, description, or part number..."
          className="h-9 pl-8"
        />
      </div>

      <Select
        value={category}
        onValueChange={(value) => onCategoryChange(value as Category | typeof ALL_FILTER)}
      >
        <SelectTrigger className="h-9 w-full sm:w-44">
          <SelectValue placeholder="Category">
            {(value: string) => (value === ALL_FILTER ? "All categories" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All categories</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.label} value={c.label}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={manufacturer}
        onValueChange={(value) => onManufacturerChange(value ?? ALL_FILTER)}
      >
        <SelectTrigger className="h-9 w-full sm:w-48">
          <SelectValue placeholder="Manufacturer">
            {(value: string) => (value === ALL_FILTER ? "All manufacturers" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All manufacturers</SelectItem>
          {manufacturers.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={lifecycle}
        onValueChange={(value) => onLifecycleChange(value as LifecycleStatus | typeof ALL_FILTER)}
      >
        <SelectTrigger className="h-9 w-full sm:w-40">
          <SelectValue placeholder="Lifecycle">
            {(value: string) => (value === ALL_FILTER ? "All statuses" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
          <SelectItem value="Active">Active</SelectItem>
          <SelectItem value="EOL">EOL</SelectItem>
          <SelectItem value="Obsolete">Obsolete</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
