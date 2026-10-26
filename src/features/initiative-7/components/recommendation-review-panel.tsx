"use client"

import type { ReactNode } from "react"
import { ArrowRightLeft, MessageSquare, ShieldCheck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatCount, formatMoney } from "@/lib/utils"
import { ForecastVsActualChart, hasNoForecast } from "@/features/initiative-7/components/forecast-vs-actual-chart"
import { SimilarMaterialsList } from "@/features/initiative-7/components/similar-materials-list"
import { ParameterComparison } from "@/features/initiative-7/components/parameter-comparison"
import type { Criticality, DemandPattern, OarConversionInfo, Recommendation } from "@/features/initiative-7/types/inventory"
import { hasRecentConsumption, serviceLevelZFactor } from "@/features/initiative-7/utils/inventory-calc"

/** ABC class from the criticality tier, most severe first. */
export const CRITICALITY_CODE: Record<Criticality, string> = {
  Critical: "A",
  High: "B",
  Medium: "C",
  Low: "D",
}

/** XYZ class from the demand pattern: X = smooth, Y = predictable-but-sparse, Z = erratic. */
export const DEMAND_CODE: Record<DemandPattern, string> = {
  Smooth: "X",
  "Slow-Moving": "Y",
  Intermittent: "Y",
  Erratic: "Z",
  Lumpy: "Z",
  "Cold start": "—",
  Unclassified: "—",
}

/** Splits a rationale's free text into individual bullet lines. The v2 prompt
 * (app/prompts/i07_recommendation_rationale/v2.md) asks the model for one
 * fact per line, optionally prefixed with "-"/"•"/"*"; this strips whichever
 * marker is present and drops blank lines. A response that ignored the
 * bullet instruction and came back as one paragraph still renders as a
 * single "bullet" rather than being force-split on sentence boundaries,
 * since guessing sentence breaks can silently invent a fact that was not
 * actually a separate point. */
function rationaleBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s]*[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0)
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] break-words text-foreground">{children}</dd>
    </div>
  )
}

/** A figure the backend has no value for. Never a 0 or an estimate in its place. */
function NotAvailable() {
  return <span className="text-muted-foreground">Not available</span>
}

const CONVERSION_ELIGIBILITY_TONE:Record<string, "success" | "warning" | "default"> = {
  ELIGIBLE: "success",
  NOT_ELIGIBLE: "default",
  UNKNOWN: "warning",
}

const CONVERSION_TRIGGER_LABEL: Record<string, string> = {
  CONSUMPTION_AND_CRITICALITY: "its usage and criticality level",
  // Older recommendations, made under the retired either-or rule.
  CONSUMPTION_FREQUENCY: "how often it is used",
  PRODUCTION_IMPACT: "its criticality level",
  NONE: "none",
  UNKNOWN: "not known",
}

const CONVERSION_ELIGIBILITY_LABEL: Record<string, string> = {
  ELIGIBLE: "Can move to Min-Max",
  NOT_ELIGIBLE: "Stays on OAR",
  UNKNOWN: "Not known yet",
}

/**
 * FRS SOP 3.1.1 -- OAR-to-Min-Max conversion suggestion. Only rendered when
 * the caller has already confirmed `rec.oarConversion` is present (i.e. the
 * backend made a conversion decision -- for a cold-start or a standard-path
 * OAR material alike); this
 * component never re-derives OAR scope or re-evaluates triggers itself, it
 * only displays the backend's decision. Demand class is shown as supporting
 * confidence context, never as a fourth trigger.
 */
function OarConversionSection({ oar, reason }: { oar: OarConversionInfo; reason?: ReactNode }) {
  const eligibility = oar.conversionEligibility
  const trigger = oar.conversionTrigger
  // Each fact is shown only when there is something to say. A count of 0 or an unknown one says
  // nothing the Reason below does not already ("It was used 0 times..."), and "Not enough history"
  // is the stand-in for a usage pattern that was never worked out.
  const timesIssued = oar.consumptionCount12m != null && oar.consumptionCount12m > 0 ? oar.consumptionCount12m : null
  const usagePattern = oar.demandClass && oar.demandClass !== "UNCLASSIFIED" ? oar.demandClass : null
  const hasFacts = timesIssued !== null || usagePattern !== null

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
        <ArrowRightLeft className="size-3.5" />
        Move from OAR to Min-Max ordering
      </h4>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge tone={eligibility ? CONVERSION_ELIGIBILITY_TONE[eligibility] : "default"}>
          {eligibility ? (CONVERSION_ELIGIBILITY_LABEL[eligibility] ?? eligibility) : "Not known yet"}
        </StatusBadge>
        {trigger && trigger !== "NONE" && trigger !== "UNKNOWN" && (
          <span className="text-[11px] text-muted-foreground">
            Because of: {CONVERSION_TRIGGER_LABEL[trigger] ?? trigger}
          </span>
        )}
      </div>
      {hasFacts && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {/* A count of issue transactions -- the Min-Max rule's measure -- not units: one issue
              of 2 units is 1 here and 2 on the chart and in Annual consumption. */}
          {timesIssued !== null && (
            <Fact label="Times issued, last 12 months">
              {timesIssued}
              {oar.consumptionCountThreshold != null && (
                <span className="text-muted-foreground"> (needs more than {oar.consumptionCountThreshold})</span>
              )}
            </Fact>
          )}
          {usagePattern !== null && <Fact label="Usage pattern">{usagePattern}</Fact>}
        </dl>
      )}
      {(oar.conversionDetail || reason) && (
        <div className={hasFacts ? "mt-2.5 border-t border-border pt-2.5" : "mt-2.5"}>
          <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Reason</dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-foreground">
            {oar.conversionDetail && <p>{oar.conversionDetail}</p>}
            {reason && <div className={oar.conversionDetail ? "mt-2" : undefined}>{reason}</div>}
          </dd>
        </div>
      )}
    </div>
  )
}

const CONVERSION_CELL_LABEL: Record<string, string> = {
  ELIGIBLE: "Eligible",
  NOT_ELIGIBLE: "Not eligible",
  UNKNOWN: "Not known yet",
}

/**
 * "Eligible" / "Not eligible" badge for the Recommendations table's Min-Max conversion column:
 * whether this OAR material could move to Min-Max. The column heading already says what is being
 * decided, so the cell says only the verdict. Same source and colouring as OarConversionSection:
 * the backend's own eligibility verdict, never re-derived here.
 */
export function OarConversionLabel({ eligibility }: { eligibility: OarConversionInfo["conversionEligibility"] | undefined }) {
  return (
    <StatusBadge tone={eligibility ? CONVERSION_ELIGIBILITY_TONE[eligibility] : "warning"}>
      <ArrowRightLeft className="size-3" />
      {eligibility ? (CONVERSION_CELL_LABEL[eligibility] ?? eligibility) : CONVERSION_CELL_LABEL.UNKNOWN}
    </StatusBadge>
  )
}

/** The recommendation's reasons as bullets: the written rationale when there is one, otherwise
 * the recorded factors. */
function RationaleList({ rec }: { rec: Recommendation }) {
  if (rec.rationale?.text) {
    return (
      <div className="flex flex-col gap-1.5">
        <ul className="list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
          {rationaleBullets(rec.rationale.text).map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
        <span className="self-start text-[10px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          {rec.rationale.source === "AI_GENERATED" ? "Written by AI" : "Standard wording, built from the figures"}
        </span>
      </div>
    )
  }
  return (
    <ul className="list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
      {rec.factors.map((factor) => (
        <li key={factor.label}>{factor.detail}</li>
      ))}
    </ul>
  )
}

/**
 * The change-review layout for one recommendation: recommended parameters and
 * the demand forecast on the left, the rationale, supporting facts and
 * whatever action belongs to the current reader on the right. Shared by the
 * expandable table row and the full review page so both read identically.
 */
export function RecommendationReviewPanel({
  rec,
  action,
  onSimilarMaterialsChanged,
}: {
  rec: Recommendation
  action?: ReactNode
  /** Called after a similar material was removed or restored, so the caller can re-read the
   * recommendation: its recommended figures are recalculated by the backend. */
  onSimilarMaterialsChanged?: () => void
}) {
  const capital = rec.workingCapitalImpact

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            <ShieldCheck className="size-3.5" />
            Recommended inventory
          </h4>
          <div className="mt-1.5">
            <ParameterComparison current={rec.current} recommended={rec.recommended} />
          </div>
        </div>

        {/* No usage in the last 12 months (no series at all, or a series of zeros): nothing to
            chart, so no card (such a material is sized from similar materials, listed below). */}
        {hasRecentConsumption(rec) && (
          <div className="rounded-lg border border-border bg-background p-3">
            <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Consumption history &amp; forecast
            </h4>
            <ForecastVsActualChart recommendations={[rec]} />
          </div>
        )}

        {hasNoForecast([rec]) && (
          <SimilarMaterialsList key={rec.id} recommendationId={rec.id} onChanged={onSimilarMaterialsChanged} />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {rec.oarConversion ? (
          // An OAR material's reasons sit inside its Min-Max conversion section, under Reason.
          <OarConversionSection oar={rec.oarConversion} reason={<RationaleList rec={rec} />} />
        ) : (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
              <MessageSquare className="size-3.5" />
              Why this recommendation?
            </h4>
            <div className="mt-1.5">
              <RationaleList rec={rec} />
            </div>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-3 sm:grid-cols-3">
          <Fact label="Category">
            {rec.criticalityTier === undefined ? (
              <>
                {CRITICALITY_CODE[rec.criticality]} – {rec.criticality}
              </>
            ) : (
              (rec.criticalityTier ?? "Not recorded")
            )}
          </Fact>
          <Fact label="Demand pattern">{rec.demandPattern}</Fact>
          <Fact label="Lead time">
            {rec.unavailable?.includes("leadTime") ? (
              <NotAvailable />
            ) : (
              <>
                {rec.leadTimeDays}d <span className="text-muted-foreground">(±{rec.leadTimeVarianceDays}d)</span>
              </>
            )}
          </Fact>
          <Fact label="Service level">
            {rec.unavailable?.includes("serviceLevel") ? (
              <NotAvailable />
            ) : (
              <>{Math.round(rec.serviceLevelTarget * 100)}% target</>
            )}
          </Fact>
          <Fact label="Z-factor">
            {rec.unavailable?.includes("serviceLevel") ? (
              <NotAvailable />
            ) : rec.zFactor != null ? (
              rec.zFactor.toFixed(2)
            ) : (
              <>
                {serviceLevelZFactor(rec.serviceLevelTarget).toFixed(2)}{" "}
                <span className="text-muted-foreground">(illustrative)</span>
              </>
            )}
          </Fact>
          <Fact label="Unit price">{formatMoney(rec.unitPrice, rec.currency)}</Fact>
          <Fact label="Annual consumption (last 12 months)">
            {rec.unavailable?.includes("consumption") ? <NotAvailable /> : <>{formatCount(rec.annualConsumption)} units</>}
          </Fact>
          <Fact label="Working capital">
            <span className={capital > 0 ? "font-medium text-success" : "font-medium text-warning"}>
              {capital > 0 ? "−" : "+"}
              {formatMoney(Math.abs(capital), rec.currency)}
              {capital > 0 ? " released" : " tied up"}
            </span>
          </Fact>
        </dl>

        {action && <div className="rounded-lg border border-border bg-background p-3">{action}</div>}
      </div>
    </div>
  )
}
