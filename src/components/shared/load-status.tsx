import { AlertBanner } from "@/components/shared/alert-banner"
import type { InitiativeId } from "@/lib/domain/contracts"
import type { InitiativeFailure } from "@/lib/domain/live-feed"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

export const INITIATIVE_NAME: Record<InitiativeId, string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

/**
 * Says which modules did not answer, next to a list that would otherwise look
 * complete. A page built from three sources that shows two of them silently is
 * telling the reader "nothing is wrong in the third", which it cannot know.
 * Renders nothing when everything answered.
 */
export function FailureNotice({ failures }: { failures: InitiativeFailure[] }) {
  if (failures.length === 0) return null
  return (
    <div role="alert">
      <AlertBanner
        tone="critical"
        title={
          failures.length === 1
            ? `${INITIATIVE_NAME[failures[0].initiative]} could not be loaded`
            : `${failures.length} modules could not be loaded`
        }
      >
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {failures.map((f) => (
            <li key={f.initiative}>
              <span className="font-medium">{INITIATIVE_NAME[f.initiative]}:</span> {f.message}
            </li>
          ))}
        </ul>
        <p className="mt-1.5">
          What is listed below leaves these out — it is not a statement that
          nothing needs attention there.
        </p>
      </AlertBanner>
    </div>
  )
}

/** A list that is a slice of a larger population says so. */
export function CappedNotice({
  shown,
  total,
  noun,
  description = "The most recent items from each module are listed; open the module for the full set.",
}: {
  shown: number
  total: number
  noun: string
  /** Defaults to the wording for a list that spans every module; `null` leaves the card as the title alone. */
  description?: string | null
}) {
  return (
    <AlertBanner tone="info" title={`Showing ${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`}>
      {description}
    </AlertBanner>
  )
}
