import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A form label.
 *
 * Plain `<label>` rather than `@base-ui/react/field`'s, because that one wants
 * to own the field's validity state and this app's field errors come from the
 * server — `app/assistant/turns.validate` is the only code that knows what was
 * asked, and a client-side validity model would be a second opinion about it.
 *
 * `peer-disabled` and `group-data-[disabled]` keep the label dimmed with its
 * control, so a disabled row reads as one thing rather than a live label above
 * a dead input.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-sm leading-none font-medium text-foreground select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        "group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
