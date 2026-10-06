"use client"

import { useMemo } from "react"

import { useDemoRuns } from "@/components/assistant/demo/use-demo-runs"
import { JustificationLog } from "@/features/initiative-13/components/justification-log"
import { PlansTable } from "@/features/initiative-13/components/plans-table"
import type { ApiJustificationKind } from "@/lib/api/assistant"
import type { ConsumptionPlan } from "@/lib/api/i13"
import { fromAssistant } from "@/lib/assistant/justifications"

/**
 * Where a demo conversation's records land, so the cycle can be followed past
 * the assistant: the I08 justification log and the I13 consumption plans.
 *
 * The live screens read the backend, which never saw a demo session, so in demo
 * mode these stand in for them -- the same table components, fed from the
 * browser's demo store. **Temporary**, with the rest of the demo.
 */

function Loading({ what }: { what: string }) {
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Loading demo {what}…
    </p>
  )
}

function DemoNote() {
  return (
    <p className="text-[11px] text-muted-foreground">
      Demo records from sessions run in this browser, plus the two every demo starts with.
      Nothing here was recorded by the platform.
    </p>
  )
}

/** Justifications recorded in demo conversations, of the given kinds. */
export function DemoJustifications({
  kinds,
  csvFilename,
}: {
  kinds: ApiJustificationKind[]
  csvFilename?: string
}) {
  const runs = useDemoRuns()
  const entries = useMemo(
    () =>
      (runs ?? [])
        .flatMap((run) => run.justifications)
        .filter((j) => kinds.includes(j.kind))
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
        .map(fromAssistant),
    [runs, kinds]
  )
  if (runs === null) return <Loading what="justifications" />
  return (
    <>
      <JustificationLog entries={entries} csvFilename={csvFilename} />
      <DemoNote />
    </>
  )
}

/** Consumption plans captured in demo conversations. */
export function DemoPlans({ material, plant }: { material?: string; plant?: string }) {
  const runs = useDemoRuns()
  const plans = useMemo<ConsumptionPlan[]>(
    () =>
      (runs ?? [])
        .flatMap((run) => run.plans.map((plan) => ({ ...plan, sessionId: run.sessionId })))
        .filter((p) => (!material || p.material === material) && (!plant || p.plant === plant))
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    [runs, material, plant]
  )
  if (runs === null) return <Loading what="consumption plans" />
  return (
    <>
      <PlansTable plans={plans} />
      <DemoNote />
    </>
  )
}
