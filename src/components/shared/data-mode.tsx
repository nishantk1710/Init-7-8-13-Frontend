"use client"

import { useEffect, useState } from "react"
import { Database, RefreshCw } from "lucide-react"
import { usePathname } from "next/navigation"

import { getHealth } from "@/lib/api/client"
import { isPublicPath } from "@/lib/auth/mock-auth"

type Health = { state: "checking" } | { state: "ok" } | { state: "down"; reason: string }

/**
 * A strip across the top of every page when the live backend is down.
 *
 * Says nothing while the backend answers. When GET /health fails, it says so
 * and offers a retry. There is no snapshot fallback: the app is live only.
 * Rendered by the shared root layout.
 */
export function DataModeBanner() {
  const pathname = usePathname()
  const [health, setHealth] = useState<Health>({ state: "checking" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
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
  }, [attempt])

  // Not on the sign-in pages: nothing there reads the backend.
  if (isPublicPath(pathname)) return null

  if (health.state === "down") {
    return (
      <Strip>
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
      </Strip>
    )
  }

  return null
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs text-destructive"
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
