"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { OptionCard } from "@/components/chat/option-card"
import { Button } from "@/components/ui/button"
import type { ActionOptionsData } from "@/lib/types"

export function ActionOptions({
  data,
  resolvedId,
  onAction,
}: {
  data: ActionOptionsData
  resolvedId?: string
  onAction?: (actionId: string) => void
}) {
  const isResolved = Boolean(resolvedId)
  const [pendingId, setPendingId] = useState<string | undefined>(undefined)
  const selectedId = isResolved ? resolvedId : pendingId

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {data.actions.map((action) => {
        const isAccent = action.id === data.accentId
        const isChosen = action.id === resolvedId

        return (
          <OptionCard
            key={action.id}
            icon={action.icon}
            label={action.label}
            description={action.description}
            showRadio={false}
            tone={isAccent ? "success" : "default"}
            selected={action.id === selectedId}
            disabled={isResolved && !isChosen}
            onSelect={isResolved ? undefined : () => setPendingId(action.id)}
          />
        )
      })}
      {!isResolved && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="xs"
            disabled={!pendingId}
            onClick={() => pendingId && onAction?.(pendingId)}
          >
            <Check className="size-3" />
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}
