import { Loader2 } from "lucide-react"

import { AlertBanner } from "@/components/shared/alert-banner"
import { Button } from "@/components/ui/button"

/** Loading state for an Initiative 13 API-backed screen — never renders
 * stale/mock data while a request is in flight. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

/** Explicit error state with retry — the FastAPI request failed, so we say
 * so instead of silently falling back to mock data. */
export function ErrorState({
  title = "Unable to load data.",
  message,
  onRetry,
}: {
  title?: string
  message?: string | null
  onRetry?: () => void
}) {
  return (
    <AlertBanner
      tone="critical"
      title={title}
      actions={
        onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {message}
    </AlertBanner>
  )
}
