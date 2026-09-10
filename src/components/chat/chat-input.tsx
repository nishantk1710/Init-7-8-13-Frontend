"use client"

import { useRef, useState } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // A native form submit (via Enter or the submit button) already ignores
    // IME composition Enter-presses, so no manual keydown interception needed.
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue("")
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3"
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={'Ask about a material by name or code, e.g. "Show me the pump seal" or "500-14892"...'}
        className="h-9 flex-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!value.trim()}
        aria-label="Send message"
      >
        <Send className="size-4" />
      </Button>
    </form>
  )
}
