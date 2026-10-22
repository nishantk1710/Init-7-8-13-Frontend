import type { ReactNode } from "react"
import { TriangleAlert } from "lucide-react"

import { cn, formatCount } from "@/lib/utils"

export type AttentionItem = { key: string; count: number; label: string }

/**
 * The orange "needs your attention" strip: a few counts that each ask for a
 * follow-up, and where to go to do it. `children` replaces the counts with a
 * paragraph where the banner explains rather than counts.
 */
export function AttentionBanner({
  title,
  items,
  action,
  children,
  className,
}: {
  title: string
  items?: AttentionItem[]
  action?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-card border border-attention-line bg-attention p-5 text-attention-ink lg:flex-row lg:items-center",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
          {title}
        </h2>
        {items && items.length > 0 && (
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {items.map((item) => (
              <li key={item.key} className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tabular-nums">{formatCount(item.count)}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
        {children && <div className="text-sm leading-relaxed">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  )
}
