"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ask, getAskSuggestions, type AskResponse } from "@/lib/api/assistant"
import { cn } from "@/lib/utils"

/**
 * The free-text box.
 *
 * ## No model is involved in this path, and the UI can prove it
 *
 * `/api/assistant/ask` matches a question against a small fixed set of
 * intents and answers from the platform's own read models. A backend test
 * asserts the module does not even import the AI layer. Every answered
 * response names the endpoints its numbers came from, and those are rendered,
 * so a reader can check the figure rather than trust it.
 *
 * ## "I cannot answer that" is a real answer, not a failure
 *
 * An unrecognised question comes back **200** with `answered: false` and a
 * sentence saying what the box does cover. It is rendered as that sentence.
 * A box that silently does nothing teaches people it is broken; one that
 * guesses teaches them it is unreliable; and one that shows a red error for a
 * perfectly reasonable question teaches them to stop asking.
 *
 * General question-answering over the whole dataset has not been scoped, and
 * every refusal says so rather than letting the boundary blur.
 *
 * ## The chips come from the backend
 *
 * `GET /ask/suggestions` serves them, so the UI cannot offer a question the
 * backend has stopped answering. Hard-coding them here would mean a chip that
 * confidently produces "I cannot answer that".
 */
export function AskBox() {
  const [question, setQuestion] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [answer, setAnswer] = useState<AskResponse | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getAskSuggestions()
      .then((chips) => {
        if (active) setSuggestions(chips)
      })
      // A failure here is not worth reporting: the box still works typed into,
      // and an error banner about missing chips would be louder than the
      // feature they belong to.
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  async function submit(text: string) {
    const trimmed = text.trim()
    if (trimmed.length === 0 || asking) return

    setAsking(true)
    setError(null)
    setQuestion(trimmed)
    try {
      setAnswer(await ask(trimmed))
    } catch (caught) {
      // Only a transport failure reaches here. A question the assistant does
      // not cover is a 200 and is rendered as an answer, not as this.
      setError(
        caught instanceof Error
          ? caught.message
          : "The assistant could not be reached."
      )
      setAnswer(null)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-foreground">Ask a question</h2>
        <p className="text-[11px] text-muted-foreground">
          Answered from the platform&rsquo;s own records. No model is involved
          in this, and every figure says where it came from.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit(question)
        }}
        className="flex gap-2"
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Which repairs are overdue?"
          aria-label="Ask the assistant a question"
          disabled={asking}
        />
        <Button type="submit" size="sm" disabled={asking || !question.trim()}>
          {asking ? "Asking…" : "Ask"}
        </Button>
      </form>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={asking}
              onClick={() => void submit(chip)}
              className={cn(
                "rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {answer && <Answer answer={answer} />}
    </div>
  )
}

function Answer({ answer }: { answer: AskResponse }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        // An unanswered question is not an error state. Same border, quieter
        // text — it is a truthful reply to a reasonable question.
        answer.answered ? "border-border" : "border-dashed border-border"
      )}
      aria-live="polite"
    >
      <p className="text-sm whitespace-pre-line text-foreground">
        {answer.text}
      </p>

      {answer.sources.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          From {answer.sources.join(", ")}
        </p>
      )}

      {/* Served with every refusal: what this box does cover. Rendered as
          clickable chips so the next question is one tap away rather than
          something to be retyped from a list. */}
      {!answer.answered && answer.suggestions.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {answer.suggestions.map((suggestion) => (
            <li key={suggestion} className="text-xs text-muted-foreground">
              {suggestion}
            </li>
          ))}
        </ul>
      )}

      {answer.note && (
        <p className="text-[11px] text-muted-foreground">{answer.note}</p>
      )}
    </div>
  )
}
