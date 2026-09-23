import Link from "next/link"
import { MessageCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * "Ask the assistant" — the on-demand entry point, from any screen that knows
 * a part.
 *
 * ## One destination: the opener form, prefilled
 *
 * It goes to `/assistant` with whatever the screen knows — a material, and a
 * plant where there is one. Several screens genuinely do not know a plant (the
 * Material 360 drawer is built on a `Material` type that has no plant field),
 * and defaulting to one would answer confidently for the wrong site.
 *
 * It used to jump straight to `/assistant/new` whenever a plant was known,
 * which opened a session on arrival. That stopped being right when the entry
 * point started asking **who** the part is for and **which department** wants
 * it: a session minted from a link carries neither, and on an append-only
 * table those blanks cannot be filled in afterwards. Prefilling the form costs
 * one click and records the two fields the whole change exists to capture.
 *
 * ## Why this never opens a session by itself
 *
 * It is a plain link. Opening a session is a write to an append-only table,
 * and a control that writes on hover, prefetch or a mis-click is a control
 * that fills that table with rows nobody meant. The write happens on
 * `/assistant/new`, in one place, where the page's whole purpose is to make
 * it.
 */
export function AskAssistantLink({
  materialId,
  plant,
  variant = "link",
  label = "Ask the assistant",
  className,
}: {
  materialId: string
  /** Omit where the screen genuinely does not know one. */
  plant?: string | null
  variant?: "link" | "chip"
  label?: string
  className?: string
}) {
  const href = `/assistant?${new URLSearchParams({
    material: materialId,
    ...(plant ? { plant } : {}),
  }).toString()}`

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
