"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { OptionCard } from "@/components/chat/option-card"
import { Button } from "@/components/ui/button"
import type { OptionGroupData } from "@/lib/types"

export function OptionGroup({
  group,
  resolvedOptionId,
  onConfirm,
}: {
  group: OptionGroupData
  /**
   * string = answered with this choice; null = settled with no choice ever
   * made (the question expired unanswered); undefined = still open/live.
   */
  resolvedOptionId?: string | null
  onConfirm?: (optionId: string) => void
}) {
  const isSettled = group.locked || resolvedOptionId !== undefined
  const [pendingId, setPendingId] = useState(group.defaultSelectedId)
  const selectedId = isSettled ? (resolvedOptionId ?? undefined) : pendingId

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div role="radiogroup" className="flex flex-col gap-1.5">
        {group.options.map((option) => (
          <OptionCard
            key={option.id}
            icon={option.icon}
            label={option.label}
            description={option.description}
            selected={option.id === selectedId}
            disabled={isSettled}
            onSelect={isSettled ? undefined : () => setPendingId(option.id)}
          />
        ))}
      </div>
      {!isSettled && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="xs"
            disabled={!pendingId}
            onClick={() => pendingId && onConfirm?.(pendingId)}
          >
            <Check className="size-3" />
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}
