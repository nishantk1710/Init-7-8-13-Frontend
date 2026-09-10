"use client"

import { RotateCcw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RiskLevel } from "@/components/shared/risk-badge"
import { cn } from "@/lib/utils"
import { getPlantById, PLANTS } from "@/lib/shared-data/plants"
import {
  CIRCUITS,
  CRITICALITIES,
  DEMAND_PATTERNS,
  RECOMMENDATION_STATUSES,
} from "@/features/initiative-7/types/inventory"

export const ALL_FILTER = "all"

const RISK_LEVELS: RiskLevel[] = ["critical", "high", "medium", "low"]

export interface DashboardFilterState {
  plant: string
  circuit: string
  criticality: string
  demandPattern: string
  status: string
  risk: string
  material: string
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFilterState = {
  plant: ALL_FILTER,
  circuit: ALL_FILTER,
  criticality: ALL_FILTER,
  demandPattern: ALL_FILTER,
  status: ALL_FILTER,
  risk: ALL_FILTER,
  material: "",
}

export function isDashboardFiltersActive(filters: DashboardFilterState): boolean {
  return Object.entries(filters).some(([key, value]) =>
    key === "material" ? value.trim().length > 0 : value !== ALL_FILTER
  )
}

function FilterField({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * The dashboard's filter controls. `rail` stacks them into a sidebar for the
 * Overview page; `bar` lays them out horizontally above a full-width table.
 * Either way every field narrows the same `recommendations` set the KPIs,
 * charts and tables read from.
 */
export function DashboardFilters({
  value,
  onChange,
  layout = "rail",
}: {
  value: DashboardFilterState
  onChange: (value: DashboardFilterState) => void
  layout?: "rail" | "bar"
}) {
  function set<K extends keyof DashboardFilterState>(key: K, next: string) {
    onChange({ ...value, [key]: next })
  }

  const isBar = layout === "bar"

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        isBar
          ? "flex flex-wrap items-end gap-3 [&>div]:min-w-[132px] [&>div]:flex-1"
          : "flex flex-col gap-4"
      )}
    >
      {!isBar && <div className="text-sm font-medium text-foreground">Filters</div>}

      <FilterField label="Plant">
        <Select value={value.plant} onValueChange={(v) => set("plant", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">
              {(v: string) => (v === ALL_FILTER ? "All" : (getPlantById(v)?.name ?? v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {PLANTS.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Circuit">
        <Select value={value.circuit} onValueChange={(v) => set("circuit", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">{(v: string) => (v === ALL_FILTER ? "All" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {CIRCUITS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Criticality">
        <Select value={value.criticality} onValueChange={(v) => set("criticality", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">{(v: string) => (v === ALL_FILTER ? "All" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {CRITICALITIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Demand Pattern">
        <Select value={value.demandPattern} onValueChange={(v) => set("demandPattern", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">{(v: string) => (v === ALL_FILTER ? "All" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {DEMAND_PATTERNS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Recommendation Status">
        <Select value={value.status} onValueChange={(v) => set("status", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">{(v: string) => (v === ALL_FILTER ? "All" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {RECOMMENDATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Stockout Risk">
        <Select value={value.risk} onValueChange={(v) => set("risk", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">
              {(v: string) => (v === ALL_FILTER ? "All" : v.charAt(0).toUpperCase() + v.slice(1))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {RISK_LEVELS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Material">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.material}
            onChange={(e) => set("material", e.target.value)}
            placeholder="Search material..."
            className="h-8 pl-7 text-sm"
          />
        </div>
      </FilterField>

      <Button
        variant="outline"
        size="sm"
        className={isBar ? "shrink-0 grow-0" : undefined}
        disabled={!isDashboardFiltersActive(value)}
        onClick={() => onChange(EMPTY_DASHBOARD_FILTERS)}
      >
        <RotateCcw className="size-3.5" />
        Clear filters
      </Button>
    </div>
  )
}
