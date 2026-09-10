import { ICONS } from "@/lib/constants"
import type { IconKey } from "@/lib/types"
import { cn } from "@/lib/utils"

type OptionCardTone = "default" | "success"

export function OptionCard({
  icon,
  label,
  description,
  selected = false,
  onSelect,
  showRadio = true,
  tone = "default",
  disabled = false,
}: {
  icon: IconKey
  label: string
  description: string
  selected?: boolean
  onSelect?: () => void
  showRadio?: boolean
  tone?: OptionCardTone
  disabled?: boolean
}) {
  const Icon = ICONS[icon]
  const isSuccess = tone === "success"

  return (
    <button
      type="button"
      role={showRadio ? "radio" : undefined}
      aria-checked={showRadio ? selected : undefined}
      disabled={disabled}
      onClick={(e) => {
        // This card can sit inside a chat message that has its own click
        // affordances (dropdown triggers, links); keep selection self-contained.
        e.stopPropagation()
        onSelect?.()
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-150",
        "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none",
        // Only fade out cards that were NOT chosen — the selected option in a
        // locked group should stay fully legible, not dim along with the rest.
        disabled && !selected && "opacity-50",
        selected && "focus-visible:ring-0",
        isSuccess
          ? selected
            ? "border-success bg-success/15"
            : "border-success/40 bg-success/5 hover:bg-success/10"
          : selected
            ? "border-primary bg-accent"
            : "border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/60"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          isSuccess ? "text-success" : "text-primary"
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13px] font-medium",
            isSuccess ? "text-success" : "text-foreground"
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
      {showRadio && (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
            selected
              ? isSuccess
                ? "border-success"
                : "border-primary"
              : "border-muted-foreground/40"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full transition-transform duration-150",
              isSuccess ? "bg-success" : "bg-primary",
              selected ? "scale-100" : "scale-0"
            )}
          />
        </span>
      )}
    </button>
  )
}
