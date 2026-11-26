import { SkeletonFilters, SkeletonPage, SkeletonTable } from "@/components/shared/page-skeleton"

/**
 * The Audit trail while it is read (global-audit-log.tsx): the header, the date filters and the events table, in
 * bones (components/shared/page-skeleton.tsx).
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading the Audit Trail" header={{ actions: true }}>
      <SkeletonFilters fields={[160, 160]} />
      <SkeletonTable rows={10} columns={7} />
    </SkeletonPage>
  )
}
