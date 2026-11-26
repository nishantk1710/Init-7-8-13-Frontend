import { Bone, SkeletonBody, SkeletonCard, SkeletonFilters, SkeletonPage } from "@/components/shared/page-skeleton"

/**
 * The Notifications page while it loads (components/shared/page-skeleton.tsx says how): the list of notices on the
 * left, the reading pane on the right, the pager under them -- the two-pane grid of notifications-page.tsx. Drawn
 * once and used twice: `NotificationsSkeleton` is the route's `loading.tsx`, `NotificationsSkeletonBody` what the
 * page shows under its real header and filter bar while the inbox is fetched.
 */
function NotificationsShape() {
  return (
    <>
      <div className="grid min-h-[28rem] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SkeletonCard className="overflow-hidden">
          <div className="bg-muted px-4 py-2">
            <Bone className="h-2.5 w-20" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 border-t border-border px-3 py-3">
              <Bone className="mt-1.5 size-2 shrink-0 rounded-full" />
              <Bone className="size-8 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Bone className="h-3.5" style={{ width: `${60 + ((i * 11) % 30)}%` }} />
                <Bone className="h-3 w-full" />
                <Bone className="h-2.5 w-24" />
              </div>
            </div>
          ))}
        </SkeletonCard>
        <SkeletonCard className="flex flex-col">
          <div className="flex flex-col gap-3 border-b border-border p-5">
            <Bone className="h-5 w-3/4" />
            <div className="flex items-center gap-2">
              <Bone className="size-7 rounded-full" />
              <Bone className="h-3 w-40" />
            </div>
            <div className="flex gap-2">
              <Bone className="h-6 w-20 rounded-full" />
              <Bone className="h-6 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 p-5">
            {[96, 88, 92, 70, 84, 60].map((w, i) => (
              <Bone key={i} className="h-3" style={{ width: `${w}%` }} />
            ))}
          </div>
        </SkeletonCard>
      </div>
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-40" />
        <div className="flex gap-2">
          <Bone className="h-8 w-20 rounded-md" />
          <Bone className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </>
  )
}

const LABEL = "Loading your notifications"

/** The route: the header with its two buttons, the filter bar, the inbox. */
export function NotificationsSkeleton() {
  return (
    <SkeletonPage label={LABEL} innerClassName="max-w-6xl" header={{ actions: true }}>
      <SkeletonFilters labelled fields={[150, 150, 150, 150, 150, 150]} />
      <NotificationsShape />
    </SkeletonPage>
  )
}

/** Under the real header and filter bar, while the inbox is fetched. */
export function NotificationsSkeletonBody() {
  return (
    <SkeletonBody label={LABEL}>
      <NotificationsShape />
    </SkeletonBody>
  )
}
