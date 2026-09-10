import { CategoryTag } from "@/components/shared/category-tag"
import type { TraceInfo } from "@/lib/types"

export function TraceabilityLog({ trace }: { trace: TraceInfo }) {
  const rows: [string, string][] = [
    ["Material", trace.material],
    ["Equipment", trace.equipment],
    ["Requester", trace.requester],
    ["Classification", trace.specMatch],
    ["Selections", `${trace.selectionsDone} of ${trace.selectionsTotal} steps`],
  ]

  return (
    <div className="p-3">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
        Traceability log
      </h3>
      <div className="mb-2 flex flex-wrap gap-1">
        {trace.tags.map((tag) => (
          <CategoryTag key={tag.label} label={tag.label} kind={tag.kind} />
        ))}
      </div>
      <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span className="font-medium text-foreground">{label}:</span>{" "}
            {value}
          </div>
        ))}
      </div>
    </div>
  )
}
