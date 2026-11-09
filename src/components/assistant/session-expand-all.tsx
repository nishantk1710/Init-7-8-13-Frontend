"use client"

import { useState } from "react"
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Opens or closes every step of the session timeline at once. The steps are
 * plain <details>, so each still opens on its own without this.
 */
export function ExpandAllSteps({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      aria-controls={targetId}
      onClick={() => {
        const next = !open
        document.querySelectorAll<HTMLDetailsElement>(`#${targetId} details`).forEach((d) => {
          d.open = next
        })
        setOpen(next)
      }}
    >
      {open ? <ChevronsDownUp aria-hidden /> : <ChevronsUpDown aria-hidden />}
      {open ? "Collapse all" : "Expand all"}
    </Button>
  )
}
