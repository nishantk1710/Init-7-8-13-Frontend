import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a number as South African Rand: "R 38,500" (no decimals). */
export function formatZAR(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-US")}`
}

/**
 * Formats an amount in the currency the data states -- SAP's MBEW WAERS, as
 * the I07 API passes it through.
 *
 * - `undefined`: the record carries no currency field at all (the hand-written
 *   scenario fixtures, which are ZAR by construction) -> the house "R 38,500".
 * - `"ZAR"`: the same "R 38,500".
 * - any other ISO code: that currency's own symbol, e.g. "NA$38,500", "$38,500".
 * - `null`: the API said SAP supplied no currency -> the number with no symbol,
 *   rather than a symbol that may be wrong.
 */
export function formatMoney(amount: number, currency?: string | null): string {
  if (currency === undefined || currency?.toUpperCase() === "ZAR") return formatZAR(amount)
  if (currency === null) return Math.round(amount).toLocaleString("en-US")
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  } catch {
    // Not a code Intl knows: show it as SAP wrote it.
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`
  }
}

/** The prefix a figure ("R 1,048,500") uses for `currency`; see formatMoney. */
export function currencyPrefix(currency?: string | null): string {
  if (currency === undefined || currency?.toUpperCase() === "ZAR") return "R "
  if (currency === null) return ""
  return `${currency.toUpperCase()} `
}

/**
 * A financial amount, exactly: sign, `prefix`, then the whole amount with international comma grouping -- "−R 103,950",
 * "+ZAR 12,500,000". Never abbreviated: no "M", "K" or "B", which would round an amount and read as a different figure ("0.10M" for
 * 103,950). The one formatter for money that is shown as a figure; `formatMoney` is the same for an unsigned amount in a stated currency.
 *
 * Rounded to the whole unit. A minus sign (U+2212) is kept for a negative amount, a plus only when `signed` asks for it, and neither on an
 * amount that rounds to 0. Does not change the amount, convert a currency or apply any business rule.
 */
export function formatSignedAmount(amount: number, prefix: string, signed = false): string {
  const rounded = Math.round(Math.abs(amount))
  const sign = rounded === 0 ? "" : amount < 0 ? "−" : signed ? "+" : ""
  return `${sign}${prefix}${rounded.toLocaleString("en-US")}`
}

/** The one currency every item states, `undefined` if none do, `null` if they differ. */
export function commonCurrency(currencies: (string | null | undefined)[]): string | null | undefined {
  const stated = new Set(currencies.filter((c): c is string => typeof c === "string"))
  if (stated.size === 0) return currencies.some((c) => c === null) ? null : undefined
  return stated.size === 1 ? [...stated][0] : null
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** Formats a Date as "14 Mar 2026". */
export function formatDateDMY(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** Formats an ISO calendar date ("2026-05-31") as "31 May 2026". Read as the calendar date it is,
 * not as a moment, so no time zone can move it to the day before. An unreadable value comes back as
 * it was given. */
export function formatIsoDateDMY(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${Number(match[3])} ${month} ${match[1]}` : iso
}

/** Formats a Date as "10:23 AM". */
export function formatTime12h(date: Date): string {
  const hours24 = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const ampm = hours24 >= 12 ? "PM" : "AM"
  const hours = hours24 % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

/** Formats a plain count with comma grouping: 1234 -> "1,234". */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

/**
 * A SAP quantity as written, never rounded: "15.000" -> "15", "1250" -> "1,250",
 * "694.906" -> "694.906", "2.500" -> "2.5". SAP keeps three decimals; a whole
 * number shows none, and a real fraction (tons, kilograms) keeps the digits it
 * has. Anything that is not a number is shown as it came.
 */
export function formatQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 })
}

/** Exports are Excel workbooks; see export-excel.ts. */
export { downloadExcel } from "./export-excel"
