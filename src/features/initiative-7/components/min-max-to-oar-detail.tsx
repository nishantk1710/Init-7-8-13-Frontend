"use client"

import type { ReactNode } from "react"
import { AlertTriangle, ArrowRightLeft } from "lucide-react"

import { PageLoader } from "@/components/shared/page-loader"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConsumptionChart } from "@/features/initiative-7/components/min-max-to-oar-chart"
import { ConvertToOarSection } from "@/features/initiative-7/components/min-max-to-oar-convert"
import { useReverseConsumption } from "@/features/initiative-7/hooks/use-reverse-consumption"
import { parseDecimal } from "@/features/initiative-7/services/reverse-conversion-api"
import type { ApiReverseRecommendation, ReverseConfidenceCode } from "@/features/initiative-7/types/reverse-conversion"
import {
  formatChange,
  formatFigure,
  formatLeadTime,
  formatMonthsAgo,
  formatYearMonth,
  reverseConfidenceLabel,
  reverseErrorMessage,
} from "@/features/initiative-7/utils/reverse-conversion-query"

const CONFIDENCE_TONE: Record<ReverseConfidenceCode, "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] break-words text-foreground">{children}</dd>
    </div>
  )
}

const NONE = <span className="text-muted-foreground">—</span>

/**
 * What opens under a Min-Max to OAR row when it is clicked, laid out like the OAR and Stock item rows: the
 * consumption history on the left; on the right the move-to-OAR section (how sure the rule is, the figures it
 * used, and the Reason), then the material's own facts. Its own component: nothing is shared with the OAR /
 * Stock item review panel.
 */
export function MinMaxToOarDetail({ row, onChanged }: { row: ApiReverseRecommendation; onChanged?: () => void }) {
  const { data, loading, error } = useReverseConsumption(row.material, row.plant)
  const minbe = parseDecimal(row.minbe)
  const mabst = parseDecimal(row.mabst)
  const stock = parseDecimal(row.current_stock)
  const lead = parseDecimal(row.lead_time_days)
  const price = parseDecimal(row.unit_price)
  const alternative = row.min_max_alternative ?? null
  // The reason as labelled lines; an older backend sends only the paragraph, which is then shown as before.
  const points = row.explanation_points ?? []

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-background p-3">
          <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">Consumption history (last 24 months)</h4>
          <div className="mt-2">
            {loading ? (
              <PageLoader label="Loading consumption" className="h-52 w-full" />
            ) : error || !data ? (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {error ? reverseErrorMessage(error as Error & { code?: string }) : "Consumption is not available."}
              </p>
            ) : (
              <ConsumptionChart consumption={data} />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">Recommended</span>
            <ArrowRightLeft className="size-3.5" />
            Move from Min-Max to OAR ordering
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={row.conversion_eligibility === "eligible" ? "success" : "default"}>
              {row.conversion_eligibility === "eligible" ? "Can move to OAR" : "Stays on Min-Max"}
            </StatusBadge>
            {row.confidence && (
              <StatusBadge tone={CONFIDENCE_TONE[row.confidence] ?? "default"}>{reverseConfidenceLabel(row.confidence)} confidence</StatusBadge>
            )}
            <span className="text-[11px] text-muted-foreground">A suggestion only: it stays on Min-Max in SAP until a planner decides.</span>
          </div>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Fact label="Issues, last 12 months">{row.issues_latest_12m}</Fact>
            <Fact label="Months Active (out of 12)">{row.months_with_consumption_12m}</Fact>
            <Fact label="Issues, 12 months before">{row.issues_prior_12m}</Fact>
          </dl>
          <div className="mt-2.5 border-t border-border pt-2.5">
            <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Reason</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-foreground">
              <p className="font-semibold">{row.reason_label}</p>
              {points.length > 0 ? (
                <dl className="mt-1.5 flex flex-col gap-1.5">
                  {points.map((point) => (
                    <div key={point.label} className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">{point.label}</dt>
                      <dd>{point.text}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1">{row.explanation}</p>
              )}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {row.explanation_source === "AI_GENERATED" ? "Written by AI" : "Standard wording, built from the figures"}
              </p>
            </dd>
          </div>
        </div>

        {alternative && (
          <div className="rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 p-3">
            <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground/70">Alternative</span>
              If you keep it on Min-Max
            </h4>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              The Stock item recommendation for this material. Shown for comparison; it is not the recommended action.
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              <Fact label="ROP (current → recommended)">
                {formatChange(parseDecimal(alternative.current_rop), parseDecimal(alternative.recommended_rop))}
              </Fact>
              <Fact label="Max stock (current → recommended)">
                {formatChange(parseDecimal(alternative.current_max_stock), parseDecimal(alternative.recommended_max_stock))}
              </Fact>
            </dl>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-3 sm:grid-cols-3">
          <Fact label="Criticality">{row.criticality ?? <span className="text-muted-foreground">Not recorded</span>}</Fact>
          <Fact label="Lead time">{lead === null ? <span className="text-muted-foreground">Unknown</span> : formatLeadTime(lead)}</Fact>
          <Fact label="History">{row.history_span_months === null ? NONE : `${row.history_span_months} months`}</Fact>
          <Fact label="First movement">{formatYearMonth(row.first_valid_movement)}</Fact>
          <Fact label="Last movement">
            {row.last_valid_movement ? `${formatYearMonth(row.last_valid_movement)} (${formatMonthsAgo(row.months_since_last_movement)})` : NONE}
          </Fact>
          <Fact label="Stock on hand (base unit)">{stock === null ? NONE : formatFigure(stock, 3)}</Fact>
          <Fact label="Current ROP / Max stock (base unit)">
            {minbe === null && mabst === null ? NONE : `${minbe === null ? "—" : formatFigure(minbe, 0)} / ${mabst === null ? "—" : formatFigure(mabst, 0)}`}
          </Fact>
          <Fact label="Unit price (ZAR)">
            {price === null ? NONE : row.currency === null ? <span className="text-muted-foreground">Not counted (not ZAR or NAD)</span> : formatFigure(price, 2)}
          </Fact>
        </dl>

        {/* Below the material's own figures: the request (or the decision to ask) comes after what it is based on. */}
        <ConvertToOarSection row={row} onChanged={onChanged} />
      </div>
    </div>
  )
}
