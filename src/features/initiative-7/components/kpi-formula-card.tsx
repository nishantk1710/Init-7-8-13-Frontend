"use client"

import { useId, useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react"

import { INFO_TONE, type InfoTone } from "@/components/shared/info-popup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { DataPicker } from "@/features/initiative-7/components/data-picker"
import { OverviewInfo } from "@/features/initiative-7/components/overview-info-popup"
import { OVERVIEW_INFO, type OverviewInfoId } from "@/features/initiative-7/data/overview-info"
import type { DataItem, FormulaField } from "@/features/initiative-7/types/kpi-formulas"
import { formulaFields, insertName, type Draft } from "@/features/initiative-7/utils/kpi-formulas"

const BADGE: Record<InfoTone, string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

const CHIP: Record<"fix" | "edited" | "custom" | "builtin", string> = {
  fix: "bg-destructive/10 text-destructive",
  edited: "bg-warning/10 text-warning",
  custom: "bg-primary/10 text-primary",
  builtin: "bg-muted text-muted-foreground",
}

/**
 * One calculation, as a dropdown like the rest of the app sections: a numbered badge in the colour of the
 * Overview card it belongs to, the title with a status chip, one line saying what it answers, and a chevron.
 * Each section opens and closes on its own. Opened, it shows what the calculation changes on the Overview, the rule
 * in use today, its numbers, its formulas and the list of data a formula can use. A section with a problem opens
 * itself, so a refused formula is never hidden behind a closed header. Nothing here validates -- the backend does, and
 * its sentence is shown under the box it is about.
 */
export function KpiFormulaCard({
  index,
  defaultOpen = false,
  title,
  blurb,
  infoId,
  controls,
  ruleLines,
  fields,
  data,
  draft,
  errors,
  disabled,
  previewPanel,
  onChange,
}: {
  /** Its place in the list, shown in the badge. */
  index: number
  defaultOpen?: boolean
  title: string
  blurb: string
  /** The Overview card this calculation belongs to: its (i) popup and its colour. */
  infoId: OverviewInfoId
  /** What this calculation changes on the Overview: the card first, then its charts. */
  controls: string[]
  /** The rule in use today, in words. */
  ruleLines: string[] | undefined
  fields: FormulaField[]
  data: DataItem[]
  draft: Draft
  errors: Record<string, string>
  disabled: boolean
  /** The "Preview impact" panel for this calculation, shown above the data list. */
  previewPanel?: ReactNode
  onChange: (key: string, value: string) => void
}) {
  const settings = fields.filter((f) => f.kind === "setting")
  const formulas = formulaFields(fields)
  const tone = OVERVIEW_INFO[infoId].tone
  const colours = INFO_TONE[tone]
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  // The formula a click on the data list writes into: the one last clicked in, else the first.
  const [focused, setFocused] = useState<string | null>(null)
  const target = formulas.find((f) => f.key === focused) ?? formulas[0]
  const helpers = Array.from(
    new Map(formulas.flatMap((f) => f.helpers).map((helper) => [helper.name, helper])).values()
  )

  const hasError = fields.some((f) => errors[f.key])
  const edited = fields.some((f) => (draft[f.key] ?? "").trim() !== String(f.value).trim())
  const custom = fields.some((f) => String(f.value).trim() !== String(f.defaultValue).trim())
  const chip = hasError
    ? { kind: "fix" as const, text: "Needs a fix" }
    : edited
      ? { kind: "edited" as const, text: "Edited" }
      : custom
        ? { kind: "custom" as const, text: "Custom" }
        : { kind: "builtin" as const, text: "Built-in" }
  const isOpen = open || hasError

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold", BADGE[tone])}>
            {index}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", CHIP[chip.kind])}>{chip.text}</span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{blurb}</span>
          </span>
        </button>
        <OverviewInfo id={infoId} />
        <button
          type="button"
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {isOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </button>
      </div>

      {isOpen && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-border p-4">
          <p className="text-xs font-medium text-primary">Changes on the Overview: {controls.join(" · ")}</p>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
              {ruleLines && ruleLines.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">The rule in use today</p>
                  <div
                    className={cn(
                      "rounded-sm border-l-4 px-3 py-2 font-mono text-xs leading-relaxed text-foreground",
                      colours.callout
                    )}
                  >
                    {ruleLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {settings.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {settings.map((field) => (
                    <FieldBox
                      key={field.key}
                      field={field}
                      value={draft[field.key] ?? ""}
                      error={errors[field.key]}
                      disabled={disabled}
                      onChange={onChange}
                    />
                  ))}
                </div>
              )}

              {formulas.map((field) => (
                <FieldBox
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ""}
                  error={errors[field.key]}
                  disabled={disabled}
                  focused={target?.key === field.key}
                  onFocus={() => setFocused(field.key)}
                  onChange={onChange}
                />
              ))}
            </div>

            <aside className="flex min-w-0 flex-col gap-4 lg:col-span-2">
              {previewPanel}
              <DataPicker
                items={data}
                helpers={helpers}
                target={target?.label ?? null}
                disabled={disabled || !target}
                onPick={(name) => target && onChange(target.key, insertName(draft[target.key] ?? "", name))}
              />
            </aside>
          </div>
        </div>
      )}
    </section>
  )
}

function FieldBox({
  field,
  value,
  error,
  disabled,
  focused,
  onFocus,
  onChange,
}: {
  field: FormulaField
  value: string
  error: string | undefined
  disabled: boolean
  focused?: boolean
  onFocus?: () => void
  onChange: (key: string, value: string) => void
}) {
  const id = `kpi-field-${field.key}`
  const isDefault = value.trim() === String(field.defaultValue).trim()
  const isSetting = field.kind === "setting"
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
        value={value}
        disabled={disabled}
        inputMode={isSetting ? "numeric" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        spellCheck={false}
        autoComplete="off"
        onFocus={onFocus}
        className={cn(!isSetting && "font-mono text-xs", isSetting && "max-w-40", focused && "border-action ring-2 ring-action/30")}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
      {error ? (
        <p id={`${id}-help`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {field.help}
          {isSetting && field.minimum !== null && field.maximum !== null
            ? ` Between ${field.minimum} and ${field.maximum}.`
            : ""}
          {field.needsRebuild ? " Applying a change rebuilds the usage data." : ""}
          {field.example && (
            <>
              {" "}
              <span className="text-foreground/70">
                For example: <code className="font-mono">{field.example}</code>
              </span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
