import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ChampionChallenger } from "@/features/initiative-7/types/inventory"

/** Champion/challenger model comparison — two small cards, the selected one
 * visually marked. Mock accuracy figures, no live model call. */
export function ChampionChallengerCards({ comparison }: { comparison: ChampionChallenger }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ModelCard profile={comparison.champion} selected={comparison.selected === "champion"} />
      <ModelCard profile={comparison.challenger} selected={comparison.selected === "challenger"} />
      <p className="text-[11px] text-muted-foreground sm:col-span-2">{comparison.rationale}</p>
    </div>
  )
}

function ModelCard({
  profile,
  selected,
}: {
  profile: ChampionChallenger["champion"]
  selected: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        selected ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{profile.name}</span>
        {selected && (
          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
            <CheckCircle2 className="size-3" />
            Selected
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{profile.description}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-foreground tabular-nums">{profile.accuracyPct}%</span>
        <span className="text-[10px] text-muted-foreground">backtest accuracy</span>
      </div>
    </div>
  )
}
