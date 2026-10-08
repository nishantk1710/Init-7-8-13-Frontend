"use client"

import type { ReactNode } from "react"
import { ArrowRightLeft, MessageSquare, Send, ShieldCheck } from "lucide-react"

import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
import { formatCount, formatZAR } from "@demo/lib/utils"
import { ForecastVsActualChart } from "@demo/features/initiative-7/components/forecast-vs-actual-chart"
import { ParameterComparison } from "@demo/features/initiative-7/components/parameter-comparison"
import { useInventoryWorkflow } from "@demo/features/initiative-7/context/workflow-context"
import type {
  Criticality,
  OarConversionEligibility,
  OarConversionInfo,
  OarConversionTrigger,
  Recommendation,
} from "@demo/features/initiative-7/types/inventory"
import { serviceLevelZFactor } from "@demo/features/initiative-7/utils/inventory-calc"

/** ABC class from the criticality tier, most severe first. */
export const CRITICALITY_CODE: Record<Criticality, string> = {
  Critical: "A",
  High: "B",
  Medium: "C",
  Low: "D",
}

const CONVERSION_ELIGIBILITY_TONE: Record<
  OarConversionEligibility,
  "default" | "success" | "warning"
> = {
  ELIGIBLE: "success",
  NEEDS_REVIEW: "warning",
  NOT_ELIGIBLE: "default",
}

const CONVERSION_TRIGGER_LABEL: Record<OarConversionTrigger, string> = {
  CONSUMPTION_FREQUENCY: "Consumption",
  PRODUCTION_IMPACT: "Criticality",
  I13_HOD_APPROVED_REQUEST: "HOD-approved request",
  NONE: "None",
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Mock OAR → Min-Max conversion suggestion (FRS SOP 3.1.1), laid out to match
 * the live module's own OAR section so the two read identically. Rendered only
 * when `rec.oarConversion` is set; this component never decides what is OAR —
 * that stays with `features/initiative-13/selectors/oar-lookup.ts`.
 */
function OarConversionSection({ oar }: { oar: OarConversionInfo }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
        <ArrowRightLeft className="size-3.5" />
        OAR → Min-Max conversion
      </h4>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge tone={CONVERSION_ELIGIBILITY_TONE[oar.conversionEligibility]}>
          {oar.conversionEligibility.replace(/_/g, " ")}
        </StatusBadge>
        {oar.conversionTrigger !== "NONE" && (
          <span className="text-[11px] text-muted-foreground">
            Trigger: {CONVERSION_TRIGGER_LABEL[oar.conversionTrigger]}
          </span>
        )}
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Fact label="Consumption (12M)">
          {oar.consumptionCount12m}
          <span className="text-muted-foreground"> / threshold {oar.consumptionCountThreshold}</span>
        </Fact>
        <Fact label="Demand class">{oar.demandClass}</Fact>
        <Fact label="I13 HOD approved">{oar.i13HodApproved ? "Yes" : "No"}</Fact>
      </dl>
      <div className="mt-2.5 border-t border-border pt-2.5">
        <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Reason</dt>
        <dd className="mt-0.5 text-[13px] leading-relaxed text-foreground">{oar.conversionDetail}</dd>
      </div>
    </div>
  )
}

/**
 * Compact OAR → Min-Max label beside the rationale heading, so an approver
 * sees at a glance that this is an OAR material being proposed for Min-Max.
 */
function OarConversionLabel({ oar }: { oar: OarConversionInfo }) {
  return (
    <StatusBadge tone={CONVERSION_ELIGIBILITY_TONE[oar.conversionEligibility]}>
      <ArrowRightLeft className="size-3" />
      OAR → Min-Max · {oar.conversionEligibility.replace(/_/g, " ")}
    </StatusBadge>
  )
}

/**
 * The lead sentence of "Why this recommendation?" — states plainly what each
 * parameter was and what it becomes, so an approver reads the actual change
 * before the supporting factors rather than inferring it from the stat boxes.
 */
function changeSummarySentence(rec: Recommendation): string {
  const moves: string[] = []
  if (rec.recommended.rop !== rec.current.rop) {
    moves.push(`the reorder point from ${rec.current.rop} to ${rec.recommended.rop}`)
  }
  if (rec.recommended.safetyStock !== rec.current.safetyStock) {
    moves.push(`safety stock from ${rec.current.safetyStock} to ${rec.recommended.safetyStock}`)
  }
  if (rec.recommended.maxStock !== rec.current.maxStock) {
    moves.push(`maximum stock from ${rec.current.maxStock} to ${rec.recommended.maxStock}`)
  }

  if (moves.length === 0) {
    return "This recommendation leaves every SAP parameter where it is — the current settings already match what the model would propose."
  }

  const list =
    moves.length === 1 ? moves[0] : `${moves.slice(0, -1).join(", ")} and ${moves[moves.length - 1]}`
  const capital =
    rec.workingCapitalImpact === 0
      ? "no net change in working capital"
      : rec.workingCapitalImpact > 0
        ? `releasing ${formatZAR(rec.workingCapitalImpact)} of working capital`
        : `tying up a further ${formatZAR(Math.abs(rec.workingCapitalImpact))} of working capital`

  return `Move ${list} — ${capital}.`
}

/**
 * "Send for approval" box — the planner-side action, shown while a
 * recommendation is still theirs to submit.
 */
export function SubmitForApprovalBox({ rec }: { rec: Recommendation }) {
  const { stateFor, pendingRole, sendForApproval } = useInventoryWorkflow()
  const state = stateFor(rec.id)
  const role = pendingRole(rec)

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
            Six months of actuals, then a one-step-ahead smoothing forecast on the same series.
          </p>
          <ForecastVsActualChart recommendations={[rec]} />
        </div>

        {rec.oarConversion && <OarConversionSection oar={rec.oarConversion} />}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
              <MessageSquare className="size-3.5" />
              Why this recommendation?
            </h4>
            {rec.oarConversion && <OarConversionLabel oar={rec.oarConversion} />}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed font-medium text-foreground">
            {changeSummarySentence(rec)}
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
            {rec.factors.map((factor) => (
              <li key={factor.label}>
                <span className="font-medium">{factor.label}:</span> {factor.detail}
              </li>
            ))}
          </ul>
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
            {serviceLevelZFactor(rec.serviceLevelTarget).toFixed(2)}{" "}
            <span className="text-muted-foreground">(illustrative)</span>
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
