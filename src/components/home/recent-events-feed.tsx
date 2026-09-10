import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import type { AuditEvent } from "@/lib/domain/contracts"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

const INITIATIVE_LABEL: Record<AuditEvent["initiative"], string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

export function RecentEventsFeed({ events }: { events: AuditEvent[] }) {
  return (
    <ChartCard title="Recent events" subtitle="See the full history in Audit Trail.">
      {events.length === 0 ? (
        <EmptyState title="No events yet" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {events.slice(0, 8).map((event) => (
            <li key={event.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-foreground">{event.eventType}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {event.timestamp}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {INITIATIVE_LABEL[event.initiative]} · {event.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}
