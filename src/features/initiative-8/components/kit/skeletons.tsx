import { Bone, SkeletonLateNote } from "@/components/shared/page-skeleton"
import { cn } from "@/lib/utils"

/**
 * What an I08 screen shows the moment it is clicked, while the server fetches
 * (I08_Live_UI_Redesign_Plan.md, Q1).
 *
 * None of the seven I08 routes had a loading screen, while Home, Materials and
 * OAR Utilization did, so a click in the sidebar left the old page up until
 * the new one was ready -- 13 seconds on Repair Candidates -- and read as a
 * link that did nothing. Each skeleton has the shape of the page it stands in
 * for, so the page lands where the eye already is.
 *
 * Drawn as white cards with grey bones in them, on the I08 page's grey. The
 * bones, the sweep of light over them, the moment's delay before the frame
 * shows and the "still loading" line are the app's shared ones
 * (components/shared/page-skeleton.tsx).
 */
function Line({ className, width }: { className?: string; width?: number }) {
  return <Bone style={width ? { width: `${width}%` } : undefined} className={cn("h-3 rounded-full", className)} />
}

function Block({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-xs", className)}>{children}</div>
  )
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="skeleton-frame min-h-0 flex-1 overflow-y-auto bg-i08-canvas px-6 pt-5 pb-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col">
        <Line className="w-40" />
        <Bone className="mt-3 h-6 w-64" />
        <Line className="mt-3 w-[28rem] max-w-full" />
        {children}
        <div className="mt-6">
          <SkeletonLateNote />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

const WIDTHS = [86, 62, 74, 58, 66, 40, 60]

function Rows({ count = 9 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="grid grid-cols-7 gap-5 border-t border-border px-4 py-[18px]">
          {WIDTHS.map((width, col) => (
            <Line key={col} className="h-2.5" width={width - ((row * 7 + col * 5) % 18)} />
          ))}
        </div>
      ))}
    </>
  )
}

export function ListSkeleton({ label, tabs = false }: { label: string; tabs?: boolean }) {
  return (
    <Frame label={label}>
      {tabs ? (
        <div className="mt-6 flex gap-6 border-b border-border pb-3">
          <Line className="w-28" />
          <Line className="w-32" />
          <Line className="w-24" />
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {[72, 96, 112, 96, 124].map((width, i) => (
            <Bone key={i} style={{ width }} className="h-[34px] rounded-full" />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {[300, 170, 210, 150].map((width, i) => (
          <Bone key={i} style={{ width }} className="h-9 rounded-lg" />
        ))}
      </div>
      <div className="mt-3.5 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="h-[42px] bg-muted/60" />
        <Rows />
      </div>
    </Frame>
  )
}

export function OverviewSkeleton() {
  return (
    <Frame label="Loading the Repairable Spares overview">
      <div className="mt-5 flex flex-wrap gap-2">
        {[180, 250, 180].map((width, i) => (
          <Bone key={i} style={{ width }} className="h-9 rounded-lg" />
        ))}
      </div>
      <Line className="mt-8 w-24" />
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Block key={key} className="h-[156px]">
            <Line className="w-32" />
            <Bone className="mt-5 h-8 w-20" />
            <Line className="mt-4 w-3/4" />
          </Block>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Block key={key} className="h-[100px]">
            <Line className="w-28" />
            <Line className="mt-4 w-1/2" />
          </Block>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {[0, 1].map((key) => (
          <Block key={key} className="h-[340px]">
            <Line className="w-44" />
            <Line className="mt-2 w-64" />
          </Block>
        ))}
      </div>
    </Frame>
  )
}

export function DetailSkeleton() {
  return (
    <Frame label="Loading the repair">
      <Bone className="mt-5 h-12 rounded-xl" />
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Block className="h-[380px]">
          <Line className="w-36" />
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="mt-7 flex items-center gap-3">
              <Bone className="size-6 rounded-full" />
              <Line className="w-1/2" />
            </div>
          ))}
        </Block>
        <div className="flex flex-col gap-4">
          <Block className="h-[230px]">
            <Line className="w-20" />
          </Block>
          <Block className="h-[120px]">
            <Line className="w-40" />
          </Block>
        </div>
      </div>
    </Frame>
  )
}
