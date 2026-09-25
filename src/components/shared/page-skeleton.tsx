import { Skeleton } from "@/components/ui/skeleton"

/**
 * The skeleton a route segment shows while its server component fetches.
 *
 * Without a `loading.tsx`, a nav click on a server-rendered screen leaves the
 * previous page on screen until the new one has finished loading, which on a
 * slow request reads as a link that did nothing. With one, the click switches
 * screen at once and this stands in until the data arrives.
 */
export function PageSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6" aria-busy="true" aria-label="Loading">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
