"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"

import {
  FlowBadge,
  MaterialSearch,
  type MaterialPick,
} from "@/components/assistant/material-search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Open the assistant by hand, for a material and plant.
 *
 * The on-demand entry point. W7.5 exists precisely so the assistant is usable
 * before the reservation-entry BAdI is transported — which is what makes the
 * dev-complete date independent of the SAP change.
 *
 * It navigates to `/assistant/new` rather than opening a session itself, so
 * there is exactly one place that mints one and the deep link and this form
 * behave identically.
 *
 * ## Material: a number or a name, then a deliberate Start
 *
 * The Material field takes either, and suggests material+plant pairs as you
 * type. Picking one fills the material and the plant but opens nothing. Once
 * every field is filled, **Start session** opens it — that is when the session
 * reference is generated, and it stays on screen from then on. A session row is
 * append-only, so it is opened by a button press and never by a mis-click on a
 * suggestion.
 *
 * ## Who is filling this in
 *
 * The name typed into `Requester` is the only person field. It is sent as
 * `requestedFor` and also becomes the `X-Actor-Id` for the session (see
 * `setRequesterActor`), so the session, turns and justifications show that
 * name instead of the no-sign-in placeholder.
 */
export function AssistantOpener({
  defaultMaterial = "",
  defaultPlant = "",
}: {
  /**
   * Prefill, for an entry point that already knows the part.
   *
   * The Material 360 drawer knows a material and genuinely does not know a
   * plant -- `Material` carries no plant field, and stock, repairs and cover
   * are all held per plant. Guessing one would answer for the wrong site,
   * which is worse than asking. With a plant as well (the WATCH table), the
   * part is taken as picked.
   */
  defaultMaterial?: string
  defaultPlant?: string
} = {}) {
  const router = useRouter()
  const [pick, setPick] = useState<MaterialPick | null>(() =>
    defaultMaterial.trim() && defaultPlant.trim()
      ? { kind: "typed", materialId: defaultMaterial.trim() }
      : null
  )
  const [plant, setPlant] = useState(defaultPlant)
  const [department, setDepartment] = useState("")
  const [requestedFor, setRequestedFor] = useState("")
  const [starting, setStarting] = useState(false)

  const materialId = pick ? (pick.kind === "match" ? pick.match.materialId : pick.materialId) : ""
  const plantCode = pick?.kind === "match" ? pick.match.plant : plant.trim()

  /**
   * All four are required here, but only material and plant are required by the
   * API — the BAdI pop-up cannot supply a department or a name, and a session
   * opened from SAP legitimately has neither. The rule is stricter on this form
   * because a person is standing in front of it and can answer.
   */
  const ready =
    materialId.length > 0 &&
    plantCode.length > 0 &&
    department.trim().length > 0 &&
    requestedFor.trim().length > 0

  function choose(next: MaterialPick) {
    setPick(next)
    if (next.kind === "match") setPlant(next.match.plant)
  }

  function changeMaterial() {
    setPick(null)
    setPlant("")
  }

  function start(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || starting) return
    setStarting(true)

    const params = new URLSearchParams({
      material: materialId,
      plant: plantCode,
      department: department.trim(),
      requestedFor: requestedFor.trim(),
    })

    router.push(`/assistant/new?${params.toString()}`)
  }

  return (
    <form
      onSubmit={start}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <Labelled id="material" label="Material">
        {pick === null ? (
          <MaterialSearch id="material" defaultQuery={defaultMaterial} onPick={choose} />
        ) : (
          <PickedMaterial pick={pick} onChange={changeMaterial} />
        )}
        <span className="text-[11px] text-muted-foreground">
          Type a material number or part of its name, then pick it from the list.
        </span>
      </Labelled>

      <div className="grid gap-3 sm:grid-cols-2">
        {pick?.kind === "typed" && (
          <Labelled id="plant" label="Plant">
            {/* Asked for only when the material was typed rather than picked:
                a suggestion already names its plant. Two plants are in scope
                per the team-lead ruling of 21-Sep (1300 Black Mountain, 1500
                Gamsberg); free text because the backend is the authority on
                scope and says so plainly for anything else. */}
            <Input
              id="plant"
              value={plant}
              onChange={(event) => setPlant(event.target.value)}
              placeholder="1300"
              className="font-mono"
            />
          </Labelled>
        )}

        <Labelled id="requestedFor" label="Requester">
          {/* The person who wants the part, not whoever is typing. Free text
              and never verified, which is why the backend keeps it well away
              from the column that records the author of the session. */}
          <Input
            id="requestedFor"
            value={requestedFor}
            onChange={(event) => setRequestedFor(event.target.value)}
            placeholder="who the part is for"
            maxLength={128}
          />
        </Labelled>

        <Labelled id="department" label="Department">
          {/* Free text, for the same reason Plant is: nothing the platform
              loads maps a person to a cost-bearing department, so a dropdown
              here would invent a vocabulary VZI has not given us. */}
          <Input
            id="department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="which department it is for"
            maxLength={64}
          />
        </Labelled>
      </div>

      {ready ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={starting}>
            {starting ? "Starting…" : "Start session"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={changeMaterial} disabled={starting}>
            Change material
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Starting records a session against this requester and gives you its reference.
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Pick a material and fill in the requester and department to start a session.
        </p>
      )}
    </form>
  )
}

/** The chosen material, in place of the search box, with a way back. */
function PickedMaterial({ pick, onChange }: { pick: MaterialPick; onChange: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      {pick.kind === "match" ? (
        <>
          <span className="font-mono text-foreground">{pick.match.materialId}</span>
          <span className="min-w-0 flex-1 truncate text-foreground">
            {pick.match.description ?? (
              <span className="text-muted-foreground italic">No description</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            Plant <span className="font-mono">{pick.match.plant}</span>
            {pick.match.plantName ? ` ${pick.match.plantName}` : ""}
          </span>
          <FlowBadge flow={pick.match.flowHint} />
        </>
      ) : (
        <>
          <span className="font-mono text-foreground">{pick.materialId}</span>
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
            Typed by hand. Enter the plant below.
          </span>
        </>
      )}
      <Button type="button" variant="ghost" size="xs" onClick={onChange}>
        <Pencil aria-hidden />
        Change
      </Button>
    </div>
  )
}

function Labelled({
  id,
  label,
  optional,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {optional && (
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
