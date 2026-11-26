"use client"

import { Fragment, useState } from "react"
import { ArrowRightLeft, ChevronDown, ChevronRight } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { sapPlantName } from "@/lib/shared-data/sap-plants"
import { cn } from "@/lib/utils"
import { parseDecimal } from "@/features/initiative-7/services/reverse-conversion-api"
import { MinMaxToOarDetail } from "@/features/initiative-7/components/min-max-to-oar-detail"
import type { ApiReverseRecommendation, ReverseConfidenceCode } from "@/features/initiative-7/types/reverse-conversion"
import { formatFigure, reverseConfidenceLabel } from "@/features/initiative-7/utils/reverse-conversion-query"
import { requestSummary } from "@/features/initiative-7/utils/reverse-request-state"

const CONFIDENCE_TONE: Record<ReverseConfidenceCode, "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
}

// Relative column weights: chevron, Material, Plant, Criticality, Stock value, OAR conversion, Confidence. Everything
// else about a material (issues, months active, movements, history, lead time, stock, ROP / max stock, unit price)
// is in the row that opens when it is clicked.
const WIDTHS = [3, 24, 14, 14, 17, 16, 12]
const COLUMN_COUNT = WIDTHS.length

const MUTED = <span className="text-muted-foreground">—</span>

/** Stock x unit price, in ZAR (a ZAR price as it is, a NAD price at 1:1 -- the rule the OAR and Stock item figures use).
 * Stock with no price says so; a price in another currency says it is not counted; zero stock shows 0. */
function StockValueCell({ row }: { row: ApiReverseRecommendation }) {
  const value = parseDecimal(row.stock_value)
  if (value !== null) return <span className="tabular-nums font-medium">{formatFigure(value, 0)}</span>
  const stock = parseDecimal(row.current_stock)
  if (stock !== null && stock > 0) {
    if (parseDecimal(row.unit_price) !== null)
      return (
        <span className="text-muted-foreground" title="The unit price is not in ZAR or NAD, or is only a placeholder, so no value is stated">
          Not counted
        </span>
      )
    return <span className="text-muted-foreground" title="Stock on hand but no unit price, so no value">No price</span>
  }
  return MUTED
}

/**
 * The Min-Max to OAR results: one row per material-plant; clicking a row opens why it is recommended and its consumption. Every row is shown, including zero stock and a
 * missing price -- stock value only orders the rows inside a category (the backend ranks them), it never
 * decides one. Presentation only: nothing is computed here.
 */
export function MinMaxToOarTable({
  rows,
  loading = false,
  emptyMessage,
  onChanged,
}: {
  rows: ApiReverseRecommendation[]
  /** Called after a conversion request is raised or decided, so the list shows the new status. */
  onChanged?: () => void
  /** The next page is being fetched while these rows are still shown. */
  loading?: boolean
  emptyMessage: string
}) {
  // One row open at a time; clicking it again closes it. The key is the material-plant.
  const [openKey, setOpenKey] = useState<string | null>(null)
  return (
    <div className={cn("rounded-xl border border-border transition-opacity", loading && "opacity-60")} aria-busy={loading}>
      <StickyScrollTable widths={WIDTHS} minWidth={COLUMN_COUNT * 130} wrapCells>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Criticality</TableHead>
            <TableHead className="text-right" title="Stock on hand x unit price, in ZAR. A NAD price counts at 1:1; any other currency is not counted.">
              Stock value
            </TableHead>
            <TableHead title="Whether this Min-Max material could move to OAR ordering">OAR conversion</TableHead>
            <TableHead title="How sure the rule is that this material should be ordered only when needed (Convert to OAR rows only)">
              Confidence
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className="py-6 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const key = `${row.material}|${row.plant}`
            const isOpen = openKey === key
            return (
            <Fragment key={key}>
            <TableRow className="cursor-pointer" onClick={() => setOpenKey(isOpen ? null : key)} aria-expanded={isOpen}>
              <TableCell>
                {isOpen ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell>
                <span className="block truncate font-medium text-foreground" title={row.material}>
                  {row.material}
                </span>
                {row.description && (
                  <span className="block truncate text-[11px] text-muted-foreground" title={row.description}>
                    {row.description}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{sapPlantName(row.plant)}</TableCell>
              <TableCell>
                {row.criticality ? (
                  row.criticality
                ) : (
                  <span className="text-muted-foreground" title="No criticality recorded; never read as Normal">
                    Unknown
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <StockValueCell row={row} />
              </TableCell>
              <TableCell>
                <StatusBadge tone={row.conversion_eligibility === "eligible" ? "success" : "default"}>
                  <ArrowRightLeft className="size-3" />
                  {row.conversion_eligibility === "eligible" ? "Eligible" : "Not eligible"}
                </StatusBadge>
                {row.conversion_request && (
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                    {requestSummary(row.conversion_request.status, row.conversion_request.pending_role)}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {row.confidence ? (
                  <StatusBadge tone={CONFIDENCE_TONE[row.confidence] ?? "default"}>{reverseConfidenceLabel(row.confidence)}</StatusBadge>
                ) : (
                  MUTED
                )}
              </TableCell>
            </TableRow>
            {isOpen && (
              <TableRow className="hover:bg-transparent">
                <TableCell />
                <TableCell colSpan={COLUMN_COUNT - 1} className="bg-muted/30 py-4 whitespace-normal">
                  {/* The row truncates a long description to fit its column; the open row shows all of it. */}
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium break-words text-foreground">{row.description ?? row.material}</span>
                    {row.description && <span className="text-xs text-muted-foreground">{row.material}</span>}
                  </div>
                  <MinMaxToOarDetail row={row} onChanged={onChanged} />
                </TableCell>
              </TableRow>
            )}
            </Fragment>
            )
          })}
        </TableBody>
      </StickyScrollTable>
    </div>
  )
}
