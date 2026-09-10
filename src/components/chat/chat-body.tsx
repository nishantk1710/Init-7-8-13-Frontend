"use client"

import { useEffect, useRef } from "react"

import { ChatMessage } from "@/components/chat/chat-message"
import type { ChatMessage as ChatMessageData } from "@/lib/types"

export function ChatBody({
  messages,
  resolvedActions,
  onAction,
  resolvedOptions,
  onOptionSelect,
}: {
  messages: ChatMessageData[]
  resolvedActions: Record<string, string>
  onAction: (messageId: string, actionId: string) => void
  resolvedOptions: Record<string, string | null>
  onOptionSelect: (groupId: string, optionId: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          resolvedActionId={resolvedActions[message.id]}
          onAction={onAction}
          resolvedOptionId={
            message.options ? resolvedOptions[message.options.id] : undefined
          }
          onOptionSelect={onOptionSelect}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}
