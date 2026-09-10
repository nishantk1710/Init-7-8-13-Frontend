import type { MaterialReference } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"

/**
 * Standard material-id-plus-description presentation, with an optional
 * click-through into the global Material 360 drawer (pass `onOpen`). Keeps
 * every table/card across every module showing materials the same way.
 */
export function MaterialIdentity({
  material,
  onOpen,
  className,
}: {
  material: MaterialReference
  onOpen?: (materialId: string) => void
  className?: string
}) {
  const content = (
    <>
      <span className="block truncate font-medium text-foreground">
        {material.description}
      </span>
      <span className="block truncate text-[11px] text-muted-foreground">
        {material.materialCode}
      </span>
    </>
  )

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(material.materialId)}
        className={cn("min-w-0 max-w-[240px] text-left hover:underline", className)}
      >
        {content}
      </button>
    )
  }

  return <div className={cn("min-w-0 max-w-[240px]", className)}>{content}</div>
}
