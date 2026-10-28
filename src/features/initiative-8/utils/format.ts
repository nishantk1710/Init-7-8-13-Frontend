/**
 * How Initiative 8 writes dates, quantities and the codes the API sends.
 *
 * One format for every I08 screen (I08_Live_UI_Redesign_Plan.md, Q3 and Q4):
 *
 * - **Dates** read `08 May 2025`, and with a time `21 Oct 2026, 17:30`. Never an
 *   ISO date, and "Sep" rather than the "Sept" the en-ZA locale writes.
 * - **Times are South African.** The pages render on the server, which runs in
 *   UTC, so a time without a zone would be two hours out for everyone reading
 *   it at a mine.
 * - **A full timestamp is a date too.** The shared `formatApiDate` appends a
 *   time to whatever it is given, so a timestamp became an invalid date and the
 *   Declaration log's date column read "—" on every row.
 * - **Codes become words.** `BEARING_FAILURE` reads "Bearing failure", and a
 *   placeholder author reads "Not signed in" -- still marked as not a person.
 */

import { isPlaceholderActor } from "@/lib/api/actor"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const ZONE = "Africa/Johannesburg"
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (value: number) => String(value).padStart(2, "0")

/** The South African calendar date and clock time of a timestamp. */
function local(timestamp: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(parsed)
      .map((part) => [part.type, part.value]),
  )
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hh: Number(parts.hour),
    mm: Number(parts.minute),
  }
}

/**
 * `2025-05-08` or a full timestamp as `08 May 2025`.
 *
 * A date with no time is a calendar date and is shown as written, never moved
 * by a time zone.
 */
export function i08Date(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  const plain = DATE_ONLY.exec(value)
  if (plain) {
    const month = Number(plain[2])
    if (month < 1 || month > 12) return fallback
    return `${plain[3]} ${MONTHS[month - 1]} ${plain[1]}`
  }
  const at = local(value)
  return at ? `${pad(at.d)} ${MONTHS[at.m - 1]} ${at.y}` : fallback
}

/** A timestamp as `21 Oct 2026, 17:30`, South African time. */
export function i08DateTime(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  if (DATE_ONLY.test(value)) return i08Date(value, fallback)
  const at = local(value)
  return at ? `${pad(at.d)} ${MONTHS[at.m - 1]} ${at.y}, ${pad(at.hh)}:${pad(at.mm)}` : fallback
}

/** A quantity without the `.000` SAP pads it with: `1`, `2.5`, `1,000`. */
export function i08Quantity(value: number | string | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback
  const parsed = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

/** A code from the API as words: `BEARING_FAILURE` -> "Bearing failure". */
export function humanize(code: string | null | undefined, fallback = "—"): string {
  if (!code) return fallback
  const words = code.replace(/_/g, " ").trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : fallback
}

const REASONS: Record<string, string> = {
  URGENT_BREAKDOWN: "Urgent breakdown",
  NO_SUITABLE_REPAIRABLE: "No suitable repairable unit",
  OTHER: "Other",
}

/** A justification's reason category, as words. */
export function reasonLabel(code: string | null | undefined): string {
  return code ? (REASONS[code] ?? humanize(code)) : "—"
}

/** A declared condition: "Beyond Economical Repair" -> "Beyond economical repair". */
export function conditionLabel(condition: string | null | undefined): string {
  return humanize(condition?.replace(/ /g, "_"))
}

/** Text for a person, or for a record nobody signed: "Not signed in". */
export function actorLabel(actor: string | null | undefined): string {
  if (!actor || isPlaceholderActor(actor)) return "Not signed in"
  return actor
}

/** Whether an author is a placeholder rather than somebody who signed in. */
export function isUnsigned(actor: string | null | undefined): boolean {
  return !actor || isPlaceholderActor(actor)
}

/** "1 day", "4 days". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`
}

const STAGES: Record<string, string> = {
  "PR Raised": "PR raised",
  "PO Issued": "PO issued",
  "At Vendor": "At vendor",
  Received: "Received",
  Closed: "Closed",
}

/** A repair stage in sentence case: "PO Issued" -> "PO issued". */
export function stageLabel(status: string | null | undefined): string {
  return status ? (STAGES[status] ?? status) : "—"
}

/**
 * A plant's name short enough for a table column: "Black Mountain Mining"
 * reads "Black Mountain". The full name stays on hover where it is shown.
 */
export function plantShort(name: string | null | undefined): string {
  if (!name) return "—"
  return name.replace(/\s+Mining$/i, "")
}
