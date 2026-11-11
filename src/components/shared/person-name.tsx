"use client"

import type { ReactNode } from "react"

import { usePersonName } from "@/hooks/use-person-name"

/**
 * The person behind an author id. Shows their name from the backend's user directory once it is
 * known; until then, and for ids the directory does not know, shows `children` (by default the
 * id itself). Placeholder ids are never looked up, so a screen that words them specially
 * ("Not signed in") keeps doing so by passing that wording as children.
 */
export function PersonName({
  id,
  children,
  className,
}: {
  id: string | null | undefined
  children?: ReactNode
  className?: string
}) {
  const { name, person } = usePersonName(id)
  if (!name) return <>{children ?? id ?? null}</>
  return (
    <span className={className} title={person?.email || id || undefined}>
      {name}
    </span>
  )
}
