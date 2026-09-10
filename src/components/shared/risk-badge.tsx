import { cn } from "@/lib/utils"

export type RiskLevel = "low" | "medium" | "high" | "critical"

const RISK_CLASSES: Record<RiskLevel, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  high: "bg-[color-mix(in_oklch,var(--warning)_40%,var(--destructive)_60%)]/15 text-[color-mix(in_oklch,var(--warning)_40%,var(--destructive)_60%)]",
  critical: "bg-destructive/10 text-destructive",
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

/** Sibling to StatusBadge, dedicated to the risk/criticality scale every
 * initiative uses (stockout risk, repair urgency, aging severity). */
export function RiskBadge({
  level,
  className,
  children,
}: {
  level: RiskLevel
  className?: string
  children?: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap uppercase tracking-[0.5px]",
        RISK_CLASSES[level],
        className
      )}
    >
      {children ?? RISK_LABELS[level]}
    </span>
  )
}
