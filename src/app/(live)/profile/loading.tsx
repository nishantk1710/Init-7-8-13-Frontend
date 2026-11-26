import { Bone, SkeletonCard, SkeletonPage } from "@/components/shared/page-skeleton"

/**
 * My profile while it opens (profile-view.tsx): the header, the banner with the avatar, the account details beside
 * the edit form, in bones (components/shared/page-skeleton.tsx).
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading your profile" className="p-0" innerClassName="max-w-4xl gap-6 p-6" header={{ actions: true }}>
      <SkeletonCard className="overflow-hidden">
        <div className="h-28 bg-muted" />
        <div className="flex flex-col gap-3 px-6 pb-6">
          <Bone className="-mt-10 size-20 rounded-full" />
          <Bone className="h-6 w-56" />
          <Bone className="h-3 w-32" />
          <Bone className="h-6 w-16 rounded-full" />
        </div>
      </SkeletonCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <SkeletonCard className="flex flex-col gap-1 p-5">
          <Bone className="mb-3 h-4 w-36" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-border py-3">
              <Bone className="size-8 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Bone className="h-2.5 w-20" />
                <Bone className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-4 p-5">
          <Bone className="h-4 w-28" />
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Bone className="h-2.5 w-24" />
              <Bone className="h-10 w-full" />
            </div>
          ))}
          <Bone className="h-10 w-28 rounded-lg" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  )
}
