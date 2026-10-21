"use client"

import { History, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@demo/components/ui/button"
import { countActions, type I8Snapshot } from "@demo/features/initiative-8/model/snapshot"
import { snapshotStore, useSnapshotActions } from "@demo/features/initiative-8/state/snapshot-store"
import { cn, formatCount } from "@demo/lib/utils"

/**
 * A slim notice that this browser has changed the Snapshot — declarations,
 * justifications, exception work — and a way back to the data as shipped.
 * Renders nothing until something has changed.
 *
 * Without it, a figure that moved after a declaration on another screen looks
 * like the Snapshot is unstable, and the next person shown the demo sees the
 * last person's changes with no clue where they came from.
 *
 * Pass the page's `snapshot` when it already has one; on its own it reads the
 * count straight from the store, which is cheaper than building a snapshot.
 */
export function SessionChangesBanner({
  snapshot,
  className,
}: {
  snapshot?: Pick<I8Snapshot, "actionCount">
  className?: string
}) {
  const actions = useSnapshotActions()
  const count = snapshot?.actionCount ?? countActions(actions)
  if (count === 0) return null

  function reset() {
    snapshotStore.reset()
    toast.success("Demo data reset", { description: "Back to the Snapshot as shipped." })
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-muted-foreground">
        <History className="size-3.5 shrink-0" />
        <span>
          <strong className="font-medium text-foreground">
            {formatCount(count)} {count === 1 ? "change" : "changes"}
          </strong>{" "}
          made in this session — held in this browser, not posted to SAP.
        </span>
      </p>
      <Button type="button" variant="outline" size="xs" onClick={reset} className="self-start sm:self-auto">
        <RotateCcw />
        Reset demo data
      </Button>
    </div>
  )
}
