"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

/**
 * A wide table whose sideways scrollbar stays on screen.
 *
 * A table wider than the page scrolls sideways inside its own box, and the
 * browser draws that box's scrollbar under the last row. With 25 rows to a
 * page that is below the fold, so moving right meant scrolling down to the
 * bottom, dragging, and scrolling back up to the rows you wanted. Shift + wheel
 * and a trackpad swipe always worked, but the people using the I08 screens did
 * not know that (22-Oct-2026).
 *
 * So the table's own scrollbar is hidden and a second one is drawn under it,
 * `position: sticky` to the bottom of the window. While any of the table is on
 * screen, that bar is at the bottom of the screen; at the end of the table it
 * settles into the place the old one had. The two are kept at the same
 * position both ways, so a trackpad swipe on the rows moves the bar too. The
 * bar is only shown when the table is wider than the page.
 *
 * A cell marked `data-frozen-column` (the Material column, on both its header
 * and its cells) stays at the left edge while the rest scroll under it, so a
 * row can still be told apart once you are a few columns to the right. The
 * styling for both lives in globals.css.
 *
 * Takes the table's contents (header and body) and draws the `<table>` itself,
 * with the shared Table's classes, rather than wrapping `<Table>`: that one
 * brings its own sideways-scroll box, and the scroll has to happen in this one.
 */
export function StickyScrollTable({
  children,
  className,
  tableClassName,
}: {
  children: ReactNode
  className?: string
  /** Extra classes for the `<table>` itself, e.g. a fixed layout with a
   *  minimum width that only overflows once more columns are switched on. */
  tableClassName?: string
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  /** Where the frozen column sits before any scrolling, in px from the left. */
  const frozenLeftRef = useRef(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [overflowing, setOverflowing] = useState(false)

  // The frozen column gets its edge shadow only once it is actually pinned. A
  // first column is pinned as soon as the table moves; a later one (Material
  // is fourth on Exceptions) only once the columns before it are out of view.
  const markPinned = useCallback(() => {
    const wrapper = wrapperRef.current
    const viewport = viewportRef.current
    if (!wrapper || !viewport) return
    if (viewport.scrollLeft > frozenLeftRef.current) {
      wrapper.dataset.frozenPinned = ""
    } else {
      delete wrapper.dataset.frozenPinned
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const table = tableRef.current
    if (!viewport || !table) return

    const measure = () => {
      setContentWidth(viewport.scrollWidth)
      setOverflowing(viewport.scrollWidth > viewport.clientWidth + 1)

      let left = 0
      let cell = table.querySelector("thead [data-frozen-column]")?.previousElementSibling
      while (cell) {
        left += cell.getBoundingClientRect().width
        cell = cell.previousElementSibling
      }
      frozenLeftRef.current = left
      markPinned()
    }

    measure()
    // The viewport changes width with the window; the table changes width
    // when a page or filter brings in longer values.
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(table)
    return () => observer.disconnect()
  }, [markPinned])

  // A hidden bar cannot hold a scroll position, so line it up whenever it
  // appears or its track changes length.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const bar = barRef.current
    if (viewport && bar && overflowing) bar.scrollLeft = viewport.scrollLeft
  }, [overflowing, contentWidth])

  // Each side follows the other. Setting a scrollLeft it already has fires no
  // scroll event, and the 1px tolerance stops fractional positions (a zoomed
  // page) from bouncing between the two.
  const onViewportScroll = () => {
    const viewport = viewportRef.current
    const bar = barRef.current
    if (viewport && bar && Math.abs(bar.scrollLeft - viewport.scrollLeft) >= 1) {
      bar.scrollLeft = viewport.scrollLeft
    }
    markPinned()
  }

  const onBarScroll = () => {
    const viewport = viewportRef.current
    const bar = barRef.current
    if (viewport && bar && Math.abs(viewport.scrollLeft - bar.scrollLeft) >= 1) {
      viewport.scrollLeft = bar.scrollLeft
    }
  }

  return (
    <div ref={wrapperRef} className={className}>
      <div ref={viewportRef} onScroll={onViewportScroll} className="sticky-hscroll-viewport">
        <table
          ref={tableRef}
          data-slot="table"
          className={tableClassName ? `w-full caption-bottom text-sm ${tableClassName}` : "w-full caption-bottom text-sm"}
        >
          {children}
        </table>
      </div>
      {/* A copy of the scrollbar for the mouse, so it is hidden from screen
          readers and the keyboard; both still scroll the table itself.
          `-bottom-6` rather than `bottom-0`: a sticky box stops at its scroll
          container's padding, and pages scroll in a `p-6` box, so `bottom-0`
          left the bar 24px above the window with rows showing beneath it. */}
      <div
        hidden={!overflowing}
        aria-hidden="true"
        className="sticky -bottom-6 z-10 bg-background py-1.5"
      >
        <div ref={barRef} onScroll={onBarScroll} tabIndex={-1} className="sticky-hscroll-bar">
          <div style={{ width: contentWidth }} className="h-px" />
        </div>
      </div>
    </div>
  )
}
