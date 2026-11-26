"use client"

import { useState } from "react"
import { AlertTriangle, Download, RefreshCw, RotateCcw } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { RecommendationsTableSkeleton } from "@/features/initiative-7/components/skeletons"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn } from "@/lib/utils"
import { ALL_FILTER } from "@/features/initiative-7/components/dashboard-filters"
import { ConfidenceInfo, LeadTimeInfo } from "@/features/initiative-7/components/min-max-to-oar-info"
import { HowGeneratedPanel, ReconciliationLine } from "@/features/initiative-7/components/min-max-to-oar-panels"
import { MinMaxToOarTable } from "@/features/initiative-7/components/min-max-to-oar-table"
import { useDebouncedValue } from "@/features/initiative-7/hooks/use-debounced-value"
import { useReverseRecommendations } from "@/features/initiative-7/hooks/use-reverse-recommendations"
import { fetchReverseCsvBlob } from "@/features/initiative-7/services/reverse-conversion-api"
import {
  REVERSE_CONFIDENCES,
  REVERSE_CRITICALITY_OPTIONS,
  REVERSE_ELIGIBILITY,
  REVERSE_LEAD_TIME_BUCKETS,
} from "@/features/initiative-7/types/reverse-conversion"
import {
  REVERSE_DEFAULT_FILTERS,
  REVERSE_PAGE_SIZE,
  activeReverseFilterCount,
  reverseErrorMessage,
  reverseExportParams,
  reverseFilterKey,
  reverseParamsFromFilters,
  type ReverseFilterState,
} from "@/features/initiative-7/utils/reverse-conversion-query"

/** The two plants this recommendation covers. */
const PLANTS = ["1300", "1500"] as const

/** A labelled filter, with an optional (i) button beside the label -- laid out like the filter bar's own fields. */
function Field({ label, info, children }: { label: string; info?: React.ReactNode; children: React.ReactNode }) {
  const labelText = (
    <span data-slot="filter-label" className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
      {label}
    </span>
  )
  return (
    <div className="flex flex-col gap-1">
      {info ? (
        <div className="flex items-center gap-1">
          {labelText}
          {info}
        </div>
      ) : (
        labelText
      )}
      {children}
    </div>
  )
}

/** A dropdown over a fixed option list plus "All". */
function OptionSelect({
  value,
  onChange,
  options,
  allLabel = "All",
  contentClassName,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly { code: string; label: string }[]
  allLabel?: string
  /** Classes for the open menu, e.g. a minimum width so a long option is not clipped. */
  contentClassName?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL_FILTER)}>
      <SelectTrigger className="h-8 w-full">
        <SelectValue placeholder={allLabel}>
          {(v: string) => (v === ALL_FILTER ? allLabel : (options.find((o) => o.code === v)?.label ?? v))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        <SelectItem value={ALL_FILTER}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.code} value={o.code}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The Min-Max to OAR view of the Recommendations page: Min-Max materials (VM / VB) that may be better ordered
 * on requirement (OAR), per material-plant, in four categories.
 *
 * Mounted by RecommendationsWorkspace in place of -- never alongside -- the OAR / Stock item workspace when the
 * page's toggle is on Min-Max to OAR, so selecting it fires none of their requests and selecting them fires none
 * of these. Read-only: it suggests, and nothing is written to SAP.
 */
export function MinMaxToOarWorkspace({ viewToggle }: { viewToggle?: React.ReactNode }) {
  const [filters, setFilters] = useState<ReverseFilterState>(REVERSE_DEFAULT_FILTERS)
  // Typing in the search box asks the backend once the person pauses, not on every keystroke.
  const searchText = useDebouncedValue(filters.material)
  const queryFilters = { ...filters, material: searchText }

  // Page number, back to 1 whenever a filter that decides the rows changes -- derived during render, not in an effect.
  const filterKey = reverseFilterKey(queryFilters)
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  const { data, loading, error, refetch } = useReverseRecommendations(reverseParamsFromFilters(queryFilters, page))

  const set = <K extends keyof ReverseFilterState>(key: K, value: ReverseFilterState[K]) => setFilters((prev) => ({ ...prev, [key]: value }))

  // Export CSV: every row the filters select (all pages), built by the backend from the same filters as the list.
  const [exportState, setExportState] = useState<"idle" | "preparing">("idle")
  const [exportError, setExportError] = useState<string | null>(null)
  async function exportCsv() {
    setExportError(null)
    setExportState("preparing")
    try {
      const { blobUrl, filename } = await fetchReverseCsvBlob(reverseExportParams(queryFilters))
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (failure) {
      setExportError(failure instanceof Error ? reverseErrorMessage(failure) : "The CSV export failed.")
    } finally {
      setExportState("idle")
    }
  }

  const activeCount = activeReverseFilterCount(filters)
  // The policy the backend applied, once a response has arrived; the info buttons explain the filters in its numbers.
  const policyParameters = data?.policy.parameters
  const emptyMessage = "No material-plants match these filters."

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-wrap items-end gap-3 rounded-lg border-2 border-action/40 bg-card p-4 shadow-lg",
          "[&>div]:min-w-[132px] [&>div]:flex-1 [&_[data-slot=filter-label]]:font-bold [&_[data-slot=filter-label]]:text-foreground",
          "[&_[data-slot=select-trigger]]:font-semibold [&_[data-slot=input]]:font-semibold",
        )}
      >
        <Field label="OAR conversion">
          <OptionSelect
            value={filters.eligibility}
            onChange={(v) => set("eligibility", v)}
            options={REVERSE_ELIGIBILITY.map((e) => ({ code: e.code, label: e.label }))}
          />
        </Field>
        <Field label="Confidence" info={<ConfidenceInfo parameters={policyParameters} />}>
          <OptionSelect value={filters.confidence} onChange={(v) => set("confidence", v)} options={REVERSE_CONFIDENCES} allLabel="All confidence" />
        </Field>
        <Field label="Plant">
          <OptionSelect
            value={filters.plant}
            onChange={(v) => set("plant", v)}
            options={PLANTS.map((code) => ({ code, label: sapPlantLabel(code) }))}
          />
        </Field>
        <Field label="Criticality">
          <OptionSelect value={filters.criticality} onChange={(v) => set("criticality", v)} options={REVERSE_CRITICALITY_OPTIONS} />
        </Field>
        <Field label="Lead time" info={<LeadTimeInfo parameters={policyParameters} />}>
          <OptionSelect value={filters.leadTime} onChange={(v) => set("leadTime", v)} options={REVERSE_LEAD_TIME_BUCKETS} />
        </Field>
        <Field label="Material">
          <Input
            value={filters.material}
            onChange={(event) => set("material", event.target.value)}
            placeholder="Material number or description"
            className="h-8"
            aria-label="Search by material number or description"
          />
        </Field>
        <div className="flex items-end gap-2 flex-none! min-w-0!">
          {/* The same Clear filters button as the OAR and Stock item filter bar: always shown, dimmed while there is nothing to clear. */}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 grow-0 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
            disabled={activeCount === 0}
            onClick={() => setFilters(REVERSE_DEFAULT_FILTERS)}
          >
            <RotateCcw className="size-3.5" />
            Clear filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 grow-0 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
            onClick={exportCsv}
            disabled={exportState === "preparing"}
            title="Download the recommendations the filters select (every page) as a CSV file"
          >
            <Download className="size-3.5" />
            {exportState === "preparing" ? "Preparing CSV…" : "Export CSV"}
          </Button>
        </div>
      </div>
      {exportError && (
        <p role="alert" className="text-xs text-destructive">
          {exportError}
        </p>
      )}
      {viewToggle}

      {!data && loading ? (
        <RecommendationsTableSkeleton label="Loading Stock item to OAR recommendations" />
      ) : !data && error ? (
        <EmptyState
          icon={<AlertTriangle className="size-4" />}
          title="Could not load Stock item to OAR recommendations"
          description={reverseErrorMessage(error as Error & { code?: string })}
          actions={
            <Button size="sm" variant="outline" onClick={refetch}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          }
        />
      ) : data ? (
        <>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              Could not refresh: {reverseErrorMessage(error as Error & { code?: string })}{" "}
              <button type="button" className="underline" onClick={refetch}>
                Retry
              </button>
            </p>
          )}
          <HowGeneratedPanel anchor={data.anchor} policy={data.policy} />
          <ReconciliationLine summary={data.summary} reconciliation={data.reconciliation} />
          <MinMaxToOarTable rows={data.items} loading={loading} emptyMessage={emptyMessage} onChanged={refetch} />
          <TablePagination
            page={page}
            pageSize={REVERSE_PAGE_SIZE}
            total={data.total}
            count={data.items.length}
            noun="material-plants"
            onPageChange={setPage}
            loading={loading}
          />
        </>
      ) : null}
    </div>
  )
}
