"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { listDepartments, type ApiDepartment } from "@/lib/api/assistant"
import { cn } from "@/lib/utils"

const CODE = /^\d{5}$/

/** Rows shown at once. The full list is ~76 codes; the box narrows it. */
const MAX_ROWS = 50

/**
 * The Department field: a 5-digit code picked from a list, never free text.
 *
 * The codes are the ones VZI keys into a purchase requisition's Requisitioner
 * (`EBAN.AFNAM`), served per plant by `GET /assistant/departments`. Before
 * anything is typed it shows the picked plant's codes; typing searches every
 * code, so a department from the other site can still be chosen — labelled
 * with where it is used.
 *
 * `value` is set only by a pick. Editing the text afterwards clears it, so the
 * opener's Start button cannot go ahead on a half-typed code.
 *
 * When the backend has no list yet (still loading, unreadable, or the demo),
 * any 5-digit code can be used as typed — the backend accepts it in that state
 * too, and the form must not be left impossible to complete.
 */
export function DepartmentPicker({
  id,
  plant,
  value,
  onChange,
}: {
  id: string
  /** Empty until a material (and so a plant) is picked; the box is disabled. */
  plant: string
  value: string
  onChange: (code: string) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [answer, setAnswer] = useState<{
    plant: string
    items: ApiDepartment[]
    loaded: boolean
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!plant) return
    const controller = new AbortController()
    listDepartments(plant, { signal: controller.signal })
      .then((response) =>
        setAnswer({ plant, items: response.items, loaded: response.loaded, error: null })
      )
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setAnswer({
          plant,
          items: [],
          loaded: false,
          error: caught instanceof Error ? caught.message : "Departments could not be loaded.",
        })
      })
    return () => controller.abort()
  }, [plant])

  const current = answer?.plant === plant ? answer : null
  const typed = query.trim()

  const options: Option[] = useMemo(() => {
    const items = current?.items ?? []
    const matches = typed
      ? items.filter((d) => d.code.startsWith(typed))
      : items.filter((d) => d.primary)
    const rows: Option[] = matches.slice(0, MAX_ROWS).map((department) => ({
      kind: "listed",
      department,
    }))
    // No list to pick from: a well-formed code is taken as typed.
    if (current && !current.loaded && CODE.test(typed)) rows.push({ kind: "typed", code: typed })
    return rows
  }, [current, typed])

  const showList = open && !!plant && current !== null
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0))

  function pick(option: Option) {
    const code = option.kind === "listed" ? option.department.code : option.code
    setQuery(code)
    setOpen(false)
    onChange(code)
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
        disabled={!plant}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, 5)
          setQuery(next)
          setActive(0)
          setOpen(true)
          if (value && next !== value) onChange("")
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={plant ? "department code, e.g. 10100" : "pick a material first"}
        className="pl-8 font-mono"
        inputMode="numeric"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options.length > 0 ? optionId(activeIndex) : undefined}
      />

      {showList && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {current.error && (
            <p className="px-3 py-2 text-xs text-destructive" role="alert">
              {current.error} Type the 5-digit code.
            </p>
          )}
          {!current.error && !current.loaded && options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
              Type the 5-digit department code.
            </p>
          )}
          {current.loaded && options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
              No department code at plant 1300 or 1500 starts with &ldquo;{typed}&rdquo;.
            </p>
          )}
          {options.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Department codes" className="max-h-60 overflow-y-auto py-1">
              {options.map((option, index) => (
                <li
                  key={option.kind === "listed" ? option.department.code : "typed"}
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
                    "flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm",
                    index === activeIndex ? "bg-muted" : "bg-transparent"
                  )}
                >
                  {option.kind === "listed" ? (
                    <>
                      <span className="font-mono text-foreground">{option.department.code}</span>
                      {!option.department.plants.includes(plant) && (
                        <span className="text-[11px] text-muted-foreground">
                          used at {option.department.plants.join(", ")}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Use <span className="font-mono text-foreground">{option.code}</span> as typed
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

type Option = { kind: "listed"; department: ApiDepartment } | { kind: "typed"; code: string }
