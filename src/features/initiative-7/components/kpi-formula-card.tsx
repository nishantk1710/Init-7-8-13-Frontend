"use client"

import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { FormulaField } from "@/features/initiative-7/types/kpi-formulas"
import { insertName, type Draft } from "@/features/initiative-7/utils/kpi-formulas"

/**
 * One KPI's editable fields: its formulas (typed, with the allowed values one click away) and its numbers.
 * Nothing here validates -- the backend does, and its sentence is shown under the box it is about.
 */
export function KpiFormulaCard({
  title,
  blurb,
  fields,
  draft,
  errors,
  disabled,
  onChange,
}: {
  title: string
  blurb: string
  fields: FormulaField[]
  draft: Draft
  errors: Record<string, string>
  disabled: boolean
  onChange: (key: string, value: string) => void
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
      </header>

      <div className="flex flex-col gap-4">
        {fields.map((field) => {
          const id = `kpi-field-${field.key}`
          const error = errors[field.key]
          const isDefault = (draft[field.key] ?? "").trim() === String(field.defaultValue).trim()
          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id}>{field.label}</Label>
                {!isDefault && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={disabled}
                    onClick={() => onChange(field.key, String(field.defaultValue))}
                  >
                    <RotateCcw className="size-3" />
                    Use built-in
                  </Button>
                )}
              </div>
              <Input
                id={id}
                value={draft[field.key] ?? ""}
                disabled={disabled}
                inputMode={field.kind === "setting" ? "numeric" : undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-help`}
                spellCheck={false}
                autoComplete="off"
                className={cn(field.kind !== "setting" && "font-mono text-xs", field.kind === "setting" && "max-w-40")}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
              {error ? (
                <p id={`${id}-help`} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : (
                <p id={`${id}-help`} className="text-xs text-muted-foreground">
                  {field.help}
                  {field.kind === "setting" && field.minimum !== null && field.maximum !== null
                    ? ` Between ${field.minimum} and ${field.maximum}.`
                    : ""}
                  {field.needsRebuild ? " Applying a change rebuilds the usage data." : ""}
                </p>
              )}
              {field.allowed.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" aria-label={`Values ${field.label} can use`}>
                  <span className="text-[11px] text-muted-foreground">Click to add:</span>
                  {field.allowed.map((value) => (
                    <button
                      key={value.name}
                      type="button"
                      disabled={disabled}
                      title={value.label}
                      onClick={() => onChange(field.key, insertName(draft[field.key] ?? "", value.name))}
                      className="rounded-sm border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {value.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
