import Link from "next/link"
import { MessageCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * "Ask the assistant" — the on-demand entry point, from any screen that knows
 * a part.
 *
 * ## Two destinations, and the difference matters
 *
 * With a **plant**, it goes to `/assistant/new`, which opens a session
 * immediately. Stock, open repairs and months of cover are all held per
 * plant, so with both identifiers there is a real question to answer.
 *
 * Without one, it goes to `/assistant` with the material prefilled and lets
 * the planner pick. Several screens genuinely do not know a plant — the
 * Material 360 drawer is built on a `Material` type that has no plant field —
 * and defaulting to one would answer confidently for the wrong site. Asking
 * is the honest option, and it costs one click.
 *
 * ## Why this never opens a session by itself
 *
 * Both destinations are plain links. Opening a session is a write to an
 * append-only table, and a control that writes on hover, prefetch or a
 * mis-click is a control that fills that table with rows nobody meant. The
 * write happens on `/assistant/new`, in one place, where the page's whole
 * purpose is to make it.
 */
export function AskAssistantLink({
  materialId,
  plant,
  quantity,
  variant = "link",
  label = "Ask the assistant",
  className,
}: {
  materialId: string
  /** Omit where the screen genuinely does not know one. */
  plant?: string | null
  /** Decimal-as-string. Omit unless a real quantity is in hand. */
  quantity?: string | null
  variant?: "link" | "chip"
  label?: string
  className?: string
}) {
  const href = plant
    ? `/assistant/new?${new URLSearchParams({
        material: materialId,
        plant,
        // Only when there is a real one. A defaulted zero is
        // indistinguishable from a requester who asked for none, and the
        // backend keeps those apart on purpose.
        ...(quantity ? { quantity } : {}),
      }).toString()}`
    : `/assistant?${new URLSearchParams({ material: materialId }).toString()}`

  return (
    <Link
      href={href}
      className={cn(
        variant === "chip"
          ? "inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          : "inline-flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline",
        className
      )}
    >
      <MessageCircle className="size-3" aria-hidden />
      {label}
    </Link>
  )
}
