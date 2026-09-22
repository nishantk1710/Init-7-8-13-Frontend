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
 *     /assistant/new?material={MATNR}&plant={WERKS}&quantity={MENGE}&origin=BADI
 *
 * `material` and `plant` are required; without both there is nothing to
 * assess. `quantity` is **optional and must stay optional**: the pop-up can
 * fire before a quantity has been entered, and defaulting it to zero would be
 * indistinguishable from a requester who genuinely asked for none. The backend
 * makes that distinction — `quantity` is nullable on the request model for
 * exactly this reason — and the URL must not undo it.
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
  const quantity = single(params.quantity)
  const origin = single(params.origin) === "BADI" ? "BADI" : "PLATFORM"

  if (!materialId || !plant) {
    return (
      <div className="flex flex-col gap-5 p-6">
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
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="Reservation assistant"
        description={`Checking ${materialId} at plant ${plant} before you reserve it.`}
      />
      <AssistantLauncher
        materialId={materialId}
        plant={plant}
        quantity={quantity}
        origin={origin}
      />
    </div>
  )
}

/** A repeated query parameter is a malformed link, not a list to guess from. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}
