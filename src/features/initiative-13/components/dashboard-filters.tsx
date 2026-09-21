"use client"

import { FilterBar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AcquiredVsPlanStatus, AgingBand } from "@/features/initiative-13/api/types"
import type { CriticalFilter } from "@/features/initiative-13/utils/dashboard-transforms"

const ALL_FILTER = "all"

const AGING_LABEL: Record<AgingBand, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

const PLAN_LABEL: Record<AcquiredVsPlanStatus, string> = {
  NO_PLAN: "No plan",
  BELOW_PLAN: "Below plan",
  ON_PLAN: "Aligned",
  ABOVE_PLAN: "Above plan",
}

const CRITICAL_LABEL: Record<CriticalFilter, string> = {
  all: "All critical-impact",
  yes: "Critical impact: Yes",
  no: "Critical impact: No",
  unknown: "Critical impact: Unknown",
}

export interface DashboardFilterValues {
  plant: string
  material: string
  agingBand: string
  acquiredVsPlanStatus: string
  criticalFilter: CriticalFilter
}

/**
 * The Utilisation Dashboard's one global filter bar (§14 of the W6.7 task).
 * Plant/material/aging-band/acquired-vs-plan are server-side filters (the
 * page debounces and forwards them as query params); critical-impact is a
 * client-side filter applied only to the Non-Mover Drilldown, since it is a
 * presentation-layer join (see `attachCriticalImpactIndicator`), not a
 * field the backend can filter on directly.
 */
export function DashboardFilters({
  values,
  onChange,
}: {
  values: DashboardFilterValues
  onChange: (patch: Partial<DashboardFilterValues>) => void
}) {
  return (
    <FilterBar>
      <Input
        placeholder="Plant (e.g. 1101)"
        value={values.plant}
        onChange={(e) => onChange({ plant: e.target.value })}
        className="h-9 sm:w-40"
      />
      <Input
        placeholder="Material"
        value={values.material}
        onChange={(e) => onChange({ material: e.target.value })}
        className="h-9 sm:w-40"
      />
      <Select
        value={values.agingBand || ALL_FILTER}
        onValueChange={(v) => {
          const value = v ?? ALL_FILTER
          onChange({ agingBand: value === ALL_FILTER ? "" : value })
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-40">
          <SelectValue placeholder="Aging band">
            {(v: string) => (v === ALL_FILTER ? "All aging bands" : AGING_LABEL[v as AgingBand] ?? v)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All aging bands</SelectItem>
          {Object.entries(AGING_LABEL).map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={values.acquiredVsPlanStatus || ALL_FILTER}
        onValueChange={(v) => {
          const value = v ?? ALL_FILTER
          onChange({ acquiredVsPlanStatus: value === ALL_FILTER ? "" : value })
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-44">
          <SelectValue placeholder="Acquired vs. plan">
            {(v: string) => (v === ALL_FILTER ? "All plan statuses" : PLAN_LABEL[v as AcquiredVsPlanStatus] ?? v)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All plan statuses</SelectItem>
          {Object.entries(PLAN_LABEL).map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={values.criticalFilter}
        onValueChange={(v) => onChange({ criticalFilter: (v ?? "all") as CriticalFilter })}
      >
        <SelectTrigger className="h-9 w-full sm:w-52">
          <SelectValue placeholder="Critical impact">{(v: string) => CRITICAL_LABEL[v as CriticalFilter] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CRITICAL_LABEL).map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  )
}
