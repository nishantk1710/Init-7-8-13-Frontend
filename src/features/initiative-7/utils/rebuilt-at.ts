// How the Inventory Planning page says when the results were last rebuilt.
//
// The backend sends one UTC timestamp. The page shows it in the viewer's own time zone with the zone named
// ("23 Nov 2026, 23:34 GMT+5:30"), and the tooltip gives the same moment in UTC so two people in different zones
// can see they are looking at the same rebuild.

export interface RebuiltAtText {
  /** "23 Nov 2026, 23:34 GMT+5:30" -- what the badge shows. */
  label: string
  /** "Rebuilt 23 Nov 2026, 18:04 UTC" -- the tooltip. */
  title: string
}

function format(date: Date, timeZone: string | undefined, zoneName: boolean): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
    ...(zoneName ? { timeZoneName: "short" as const } : {}),
  }).format(date)
}

/** The badge text for a backend timestamp, or ``null`` when there is none or it is not a date -- the badge is
 * then left out rather than showing a made-up time. ``timeZone`` is for tests; omitted, it is the viewer's. */
export function formatRebuiltAt(iso: string | null | undefined, timeZone?: string): RebuiltAtText | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return {
    label: format(date, timeZone, true),
    title: `Rebuilt ${format(date, "UTC", false)} UTC`,
  }
}
