import { Bone, SkeletonCard, SkeletonPage, SkeletonTable, SkeletonTabs } from "@/components/shared/page-skeleton"

/**
 * The Action Center while it opens (live-approvals-workspace.tsx): the header, the status tabs, the toolbar, the
 * approvals table beside the approval-chain panel, in bones (components/shared/page-skeleton.tsx).
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading the Action Center" header={{ actions: true }}>
      <Bone className="h-4 w-44" />
      <SkeletonTabs count={4} />
      <div className="flex items-center justify-between border-b border-border pb-2">
        <Bone className="h-3 w-40" />
        <div className="flex gap-2">
          <Bone className="h-8 w-40" />
          <Bone className="h-8 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <SkeletonTable rows={6} columns={6} rowHeight="h-16" pagination={false} />
        <SkeletonCard className="flex flex-col gap-3 p-4">
          <Bone className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="size-7 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Bone className="h-3 w-3/4" />
                <Bone className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </SkeletonCard>
      </div>
    </SkeletonPage>
  )
}
