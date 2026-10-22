import type { ReactNode } from "react"

/**
 * Every Repairable Spares screen, Live: wears the I08 look (`i08-scope` in
 * globals.css -- Vedanta blue, a grey page under white cards, the status
 * colours). Scoped here so the rest of the app is untouched until the new
 * look has been seen (I08_Live_UI_Redesign_Plan.md, decision D1).
 */
export default function RepairableSparesLayout({ children }: { children: ReactNode }) {
  return <div className="i08-scope flex min-h-0 min-w-0 flex-1 flex-col bg-i08-canvas">{children}</div>
}
