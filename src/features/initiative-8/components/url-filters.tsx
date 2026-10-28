"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/**
 * The filter controls of I08's server-paged screens: Justifications, Repair
 * Declarations and Repair Exceptions.
 *
 * Each of those is a server component that reads its filters and page from
 * `searchParams` and fetches one page. These controls only write the URL, and
 * the server re-renders with the page for it -- the I13 OAR screens' pattern
 * (`initiative-13/components/url-filters.tsx`). A filtered queue is a link
 * somebody can send, and back and forward work.
 *
 * Moved here from the justification log when the two queues began paging, so
 * three screens share one copy.
 */

const ALL = "all"
const DEBOUNCE_MS = 400

/**
 * `push(patch)` writes the patch into the URL -- an empty value removes the
 * key -- and starts over at page 1, since page 4 of the old filter means
 * nothing in the new one.
 *
 * Inside a transition, so the rows on screen stay while the next page loads
 * instead of blanking. `isPending` is for the spinner that says so; without it
 * the screen would look frozen.
 */
export function useUrlFilters(path: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function push(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete("page")
    const query = next.toString()
    startTransition(() => {
      router.replace(query ? `${path}?${query}` : path, { scroll: false })
    })
  }

  return { push, isPending }
}

/** Reserved whether or not it spins, so the filter row does not jump. */
export function PendingSpinner({ pending }: { pending: boolean }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      {pending && (
        <Loader2
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Loading filtered results"
        />
      )}
    </span>
  )
}

/**
 * A dropdown with "all" as its first option. Choosing it writes no value, so a
 * cleared filter and one never set are the same URL.
 */
export function UrlSelect({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  /** The value in the URL; empty for "all". */
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  className?: string
}) {
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]))
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => {
        const next = v ?? ALL
        onChange(next === ALL ? "" : next)
      }}
    >
      {/* A set filter looks set -- tinted, in the link colour -- so a page
          narrowed by one is never mistaken for the whole list. */}
      <SelectTrigger
        className={cn(
          "h-9 w-full bg-background",
          value && "border-primary/60 bg-accent font-medium text-accent-foreground",
          className
        )}
      >
        <SelectValue placeholder={allLabel}>
          {(selected: string) => (selected === ALL ? allLabel : labels[selected] ?? selected)}
        </SelectValue>
      </SelectTrigger>
      {/* Portalled out of the page, so it carries the I08 look itself. */}
      <SelectContent className="i08-scope">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The search box. It writes the URL once typing settles, not per keystroke:
 * a controlled input reading the URL would re-render from the server on every
 * key and drop characters. Same mechanics as I13's `DebouncedInput`.
 */
export function UrlSearchInput({
  value,
  onCommit,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)

  // Re-sync when the URL changes underneath -- the back button, or Clear.
  // Adjusted during render, React's pattern for state that resets with a prop.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const id = setTimeout(() => onCommit(draft.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("h-9 w-full", draft && "pr-8")}
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft("")
            onCommit("")
          }}
          aria-label="Clear search"
          title="Clear search"
          className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** The values the server says exist, plus the one selected -- so a link to a
 *  value that no longer appears still shows what it is filtering by. */
export function withSelected(values: readonly string[], selected?: string): string[] {
  return selected && !values.includes(selected) ? [...values, selected] : [...values]
}
