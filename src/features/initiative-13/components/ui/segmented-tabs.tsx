"use client"

import { useTransition, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageLoader } from "@/components/shared/page-loader"
import { cn } from "@/lib/utils"

export type SegmentedTab = { href: string; label: string; active: boolean }

/**
 * Views of one screen as links -- the view lives in the URL like every other
 * I13 filter, so each tab is a page a person can send. Drawn like the dashboard's
 * Details tabs and the Action Center's filter: a bordered, shadowed track, and the
 * selected tab a white box outlined in blue (`aria-current` says so for assistive tech).
 * It is only as wide as its tabs; two views do not need a full-width bar.
 *
 * ## The loader (UAT, 25 Nov 2026)
 *
 * A tab is the same page with another `?view=`, so Next.js does not show the
 * route's `loading.tsx` for it: the old tab stayed on screen, looking stuck,
 * until the new one had loaded. The switch now runs in a transition and, while
 * it waits, shows the same hourglass as opening a page from the sidebar. A
 * click with a modifier (new tab or window) is left to the browser.
 */
export function SegmentedTabs({ tabs, label }: { tabs: SegmentedTab[]; label: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function open(event: MouseEvent<HTMLAnchorElement>, tab: SegmentedTab) {
    if (tab.active || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    startTransition(() => router.push(tab.href))
  }

  return (
    <>
      <nav aria-label={label} className="max-w-full overflow-x-auto p-1 pb-3">
        <div className="inline-flex h-11 items-center gap-1 rounded-lg border-2 border-action/40 bg-card p-1 shadow-lg">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={(event) => open(event, tab)}
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
      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6">
          <PageLoader label="Loading OAR Utilization" className="h-64 w-full" />
        </div>
      )}
    </>
  )
}
