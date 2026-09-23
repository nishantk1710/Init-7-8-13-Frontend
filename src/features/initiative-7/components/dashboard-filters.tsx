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
  type Criticality,
  type DemandPattern,
} from "@/features/initiative-7/types/inventory"

export const ALL_FILTER = "all"

/** The raw ZMM065 tier name shown for each mapped `Criticality` value, so the
 * filter reads the way the underlying data actually looks (CRITICAL, IMPACT,
 * INSURANCE, NORMAL, OBSOLETE -- see CRITICALITY_MAP in services/i7-api.ts)
 * rather than the derived Low/Medium/High/Critical ordinal or an ABC code.
 * NORMAL and OBSOLETE both map to "Low" today (see CRITICALITY_MAP) and are
 * not distinguished on Recommendation -- NORMAL is shown here as the far
 * more common of the two (12,693 vs 3,128 rows in the ZMM065 extract), not a
 * claim that OBSOLETE rows are absent from this filter value. */
export const CRITICALITY_TIER_LABEL: Record<Criticality, string> = {
  Critical: "CRITICAL",
  High: "IMPACT",
  Medium: "INSURANCE",
  Low: "NORMAL",
}

const RISK_LEVELS: RiskLevel[] = ["critical", "high", "medium", "low"]

export interface DashboardFilterState {
  plant: string
  circuit: string
  criticality: string
  demandPattern: string
  status: string
  risk: string
  material: string
  /** Live mode only. "calculated" = only rows that actually reached a
   * computed ROP/safety stock (backend status READY_FOR_REVIEW); ALL_FILTER =
   * every row including the far larger blocked population. Not a client-side
   * predicate: it maps to the backend's own `status` query param, because at
   * ~113k rows the handful that are calculated would almost never appear in
   * one fetched page. Kept separate from `status` because the frontend's
   * display statuses collapse READY_FOR_REVIEW and NOT_EVALUABLE into the
   * same "Pending Review" label (see i7-api.ts STATUS_MAP), so that filter
   * cannot express "has a real calculated value". */
  recommendation: string
}

export const RECOMMENDATION_FILTER_CALCULATED = "calculated"

export const EMPTY_DASHBOARD_FILTERS: DashboardFilterState = {
  plant: ALL_FILTER,
  circuit: ALL_FILTER,
  criticality: ALL_FILTER,
  demandPattern: ALL_FILTER,
  status: ALL_FILTER,
  risk: ALL_FILTER,
  material: "",
  // Calculated-only by default: of ~113k recommendation rows only a handful
  // carry a real computed value, so defaulting to "All" shows page after page
  // of "not yet computed" rows and buries the ones a planner can act on.
  recommendation: RECOMMENDATION_FILTER_CALCULATED,
}

export function isDashboardFiltersActive(filters: DashboardFilterState): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "material") return value.trim().length > 0
    // The default is calculated-only, so that value is not an "active" filter
    // -- only switching it to All (or anything else) counts as one.
    if (key === "recommendation") return value !== RECOMMENDATION_FILTER_CALCULATED
    return value !== ALL_FILTER
  })
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
  plantOptions,
  showRecommendationFilter = false,
}: {
  value: DashboardFilterState
  onChange: (value: DashboardFilterState) => void
  layout?: "rail" | "bar"
  /** Live mode only: the real SAP plant codes present in the data, from the
   * backend's own by_plant aggregate. The default PLANTS list is app-side
   * scenario master data keyed on invented ids (PLANT-GBG etc.) that never
   * match a live row's SAP WERKS code, so selecting one filtered everything
   * out -- see utils/sap-plants.ts. When provided, these replace that list. */
  plantOptions?: { value: string; label: string; count?: number }[]
  /** Live mode only -- the scenario dataset has no "blocked vs calculated"
   * distinction to filter on (every fixture row carries values). */
  showRecommendationFilter?: boolean
}) {
  function set<K extends keyof DashboardFilterState>(key: K, next: string) {
    onChange({ ...value, [key]: next })
  }

  const isBar = layout === "bar"
  const plants: { value: string; label: string; count?: number }[] =
    plantOptions ?? PLANTS.map((p) => ({ value: p.plantId, label: p.name }))
  const plantLabel = (v: string) =>
    plantOptions
      ? (plantOptions.find((p) => p.value === v)?.label ?? v)
      : (getPlantById(v)?.name ?? v)

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

      {showRecommendationFilter && (
        <FilterField label="Recommendation">
          <Select
            value={value.recommendation}
            onValueChange={(v) => set("recommendation", v ?? RECOMMENDATION_FILTER_CALCULATED)}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Calculated only">
                {(v: string) => (v === ALL_FILTER ? "All materials" : "Calculated only")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RECOMMENDATION_FILTER_CALCULATED}>Calculated only</SelectItem>
              <SelectItem value={ALL_FILTER}>All materials</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      )}

      <FilterField label="Plant" className={isBar ? "min-w-[180px]!" : undefined}>
        <Select value={value.plant} onValueChange={(v) => set("plant", v ?? ALL_FILTER)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="All">
              {(v: string) => (v === ALL_FILTER ? "All" : plantLabel(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="min-w-[220px]">
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {plants.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
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
            <SelectValue placeholder="All">
              {(v: string) => (v === ALL_FILTER ? "All" : CRITICALITY_TIER_LABEL[v as Criticality])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All</SelectItem>
            {CRITICALITIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CRITICALITY_TIER_LABEL[c]}
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
