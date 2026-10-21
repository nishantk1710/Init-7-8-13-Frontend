// Option lists for the OAR filter bar.
//
// The pages used to pass options built from the rows a request returned. Those
// rows are already filtered, so choosing Plant 1300 shrank the plant list to
// just 1300, and moving to another plant meant going back to "All plants"
// first. These lists are built from the full set of values instead: a filter
// never removes the other choices for itself.

/** The OAR plants. Any other plant seen in the data is added alongside. */
export const OAR_PLANTS = ["1300", "1500"] as const

/**
 * The fixed values in their display order, then any extra value the data or the
 * URL carries (a backend that adds an enum value, a plant outside the known
 * list, a value typed into the URL), so the current selection is always listed.
 */
export function filterOptions(
  fixed: readonly string[],
  seen: readonly string[] = [],
  selected?: string | null
): string[] {
  const extras = [...seen, ...(selected ? [selected] : [])].filter(
    (value, index, all) => value && !fixed.includes(value) && all.indexOf(value) === index
  )
  return [...fixed, ...extras.sort((a, b) => a.localeCompare(b))]
}
