"use client"

import { useState } from "react"
import Link from "next/link"

import { ApprovalsTable } from "@/components/approvals/approvals-table"
import { AlertBanner } from "@/components/shared/alert-banner"
import { CappedNotice } from "@/components/shared/load-status"
import type { GlobalAction, InitiativeId } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"
import { ApprovalsWorkspace } from "@/features/initiative-7/components/approvals-workspace"
import type { ApprovalsSummary } from "@/features/initiative-7/components/live-approvals-workspace"

export type ApprovalsChip = { id: InitiativeId | "all"; label: string; href: string }

/**
 * The Approvals body: the "Showing X of Y" card, the module filter, and what the filter selects.
 *
 * A client component for one reason: the card has to say what is on screen -- one page of the table, or the Inventory
 * Planning queue's own rows -- and only the table and the workspace know that. The filter stays a row of links, so the
 * module is still in the URL and a filtered view is still something you can send.
 */
export function ApprovalsView({
  filter,
  chips,
  approvals,
  total,
  moduleName,
  notLoaded,
  incomplete,
}: {
  filter: InitiativeId | "all"
  chips: ApprovalsChip[]
  /** The decisions for the selected module, already filtered by the server. */
  approvals: GlobalAction[]
  /** The real number of decisions behind this filter; `null` where it could not be determined. */
  total: number | null
  /** Named in the "not loaded" card. */
  moduleName: string
  /** The selected module did not answer. */
  notLoaded: boolean
  /** Some module could not be loaded, so an empty table is not "all clear". */
  incomplete: boolean
}) {
  const [shown, setShown] = useState<number | null>(null)
  const [i7Summary, setI7Summary] = useState<ApprovalsSummary | null>(null)

  // Nothing is claimed until what is on screen has reported in.
  let card: React.ReactNode = null
  if (notLoaded) {
    card = (
      <AlertBanner tone="info" title={`${moduleName} is not loaded`}>
        This module did not answer, so nothing is listed for it. That is not a statement that nothing is waiting there.
      </AlertBanner>
    )
  } else if (filter === "initiative-7") {
    // This filter lists its own queue, so the card reports what that queue is showing.
    if (i7Summary) {
      card = (
        <CappedNotice shown={i7Summary.shown} total={i7Summary.total} noun="recommendations" description={null} />
      )
    }
  } else if (total !== null && shown !== null) {
    card = <CappedNotice shown={shown} total={total} noun="decisions" description={null} />
  }

  return (
    <>
      {card}

      {/* The same bar as the Action Center's filter: a bold bordered, shadowed track, with the selected module a white
          box outlined in the theme colour. */}
      <nav
        aria-label="Filter by module"
        className="flex w-full max-w-4xl flex-wrap items-center gap-1 rounded-lg border-2 border-action/40 bg-card p-1 shadow-lg sm:flex-nowrap"
      >
        {chips.map((chip) => (
          <Link
            key={chip.id}
            href={chip.href}
            aria-current={filter === chip.id ? "page" : undefined}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-4 text-sm font-semibold whitespace-nowrap transition-all duration-300 ease-out",
              filter === chip.id
                ? "border-action bg-background text-foreground shadow-md"
                : "text-foreground/70 hover:text-foreground"
            )}
          >
            {chip.label}
          </Link>
        ))}
      </nav>

      {/* Keyed on the module so the content fades in on every filter change. Dropped for reduced motion. */}
      <div
        key={filter}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none"
      >
        {filter === "initiative-7" ? (
          <ApprovalsWorkspace onSummaryChange={setI7Summary} />
        ) : (
          <ApprovalsTable approvals={approvals} incomplete={incomplete} onShownChange={setShown} />
        )}
      </div>
    </>
  )
}
