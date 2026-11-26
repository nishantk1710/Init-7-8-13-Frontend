import { Bone, SkeletonCard, SkeletonPage } from "@/components/shared/page-skeleton"

/**
 * Home while it opens (spares-home.tsx): the greeting and title, the assistant banner, the three module cards and
 * the two links across all modules, in bones (components/shared/page-skeleton.tsx).
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading Home" className="oar-scope px-4 py-6 sm:px-6" innerClassName="max-w-[1240px] gap-7" header={false}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bone className="h-3.5 w-40" />
          <Bone className="h-8 w-80 max-w-full" />
        </div>
        <Bone className="h-10 w-44 rounded-full" />
      </div>
      <Bone className="h-[172px] rounded-[20px]" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Bone className="h-4 w-24" />
          <Bone className="h-3 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} className="flex min-h-[380px] flex-col gap-4 rounded-2xl p-6">
              <Bone className="size-14 rounded-xl" />
              <Bone className="h-3 w-16" />
              <Bone className="h-7 w-3/4" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-5/6" />
              <Bone className="h-3 w-2/3" />
              <Bone className="mt-auto h-12 w-full rounded-lg" />
            </SkeletonCard>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Bone className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} className="flex items-center gap-3 rounded-[14px] px-[18px] py-4">
              <Bone className="size-9 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-3.5 w-1/2" />
                <Bone className="h-3 w-3/4" />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
