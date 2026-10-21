import { EMPTY_LABEL, type EmptyKind } from "@/features/initiative-13/utils/empty-labels"
import { cn } from "@/lib/utils"

/**
 * A missing value, said in words: muted so it never reads as data, with the
 * full reason on hover. `title` overrides the default hover text where the
 * row knows more (e.g. the date the movement history starts).
 */
export function EmptyValue({ kind, title, className }: { kind: EmptyKind; title?: string; className?: string }) {
  const empty = EMPTY_LABEL[kind]
  return (
    <span className={cn("text-xs text-muted-foreground", className)} title={title ?? empty.title}>
      {empty.label}
    </span>
  )
}
