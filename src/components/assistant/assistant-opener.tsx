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
 */
export function AssistantOpener() {
  const router = useRouter()
  const [material, setMaterial] = useState("")
  const [plant, setPlant] = useState("")
  const [quantity, setQuantity] = useState("")

  const ready = material.trim().length > 0 && plant.trim().length > 0

  function open(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return

    const params = new URLSearchParams({
      material: material.trim(),
      plant: plant.trim(),
    })
    // Sent only when given. A zero here would be indistinguishable from a
    // requester who asked for none, and the backend deliberately keeps those
    // apart.
    if (quantity.trim().length > 0) params.set("quantity", quantity.trim())

    router.push(`/assistant/new?${params.toString()}`)
  }

  return (
    <form
      onSubmit={open}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
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

        <Labelled id="quantity" label="Quantity" optional>
          <Input
            id="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="how many you were about to reserve"
            inputMode="decimal"
          />
        </Labelled>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!ready}>
          Check this material
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Opening the assistant records a session in your name.
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
