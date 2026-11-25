"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { materialsHref, type MaterialsFilters } from "@/components/materials/materials-params"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CLASSIFICATION_LABEL,
  fetchMaterialsWorkbook,
  type MaterialClassification,
  type MaterialCounts,
} from "@/lib/api/materials"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount } from "@/lib/utils"

const ALL = "all"
const DEBOUNCE_MS = 400
/** The in-scope plants (the backend's app/shared/plant_scope.py). */
const PLANTS = ["1300", "1500"] as const

/** The same action-blue outline the audit trail's Export and Clear filters use. */
const ACTION_BUTTON =
  "h-9 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"

/**
 * Search, plant, All / OAR / Non-OAR, and the Excel download.
 *
 * Every control writes the URL and the server re-renders the list for it. The
 * navigation runs in a transition so the current rows stay on screen while the
 * next ones load, with a spinner so it does not look frozen. The search box
 * keeps its own text and writes the URL after a pause in typing.
 */
export function MaterialsFilterBar({
  filters,
  counts,
}: {
  filters: MaterialsFilters
  counts: MaterialCounts | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.search ?? "")
  const [exporting, setExporting] = useState(false)

  // Changing a filter returns to page 1 -- page 4 of a different list means nothing.
  const go = (next: Partial<MaterialsFilters>) =>
    startTransition(() => router.replace(materialsHref({ ...filters, ...next, page: 1 }), { scroll: false }))

  // Clear filters empties the box and navigates itself; without this the
  // debounce would fire afterwards with the old filters and put them back.
  const skipDebounce = useRef(false)

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false
      return
    }
    const typed = search.trim()
    if (typed === (filters.search ?? "")) return
    const timer = window.setTimeout(() => go({ search: typed || undefined }), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // `go` changes every render; the typed text is what this waits on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const filtered = Boolean(filters.search || filters.plant || filters.classification)

  async function handleExport() {
    setExporting(true)
    try {
      const { blob, filename } = await fetchMaterialsWorkbook(filters)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workbook could not be downloaded.")
    } finally {
      setExporting(false)
    }
  }

  const choices: { value: MaterialClassification | undefined; label: string; count?: number }[] = [
    { value: undefined, label: "All", count: counts?.total },
    { value: "OAR", label: CLASSIFICATION_LABEL.OAR, count: counts?.oar },
    { value: "NON_OAR", label: CLASSIFICATION_LABEL.NON_OAR, count: counts?.nonOar },
  ]

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
      <label className="relative w-full sm:w-72">
        <span className="sr-only">Search materials</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Material number or description"
          className="h-9 pl-8"
        />
      </label>

      <div className="w-full sm:w-56">
        <Select
          value={filters.plant ?? ALL}
          onValueChange={(v) => {
            const next = v ?? ALL
            go({ plant: next === ALL ? undefined : next })
          }}
        >
          <SelectTrigger className="h-9 w-full" aria-label="Plant">
            <SelectValue placeholder="All plants">
              {(v: string) => (v === ALL ? "All plants" : sapPlantLabel(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {PLANTS.map((plant) => (
              <SelectItem key={plant} value={plant}>
                {sapPlantLabel(plant)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div role="group" aria-label="Classification" className="inline-flex rounded-lg border border-border bg-background p-1">
        {choices.map((choice) => {
          const active = filters.classification === choice.value
          return (
            <button
              key={choice.label}
              type="button"
              aria-pressed={active}
              onClick={() => go({ classification: choice.value })}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                active ? "bg-action/10 text-action" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {choice.label}
              {choice.count !== undefined && (
                <span className="text-xs tabular-nums opacity-80">{formatCount(choice.count)}</span>
              )}
            </button>
          )
        })}
      </div>

      {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}

      <div className="ml-auto flex items-center gap-2">
        {filtered && (
          <Button
            variant="outline"
            size="sm"
            className={ACTION_BUTTON}
            onClick={() => {
              if (search !== "") skipDebounce.current = true
              setSearch("")
              startTransition(() => router.replace(materialsHref({ page: 1 }), { scroll: false }))
            }}
          >
            Clear filters
          </Button>
        )}
        <Button variant="outline" size="sm" className={ACTION_BUTTON} onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {exporting ? "Preparing Excel…" : "Download Excel"}
        </Button>
      </div>
    </div>
  )
}
