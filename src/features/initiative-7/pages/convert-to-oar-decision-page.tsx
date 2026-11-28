"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRightLeft } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { cn, formatZAR } from "@/lib/utils"
import { ConvertToOarDecisionPanel } from "@/features/initiative-7/components/convert-to-oar-decision-panel"
import { ReverseRequestHistory } from "@/features/initiative-7/components/reverse-request-history"
import { useReverseRequest } from "@/features/initiative-7/hooks/use-reverse-request"
import { REVERSE_CONFIDENCES } from "@/features/initiative-7/types/reverse-conversion"
import { parseDecimal } from "@/features/initiative-7/services/reverse-conversion-api"
import { formatLoadedAt } from "@/features/initiative-7/utils/reverse-conversion-query"
import { requestStatusLabel, requestStatusTone } from "@/features/initiative-7/utils/reverse-request-state"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  )
}

function BackToActionCenter() {
  return (
    <Link href="/actions" className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Back to Action Center
    </Link>
  )
}

/** One request: what is being asked, and the decision. Opened from the Action Center (or the Pipeline) on a material and plant. */
function RequestDecision({ material, plant }: { material: string; plant: string }) {
  const { detail, loading, error, unavailable, busy, act } = useReverseRequest(material, plant)
  const current = detail?.current ?? null

  if (loading) return <p className="text-[13px] text-muted-foreground">Loading…</p>

  if (unavailable) {
    return (
      <EmptyState
        title="Conversion requests are not available on this server yet"
        description="Nothing can be shown or decided from here until the server is updated."
      />
    )
  }

  if (!detail) {
    return (
      <p role="alert" className="text-[13px] text-destructive">
        The conversion request could not be loaded{error ? `: ${error}` : "."}
      </p>
    )
  }

  if (!current) {
    return (
      <EmptyState
        icon={<ArrowRightLeft className="size-4" />}
        title="No conversion request for this material"
        description="Nothing has been sent for approval for this material and plant."
        actions={
          <Link href="/actions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open Action Center
          </Link>
        }
      />
    )
  }

  const stockValue = parseDecimal(current.stock_value)
  const confidence = REVERSE_CONFIDENCES.find((level) => level.code === current.confidence)?.label ?? "—"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">Convert to OAR — {current.material}</h1>
        <StatusBadge tone={requestStatusTone(current.status)}>{requestStatusLabel(current.status)}</StatusBadge>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">What is being asked</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Fact label="Material">{current.material}</Fact>
            <Fact label="Plant">{current.plant}</Fact>
            <Fact label="Confidence">{confidence}</Fact>
            <Fact label="Stock value">
              {stockValue !== null ? formatZAR(stockValue) : <span className="font-normal text-muted-foreground">No value stated</span>}
            </Fact>
          </dl>
          <p className="text-[13px] leading-relaxed text-foreground/90">{current.detail}</p>
          <p className="border-t border-border pt-2 text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">Requested</span> by {current.submitted_by} · {formatLoadedAt(current.submitted_at)}
          </p>
          {current.submit_comment && (
            <p className="text-[12px] text-foreground/80">“{current.submit_comment}”</p>
          )}
        </section>

        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-foreground/70 bg-card p-4">
          <ConvertToOarDecisionPanel request={current} busy={busy} error={error} act={act} />
          <ReverseRequestHistory entries={detail.history} />
        </section>
      </div>
    </div>
  )
}

function DecisionFromUrl() {
  const params = useSearchParams()
  const material = (params.get("material") ?? "").trim()
  const plant = (params.get("plant") ?? "").trim()

  if (!material || !plant) {
    return (
      <EmptyState
        icon={<ArrowRightLeft className="size-4" />}
        title="No material chosen"
        description="Open a Convert to OAR request from the Action Center to review it here."
        actions={
          <Link href="/actions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open Action Center
          </Link>
        }
      />
    )
  }
  return <RequestDecision material={material} plant={plant} />
}

export function ConvertToOarDecisionPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <BackToActionCenter />
        <Suspense fallback={<p className="text-[13px] text-muted-foreground">Loading…</p>}>
          <DecisionFromUrl />
        </Suspense>
      </div>
    </div>
  )
}
