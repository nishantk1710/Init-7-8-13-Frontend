"use client"

import { Button } from "@/components/ui/button"

export function SuggestedQuestions({
  questions,
  onSelect,
}: {
  questions: string[]
  onSelect: (question: string) => void
}) {
  if (questions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {questions.map((q) => (
        <Button
          key={q}
          type="button"
          variant="outline"
          size="xs"
          className="h-auto whitespace-normal rounded-full py-1 text-left"
          onClick={() => onSelect(q)}
        >
          {q}
        </Button>
      ))}
    </div>
  )
}
