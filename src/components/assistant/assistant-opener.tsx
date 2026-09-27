"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
 * ## Who is filling this in
 *
 * One coordinator runs this for the whole site. They are **not** the person who
 * wants the part — they type that name into `Requester`. The two are recorded
 * separately: the coordinator is taken from the `X-Actor-Id` header as the
 * author of the record, and the typed name is data about the reservation. This
 * form never touches the header, so nothing typed here can become an audit
 * author.
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
   * which is worse than asking.
   */
  defaultMaterial?: string
  defaultPlant?: string
} = {}) {
  const router = useRouter()
  const [material, setMaterial] = useState(defaultMaterial)
  const [plant, setPlant] = useState(defaultPlant)
  const [department, setDepartment] = useState("")
  const [requestedFor, setRequestedFor] = useState("")

  /**
   * All four are required here, but only material and plant are required by the
   * API — the BAdI pop-up cannot supply a department or a name, and a session
   * opened from SAP legitimately has neither. The rule is stricter on this form
   * because a person is standing in front of it and can answer.
   */
  const ready =
    material.trim().length > 0 &&
    plant.trim().length > 0 &&
    department.trim().length > 0 &&
    requestedFor.trim().length > 0

  function open(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return

    const params = new URLSearchParams({
      material: material.trim(),
      plant: plant.trim(),
      department: department.trim(),
      requestedFor: requestedFor.trim(),
    })

    router.push(`/assistant/new?${params.toString()}`)
  }

  return (
    <form
      onSubmit={open}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Labelled id="material" label="Material">
          <Input
            id="material"
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            placeholder="8000005632"
            className="font-mono"
          />
        </Labelled>

        <Labelled id="plant" label="Plant">
          {/* Two plants are in scope per the team-lead ruling of 21-Sep:
              1300 Black Mountain and 1500 Gamsberg. Left as free text rather
              than a two-item dropdown because the backend is the authority on
              scope and will say so plainly for anything else — a dropdown
              here would be a third place that encodes the plant list. */}
          <Input
            id="plant"
            value={plant}
            onChange={(event) => setPlant(event.target.value)}
            placeholder="1300"
            className="font-mono"
          />
        </Labelled>

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

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!ready}>
          Check this material
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Opening the assistant records a session against this requester.
        </span>
      </div>
    </form>
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
