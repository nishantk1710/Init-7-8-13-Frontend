import Link from "next/link"
import { CircleDot } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { getInitiative7Material360Signal } from "@/features/initiative-7/selectors/material-360-adapter"
import { getInitiative8Material360Signal } from "@/features/initiative-8/selectors/material-360-adapter"
import { getInitiative13Material360Signal } from "@/features/initiative-13/selectors/material-360-adapter"
import { isOARMaterial } from "@/features/initiative-13/selectors/oar-lookup"
import type { Material360Signal, InitiativeHealth } from "@/lib/domain/contracts"
import { getMaterialById } from "@/lib/shared-data/material-catalog"
import { CHAT_SESSIONS } from "@/lib/mock-data"
import { cn, formatZAR } from "@/lib/utils"

const STATUS_DOT: Record<InitiativeHealth | "neutral", string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
  neutral: "text-muted-foreground",
}

function SignalSection({ signal }: { signal: Material360Signal }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <CircleDot className={cn("size-3", STATUS_DOT[signal.status])} />
          {signal.label}
        </span>
        <Link href={signal.href} className="text-[11px] text-primary hover:underline">
          Open
        </Link>
      </div>
      {signal.lines.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No active signal.</p>
      ) : (
        <dl className="space-y-0.5">
          {signal.lines.map((line) => (
            <div key={line.label} className="flex justify-between gap-2 text-[11px]">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * One integrated material view (§32/§39) — composition only. Each module
 * supplies a `Material360Signal | null` via its own
 * `selectors/material-360-adapter.ts`; this just lays out whatever comes
 * back. Shared by the Material 360 drawer (quick glance) and the
 * `/materials/[materialId]` page (deep link / full page).
 */
export function MaterialOverviewContent({ materialId }: { materialId: string }) {
  const material = getMaterialById(materialId)

  const initiative7Signal = getInitiative7Material360Signal(materialId)
  const initiative8Signal = getInitiative8Material360Signal(materialId)
  const initiative13Signal = getInitiative13Material360Signal(materialId)
  const isOAR = isOARMaterial(materialId)

  const relatedSessions = CHAT_SESSIONS.filter((s) => s.materialId === materialId)

  if (!material) {
    return (
      <p className="text-xs text-muted-foreground">
        No catalog record for this material — it may be module-specific mock data not in the
        shared catalog.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">Material details</span>
          <StatusBadge tone={isOAR ? "warning" : "default"}>
            {isOAR ? "OAR" : "Non-OAR"}
          </StatusBadge>
        </div>
        <dl className="space-y-0.5">
          <div className="flex justify-between gap-2 text-[11px]">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="text-foreground">{material.category}</dd>
          </div>
          <div className="flex justify-between gap-2 text-[11px]">
            <dt className="text-muted-foreground">Stock on hand</dt>
            <dd className="text-foreground">{material.stockLevel}</dd>
          </div>
          <div className="flex justify-between gap-2 text-[11px]">
            <dt className="text-muted-foreground">Last PO price</dt>
            <dd className="text-foreground">{formatZAR(material.lastPoPrice)}</dd>
          </div>
          <div className="flex justify-between gap-2 text-[11px]">
            <dt className="text-muted-foreground">Last vendor</dt>
            <dd className="text-foreground">{material.lastVendor}</dd>
          </div>
          <div className="flex justify-between gap-2 text-[11px]">
            <dt className="text-muted-foreground">Lead time</dt>
            <dd className="text-foreground">{material.leadTimeDays} days</dd>
          </div>
        </dl>
        {relatedSessions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-dashed border-border pt-2">
            {relatedSessions.map((s) => (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                className="text-[11px] text-primary hover:underline"
              >
                Open session #{s.id}
              </Link>
            ))}
          </div>
        )}
      </div>

      {initiative7Signal && <SignalSection signal={initiative7Signal} />}
      {initiative8Signal && <SignalSection signal={initiative8Signal} />}
      {initiative13Signal && <SignalSection signal={initiative13Signal} />}
    </div>
  )
}
