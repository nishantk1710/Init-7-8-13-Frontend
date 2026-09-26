"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

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

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useHasMounted()

  if (!mounted) {
    return (
      <div className="mx-2 my-0.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground">
        <span className="size-4" />
        Appearance
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted"
    >
      {isDark ? (
        <Moon className="size-4 shrink-0" />
      ) : (
        <Sun className="size-4 shrink-0" />
      )}
      {isDark ? "Dark mode" : "Light mode"}
    </button>
  )
}
