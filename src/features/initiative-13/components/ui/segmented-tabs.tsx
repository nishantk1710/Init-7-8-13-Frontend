import Link from "next/link"

import { cn } from "@/lib/utils"

export type SegmentedTab = { href: string; label: string; active: boolean }

/**
 * Views of one screen as links -- the view lives in the URL like every other
 * I13 filter, so each tab is a page a person can send. Drawn like the dashboard's
 * Details tabs and the Action Center's filter: a bordered, shadowed track, and the
 * selected tab a white box outlined in blue (`aria-current` says so for assistive tech).
 * It is only as wide as its tabs; two views do not need a full-width bar.
 */
export function SegmentedTabs({ tabs, label }: { tabs: SegmentedTab[]; label: string }) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto p-1 pb-3">
      <div className="inline-flex h-11 items-center gap-1 rounded-lg border-2 border-action/40 bg-card p-1 shadow-lg">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-md border border-transparent px-4 text-sm font-semibold whitespace-nowrap transition-all duration-300 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              tab.active
                ? "border-action bg-background text-foreground shadow-md"
                : "text-foreground/70 hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
