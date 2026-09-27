"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Database, FlaskConical, RefreshCw } from "lucide-react"

import { getHealth } from "@/lib/api/client"
import { clientDataMode, setDataMode, type DataMode } from "@/lib/data-mode"
import { cn } from "@/lib/utils"

function subscribe() {
  return () => {}
}

/**
 * The mode, once hydrated; null during SSR. Read on the client only so the
 * root layout does not have to read the cookie -- which would make every route
 * dynamic just to draw a toggle.
 */
function useDataMode(): DataMode | null {
  return useSyncExternalStore(subscribe, clientDataMode, () => null)
}

/** Sidebar switch between the live frontend and main's demo frontend. */
export function DataModeToggle() {
  const mode = useDataMode()

  return (
    <div className="mx-2 my-1 px-1">
      <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Data source
      </div>
      <div
        role="radiogroup"
        aria-label="Data source"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-[12px]"
      >
        {(["demo", "live"] as const).map((option) => {
          const Icon = option === "demo" ? FlaskConical : Database
          const active = mode === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={mode === null}
              onClick={() => {
                if (!active) void setDataMode(option)
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {option === "demo" ? "Demo" : "Live"}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Health = { state: "checking" } | { state: "ok" } | { state: "down"; reason: string }

/**
 * A strip across the top of every page saying which data this is.
 *
 * Demo mode always says so: a mock number next to nothing that marks it as
 * mock is the confusion this app goes out of its way to avoid. Rendered by the
 * shared root layout, so it sits above both frontends.
 *
 * Live mode says nothing while the backend answers. When GET /health fails, it
 * says that, and offers demo mode -- so a broken backend integration costs a
 * presenter one click, not the demo.
 */
export function DataModeBanner() {
  const mode = useDataMode()
  const [health, setHealth] = useState<Health>({ state: "checking" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (mode !== "live") return
    let cancelled = false
    getHealth()
      .then(() => {
        if (!cancelled) setHealth({ state: "ok" })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHealth({ state: "down", reason: error instanceof Error ? error.message : String(error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [mode, attempt])

  if (mode === "demo") {
    return (
      <Strip tone="demo">
        <FlaskConical className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="font-semibold">Demo mode.</strong> Mock data for demonstration — not connected
          to SAP or the backend.
        </span>
        <StripButton onClick={() => void setDataMode("live")}>Switch to live</StripButton>
      </Strip>
    )
  }

  if (mode === "live" && health.state === "down") {
    return (
      <Strip tone="down">
        <Database className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1" title={health.reason}>
          <strong className="font-semibold">The live backend is not responding.</strong> Screens that read it
          will fail until it is back.
        </span>
        <StripButton
          onClick={() => {
            setHealth({ state: "checking" })
            setAttempt((n) => n + 1)
          }}
        >
          <RefreshCw className="size-3" />
          Retry
        </StripButton>
        <StripButton onClick={() => void setDataMode("demo")}>Switch to demo data</StripButton>
      </Strip>
    )
  }

  return null
}

function Strip({ tone, children }: { tone: "demo" | "down"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-1.5 text-xs",
        tone === "demo"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {children}
    </div>
  )
}

function StripButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-md border border-current/30 px-2 py-0.5 font-medium transition-colors hover:bg-current/10"
    >
      {children}
    </button>
  )
}
