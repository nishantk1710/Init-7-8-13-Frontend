"use client"

import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getI13ActExceptions,
  getI13ActUtilisation,
  getI13Justifications,
  getI13Reclassification,
  getI13Summary,
  getI13Validation,
} from "@/features/initiative-13/api/client"
import { AcquiredVsPlanPanel } from "@/features/initiative-13/components/acquired-vs-plan-panel"
import { AgingBucketsChart } from "@/features/initiative-13/components/aging-buckets-chart"
import { DashboardFilters, type DashboardFilterValues } from "@/features/initiative-13/components/dashboard-filters"
import { ExceptionStatusPanel } from "@/features/initiative-13/components/exception-status-panel"
import { JustificationLog } from "@/features/initiative-13/components/justification-log"
import { KpiSummary } from "@/features/initiative-13/components/kpi-summary"
import { NonMoverTable } from "@/features/initiative-13/components/non-mover-table"
import { ErrorState, LoadingState, UnavailableState } from "@/features/initiative-13/components/query-states"
import { ReclassificationTable } from "@/features/initiative-13/components/reclassification-table"
import { ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { useI13OptionalQuery } from "@/features/initiative-13/hooks/use-i13-optional-query"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"
import {
  attachCriticalImpactIndicator,
  buildLastRefreshedAt,
  countByField,
  filterNonMovers,
  matchesCriticalFilter,
} from "@/features/initiative-13/utils/dashboard-transforms"
import { downloadCsv, formatCount } from "@/lib/utils"

const FILTER_DEBOUNCE_MS = 400

const AGING_BAND_LABELS: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

/**
 * W6.7 — Initiative 13 Utilisation Dashboard (FR-10). A pure presentation
 * layer over the read-only Initiative 13 API — see this file's siblings
 * under `components/` for the per-section rendering, and
 * `utils/dashboard-transforms.ts` for the only transforms this page
 * performs (grouping/joining/filtering already-computed backend fields,
 * never a business rule). Officially depends on W6.3 (WATCH); the
 * reclassification (W6.5), exception (W6.6) and justification (W6.6)
 * sections degrade independently via `useI13OptionalQuery` so a backend
 * without those wired up still shows a usable dashboard (§17).
 */
export function UtilisationDashboardPage() {
  const [filters, setFilters] = useState<DashboardFilterValues>({
    plant: "",
    material: "",
    agingBand: "",
    acquiredVsPlanStatus: "",
    criticalFilter: "all",
  })
  const [debounced, setDebounced] = useState(filters)
  const [zmm065Input, setZmm065Input] = useState("")
  const [gr30DayInput, setGr30DayInput] = useState("")
  const [zmm065ReferenceCount, setZmm065ReferenceCount] = useState<number | undefined>(undefined)
  const [gr30DayReferenceCount, setGr30DayReferenceCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(filters), FILTER_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [filters])

  const summary = useI13Query(() => getI13Summary(), [])

  const utilisation = useI13Query(
    () =>
      getI13ActUtilisation({
        plant: debounced.plant || undefined,
        material: debounced.material || undefined,
        agingBand: debounced.agingBand || undefined,
        acquiredVsPlanStatus: debounced.acquiredVsPlanStatus || undefined,
      }),
    [debounced.plant, debounced.material, debounced.agingBand, debounced.acquiredVsPlanStatus]
  )

  const reclassification = useI13OptionalQuery(
    () => getI13Reclassification({ plant: debounced.plant || undefined, material: debounced.material || undefined }),
    [debounced.plant, debounced.material]
  )

  const exceptions = useI13OptionalQuery(
    () => getI13ActExceptions({ plant: debounced.plant || undefined, material: debounced.material || undefined }),
    [debounced.plant, debounced.material]
  )

  const justifications = useI13OptionalQuery(
    () => getI13Justifications({ plant: debounced.plant || undefined, material: debounced.material || undefined }),
    [debounced.plant, debounced.material]
  )

  const validation = useI13Query(
    () => getI13Validation({ zmm065ReferenceCount, gr30DayReferenceCount }),
    [zmm065ReferenceCount, gr30DayReferenceCount]
  )

  function applyReferenceCounts(e: React.FormEvent) {
    e.preventDefault()
    setZmm065ReferenceCount(zmm065Input.trim() === "" ? undefined : Number(zmm065Input))
    setGr30DayReferenceCount(gr30DayInput.trim() === "" ? undefined : Number(gr30DayInput))
  }

  const agingDistribution = useMemo(() => {
    if (!utilisation.data) return []
    return countByField(utilisation.data, (r) => r.agingBand).map((d) => ({
      ...d,
      bucket: AGING_BAND_LABELS[d.bucket] ?? d.bucket,
    }))
  }, [utilisation.data])

  const nonMoverRows = useMemo(() => {
    if (!utilisation.data) return []
    const nonMovers = filterNonMovers(utilisation.data)
    const withCriticality = attachCriticalImpactIndicator(
      nonMovers,
      reclassification.status === "ready" ? reclassification.data : []
    )
    return withCriticality.filter((row) => matchesCriticalFilter(row, filters.criticalFilter))
  }, [utilisation.data, reclassification, filters.criticalFilter])

  const lastRefreshedAt = useMemo(() => buildLastRefreshedAt(utilisation.data ?? []), [utilisation.data])

  function exportAgingCsv() {
    if (!utilisation.data) return
    downloadCsv(
      "i13-utilisation.csv",
      ["Material", "Plant", "Aging band", "Months of cover", "Days since movement", "Consumption (12m)", "Acquired vs plan"],
      utilisation.data.map((r) => [
        r.material,
        r.plant,
        r.agingBand,
        r.monthsOfCover ?? "",
        r.daysSinceLastMovement ?? "",
        r.consumptionCount12m,
        r.acquiredVsPlanStatus,
      ])
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Utilisation Dashboard"
          description="KPIs, aging, non-mover drilldown, acquired-vs-plan, exceptions, reclassification candidates, justifications and validation — one consolidated view over the read-only Initiative 13 API (FR-10)."
          actions={
            <span className="text-[11px] text-muted-foreground">
              {lastRefreshedAt
                ? `Last refreshed ${new Date(lastRefreshedAt).toLocaleString()}`
                : "Last refreshed: not yet available"}
            </span>
          }
        />

        <DashboardFilters values={filters} onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))} />

        {/* KPI Summary */}
        {summary.loading && <LoadingState label="Loading summary…" />}
        {summary.error && (
          <ErrorState message={summary.error} onRetry={summary.refetch} title="Unable to load utilisation summary." />
        )}
        {summary.data && <KpiSummary summary={summary.data} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Aging Distribution (§7) */}
          <ChartCard
            title="Aging distribution"
            subtitle="Backend-computed aging band (FAST/SLOW/NON_MOVING) — never reclassified in the browser"
            span={6}
          >
            {utilisation.loading && <LoadingState label="Loading WATCH metrics…" />}
            {utilisation.error && <ErrorState message={utilisation.error} onRetry={utilisation.refetch} />}
            {utilisation.data && <AgingBucketsChart data={agingDistribution} />}
          </ChartCard>

          {/* Acquired vs Plan (§9) */}
          <ChartCard title="Acquired vs. plan" subtitle="Backend-computed acquired-vs-plan status and variance" span={6}>
            {utilisation.loading && <LoadingState label="Loading WATCH metrics…" />}
            {utilisation.error && <ErrorState message={utilisation.error} onRetry={utilisation.refetch} />}
            {utilisation.data && <AcquiredVsPlanPanel rows={utilisation.data} />}
          </ChartCard>

          {/* Non-Mover Drilldown (§8) */}
          <ChartCard
            title="Non-mover drilldown"
            subtitle="NON_MOVING positions by plant and critical-impact indicator (joined from W6.5, when available)"
            span={12}
            footnote={
              <span>
                {reclassification.status === "unavailable" &&
                  "Critical-impact indicator unavailable — reclassification candidates (W6.5) could not be loaded, so this column shows Unknown for every row."}
              </span>
            }
          >
            {utilisation.loading && <LoadingState label="Loading non-mover positions…" />}
            {utilisation.error && <ErrorState message={utilisation.error} onRetry={utilisation.refetch} />}
            {utilisation.data && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportAgingCsv}>
                    <Download className="size-3.5" />
                    Export full utilisation set
                  </Button>
                </div>
                <NonMoverTable rows={nonMoverRows} />
              </div>
            )}
          </ChartCard>

          {/* Exception Status (§12) */}
          <ChartCard
            title="Exception status"
            subtitle="W6.6 ACT exception queue — read-only, no detection/escalation logic runs here"
            span={12}
          >
            {exceptions.status === "loading" && <LoadingState label="Loading ACT exceptions…" />}
            {exceptions.status === "unavailable" && (
              <UnavailableState message="ACT exceptions (W6.6) are not available from the current backend." />
            )}
            {exceptions.status === "error" && (
              <ErrorState message={exceptions.message} onRetry={exceptions.refetch} title="Unable to load exceptions." />
            )}
            {exceptions.status === "ready" && <ExceptionStatusPanel rows={exceptions.data} />}
          </ChartCard>

          {/* Reclassification Candidates (§11) */}
          <ChartCard
            title="Reclassification candidates"
            subtitle="W6.5 advisory evidence — recommended for review, never an automatic conversion"
            span={12}
          >
            {reclassification.status === "loading" && <LoadingState label="Loading reclassification candidates…" />}
            {reclassification.status === "unavailable" && (
              <UnavailableState message="Reclassification candidates (W6.5) are not available from the current backend." />
            )}
            {reclassification.status === "error" && (
              <ErrorState
                message={reclassification.message}
                onRetry={reclassification.refetch}
                title="Unable to load reclassification candidates."
              />
            )}
            {reclassification.status === "ready" && <ReclassificationTable candidates={reclassification.data} />}
          </ChartCard>

          {/* Justification Log (§10) */}
          <ChartCard
            title="Justification log"
            subtitle="Structured requester confirmations from W6.6 — audit/accountability view only"
            span={12}
            footnote="Bounded to the most recent confirmed/resolved ACT exceptions — there is no bulk confirmation-listing endpoint yet."
          >
            {justifications.status === "loading" && <LoadingState label="Loading justifications…" />}
            {justifications.status === "unavailable" && (
              <UnavailableState message="The justification log (W6.6) is not available from the current backend." />
            )}
            {justifications.status === "error" && (
              <ErrorState
                message={justifications.message}
                onRetry={justifications.refetch}
                title="Unable to load justifications."
              />
            )}
            {justifications.status === "ready" && <JustificationLog entries={justifications.data} />}
          </ChartCard>

          {/* Validation Views (§13) */}
          <ChartCard
            title="Validation"
            subtitle="Reconciliation against ZMM065 and the 30-Day GR Report — all tolerance math runs in the backend"
            span={12}
          >
            <form onSubmit={applyReferenceCounts} className="mb-3">
              <FilterBar>
                <Input
                  type="number"
                  placeholder="ZMM065 reference count"
                  value={zmm065Input}
                  onChange={(e) => setZmm065Input(e.target.value)}
                  className="h-9 sm:w-56"
                />
                <Input
                  type="number"
                  placeholder="30-Day GR reference count"
                  value={gr30DayInput}
                  onChange={(e) => setGr30DayInput(e.target.value)}
                  className="h-9 sm:w-56"
                />
                <Button type="submit" size="sm">
                  Apply reference counts
                </Button>
              </FilterBar>
            </form>
            {validation.loading && <LoadingState label="Loading validation results…" />}
            {validation.error && (
              <ErrorState message={validation.error} onRetry={validation.refetch} title="Unable to load validation data." />
            )}
            {validation.data && <ValidationPanel result={validation.data} />}
          </ChartCard>
        </div>

        {utilisation.data && (
          <p className="text-[11px] text-muted-foreground">{formatCount(utilisation.data.length)} WATCH position(s) matched the current filters.</p>
        )}
      </div>
    </div>
  )
}
