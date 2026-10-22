import Link from "next/link"

import { cn } from "@/lib/utils"

export type SegmentedTab = { href: string; label: string; active: boolean }

/**
 * Views of one screen as links -- the view lives in the URL like every other
 * I13 filter, so each tab is a page a person can send. The active tab is a
 * solid indigo segment and says so with `aria-current`.
 */
export function SegmentedTabs({ tabs, label }: { tabs: SegmentedTab[]; label: string }) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <div className="inline-flex gap-1 rounded-xl border border-line bg-card p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              tab.active
                ? "bg-primary-strong text-white hover:bg-primary-strong-hover"
                : "text-ink-muted hover:bg-primary-tint hover:text-primary-ink"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
