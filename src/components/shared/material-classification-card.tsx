import Link from "next/link"
import { ArrowRight, PackageCheck, PackageSearch, RotateCcw, Wrench } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { classifyMaterial } from "@/lib/material-router"

const ROUTE_ICON = {
  "initiative-13": PackageSearch,
  "initiative-8": Wrench,
  "initiative-7": RotateCcw,
} as const

interface QuickAction {
  label: string
  href: string
}

function quickActionsFor(materialId: string, route: ReturnType<typeof classifyMaterial>["route"], signalHref?: string): QuickAction[] {
  switch (route.initiative) {
    case "initiative-13":
      return [
        { label: "View Utilisation Ledger", href: "/oar-utilization/ledger" },
        { label: "View Released OAR", href: "/oar-utilization/redeployment" },
      ]
    case "initiative-8":
      return [
        { label: "View Repair Register", href: signalHref ?? "/repairable-spares/repair-register" },
        { label: "Start Condition Declaration", href: "/repairable-spares/declarations" },
      ]
    case "initiative-7":
      return [
        { label: "Review Planning Parameters", href: signalHref ?? "/inventory-planning/recommendations" },
        { label: "Open Approval Workflow", href: "/inventory-planning/pipeline" },
      ]
    default:
      return [{ label: "View in Materials", href: `/materials?material=${encodeURIComponent(materialId)}` }]
  }
}

/**
 * The Material Assistant's classification response — the shared card used
 * everywhere a material gets identified and routed (chat, Material 360).
 * Pure presentation: all classification/routing logic lives in
 * `lib/material-router.ts`, all initiative detail lines come from that
 * initiative's own `Material360Signal` selector.
 */
export function MaterialClassificationCard({ materialId }: { materialId: string }) {
  const { description, classificationLabel, route, signal } = classifyMaterial(materialId)
  const Icon = route.initiative ? ROUTE_ICON[route.initiative] : PackageCheck
  const actions = quickActionsFor(materialId, route, signal?.href)

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 text-xs">
      <Link href={`/materials/${materialId}`} className="mb-2 block hover:underline">
        <div className="text-sm font-medium text-foreground">{description}</div>
        <div className="text-[11px] text-muted-foreground">{materialId}</div>
      </Link>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <div className="text-[11px] text-muted-foreground">Classification</div>
          <StatusBadge tone={route.reason === "oar" ? "warning" : "default"} className="mt-1">
            <span className="flex items-center gap-1">
              <Icon className="size-3" />
              {classificationLabel}
            </span>
          </StatusBadge>
        </div>
        <div className="rounded-lg bg-muted/40 p-2.5">
          <div className="text-[11px] text-muted-foreground">Routing</div>
          <div className="mt-1 flex items-center gap-1 text-[13px] font-medium text-foreground">
            <ArrowRight className="size-3.5 text-primary" />
            {route.label}
          </div>
        </div>
      </div>

      {signal && signal.lines.length > 0 && (
        <dl className="mt-2.5 space-y-0.5 border-t border-dashed border-border pt-2.5">
          {signal.lines.map((line) => (
            <div key={line.label} className="flex justify-between gap-2 text-[11px]">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
