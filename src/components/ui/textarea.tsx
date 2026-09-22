import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Multi-line text input.
 *
 * `@base-ui/react` ships no textarea primitive, so this is a plain element
 * carrying the same class vocabulary as `Input` — same border, radius, focus
 * ring, disabled treatment and `aria-invalid` handling — so the two do not
 * drift apart visually.
 *
 * `field-sizing-content` lets it grow with what is typed where the browser
 * supports it, with `rows` as the floor. The free-text box on a justification
 * is the part a person actually reads when a decision is reviewed, and a
 * three-line window that has to be scrolled discourages writing anything
 * worth reading.
 */
function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        "field-sizing-content w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
