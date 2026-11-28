import type { ReverseRequestAction } from "@/features/initiative-7/services/reverse-conversion-requests-api"
import type { ApiReverseLedgerEntry } from "@/features/initiative-7/types/reverse-conversion"
import { formatLoadedAt } from "@/features/initiative-7/utils/reverse-conversion-query"
import { ACTION_DONE } from "@/features/initiative-7/utils/reverse-request-state"

/** What happened to a conversion request, oldest first: who did what, as which role, when, and their comment. Shared by
 * the Stock item to OAR card and the Action Center's decision page, so both read the same ledger the same way. */
export function ReverseRequestHistory({ entries }: { entries: ApiReverseLedgerEntry[] }) {
  if (entries.length === 0) return null
  return (
    <ul className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
      {entries.map((entry) => (
        <li key={entry.id} className="text-[12px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">
            {entry.action === "SUBMIT" ? "Requested" : ACTION_DONE[entry.action as ReverseRequestAction] ?? entry.action}
          </span>
          {" by "}
          {entry.actor_role === "Requester" ? entry.actor_id : entry.actor_role}
          {" · "}
          {formatLoadedAt(entry.timestamp)}
          {entry.comment ? <span className="block text-foreground/80">“{entry.comment}”</span> : null}
        </li>
      ))}
    </ul>
  )
}
