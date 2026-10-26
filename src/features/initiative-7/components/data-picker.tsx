"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DataItem } from "@/features/initiative-7/types/kpi-formulas"
import { UNIT_LABEL, filterData, groupData } from "@/features/initiative-7/utils/kpi-formulas"

/**
 * Every fact a formula on this card may use, in plain words, grouped and searchable. Clicking one writes its
 * name into the formula being edited, so nobody has to know the names or guess what exists.
 */
export function DataPicker({
  items,
  helpers,
  target,
  disabled,
  onPick,
}: {
  items: DataItem[]
  /** Values built by the card's earlier formulas, which a later one may use too. */
  helpers: { name: string; label: string }[]
  /** The formula a click writes into, in words ("At risk when"). */
  target: string | null
  disabled: boolean
  onPick: (name: string) => void
}) {
  const [query, setQuery] = useState("")
  const shown = filterData(items, query)
  const groups = groupData(shown)
  const searching = query.trim().length > 0

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Data you can use</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {target ? (
            <>
              Click a name to add it to <span className="font-medium text-foreground">{target}</span>.
            </>
          ) : (
            "Click a name to add it to the formula you are editing."
          )}
        </p>
      </div>

      <label className="relative block">
        <span className="sr-only">Search the data</span>
        <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${items.length} facts, e.g. price, stock, lead…`}
          className="h-8 w-full rounded-lg border border-input bg-transparent pr-2.5 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
        {helpers.length > 0 && !searching && (
          <Group heading="Built up above" defaultOpen>
            {helpers.map((helper) => (
              <Fact
                key={helper.name}
                name={helper.name}
                label={helper.label}
                description="The result of the formula of that name on this card."
                disabled={disabled}
                onPick={onPick}
              />
            ))}
          </Group>
        )}
        {groups.map(({ group, items: grouped }) => (
          <Group key={group} heading={group} count={grouped.length} defaultOpen={searching || group === groups[0]?.group}>
            {grouped.map((item) => (
              <Fact
                key={item.name}
                name={item.name}
                label={item.label}
                description={item.description}
                unit={item.unit}
                disabled={disabled}
                onPick={onPick}
              />
            ))}
          </Group>
        ))}
        {groups.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>}
      </div>
    </div>
  )
}

function Group({
  heading,
  count,
  defaultOpen,
  children,
}: {
  heading: string
  count?: number
  defaultOpen: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span>{heading}</span>
        {count !== undefined && <span className="font-normal tabular-nums">{count}</span>}
      </summary>
      <ul className="flex flex-col gap-0.5 border-t border-border p-1">{children}</ul>
    </details>
  )
}

function Fact({
  name,
  label,
  description,
  unit,
  disabled,
  onPick,
}: {
  name: string
  label: string
  description: string
  unit?: string
  disabled: boolean
  onPick: (name: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(name)}
        className={cn(
          "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          disabled && "opacity-50"
        )}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <code className="rounded-sm bg-muted px-1 font-mono text-[11px] text-muted-foreground">{name}</code>
          {unit && <span className="text-[11px] text-muted-foreground">{UNIT_LABEL[unit] ?? unit}</span>}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </button>
    </li>
  )
}
