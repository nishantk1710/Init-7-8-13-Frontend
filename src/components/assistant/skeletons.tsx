import {
  Bone,
  SkeletonBody,
  SkeletonCard,
  SkeletonFilters,
  SkeletonLines,
  SkeletonPage,
  SkeletonTable,
} from "@/components/shared/page-skeleton"

/**
 * The assistant's screens while they load (components/shared/page-skeleton.tsx says how): the hub, the sessions
 * log, one session, the request list, one request, and the new-request form. The restyled pages sit in
 * `nav-blue-scope` with `p-4 sm:p-6` and a `gap-5` column; the frames below copy the page they stand in for, so
 * the page lands where the skeleton was.
 *
 * The request list and a request are drawn once and used twice: `<Name>Skeleton` is the route's `loading.tsx` and
 * `<Name>SkeletonBody` is what the component shows under the real header while it fetches.
 */

const REQUEST_FRAME = "nav-blue-scope p-4 sm:p-6"

// --- Hub and sessions ------------------------------------------------------------------------------------------------

/** The hub (app/(live)/assistant/page.tsx): the hero, the "Start a request" card, two feature tiles. */
export function AssistantHubSkeleton() {
  return (
    <SkeletonPage label="Loading the Spares Assistant" className="ai-scope p-4 sm:p-6" innerClassName="max-w-none gap-5" header={false}>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <Bone className="size-12 rounded-full" />
        <Bone className="h-3 w-28" />
        <Bone className="h-7 w-80 max-w-full" />
        <Bone className="h-4 w-[36rem] max-w-full" />
      </div>
      <SkeletonCard className="flex items-center gap-4 rounded-2xl p-5">
        <Bone className="size-10 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Bone className="h-4 w-48" />
          <Bone className="h-3 w-72 max-w-full" />
        </div>
        <Bone className="size-5 rounded-full" />
      </SkeletonCard>
      <div className="flex flex-col gap-3">
        <Bone className="h-3.5 w-40" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} className="flex gap-3 rounded-2xl p-4">
              <Bone className="size-9 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-3.5 w-2/5" />
                <SkeletonLines count={3} />
              </div>
            </SkeletonCard>
          ))}
        </div>
        <Bone className="h-2.5 w-96 max-w-full" />
      </div>
    </SkeletonPage>
  )
}

/** The sessions log (assistant/sessions): filters, the three compliance figures, the sessions table. */
export function AssistantSessionsSkeleton() {
  return (
    <SkeletonPage label="Loading assistant sessions" className={REQUEST_FRAME} innerClassName="gap-5" header={{ size: "2xl" }}>
      <SkeletonFilters labelled fields={[170, 170, 170, 220]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="flex flex-col gap-2 p-4">
            <Bone className="h-8 w-16" />
            <Bone className="h-3.5 w-32" />
            <Bone className="h-3 w-3/4" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonTable rows={8} columns={9} pagination={false} />
      <Bone className="h-2.5 w-72 max-w-full" />
    </SkeletonPage>
  )
}

/** One session (assistant/sessions/[id]): the reference box, the summary facts, the numbered parts. */
export function AssistantSessionSkeleton() {
  return (
    <SkeletonPage
      label="Loading the assistant session"
      className={REQUEST_FRAME}
      innerClassName="max-w-6xl gap-5"
      header={{ size: "2xl", back: true, actions: true }}
    >
      <ReferenceBox />
      <SkeletonCard className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-3.5 w-3/4" />
          </div>
        ))}
      </SkeletonCard>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-[2rem_1fr] gap-4">
          <Bone className="size-8 rounded-full" />
          <div className="flex flex-col gap-3">
            <Bone className="h-4 w-48" />
            <SkeletonCard className="p-5">
              <SkeletonLines count={i === 1 ? 5 : 3} />
            </SkeletonCard>
          </div>
        </div>
      ))}
    </SkeletonPage>
  )
}

/** The reservation assistant's opening (assistant/new): a narrow column, the orb header, the first card. */
export function AssistantNewSkeleton() {
  return (
    <SkeletonPage label="Loading the reservation assistant" innerClassName="max-w-2xl gap-5" header={{ eyebrow: true }}>
      <SkeletonCard className="flex flex-col gap-4 p-5">
        <Bone className="h-4 w-56" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-16" />
          ))}
        </div>
        <SkeletonLines count={2} />
      </SkeletonCard>
    </SkeletonPage>
  )
}

// --- Requests -------------------------------------------------------------------------------------------------------

/** request-list.tsx: three figures, the search, a day's requests. */
function RequestsShape() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="flex flex-col gap-2 border-l-4 border-l-muted py-4 pr-4 pl-5">
            <Bone className="h-8 w-14" />
            <Bone className="h-3.5 w-28" />
            <Bone className="h-3 w-40" />
          </SkeletonCard>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <Bone className="h-11 w-80 max-w-full" />
        <Bone className="h-3 w-24" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <Bone className="h-4 w-28" />
          <Bone className="h-3 w-20" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="grid min-h-14 grid-cols-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 md:grid-cols-[9rem_10rem_1fr_auto_auto_auto]"
          >
            <Bone className="h-3.5 w-24" />
            <div className="flex items-center gap-2">
              <Bone className="size-7 rounded-full" />
              <Bone className="h-3 w-20" />
            </div>
            <Bone className="h-3" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-3 w-12" />
            <Bone className="size-4 rounded-full" />
          </div>
        ))}
      </div>
    </>
  )
}

const REQUESTS = "Loading requests"

/** The route: the page header with "New request" at its right, then the list. */
export function RequestsSkeleton() {
  return (
    <SkeletonPage label={REQUESTS} className={REQUEST_FRAME} innerClassName="max-w-6xl gap-5" header={{ size: "2xl", actions: true }}>
      <RequestsShape />
    </SkeletonPage>
  )
}

/** Under the real header, while the list is fetched. */
export function RequestsSkeletonBody() {
  return (
    <SkeletonBody label={REQUESTS} className="gap-5">
      <RequestsShape />
    </SkeletonBody>
  )
}

function ReferenceBox() {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[11rem_1fr]">
      <div className="flex flex-col gap-2">
        <Bone className="h-2.5 w-24" />
        <Bone className="h-3 w-32" />
      </div>
      <div className="flex items-center gap-3">
        <Bone className="h-9 w-56 max-w-full" />
        <Bone className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  )
}

/** request-summary.tsx: the reference, its facts, the lines, the actions. */
function RequestDetailShape() {
  return (
    <>
      <ReferenceBox />
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>
      <Bone className="h-4 w-16" />
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} className="overflow-hidden border-l-4 border-l-muted">
          <div className="flex items-center gap-3 px-4 py-3">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-48" />
            <Bone className="ml-auto h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-border px-4 py-4 md:grid-cols-3">
            {[0, 1, 2].map((col) => (
              <div key={col} className="flex flex-col gap-2">
                <Bone className="h-2.5 w-20" />
                <Bone className="h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      ))}
      <div className="flex flex-wrap gap-2">
        <Bone className="h-11 w-36 rounded-lg" />
        <Bone className="h-11 w-32 rounded-lg" />
        <Bone className="h-11 w-28 rounded-lg" />
      </div>
    </>
  )
}

const REQUEST = "Loading the request"

/** The route: the back link and header, then the request. */
export function RequestDetailSkeleton() {
  return (
    <SkeletonPage label={REQUEST} className={REQUEST_FRAME} innerClassName="max-w-6xl gap-5" header={{ size: "2xl", back: true }}>
      <RequestDetailShape />
    </SkeletonPage>
  )
}

/** Under the real header, while the request is fetched. */
export function RequestDetailSkeletonBody() {
  return (
    <SkeletonBody label={REQUEST} className="gap-5">
      <RequestDetailShape />
    </SkeletonBody>
  )
}

/** The new-request form (request-builder.tsx): who is asking, the materials card, the empty lines card. */
export function NewRequestSkeleton() {
  return (
    <SkeletonPage label="Loading the new request" className={REQUEST_FRAME} innerClassName="max-w-6xl gap-5" header={{ size: "2xl" }}>
      <SkeletonCard className="flex flex-col gap-4 p-5">
        <Bone className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Bone className="h-2.5 w-20" />
              <Bone className="h-11 w-full" />
            </div>
          ))}
        </div>
        <Bone className="h-11 w-full" />
        <Bone className="h-2.5 w-80 max-w-full" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3 p-5">
        <Bone className="h-4 w-36" />
        <div className="flex gap-3">
          <Bone className="h-11 flex-1" />
          <Bone className="h-11 w-32 rounded-lg" />
        </div>
      </SkeletonCard>
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-card p-8">
        <Bone className="h-3.5 w-64 max-w-full" />
      </div>
    </SkeletonPage>
  )
}
