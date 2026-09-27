"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { FilterBar } from "@/components/shared/filter-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mergeSearchParams } from "@/features/initiative-13/utils/search-params"

/**
 * The two reconciliation reference counts, as URL parameters.
 *
 * FR-6 asks for a monthly reconciliation against ZMM065 and the 30-Day GR
 * Report. Neither report has been delivered as an export, so the counts are
 * typed in by whoever is holding the printout — which is why they are inputs
 * rather than a second data source, and why the backend answers
 * `REFERENCE_UNAVAILABLE` without them.
 *
 * Putting them in the URL means a reconciliation result is a link. On a
 * validation screen whose whole output is "these two numbers agree within
 * tolerance", being able to send somebody the exact comparison is the point.
 */
export function ReferenceCountForm() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [zmm065, setZmm065] = useState(searchParams.get("zmm065") ?? "")
  const [gr30Day, setGr30Day] = useState(searchParams.get("gr30Day") ?? "")

  function apply(event: React.FormEvent) {
    event.preventDefault()
    const query = mergeSearchParams(searchParams, {
      zmm065: zmm065.trim() || undefined,
      gr30Day: gr30Day.trim() || undefined,
    })
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <form onSubmit={apply}>
      <FilterBar>
        <Input
          type="number"
          min={0}
          placeholder="ZMM065 reference count"
          value={zmm065}
          onChange={(event) => setZmm065(event.target.value)}
          className="h-9 sm:w-56"
        />
        <Input
          type="number"
          min={0}
          placeholder="30-Day GR reference count"
          value={gr30Day}
          onChange={(event) => setGr30Day(event.target.value)}
          className="h-9 sm:w-56"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Reconciling…" : "Apply reference counts"}
        </Button>
      </FilterBar>
    </form>
  )
}
