import Link from "next/link"
import { Fragment, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"

/**
 * The frame of every I08 Live screen (I08_Live_UI_Redesign_Plan.md, L0): a
 * breadcrumb, the title, one summary line, the actions, then the screen.
 *
 * One frame so the seven screens cannot drift apart again -- they had three
 * different widths, two different headers and four ways of saying a count.
 *
 * The bottom padding stays `p-6` (24px) on purpose: the tables' pinned
 * sideways scrollbar (`StickyScrollTable`) is offset by exactly that much.
 */
export type Crumb = { label: string; href?: string }

export function I08Page({
  crumbs,
  title,
  summary,
  actions,
  children,
}: {
  crumbs: Crumb[]
  title: ReactNode
  /** One line under the title: counts and freshness, joined by dots. */
  summary?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-i08-canvas px-6 pt-5 pb-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col">
        <Breadcrumbs crumbs={crumbs} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {summary && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {summary}
              </div>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
      {crumbs.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
          {crumb.href ? (
            <Link href={crumb.href} className="rounded-sm hover:text-i08-link hover:underline">
              {crumb.label}
            </Link>
          ) : (
            <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

/** The dot between two facts in a summary line. */
export function Dot() {
  return (
    <span aria-hidden="true" className="text-muted-foreground/60">
      ·
    </span>
  )
}

/** A white card on the grey page. */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-card shadow-xs ${className}`}>{children}</section>
  )
}
