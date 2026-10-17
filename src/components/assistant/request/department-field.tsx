"use client"

import { useId, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import type { ApiDepartment } from "@/lib/api/assistant"
import { cn } from "@/lib/utils"

type Option = { code: string; otherPlant: string | null }

/**
 * A searchable department code, picked from the request plant's list
 * (`GET /assistant/departments?plant=`). Used in the header to fill many lines
 * at once; each line has its own.
 *
 * Disabled until the first material fixes the plant. Before anything is typed
 * it lists that plant's codes; typing also finds the other plant's, labelled.
 * The value is set only by a pick, so a half-typed code never counts.
 */
export function DepartmentField({
  id,
  label = "Department",
  plant,
  departments,
  value,
  onChange,
  invalid,
}: {
  id: string
  label?: string
  plant: string | null
  /** The plant's own codes first (`primary`), then the other plant's. */
  departments: readonly ApiDepartment[]
  value: string
  onChange: (code: string) => void
  invalid: boolean
}) {
  const listId = useId()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const options: Option[] = useMemo(() => {
    if (!plant) return []
    const typed = query.trim()
    const mine = departments
      .filter((d) => d.primary && d.code.startsWith(typed))
      .map((d) => ({ code: d.code, otherPlant: null }))
    if (!typed) return mine
    const others = departments
      .filter((d) => !d.primary && d.code.startsWith(typed))
      .map((d) => ({ code: d.code, otherPlant: d.plants.join(", ") || null }))
    return [...mine, ...others]
  }, [plant, query, departments])

  const showList = open && !!plant
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0))

  function pick(option: Option) {
    setQuery(option.code)
    setOpen(false)
    onChange(option.code)
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
      event.preventDefault()
      if (showList && options[activeIndex]) pick(options[activeIndex])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          value={plant ? query : ""}
          disabled={!plant}
          aria-invalid={invalid}
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
          placeholder={
            plant
              ? `department code at ${plant}, e.g. ${departments.find((d) => d.primary)?.code ?? "10100"}`
              : "add the first material first"
          }
          className="pl-8 font-mono"
          inputMode="numeric"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {showList && (
          <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
                No department code starts with &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul id={listId} role="listbox" aria-label="Department codes" className="max-h-60 overflow-y-auto py-1">
                {options.map((option, index) => (
                  <li
                    key={option.code}
                    role="option"
                    aria-selected={index === activeIndex}
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
                    <span className="font-mono text-foreground">{option.code}</span>
                    {option.otherPlant && (
                      <span className="text-[11px] text-muted-foreground">used at {option.otherPlant}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
