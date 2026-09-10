"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { useMaterial360 } from "@/lib/material-360-context"
import { formatCount } from "@/lib/utils"
import type { RedeploymentCandidate } from "@/features/initiative-13/types/oar"

/**
 * Advisory only — recommending a transfer or continuing procurement never
 * simulates an actual SAP stock movement. Every action here is a toast-only
 * UI acknowledgement, matching the master spec's "advisory only" rule for
 * cross-plant redeployment.
 */
export function RedeploymentBoard({ candidates }: { candidates: RedeploymentCandidate[] }) {
  const { openMaterial360 } = useMaterial360()
  const [notes, setNotes] = useState<Record<string, string>>({})

  function recommendTransfer(candidate: RedeploymentCandidate, fromPlant: string) {
    setNotes((prev) => ({ ...prev, [candidate.id]: `Transfer recommended from ${fromPlant}` }))
    toast.success(
      `Transfer recommended: ${candidate.material.description} from ${fromPlant} to ${candidate.requestingPlant.name}. Advisory only — no SAP stock transfer executed.`
    )
  }

  function continueProcurement(candidate: RedeploymentCandidate) {
    setNotes((prev) => ({ ...prev, [candidate.id]: "Continuing procurement" }))
    toast.info(`Continuing procurement for ${candidate.material.description} at ${candidate.requestingPlant.name}.`)
  }

  function reviewMaterial(candidate: RedeploymentCandidate) {
    openMaterial360(candidate.material.materialId)
  }

  return (
    <div className="flex flex-col gap-3">
      {candidates.map((candidate) => (
        <div key={candidate.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <MaterialIdentity material={candidate.material} onOpen={openMaterial360} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Needed: {formatCount(candidate.qtyNeeded)} at{" "}
                <span className="font-medium text-foreground">{candidate.requestingPlant.name}</span> —{" "}
                {candidate.requestedFor}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => continueProcurement(candidate)}>
                Continue Procurement
              </Button>
              <Button size="sm" variant="outline" onClick={() => reviewMaterial(candidate)}>
                Review Material
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {candidate.matches.map((match) => (
              <div
                key={match.plant.plantId}
                className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{match.plant.name}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="text-foreground">{candidate.requestingPlant.name}</span>
                  <span className="text-muted-foreground">
                    · {formatCount(match.qtyAvailable)} available · last moved {match.lastMovementDate} ·{" "}
                    {match.condition}
                  </span>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  className="w-fit"
                  onClick={() => recommendTransfer(candidate, match.plant.name)}
                >
                  Recommend Transfer
                </Button>
              </div>
            ))}
          </div>

          {notes[candidate.id] && (
            <div className="mt-2">
              <StatusBadge tone="default">{notes[candidate.id]}</StatusBadge>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
