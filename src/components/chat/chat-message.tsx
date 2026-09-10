import { ActionOptions } from "@/components/chat/action-options"
import { OptionGroup } from "@/components/chat/option-group"
import { MaterialClassificationCard } from "@/components/shared/material-classification-card"
import type { ChatMessage as ChatMessageData } from "@/lib/types"
import { cn } from "@/lib/utils"

function FormattedLine({ line }: { line: string }) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </>
  )
}

function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n")
  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, pIndex) => {
        const lines = paragraph.split("\n")
        return (
          <p key={pIndex}>
            {lines.map((line, lIndex) => (
              <span key={lIndex}>
                {lIndex > 0 && <br />}
                <FormattedLine line={line} />
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export function ChatMessage({
  message,
  resolvedActionId,
  onAction,
  resolvedOptionId,
  onOptionSelect,
}: {
  message: ChatMessageData
  resolvedActionId?: string
  onAction?: (messageId: string, actionId: string) => void
  resolvedOptionId?: string | null
  onOptionSelect?: (groupId: string, optionId: string) => void
}) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isUser ? "max-w-[75%] self-end" : "w-full max-w-[560px] self-start"
      )}
    >
      {message.text && (
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.55]",
            isUser
              ? "bg-primary text-primary-foreground"
              : "w-full border border-border bg-card text-foreground"
          )}
        >
          <FormattedText text={message.text} />
        </div>
      )}

      {message.classification && (
        <MaterialClassificationCard materialId={message.classification} />
      )}
      {message.options && (
        <OptionGroup
          group={message.options}
          resolvedOptionId={resolvedOptionId}
          onConfirm={(optionId) =>
            onOptionSelect?.(message.options!.id, optionId)
          }
        />
      )}
      {message.actions && (
        <ActionOptions
          data={message.actions}
          resolvedId={resolvedActionId ?? message.actions.resolvedActionId}
          onAction={(actionId) => onAction?.(message.id, actionId)}
        />
      )}

      <div
        className={cn(
          "text-[11px] text-muted-foreground",
          isUser && "text-right"
        )}
      >
        {message.authorLabel} · {message.timestamp}
        {message.footerNote && (
          <>
            {" "}
            · <span className="text-primary">{message.footerNote}</span>
          </>
        )}
      </div>
    </div>
  )
}
