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
import { formatFigure, formatMonthsAgo, formatYearMonth, reverseConfidenceLabel } from "@/features/initiative-7/utils/reverse-conversion-query"

const CONFIDENCE_TONE: Record<ReverseConfidenceCode, "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
}

// Relative column weights: chevron, Material, Plant, MRP type, Criticality, OAR conversion, Confidence, Reason, Issues, Months, First, Last,
// History span, Lead time, Stock, MINBE / MABST, Unit price, Stock value.
const WIDTHS = [3, 16, 8, 6, 9, 9, 7, 20, 6, 7, 8, 9, 7, 7, 7, 8, 7, 9]
const COLUMN_COUNT = WIDTHS.length

const MUTED = <span className="text-muted-foreground">—</span>

function Figure({ value, digits = 2 }: { value: number | null; digits?: number }) {
  return value === null ? MUTED : <span className="tabular-nums">{formatFigure(value, digits)}</span>
}

/** Stock x unit price. Stock with no price says so; zero stock shows 0. The source gives no currency, so no symbol. */
function StockValueCell({ row }: { row: ApiReverseRecommendation }) {
  const value = parseDecimal(row.stock_value)
  if (value !== null) return <span className="tabular-nums font-medium">{formatFigure(value, 0)}</span>
  const stock = parseDecimal(row.current_stock)
  if (stock !== null && stock > 0) return <span className="text-muted-foreground" title="Stock on hand but no unit price, so no value">No price</span>
  return MUTED
}

function MinMaxCell({ row }: { row: ApiReverseRecommendation }) {
  const minbe = parseDecimal(row.minbe)
  const mabst = parseDecimal(row.mabst)
  if (minbe === null && mabst === null) return MUTED
  return (
    <span className="tabular-nums" title="Reorder point (MINBE) / maximum stock (MABST) set in SAP">
      {minbe === null ? "—" : formatFigure(minbe, 0)} / {mabst === null ? "—" : formatFigure(mabst, 0)}
    </span>
  )
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
  anchorMonth,
}: {
  rows: ApiReverseRecommendation[]
  /** The calculation anchor (YYYY-MM): the opened row's chart is drawn to the same month as the list. */
  anchorMonth: string
  /** The next page is being fetched while these rows are still shown. */
  loading?: boolean
  emptyMessage: string
}) {
  // One row open at a time; clicking it again closes it. The key is the material-plant.
  const [openKey, setOpenKey] = useState<string | null>(null)
  return (
    <div className={cn("rounded-xl border border-border transition-opacity", loading && "opacity-60")} aria-busy={loading}>
      <StickyScrollTable widths={WIDTHS} minWidth={COLUMN_COUNT * 118} wrapCells>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>MRP type</TableHead>
            <TableHead>Criticality</TableHead>
            <TableHead title="Whether this Min-Max material could move to OAR ordering">OAR conversion</TableHead>
            <TableHead title="How sure the rule is that this material should be ordered only when needed (Convert to OAR rows only)">
              Confidence
            </TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right" title="Net issue transactions in the latest 12 complete months">
              Issues (last 12 months)
            </TableHead>
            <TableHead className="text-right" title="Months in the latest 12 with consumption (net issued quantity above zero)">
              Months with use (of 12)
            </TableHead>
            <TableHead>First movement (month)</TableHead>
            <TableHead>Last movement (month)</TableHead>
            <TableHead className="text-right" title="Months from the first to the latest consumption, both counted">
              History (months)
            </TableHead>
            <TableHead className="text-right">Lead time (days)</TableHead>
            <TableHead className="text-right" title="Quantity currently on hand, not the quantity used. Usage is shown in Issues (last 12 months).">
              Stock on hand (base unit)
            </TableHead>
            <TableHead className="text-right" title="Current reorder point (MINBE) / maximum stock (MABST) set in SAP">
              Current ROP / Max stock (base unit)
            </TableHead>
            <TableHead className="text-right">Unit price (no currency)</TableHead>
            <TableHead className="text-right" title="Stock x unit price. The source gives no currency.">
              Stock value (no currency)
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
              <TableCell>{row.mrp_type ?? MUTED}</TableCell>
              <TableCell>
                {row.criticality ? (
                  row.criticality
                ) : (
                  <span className="text-muted-foreground" title="No criticality recorded; never read as Normal">
                    Unknown
                  </span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge tone={row.conversion_eligibility === "eligible" ? "success" : "default"}>
                  <ArrowRightLeft className="size-3" />
                  {row.conversion_eligibility === "eligible" ? "Eligible" : "Not eligible"}
                </StatusBadge>
              </TableCell>
              <TableCell>
                {row.confidence ? (
                  <StatusBadge tone={CONFIDENCE_TONE[row.confidence] ?? "default"}>{reverseConfidenceLabel(row.confidence)}</StatusBadge>
                ) : (
                  MUTED
                )}
              </TableCell>
              <TableCell>
                <span className="block font-medium text-foreground">{row.reason_label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground" title={row.explanation}>
                  {row.explanation}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.issues_latest_12m}</TableCell>
              <TableCell className="text-right tabular-nums">{row.months_with_consumption_12m}</TableCell>
              <TableCell>{formatYearMonth(row.first_valid_movement)}</TableCell>
              <TableCell>
                <span className="block">{formatYearMonth(row.last_valid_movement)}</span>
                {row.last_valid_movement && (
                  <span className="block text-[11px] text-muted-foreground">{formatMonthsAgo(row.months_since_last_movement)}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.history_span_months ?? MUTED}</TableCell>
              <TableCell className="text-right">
                {parseDecimal(row.lead_time_days) === null ? (
                  <span className="text-muted-foreground" title="Lead time is not known">
                    Unknown
                  </span>
                ) : (
                  <span className="tabular-nums">{formatFigure(parseDecimal(row.lead_time_days), 0)}</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Figure value={parseDecimal(row.current_stock)} digits={3} />
              </TableCell>
              <TableCell className="text-right">
                <MinMaxCell row={row} />
              </TableCell>
              <TableCell className="text-right">
                <Figure value={parseDecimal(row.unit_price)} />
              </TableCell>
              <TableCell className="text-right">
                <StockValueCell row={row} />
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
                  <MinMaxToOarDetail row={row} anchorMonth={anchorMonth} />
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
