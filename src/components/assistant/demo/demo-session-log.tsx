"use client"

import { useEffect, useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"

import { CompliancePanel, type ComplianceCheck } from "@/components/assistant/compliance-panel"
import { SessionLogTable } from "@/components/assistant/session-log-table"
import { Button } from "@/components/ui/button"
import type { SessionListResponse } from "@/lib/api/assistant"
import { listSessions, resetDemo } from "@/lib/assistant/demo"
import type { DemoRun } from "@/lib/assistant/demo/script"
import { allRuns, subscribe } from "@/lib/assistant/demo/store"

/**
 * The session log in demo mode: the two seeded sessions plus anything run in
 * this browser, with the same compliance cards live shows, counted over them.
 *
 * Reset demo puts it back to the seeded two, so the next audience starts clean.
 */
export function DemoSessionLog({ material, plant }: { material?: string; plant?: string }) {
  const [state, setState] = useState<{ list: SessionListResponse; runs: DemoRun[] } | null>(null)

  useEffect(() => {
    const read = () => setState({ list: listSessions(), runs: allRuns() })
    read()
    return subscribe(read)
  }, [])
  const list = state?.list ?? null

  const items = useMemo(
    () =>
      (list?.items ?? []).filter(
        (s) => (!material || s.materialId === material) && (!plant || s.plant === plant)
      ),
    [list, material, plant]
  )

  const checks = useMemo<ComplianceCheck[]>(() => {
    const runs = (state?.runs ?? []).filter(
      (r) => (!material || r.materialId === material) && (!plant || r.plant === plant)
    )
    const justifications = runs.flatMap((r) => r.justifications)
    const linked = runs.filter((r) => r.linkedReservations.length > 0).length
    return [
      {
        id: "advice-not-taken",
        label: "Went ahead anyway",
        description:
          "Someone was told a repairable unit exists, or offered a smaller quantity, and proceeded regardless. Each one carries a recorded reason.",
        state: "counted",
        count: justifications.filter(
          (j) => j.kind === "NEW_ACQUISITION" || j.kind === "QUANTITY_OVERRIDE"
        ).length,
        detail: "Recorded at the moment of the decision.",
      },
      {
        id: "abandoned",
        label: "Advice given, not acted on",
        description:
          "Sessions opened and left without an answer. Both FRSs count these, which is why the log lists them rather than hiding unfinished conversations.",
        state: "counted",
        count: items.filter((s) => s.outcome === "ABANDONED").length,
      },
      {
        id: "missing-session",
        label: "Reservations with no session",
        description:
          "Reservations whose item text (SGTXT) carries no valid session reference — I08 FR-8 and I13 FR-4.",
        state: "counted",
        count: 0,
        detail:
          linked === 1
            ? "1 reservation carries a session reference."
            : `${linked} reservations carry a session reference.`,
      },
    ]
  }, [items, material, plant, state])

  if (list === null) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading sessions…
      </p>
    )
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (window.confirm("Reset the session log? Sessions run since the last reset are removed.")) resetDemo()
          }}
        >
          <RotateCcw aria-hidden />
          Reset log
        </Button>
      </div>
      <CompliancePanel checks={checks} />
      <SessionLogTable sessions={items} note={list.note} total={items.length} />
    </>
  )
}
