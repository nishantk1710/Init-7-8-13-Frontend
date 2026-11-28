import { Bone, SkeletonFilters, SkeletonPage, SkeletonTable } from "@/components/shared/page-skeleton"

/**
 * Materials while it is read (materials-page.tsx): the header, the search and plant filters with the OAR switch,
 * the table and its pager, in bones (components/shared/page-skeleton.tsx).
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading Materials" header={{ actions: true }}>
      <SkeletonFilters fields={[288, 224, 180]} />
      <SkeletonTable rows={10} columns={4} />
      <Bone className="h-2.5 w-64" />
    </SkeletonPage>
  )
}
