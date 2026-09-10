import { cn } from "@/lib/utils"

type StatusTone = "default" | "success" | "warning" | "danger"

const TONE_CLASSES: Record<StatusTone, string> = {
  default: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

export function StatusBadge({
  tone = "default",
  className,
  children,
}: {
  tone?: StatusTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap uppercase tracking-[0.5px]",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
