import { NotificationsSkeleton } from "@/components/notifications/notifications-skeleton"

/** Notifications while it opens: the header, the filter bar and the two panes, in bones. notifications-page.tsx shows the same panes under the real header while the inbox is fetched. */
export default function Loading() {
  return <NotificationsSkeleton />
}
