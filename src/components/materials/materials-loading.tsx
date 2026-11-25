"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"

import { AlertBanner } from "@/components/shared/alert-banner"
import { Button } from "@/components/ui/button"

/** Seconds between automatic retries; the backend's Retry-After. */
const RETRY_SECONDS = 30

/**
 * Shown while the backend is still reading the list from SAP (it answers 503
 * until the first read lands). Re-asks every 30 seconds by itself, so the
 * table appears without anyone pressing anything.
 */
export function MaterialsLoadingBanner({ message }: { message: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const timer = window.setInterval(() => startTransition(() => router.refresh()), RETRY_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [router])

  return (
    <AlertBanner
      tone="info"
      title="The materials list is not ready yet"
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
          className="border-action bg-action/10 text-action"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Try again
        </Button>
      }
    >
      {message} This page checks again every {RETRY_SECONDS} seconds.
    </AlertBanner>
  )
}
