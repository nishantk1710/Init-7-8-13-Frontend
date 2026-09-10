import { cn } from "@/lib/utils"
import type { TraceTag } from "@/lib/types"

const KIND_CLASSES: Record<TraceTag["kind"], string> = {
  cat: "bg-accent text-accent-foreground",
  tier: "bg-success/15 text-success",
  status: "bg-warning/15 text-warning",
}

export function CategoryTag({ label, kind }: TraceTag) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        KIND_CLASSES[kind]
      )}
    >
      {label}
    </span>
  )
}
