// Requests grouped under the day they were recorded, newest day first, in the
// reader's own calendar. Display only: the list's order within a day is kept.

export type DayGroup<T> = {
  /** yyyy-mm-dd in local time, stable as a React key. */
  key: string
  /** "Today", "Yesterday", or the weekday and date, e.g. "Fri 23 Oct". */
  heading: string
  /** The full date, e.g. "23 Oct 2026". */
  date: string
  items: T[]
}

function localKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function groupByDay<T>(items: T[], whenOf: (item: T) => string, now: Date = new Date()): DayGroup<T>[] {
  const today = localKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterday = localKey(yesterdayDate)

  const groups = new Map<string, DayGroup<T>>()
  for (const item of items) {
    const when = new Date(whenOf(item))
    const key = Number.isNaN(when.getTime()) ? "unknown" : localKey(when)
    let group = groups.get(key)
    if (!group) {
      group =
        key === "unknown"
          ? { key, heading: "Date not recorded", date: "", items: [] }
          : {
              key,
              heading:
                key === today
                  ? "Today"
                  : key === yesterday
                    ? "Yesterday"
                    : when.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
              date: when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
              items: [],
            }
      groups.set(key, group)
    }
    group.items.push(item)
  }
  // Newest day first; the undated group last.
  return [...groups.values()].sort((a, b) =>
    a.key === "unknown" ? 1 : b.key === "unknown" ? -1 : b.key.localeCompare(a.key)
  )
}
