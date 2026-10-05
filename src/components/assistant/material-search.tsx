"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  searchMaterials,
  type ApiFlow,
  type ApiMaterialMatch,
} from "@/lib/api/assistant"
import { cn } from "@/lib/utils"

/** What the person picked: a suggestion, or a number typed by hand. */
export type MaterialPick =
  | { kind: "match"; match: ApiMaterialMatch }
  | { kind: "typed"; materialId: string }

const DEBOUNCE_MS = 250
const MIN_LENGTH = 2

/** All digits, ignoring spaces and dashes: the text is a material number. */
function typedNumber(text: string): string | null {
  const compact = text.replace(/[\s-]/g, "")
  if (!/^\d+$/.test(compact)) return null
  return compact.replace(/^0+/, "") || null
}

/**
 * The Material field: a number or part of a name, with suggestions.
 *
 * Each suggestion is one material at one plant, because stock, repairs and
 * cover are all held per plant -- picking one fills both. Picking does **not**
 * open a session; the opener's Start button does, once every field is filled.
 *
 * A number with no description anywhere (some rows have no MAKT text) can still
 * be used as typed, through the last row of the list. Without it, a material
 * the platform cannot name could not be assessed at all.
 */
export function MaterialSearch({
  id,
  defaultQuery = "",
  onPick,
}: {
  id: string
  defaultQuery?: string
  onPick: (pick: MaterialPick) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState(defaultQuery)
  /** The last answer, and the query it answers. Older answers stay visible
   *  while a newer one is on its way, as in any typeahead. */
  const [answer, setAnswer] = useState<{
    query: string
    items: ApiMaterialMatch[]
    error: string | null
  } | null>(null)
  const [open, setOpen] = useState(defaultQuery.trim().length >= MIN_LENGTH)
  const [active, setActive] = useState(0)

  const text = query.trim()
  const tooShort = text.length < MIN_LENGTH

  useEffect(() => {
    if (tooShort) return
    // A newer keystroke cancels the request for an older one, so a slow answer
    // to "pu" can never replace the answer to "pump".
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchMaterials(text, { signal: controller.signal })
        .then((response) => {
          setAnswer({ query: text, items: response.items, error: null })
          setActive(0)
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return
          setAnswer({
            query: text,
            items: [],
            error: caught instanceof Error ? caught.message : "Materials could not be searched.",
          })
        })
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [text, tooShort])

  const results = useMemo(() => (tooShort ? [] : (answer?.items ?? [])), [tooShort, answer])
  const status: "idle" | "loading" | "done" | "error" = tooShort
    ? "idle"
    : answer?.query !== text
      ? "loading"
      : answer.error
        ? "error"
        : "done"
  const error = answer?.error ?? null

  const number = typedNumber(query)
  const answered = status === "done" || status === "error"
  const options: MaterialPick[] = useMemo(() => {
    const picks: MaterialPick[] = results.map((match) => ({ kind: "match", match }))
    // Only once this query has been answered. Offered while the search is in
    // flight, it would be the first row a quick Enter lands on, ahead of the
    // suggestion that was about to arrive.
    if (answered && number && !results.some((m) => m.materialId === number)) {
      picks.push({ kind: "typed", materialId: number })
    }
    return picks
  }, [results, number, answered])

  const showList = open && status !== "idle"
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0))

  function pick(option: MaterialPick) {
    setOpen(false)
    onPick(option)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === "Enter") {
      // Enter picks; it must never submit the surrounding form.
      event.preventDefault()
      if (showList && options[activeIndex]) pick(options[activeIndex])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Material number or name, e.g. 8000005632 or pump"
        className="pl-8"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options.length > 0 ? optionId(activeIndex) : undefined}
      />

      {showList && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {status === "loading" && options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
              Searching…
            </p>
          )}
          {status === "error" && (
            <p className="px-3 py-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {status === "done" && options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
              No material at plant 1300 or 1500 matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}
          {options.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Matching materials" className="max-h-72 overflow-y-auto py-1">
              {options.map((option, index) => (
                <li
                  key={option.kind === "match" ? `${option.match.materialId}/${option.match.plant}` : "typed"}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown, not click: a click lands after the input's blur
                  // has already closed the list.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pick(option)
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                    index === activeIndex ? "bg-muted" : "bg-transparent"
                  )}
                >
                  {option.kind === "match" ? (
                    <MatchRow match={option.match} />
                  ) : (
                    <span className="text-muted-foreground">
                      Use <span className="font-mono text-foreground">{option.materialId}</span> as typed
                      <span className="ml-1 text-[11px]">— you will be asked for the plant</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match }: { match: ApiMaterialMatch }) {
  return (
    <>
      <span className="w-24 shrink-0 font-mono text-xs text-foreground">{match.materialId}</span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {match.description ?? <span className="text-muted-foreground italic">No description</span>}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        <span className="font-mono">{match.plant}</span>
        {match.plantName && <span className="hidden sm:inline"> {match.plantName}</span>}
      </span>
      <FlowBadge flow={match.flowHint} />
    </>
  )
}

const FLOW_LABEL: Record<ApiFlow, string> = {
  i08: "Repairable",
  i13: "OAR",
  none: "No assistant flow",
}

/** The router's likely verdict. A hint: the router decides when it opens. */
export function FlowBadge({ flow }: { flow: ApiFlow }) {
  return (
    <Badge
      variant={flow === "none" ? "outline" : "secondary"}
      className={cn("shrink-0", flow === "none" && "text-muted-foreground")}
      title="Hint only — the flow is decided when the session opens."
    >
      {FLOW_LABEL[flow]}
    </Badge>
  )
}
