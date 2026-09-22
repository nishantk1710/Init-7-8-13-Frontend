"use client"

import type { ReactNode } from "react"
import { ArrowRightLeft, MessageSquare, Send, ShieldCheck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatCount, formatZAR } from "@/lib/utils"
import { ForecastVsActualChart } from "@/features/initiative-7/components/forecast-vs-actual-chart"
import { ParameterComparison } from "@/features/initiative-7/components/parameter-comparison"
import { useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import type { Criticality, DemandPattern, OarConversionInfo, Recommendation } from "@/features/initiative-7/types/inventory"
import { serviceLevelZFactor } from "@/features/initiative-7/utils/inventory-calc"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"

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

const CONVERSION_ELIGIBILITY_TONE: Record<string, "success" | "warning" | "default"> = {
  ELIGIBLE: "success",
  NOT_ELIGIBLE: "default",
  UNKNOWN: "warning",
}

const CONVERSION_TRIGGER_LABEL: Record<string, string> = {
  CONSUMPTION_FREQUENCY: "Consumption",
  PRODUCTION_IMPACT: "Criticality",
  I13_HOD_APPROVED_REQUEST: "HOD-approved request",
  NONE: "None",
  UNKNOWN: "Unknown",
}

/**
 * FRS SOP 3.1.1 -- OAR-to-Min-Max conversion suggestion. Only rendered when
 * the caller has already confirmed `rec.oarConversion` is present (i.e. the
 * material is in OAR scope AND conversion.evaluate() actually ran); this
 * component never re-derives OAR scope or re-evaluates triggers itself, it
 * only displays the backend's decision. Demand class is shown as supporting
 * confidence context, never as a fourth trigger.
 */
function OarConversionSection({ oar }: { oar: OarConversionInfo }) {
  const eligibility = oar.conversionEligibility
  const trigger = oar.conversionTrigger

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
        <ArrowRightLeft className="size-3.5" />
        OAR → Min-Max conversion
      </h4>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge tone={eligibility ? CONVERSION_ELIGIBILITY_TONE[eligibility] : "default"}>
          {eligibility ? eligibility.replace(/_/g, " ") : "Unknown"}
        </StatusBadge>
        {trigger && trigger !== "NONE" && (
          <span className="text-[11px] text-muted-foreground">
            Trigger: {CONVERSION_TRIGGER_LABEL[trigger] ?? trigger}
          </span>
        )}
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Fact label="Consumption (12M)">
          {oar.consumptionCount12m ?? "—"}
          {oar.consumptionCountThreshold != null && (
            <span className="text-muted-foreground"> / threshold {oar.consumptionCountThreshold}</span>
          )}
        </Fact>
        <Fact label="Demand class">{oar.demandClass ?? "—"}</Fact>
        <Fact label="I13 HOD approved">
          {oar.i13HodApproved === null ? "Unknown" : oar.i13HodApproved ? "Yes" : "No"}
        </Fact>
      </dl>
      {oar.conversionDetail && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Reason</dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-foreground">{oar.conversionDetail}</dd>
        </div>
      )}
    </div>
  )
}

/**
 * "Send for approval" box — the planner-side action, shown while a
 * recommendation is still theirs to submit.
 */
export function SubmitForApprovalBox({ rec }: { rec: Recommendation }) {
  const { stateFor, pendingRole, sendForApproval } = useInventoryWorkflow()
  const state = stateFor(rec.id)
  const role = pendingRole(rec.id)

  if (state.submitted) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={state.outcome === "rejected" ? "danger" : state.outcome ? "success" : "warning"}>
            {state.outcome === "rejected" ? "Rejected" : state.outcome ? "Approved" : `Awaiting ${role}`}
          </StatusBadge>
          <span className="text-[11px] text-muted-foreground">
            {state.requestedBy ? `Sent by ${state.requestedBy}` : "In the approval chain"}
            {state.submittedOn ? ` · ${state.submittedOn}` : ""}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Decisions are taken on the Approvals screen — this recommendation is already in the chain.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" className="self-start" onClick={() => sendForApproval(rec)}>
        <Send className="size-3.5" />
        Send for approval
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Submits the parameter change into the four-step approval chain, starting with the End User. Approve, adjust
        and reject decisions are taken on the Approvals screen.
      </p>
    </div>
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
}: {
  rec: Recommendation
  action?: ReactNode
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

        <div className="rounded-lg border border-border bg-background p-3">
          <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Consumption history &amp; forecast
          </h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {USING_LIVE_DATA
              ? "Actual consumption against the backend's own forecast demand rate — one monthly figure, shown flat, not a fabricated month-by-month curve."
              : "Six months of actuals, then a one-step-ahead smoothing forecast on the same series."}
          </p>
          <ForecastVsActualChart recommendations={[rec]} />
        </div>

        {rec.oarConversion && <OarConversionSection oar={rec.oarConversion} />}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            <MessageSquare className="size-3.5" />
            Why this recommendation?
          </h4>
          {rec.rationale?.text ? (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <ul className="list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
                {rationaleBullets(rec.rationale.text).map((bullet, index) => (
                  <li key={index}>{bullet}</li>
                ))}
              </ul>
              <span className="self-start text-[10px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
                {rec.rationale.source === "AI_GENERATED" ? "AI-generated" : "Deterministic (rule-based)"}
              </span>
            </div>
          ) : (
            <ul className="mt-1.5 list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
              {rec.factors.map((factor) => (
                <li key={factor.label}>{factor.detail}</li>
              ))}
            </ul>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-3 sm:grid-cols-3">
          <Fact label="Category">
            {CRITICALITY_CODE[rec.criticality]} – {rec.criticality}
          </Fact>
          <Fact label="Demand pattern">{rec.demandPattern}</Fact>
          <Fact label="Lead time">
            {rec.leadTimeDays}d <span className="text-muted-foreground">(±{rec.leadTimeVarianceDays}d)</span>
          </Fact>
          <Fact label="Service level">{Math.round(rec.serviceLevelTarget * 100)}% target</Fact>
          <Fact label="Z-factor">
            {rec.zFactor != null ? (
              rec.zFactor.toFixed(2)
            ) : (
              <>
                {serviceLevelZFactor(rec.serviceLevelTarget).toFixed(2)}{" "}
                <span className="text-muted-foreground">(illustrative)</span>
              </>
            )}
          </Fact>
          <Fact label="Unit price">{formatZAR(rec.unitPrice)}</Fact>
          <Fact label="Annual consumption">{formatCount(rec.annualConsumption)} units</Fact>
          <Fact label="Working capital">
            <span className={capital > 0 ? "font-medium text-success" : "font-medium text-warning"}>
              {capital > 0 ? "−" : "+"}
              {formatZAR(Math.abs(capital))}
              {capital > 0 ? " released" : " tied up"}
            </span>
          </Fact>
        </dl>

        {action && <div className="rounded-lg border border-border bg-background p-3">{action}</div>}
      </div>
    </div>
  )
}
