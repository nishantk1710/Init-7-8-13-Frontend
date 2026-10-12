import { cn } from "@/lib/utils"

/** Two-letter initials from a display name — "Thabo Nkosi" -> "TN". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

/**
 * A circle of initials. Hand-written rather than pulled from shadcn: that
 * Avatar is Radix-based, and the primitives in this folder wrap base-ui.
 * There is no image slot because nothing in the app carries a photo.
 */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground select-none",
        size === "lg" ? "size-11 text-sm" : size === "sm" ? "size-6 text-[10px]" : "size-9 text-xs",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
