import Link from "next/link"

import { AlertBanner } from "@/components/shared/alert-banner"
// Sanctioned, single cross-initiative import: a read-only presentation
// signal from Initiative 8's Material 360 adapter. Nothing else from
// Initiative 8 is imported anywhere in this module.
import { getInitiative8Material360Signal } from "@/features/initiative-8/selectors/material-360-adapter"

/**
 * Renders a "Repair Context Available" notice when Initiative 8 has an
 * active repair chain for this material. Renders nothing if Initiative 8
 * has no signal (including before that module exists) — never errors.
 */
export function RepairContextSignal({ materialId }: { materialId: string }) {
  const signal = getInitiative8Material360Signal(materialId)
  if (!signal) return null

  return (
    <AlertBanner
      tone="info"
      title="Repair context available — Repairable Spares"
      actions={
        <Link href={signal.href} className="text-xs font-medium text-primary hover:underline">
          View in Repairable Spares →
        </Link>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {signal.lines.map((line) => (
          <li key={line.label}>
            <span className="text-foreground/80">{line.label}:</span> {line.value}
          </li>
        ))}
      </ul>
    </AlertBanner>
  )
}
