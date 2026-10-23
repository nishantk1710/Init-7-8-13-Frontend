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
  /** Live mode (Recommendations page). How the recommendation was worked out:
   * "oar" (sized from similar materials) or "stock_item" (everything else: normal and
   * declining demand together). Pushed to the backend as the `type` query param --
   * a client-side filter over one fetched page would miss most of the catalogue.
   * Separate from `recommendation` (calculated or not). */
  type: string
  /** Live mode (Recommendations page, OAR only). How sure the similarity engine is of an
   * OAR recommendation: "HIGH", "MEDIUM" or "LOW". Only OAR rows carry one. */
  confidence: string
  /** Live mode (Recommendations page, OAR only). The OAR -> Min-Max conversion decision:
   * "ELIGIBLE" or "NOT_ELIGIBLE", as the backend stores it. Applied in SQL. */
  conversion: string
  /** Live mode only. Reconciliation result against SAP change-document
   * evidence (see use-live-adoption.ts) -- "Adopted" / "Partially adopted" /
   * "Not adopted" / "Unknown", the same 4 values Adoption Tracking's table
   * shows. Not a property of the recommendation row itself; the caller joins
   * it in by recommendation id (a separate reconciliation fetch), so this
   * filter only has an effect where that join was actually performed. */
  sapAdoption: string
}

export const RECOMMENDATION_FILTER_CALCULATED = "calculated"

/** The Recommendation filter's options: OAR, or a stock item (a normal or declining-demand
 * material, i.e. anything that is not OAR). */
export const RECOMMENDATION_TYPE_OPTIONS = [
  { value: "oar", label: "OAR" },
  { value: "stock_item", label: "Stock item" },
] as const

/** The OAR confidence filter's options, as the backend stores them. */
export const CONFIDENCE_OPTIONS = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
] as const

/** The OAR Min-Max conversion filter's options, as the backend stores them. */
export const MIN_MAX_CONVERSION_OPTIONS = [
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "NOT_ELIGIBLE", label: "Not eligible" },
] as const

/** Whether a row's risk satisfies the Stockout Risk filter. With the merged tiers, "high" also
 * takes the rows the backend calls "critical". */
export function matchesRiskFilter(filter: string, risk: RiskLevel, mergeCriticalIntoHigh: boolean): boolean {
  if (filter === ALL_FILTER) return true
  if (mergeCriticalIntoHigh && filter === "high") return risk === "high" || risk === "critical"
  return risk === filter
}

export const SAP_ADOPTION_STATUSES = ["Adopted", "Partially adopted", "Not adopted", "Unknown"] as const

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
  type: ALL_FILTER,
  confidence: ALL_FILTER,
  conversion: ALL_FILTER,
  sapAdoption: ALL_FILTER,
}

/** Whether any filter differs from `baseline` -- what "Clear filters" would put back. The baseline is
 * every filter off, unless a page starts from something else (the Recommendations page starts on OAR). */
export function isDashboardFiltersActive(
  filters: DashboardFilterState,
  baseline: DashboardFilterState = EMPTY_DASHBOARD_FILTERS,
): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "material") return value.trim().length > 0
    // The default is calculated-only, so that value is not an "active" filter
    // -- only switching it to All (or anything else) counts as one.
    if (key === "recommendation") return value !== RECOMMENDATION_FILTER_CALCULATED
    return value !== baseline[key as keyof DashboardFilterState]
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
      <span
        data-slot="filter-label"
        className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
      >
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
  showSapAdoptionFilter = false,
  showCircuitFilter = true,
  showTypeFilter = false,
  typeFilterLabel = "Type",
  typeFilterAllowAll = false,
  showStatusFilter = true,
  showRiskFilter = true,
  showConfidenceFilter = false,
  showConversionFilter = false,
  resetFilters = EMPTY_DASHBOARD_FILTERS,
  hiddenDemandPatterns = [],
  mergeCriticalIntoHigh = false,
}: {
  value: DashboardFilterState
  onChange: (value: DashboardFilterState) => void
  layout?: "rail" | "bar"
  /** The real SAP plant codes present in the data, from the backend's own
   * by_plant aggregate -- see utils/sap-plants.ts. */
  plantOptions: { value: string; label: string; count?: number }[]
  /** Live mode only -- the scenario dataset has no "blocked vs calculated"
   * distinction to filter on (every fixture row carries values). */
  showRecommendationFilter?: boolean
  /** Live mode only -- requires the caller to have already joined an
   * adoption-status onto each recommendation (a separate reconciliation
   * fetch keyed by recommendation id, see use-live-adoption.ts); the
   * scenario dataset carries no such field at all. */
  showSapAdoptionFilter?: boolean
  /** False hides the Circuit dropdown -- for a page whose rows have no real
   * circuit, where every option would filter to nothing. */
  showCircuitFilter?: boolean
  /** Live Recommendations page: adds the Type filter (OAR / Declining / Normal). */
  showTypeFilter?: boolean
  /** The label above that dropdown. The Recommendations page calls it "Recommendation". */
  typeFilterLabel?: string
  /** Adds an "All" option to the Type dropdown. The Recommendations page has none (a recommendation
   * is OAR or a stock item); the Overview, which counts both, offers it. */
  typeFilterAllowAll?: boolean
  /** False hides the Recommendation Status dropdown. The Recommendations page hides it: a
   * recommendation sent for approval is decided in the Action Center and leaves that page, so
   * there is no status left to filter by. */
  showStatusFilter?: boolean
  /** False hides the Stockout Risk dropdown -- for a page whose risk figures are not a property of a
   * recommendation row, so there is nothing for the dropdown to filter. */
  showRiskFilter?: boolean
  /** Adds the OAR confidence dropdown (High / Medium / Low). Offered only where the rows
   * on view are OAR ones, since no other recommendation carries a confidence. */
  showConfidenceFilter?: boolean
  /** Adds the OAR Min-Max conversion dropdown (Eligible / Not eligible). Offered only where
   * the rows on view are OAR ones, since only they carry a conversion decision. */
  showConversionFilter?: boolean
  /** What "Clear filters" puts back, and what counts as "no filter set". Every filter off by
   * default; the Recommendations page passes its own starting point (OAR), since it has no "All". */
  resetFilters?: DashboardFilterState
  /** Demand patterns to leave out of the Demand Pattern dropdown. The Recommendations page leaves out
   * Smooth: a smooth-demand material is sized by SAP, not recommended, so it is never in that list. */
  hiddenDemandPatterns?: readonly DemandPattern[]
  /** The Stockout Risk filter offers High, Medium and Low only; High stands for Critical and
   * High together. The caller matches rows accordingly (see matchesRiskFilter). */
  mergeCriticalIntoHigh?: boolean
}) {
  function set<K extends keyof DashboardFilterState>(key: K, next: string) {
    onChange({ ...value, [key]: next })
  }

  const isBar = layout === "bar"
  const plants = plantOptions
  const plantLabel = (v: string) => plantOptions.find((p) => p.value === v)?.label ?? v

  return (
    <div
      className={cn(
        "bg-card p-4",
        isBar
          ? // The bar: the same bold bordered, shadowed track as the filters on the Action Center, Approvals and
            // Audit trail.
            // Field names bold and dark, and the chosen values semi-bold, so the bar reads at a glance.
            "flex flex-wrap items-end gap-3 rounded-lg border-2 border-primary/40 shadow-lg [&>div]:min-w-[132px] [&>div]:flex-1 [&_[data-slot=filter-label]]:font-bold [&_[data-slot=filter-label]]:text-foreground [&_[data-slot=select-trigger]]:font-semibold [&_[data-slot=input]]:font-semibold"
          : // The Overview's rail: field names (Recommendation, Plant, ...) a little bolder than the bar's.
            "flex flex-col gap-4 rounded-xl border border-border [&_[data-slot=filter-label]]:font-semibold"
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

      {showTypeFilter && (
        <FilterField label={typeFilterLabel}>
          {/* No "All" unless asked for: a recommendation is either OAR or a stock item. */}
          <Select value={value.type} onValueChange={(v) => set("type", v ?? resetFilters.type)}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder={typeFilterAllowAll ? "All" : "OAR"}>
                {(v: string) =>
                  v === ALL_FILTER ? "All" : (RECOMMENDATION_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {typeFilterAllowAll && <SelectItem value={ALL_FILTER}>All</SelectItem>}
              {RECOMMENDATION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
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

      {showCircuitFilter && (
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
      )}

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
            {DEMAND_PATTERNS.filter((d) => !hiddenDemandPatterns.includes(d)).map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {showStatusFilter && (
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
      )}

      {showConfidenceFilter && (
        <FilterField label="Recommendation Confidence">
          <Select value={value.confidence} onValueChange={(v) => set("confidence", v ?? ALL_FILTER)}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="All">
                {(v: string) => CONFIDENCE_OPTIONS.find((o) => o.value === v)?.label ?? "All"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All</SelectItem>
              {CONFIDENCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      )}

      {showConversionFilter && (
        <FilterField label="Min-Max conversion">
          <Select value={value.conversion} onValueChange={(v) => set("conversion", v ?? ALL_FILTER)}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="All">
                {(v: string) => MIN_MAX_CONVERSION_OPTIONS.find((o) => o.value === v)?.label ?? "All"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All</SelectItem>
              {MIN_MAX_CONVERSION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      )}

      {showRiskFilter && (
        <FilterField label="Stockout Risk">
          <Select value={value.risk} onValueChange={(v) => set("risk", v ?? ALL_FILTER)}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="All">
                {(v: string) => (v === ALL_FILTER ? "All" : v.charAt(0).toUpperCase() + v.slice(1))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All</SelectItem>
              {(mergeCriticalIntoHigh ? RISK_LEVELS.filter((r) => r !== "critical") : RISK_LEVELS).map((r) => (
                <SelectItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      )}

      {showSapAdoptionFilter && (
        <FilterField label="SAP Adoption">
          <Select value={value.sapAdoption} onValueChange={(v) => set("sapAdoption", v ?? ALL_FILTER)}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="All">{(v: string) => (v === ALL_FILTER ? "All" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All</SelectItem>
              {SAP_ADOPTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "Unknown" ? "Pending" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      )}

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
        className={
          isBar
            ? // Highlighted like Clear filters on the Audit trail; it dims, as before, while there is nothing to clear.
              "shrink-0 grow-0 border-primary bg-primary/10 font-semibold text-primary shadow-sm hover:bg-primary/20 hover:text-primary"
            : undefined
        }
        disabled={!isDashboardFiltersActive(value, resetFilters)}
        onClick={() => onChange(resetFilters)}
      >
        <RotateCcw className="size-3.5" />
        Clear filters
      </Button>
    </div>
  )
}
