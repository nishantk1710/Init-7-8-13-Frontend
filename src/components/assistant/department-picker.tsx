"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { listDepartments, type ApiDepartment } from "@/lib/api/assistant"
import { departmentText } from "@/lib/assistant/request/record"
import { cn } from "@/lib/utils"

const CODE = /^\d{5}$/

/** Rows shown at once. The full list is ~105 codes; the box narrows it. */
const MAX_ROWS = 50

type Loaded = { items: ApiDepartment[]; loaded: boolean }

function loadFromApi(plant: string, signal: AbortSignal): Promise<Loaded> {
  return listDepartments(plant, { signal })
}

/** A code or name fragment: a code by its start, a name anywhere in it. */
export function matchesDepartment(department: ApiDepartment, typed: string): boolean {
  const query = typed.trim().toLowerCase()
  if (!query) return true
  return department.code.startsWith(query) || (department.name ?? "").toLowerCase().includes(query)
}

/**
 * The Department field: a 5-digit code picked from a list, never free text
 * (free text goes in the separate department note).
 *
 * The list is VZI's department list (`Plant Dept Codes`), served per plant by
 * `GET /assistant/departments` with each code's name. Before anything is
 * typed it shows the plant's own codes; typing searches every code by code or
 * name, so a department the list files under the other plant can still be
 * chosen — labelled with the plant it is listed at.
 *
 * `value` is set only by a pick. Editing the text afterwards clears it, so the
 * form cannot go ahead on a half-typed code.
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
  load = loadFromApi,
  invalid = false,
}: {
  id: string
  /** Empty until a material (and so a plant) is picked; the box is disabled. */
  plant: string
  value: string
  onChange: (code: string) => void
  /** Where the list comes from; the request screen passes its demo-aware loader. */
  load?: (plant: string, signal: AbortSignal) => Promise<Loaded>
  invalid?: boolean
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
    load(plant, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setAnswer({ plant, items: response.items, loaded: response.loaded, error: null })
      })
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
  }, [plant, load])

  const current = answer?.plant === plant ? answer : null

  // A code handed in (from SAP, or kept from before) is shown with its name
  // once the list arrives.
  const preset = value && query === value ? current?.items.find((d) => d.code === value) : undefined
  const shown = preset ? departmentText(preset.code, preset.name) : query
  // With a department picked, the list offers the plant's own again, unfiltered.
  const typed = value ? "" : query.trim()

  const options: Option[] = useMemo(() => {
    const items = current?.items ?? []
    const matches = typed ? items.filter((d) => matchesDepartment(d, typed)) : items.filter((d) => d.primary)
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
    if (option.kind === "listed") {
      setQuery(departmentText(option.department.code, option.department.name))
      onChange(option.department.code)
    } else {
      setQuery(option.code)
      onChange(option.code)
    }
    setOpen(false)
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
        value={shown}
        // The whole name on hover: the box is narrower than the longest names.
        title={value ? shown : undefined}
        disabled={!plant}
        onChange={(event) => {
          const next = event.target.value.slice(0, 80)
          setQuery(next)
          setActive(0)
          setOpen(true)
          if (value) onChange("")
        }}
        onFocus={(event) => {
          setOpen(true)
          // A picked department's text is selected, so typing replaces it.
          if (value) event.target.select()
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={plant ? "code or name, e.g. 10100 or finance" : "add a material first"}
        className="truncate pl-8"
        aria-invalid={invalid}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options.length > 0 ? optionId(activeIndex) : undefined}
      />

      {showList && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 min-w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
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
              No department at plant 1300 or 1500 matches &ldquo;{typed}&rdquo;.
            </p>
          )}
          {options.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Departments" className="max-h-60 overflow-y-auto py-1">
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
                    "flex cursor-pointer items-baseline gap-3 px-3 py-1.5 text-sm",
                    index === activeIndex ? "bg-muted" : "bg-transparent"
                  )}
                >
                  {option.kind === "listed" ? (
                    <>
                      <span className="shrink-0 font-mono text-foreground">{option.department.code}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {option.department.name ?? <span className="text-muted-foreground">no name on the list</span>}
                      </span>
                      {!option.department.plants.includes(plant) && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          listed at {option.department.plants.join(", ")}
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
