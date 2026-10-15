import { cn } from "@/lib/utils"

/** A real-number KPI card in the mockup's shape -- label + corner icon on
 * top, a large number, a sublabel, and an optional colored footnote line
 * (e.g. "48.0% of recommendations"). Solid border distinguishes it from
 * UndefinedKpiCard's dashed "not configured" shell. */
export function KpiCard({
  label,
  icon,
  value,
  sublabel,
  footnote,
  footnoteTone = "muted",
}: {
  label: string
  icon: React.ReactNode
  value: string
  sublabel: string
  footnote?: string
  footnoteTone?: "muted" | "warning" | "success" | "destructive"
}) {
  const footnoteClass = {
    muted: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  }[footnoteTone]
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      </div>
      {footnote && <p className={cn("text-xs", footnoteClass)}>{footnote}</p>}
    </div>
  )
}
