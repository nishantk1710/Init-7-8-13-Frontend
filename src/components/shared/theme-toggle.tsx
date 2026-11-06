"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

function subscribe() {
  return () => {}
}

/** True only once hydrated on the client — theme is unknown (localStorage/system) during SSR. */
function useHasMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}

/** `compact` is the sidebar down to its rail: the icon alone, still named. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useHasMounted()

  if (!mounted) {
    return compact ? (
      <div className="size-10" />
    ) : (
      <div className="flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] text-nav-muted">
        <span className="size-4" />
        Appearance
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"
  const label = isDark ? "Dark mode" : "Light mode"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={compact ? label : undefined}
      className={cn(
        "flex items-center rounded-xl text-left text-[13px] text-nav-muted transition-colors hover:bg-nav-hover hover:text-nav-fg",
        compact ? "size-10 justify-center" : "gap-2 px-3 py-2"
      )}
    >
      {isDark ? (
        <Moon className="size-4 shrink-0" />
      ) : (
        <Sun className="size-4 shrink-0" />
      )}
      <span className={cn(compact && "sr-only")}>{label}</span>
    </button>
  )
}
