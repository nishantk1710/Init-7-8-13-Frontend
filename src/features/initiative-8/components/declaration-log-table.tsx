"use client"

import { useMemo, useState } from "react"
import { Copy, Download } from "lucide-react"
import { toast } from "sonner"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import { FilterChips, MaterialCell, ResultsCard } from "@/features/initiative-8/components/kit/list"
import { Actor, StatusDot } from "@/features/initiative-8/components/kit/status"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { repairHref } from "@/features/initiative-8/components/repair-register-table"
import { UrlSelect } from "@/features/initiative-8/components/url-filters"
import type { DeclarationLogRow } from "@/features/initiative-8/data/live-declarations"
import { actorLabel, conditionLabel, humanize, i08Quantity, plantShort } from "@/features/initiative-8/utils/format"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { downloadExcel } from "@/lib/utils"

/**
 * The declaration log: every condition declaration recorded, newest first --
 * what was judged, by whom, on what (I08_Live_UI_Redesign_Plan.md, L4).
 *
 * It was four screens down, under the queue, with its own second filter bar;
 * it is a tab now. Loaded whole (it holds a handful of rows) and filtered here.
 *
 * Records are never edited or deleted: a correction is a new row pointing at
 * the one it replaced, and both stay listed -- which is why a superseded row is
 * marked rather than removed.
 */
export function DeclarationLogTable({
  rows: allRows,
  faultCategories = [],
}: {
  rows: DeclarationLogRow[]
  /** For Amend's form. Empty when that fetch failed: the form says so. */
  faultCategories?: string[]
}) {
  // The declaration being amended. Only one in force is offered Amend: a
  // superseded record is history, and amending it would fork the chain.
  const [amending, setAmending] = useState<DeclarationLogRow | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [search, setSearch] = useState("")
  const [condition, setCondition] = useState("")
  const [plant, setPlant] = useState("")
  const [inForceOnly, setInForceOnly] = useState(false)

  const conditions = useMemo(() => [...new Set(allRows.map((r) => r.condition).filter(Boolean))].sort(), [allRows])
  const plants = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of allRows) if (r.plant) seen.set(r.plant.plantId, r.plant.name ?? r.plant.plantId)
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [allRows])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allRows.filter((r) => {
      if (condition && r.condition !== condition) return false
      if (plant && r.plant?.plantId !== plant) return false
      if (inForceOnly && r.supersededBy) return false
      if (
        needle &&
        ![r.id, r.material.materialCode, r.material.description, r.conditionDescription, r.serialNumber, r.evidenceReference, humanize(r.faultCategory), r.repairId]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      ) {
        return false
      }
      return true
    })
  }, [allRows, search, condition, plant, inForceOnly])

  const { paged, page, pageSize, total, setPage } = usePaginatedRows(rows, {
    resetKey: [search, condition, plant, inForceOnly].join("|"),
  })

  const chips = [
    search.trim() && { key: "q", label: `Search: “${search.trim()}”` },
    condition && { key: "condition", label: `Condition: ${conditionLabel(condition)}` },
    plant && { key: "plant", label: `Plant: ${plants.find(([id]) => id === plant)?.[1] ?? plant}` },
    inForceOnly && { key: "inForce", label: "In force only" },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))
  const remove = (key: string) => {
    if (key === "q") setSearch("")
    if (key === "condition") setCondition("")
    if (key === "plant") setPlant("")
    if (key === "inForce") setInForceOnly(false)
  }
  const clearAll = () => {
    setSearch("")
    setCondition("")
    setPlant("")
    setInForceOnly(false)
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search material, notes or declaration id"
          aria-label="Search declarations"
          className="h-9 w-full bg-background sm:w-72"
        />
        <UrlSelect
          value={condition}
          onChange={setCondition}
          allLabel="Any condition"
          options={conditions.map((c) => ({ value: c, label: conditionLabel(c) }))}
          className="sm:w-52"
        />
        <UrlSelect
          value={plant}
          onChange={setPlant}
          allLabel="All plants"
          options={plants.map(([id, name]) => ({ value: id, label: name }))}
          className="sm:w-44"
        />
        <UrlSelect
          value={inForceOnly ? "1" : ""}
          onChange={(value) => setInForceOnly(value === "1")}
          allLabel="Including superseded"
          options={[{ value: "1", label: "In force only" }]}
          className="sm:w-48"
        />
        {/* The log as filtered, every column. */}
        <Button
          size="lg"
          variant="outline"
          className="px-3.5 sm:ml-auto border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
          disabled={rows.length === 0}
          onClick={() => void downloadExcel("i08-declaration-log.xlsx", DECLARATION_LOG_HEADERS, declarationLogRowsForExcel(rows))}
        >
          <Download className="size-4" />
          Export Excel
        </Button>
      </div>

      <FilterChips chips={chips} onRemove={remove} onClear={clearAll} />

      <ResultsCard>
        {allRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">No declarations recorded yet</p>
            <p className="max-w-md text-[13.5px] text-muted-foreground">
              Declare a part with the button above, or from any repair line in the To declare tab or on its repair
              page.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">No declarations match</p>
            <Button variant="outline" size="lg" className="mt-1" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <StickyScrollTable tableClassName="table-fixed min-w-[1080px]">
              <colgroup>
                {[16, 20, 11, 15, 11, 11, 10, 6].map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head>Declared</Head>
                  <Head frozen>Material</Head>
                  <Head>Plant</Head>
                  <Head>Condition</Head>
                  <Head>Fault</Head>
                  <Head>Notes</Head>
                  <Head>By</Head>
                  <Head>
                    <span className="sr-only">Action</span>
                  </Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => (
                  <TableRow key={r.id} className={r.supersededBy ? "opacity-60" : undefined}>
                    <Cell>
                      <div className="flex flex-col leading-snug">
                        <span>{r.attestedAt ?? "—"}</span>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[12px] text-muted-foreground">
                          {r.id}
                          <button
                            type="button"
                            aria-label={`Copy ${r.id}`}
                            title="Copy the declaration id"
                            onClick={() =>
                              navigator.clipboard?.writeText(r.id).then(
                                () => toast.success(`Copied ${r.id}`),
                                () => toast.error("Could not copy: the browser blocked it."),
                              )
                            }
                            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-i08-link"
                          >
                            <Copy className="size-3" />
                          </button>
                        </span>
                      </div>
                    </Cell>
                    <Cell frozen>
                      {/* Opens the repair line it was declared on, when it was. */}
                      <MaterialCell
                        code={r.material.materialCode}
                        description={r.material.description}
                        href={r.repairId ? repairHref({ id: r.repairId }) : undefined}
                        extra={
                          Number(r.quantity) !== 1 ? (
                            <span className="rounded-full bg-accent px-1.5 font-sans text-xs font-semibold text-accent-foreground">
                              × {i08Quantity(r.quantity)}
                            </span>
                          ) : undefined
                        }
                      />
                    </Cell>
                    <Cell wrap>
                      <span title={r.plant?.name}>{plantShort(r.plant?.name ?? r.plant?.plantId)}</span>
                    </Cell>
                    <Cell wrap>
                      <div className="flex flex-col leading-snug">
                        {r.condition === "Repairable" ? (
                          <StatusDot tone="good">Repairable</StatusDot>
                        ) : (
                          <StatusDot tone="neutral" wrap>
                            {conditionLabel(r.condition)}
                          </StatusDot>
                        )}
                        {r.supersededBy && <span className="text-[12px] text-muted-foreground">Superseded by {r.supersededBy}</span>}
                        {r.isAmendment && (
                          <span className="text-[12px] text-muted-foreground" title={r.amendmentReason}>
                            Amendment{r.amendmentReason ? `: ${r.amendmentReason}` : ""}
                          </span>
                        )}
                      </div>
                    </Cell>
                    <Cell wrap>{humanize(r.faultCategory)}</Cell>
                    <Cell>
                      <span className="block truncate" title={r.conditionDescription}>
                        {r.conditionDescription || "—"}
                      </span>
                      {r.evidenceReference && (
                        <span className="block truncate text-[12px] text-muted-foreground" title={r.evidenceReference}>
                          Evidence: {r.evidenceReference}
                        </span>
                      )}
                    </Cell>
                    <Cell wrap>
                      <Actor actor={r.attestor} />
                    </Cell>
                    <Cell right>
                      {!r.supersededBy && r.plant && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFormKey((k) => k + 1)
                            setAmending(r)
                          }}
                        >
                          Amend
                        </Button>
                      )}
                    </Cell>
                  </TableRow>
                ))}
              </TableBody>
            </StickyScrollTable>
            <div className="border-t border-border px-4 py-2.5">
              <TablePagination page={page} pageSize={pageSize} total={total} count={paged.length} noun="declarations" onPageChange={setPage} />
            </div>
          </>
        )}
      </ResultsCard>

      {amending && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setAmending(null)}
          target={{
            materialId: amending.material.materialId,
            plantId: amending.plant?.plantId,
            label: `${amending.material.materialCode} · ${amending.material.description} · ${amending.plant?.name ?? "an unknown plant"}${amending.repairId ? ` · repair line ${amending.repairId}` : ""}`,
            defaultQuantity: amending.quantity,
            supersedes: amending.id,
            // The amendment names the same line the original did, if any.
            repairDocument: amending.repairDocument,
            repairItem: amending.repairItem,
            repairDocumentType: amending.repairDocumentType,
          }}
          faultCategories={faultCategories}
        />
      )}
    </>
  )
}

/** The log as the user filtered it, for Export Excel: every column, wide. */
export function declarationLogRowsForExcel(rows: DeclarationLogRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.attestedAt ?? "",
    r.material.materialCode,
    r.material.description ?? "",
    r.plant?.name ?? r.plant?.plantId ?? "",
    r.quantity,
    r.condition,
    humanize(r.faultCategory),
    r.conditionDescription,
    r.serialNumber ?? "",
    r.evidenceReference ?? "",
    actorLabel(r.attestor),
    r.id,
    r.repairId ?? "",
    r.isAmendment ? "Yes" : "No",
    r.supersededBy ?? "",
    r.amendmentReason ?? "",
  ])
}

export const DECLARATION_LOG_HEADERS = [
  "Declared At",
  "Material",
  "Description",
  "Plant",
  "Qty",
  "Condition",
  "Fault Category",
  "Condition Description",
  "Serial",
  "Evidence Reference",
  "Declared By",
  "Declaration",
  "Repair Line",
  "Amendment",
  "Superseded By",
  "Amendment Reason",
]
