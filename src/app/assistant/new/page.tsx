import type { Metadata } from "next"
import Link from "next/link"

import { AssistantLauncher } from "@/components/assistant/assistant-launcher"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Reservation assistant — Spares AI",
}

/**
 * The deep-link entry point — W7.5's "deep-link entry point", and the URL the
 * SAP reservation-entry BAdI pop-up will eventually open.
 *
 * ## The contract, which is a deliverable for the SAP team
 *
 *     /assistant/new?material={MATNR}&plant={WERKS}&department={KOSTL}&requestedFor={NAME}&origin=BADI
 *
 * `material` and `plant` are required; without both there is nothing to
 * assess.
 *
 * `department` and `requestedFor` are **optional and must stay optional**. The
 * pop-up carries a material and a plant and cannot supply either, so a session
 * opened from SAP legitimately has neither and the backend records NULL — which
 * is the honest account of what SAP could tell us, not a gap to be closed by
 * defaulting it.
 *
 * `requestedFor` names the person who wants the part. It is **not** identity:
 * the author of the session is taken from the `X-Actor-Id` header and no query
 * parameter can change that, which is why a name can safely travel in a URL.
 *
 * `quantity` used to be here and has been removed. The quantity of record is
 * captured inside the conversation, against a stated purpose and a window;
 * asking for one at the door was the same question twice, and the answer given
 * first was the one nobody had thought about. A link that still carries one is
 * simply ignored.
 *
 * `origin` defaults to `PLATFORM` and is set to `BADI` by the pop-up. It is
 * recorded on the session so "arrived from SAP" can be told apart from
 * "opened by hand", which is the difference between the BAdI being live and a
 * planner remembering to check.
 *
 * The page works today without the BAdI. That is what makes the assistant
 * demonstrable independently of the SAP transport.
 */
export default async function NewAssistantSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const materialId = single(params.material)
  const plant = single(params.plant)
  const department = single(params.department)
  const requestedFor = single(params.requestedFor)
  const origin = single(params.origin) === "BADI" ? "BADI" : "PLATFORM"

  if (!materialId || !plant) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-5">
          <PageHeader
            title="Reservation assistant"
            description="Checks a material before you reserve it."
          />
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-foreground">
              This link needs both a material and a plant.
            </p>
            <p className="text-xs text-muted-foreground">
              Expected{" "}
              <code className="font-mono">
                /assistant/new?material=…&amp;plant=…
              </code>
              . A material without a plant cannot be assessed: stock, repairs and
              cover are all held per plant, and answering for the wrong one is
              worse than not answering.
            </p>
            <Link
              href="/assistant"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Choose a material
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      {/* This is the page that hosts the live conversation
          (AssistantLauncher -> AssistantWorkspace). The transcript has no
          height cap of its own -- it grows with the number of turns -- so the
          scroll container here is what keeps a long conversation (the plan
          form has six fields, and the longest path is four turns deep)
          reachable rather than clipped by the fixed-height shell in
          app/layout.tsx (`body` is `overflow-hidden`). */}
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <PageHeader
          title="Reservation assistant"
          description={`Checking ${materialId} at plant ${plant} before you reserve it.`}
        />
        <AssistantLauncher
          materialId={materialId}
          plant={plant}
          department={department}
          requestedFor={requestedFor}
          origin={origin}
        />
      </div>
    </div>
  )
}

/** A repeated query parameter is a malformed link, not a list to guess from. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}
