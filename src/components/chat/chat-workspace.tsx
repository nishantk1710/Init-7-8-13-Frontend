"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ChatBody } from "@/components/chat/chat-body"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatInput } from "@/components/chat/chat-input"
import { SuggestedQuestions } from "@/components/chat/suggested-questions"
import { RightPanel } from "@/components/layout/right-panel"
import { answerForIntent, answerForThisMaterial, classifyIntent } from "@/lib/chat-intents"
import { NEW_SESSION_ID, SUGGESTED_QUESTIONS } from "@/lib/constants"
import { findMaterialIdByName, findNameMatchCandidates } from "@/lib/material-name-lookup"
import { classifyMaterial } from "@/lib/material-router"
import type {
  ChatMessage as ChatMessageData,
  ChatSession,
  OptionGroupData,
} from "@/lib/types"
import { formatTime12h } from "@/lib/utils"

/** optionId is null for a group that's settled but was never actually
 * answered — e.g. a question that expired unanswered and triggered an
 * escalation. Still stops blocking the reveal cascade; just skips the
 * synthesized confirmation bubble since there's nothing to confirm. */
type ResolvedOption = { optionId: string | null; timestamp: string }

function seedResolvedOptionGroups(
  messages: ChatMessageData[]
): Record<string, ResolvedOption> {
  const seeded: Record<string, ResolvedOption> = {}
  for (const message of messages) {
    if (message.options?.locked) {
      seeded[message.options.id] = {
        optionId: message.options.defaultSelectedId ?? null,
        timestamp: message.options.resolvedAt ?? message.timestamp,
      }
    }
  }
  return seeded
}

/**
 * Reveals the script up to (and including) the first still-unanswered option
 * group, injecting a synthesized "you selected X" user bubble right after
 * each resolved one — answering a question is what makes the next turn
 * appear, rather than every message being present from the start.
 */
function computeVisibleMessages(
  messages: ChatMessageData[],
  resolvedOptionGroups: Record<string, ResolvedOption>
): ChatMessageData[] {
  const result: ChatMessageData[] = []
  for (const message of messages) {
    result.push(message)
    if (message.options) {
      const resolved = resolvedOptionGroups[message.options.id]
      if (!resolved) break
      if (resolved.optionId) {
        const chosen = message.options.options.find(
          (o) => o.id === resolved.optionId
        )
        result.push({
          id: `${message.options.id}-confirm`,
          role: "user",
          authorLabel: "You",
          timestamp: resolved.timestamp,
          text: chosen?.label ?? resolved.optionId,
        })
      }
    }
  }
  return result
}

let trackingCounter = 12 // seed past the OAR-TRK-0001..0011 ledger scenarios
function nextTrackingId(): string {
  trackingCounter += 1
  return `OAR-TRK-${String(trackingCounter).padStart(4, "0")}`
}
function nextReservationNumber(): string {
  return `RES-5003${Math.floor(10 + Math.random() * 89)}`
}

function aiMessage(id: string, text?: string, extra?: Partial<ChatMessageData>): ChatMessageData {
  return {
    id,
    role: "ai",
    authorLabel: "Spares Assistant",
    timestamp: formatTime12h(new Date()),
    text,
    ...extra,
  }
}

function userMessage(id: string, text: string): ChatMessageData {
  return {
    id,
    role: "user",
    authorLabel: "You",
    timestamp: formatTime12h(new Date()),
    text,
  }
}

/** The three-step OAR consumption-plan conversation (§5) — purpose, then
 * equipment/project/job, then quantity + planned consumption date. */
const OAR_QUESTIONS = [
  "This material is classified as OAR. A consumption plan is required before proceeding.\n\nBefore proceeding, please provide the intended purpose.",
  "Which equipment, project or job is this for?",
  "How many units do you need, and when do you expect to consume them?",
]

/** Pulls a material code out of free text typed into a blank session, e.g.
 * "Show me material 500-14892" -> "500-14892". Mock-only pattern matching —
 * no real NLU — supporting this app's two id conventions (hyphenated, and
 * the master-spec's plain-digit examples). A material named instead of
 * coded (e.g. "the conveyor gearmotor") falls through to
 * `findMaterialIdByName` at the call site. */
function extractMaterialId(text: string): string | null {
  const hyphenated = text.match(/\b\d{2,4}-\d{4,7}\b/)
  if (hyphenated) return hyphenated[0]
  const plain = text.match(/\b\d{6,10}\b/)
  if (plain) return plain[0]
  return null
}

export function ChatWorkspace({ session }: { session: ChatSession }) {
  const [resolvedOptionGroups, setResolvedOptionGroups] = useState<
    Record<string, ResolvedOption>
  >(() => seedResolvedOptionGroups(session.messages))
  const [extraMessages, setExtraMessages] = useState<ChatMessageData[]>([])
  const [workflow, setWorkflow] = useState(session.workflow)
  const [emails, setEmails] = useState(session.emails)
  const [trace, setTrace] = useState(session.trace)
  const [resolvedActions, setResolvedActions] = useState<
    Record<string, string>
  >(() => {
    const seeded: Record<string, string> = {}
    for (const message of session.messages) {
      if (message.actions?.resolvedActionId) {
        seeded[message.id] = message.actions.resolvedActionId
      }
    }
    return seeded
  })
  const [activeTab, setActiveTab] = useState("workflow")

  // Draft sessions (blank "New session", or a fresh /materials row click) have
  // no authored script — the Material Assistant conversation is driven live
  // instead. Named demo sessions author their own conversation in full.
  const isDraftSession =
    session.id === NEW_SESSION_ID || session.id.startsWith("NEW-")
  // The blank "New session" starts with no material at all — the user's
  // first message is parsed for one (§2's "Show me material X" example).
  const [liveMaterialId, setLiveMaterialId] = useState<string | null>(null)
  const effectiveMaterialId = liveMaterialId ?? session.materialId
  const hasMaterial = effectiveMaterialId !== "—"

  const classification = useMemo(
    () => classifyMaterial(effectiveMaterialId),
    [effectiveMaterialId]
  )
  const [oarStep, setOarStep] = useState(0) // 0 = not started, 1-3 = which question is pending
  const [oarAnswers, setOarAnswers] = useState<string[]>([]) // raw free-text replies, in question order

  const optionGroupsById = useMemo(() => {
    const map = new Map<string, OptionGroupData>()
    for (const message of session.messages) {
      if (message.options) map.set(message.options.id, message.options)
    }
    return map
  }, [session.messages])

  const visibleMessages = useMemo(
    () => computeVisibleMessages(session.messages, resolvedOptionGroups),
    [session.messages, resolvedOptionGroups]
  )
  const messages = [...visibleMessages, ...extraMessages]

  const resolvedOptionIds = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(resolvedOptionGroups).map(([id, v]) => [id, v.optionId])
      ),
    [resolvedOptionGroups]
  )

  // Live sessions only: once the classification card has been shown, the
  // assistant continues the conversation itself — asking for the OAR
  // consumption plan (§5) or surfacing the Initiative 8 duplicate-repair
  // check (§24) — rather than a separate form/panel.
  useEffect(() => {
    if (!isDraftSession || !hasMaterial || oarStep !== 0) return
    if (classification.route.reason === "oar") {
      setOarStep(1)
      setExtraMessages((prev) => [...prev, aiMessage("oar-q-1", OAR_QUESTIONS[0])])
    } else if (classification.route.reason === "repairable" && classification.signal) {
      const lines = classification.signal.lines.map((l) => `${l.label}: ${l.value}`).join(", ")
      setExtraMessages((prev) => [
        ...prev,
        aiMessage(
          "duplicate-guard",
          `A repair for this material may already be in progress — ${lines}. Would you still like to proceed with a new procurement request?`,
          {
            actions: {
              id: "duplicate-guard-actions",
              actions: [
                {
                  id: "review-existing",
                  icon: "eye",
                  label: "Review Existing Repair",
                  description: "Open the Repair Register entry for this chain",
                },
                {
                  id: "proceed-anyway",
                  icon: "send",
                  label: "Proceed Anyway",
                  description: "Continue with a new procurement request",
                },
                {
                  id: "cancel-request",
                  icon: "cancel",
                  label: "Cancel Request",
                  description: "Don't raise a new request",
                },
              ],
            },
          }
        ),
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSession, hasMaterial, classification, oarStep])

  // Shared by both interaction paths — an option click and an action click
  // are each, in their own way, the user completing the current workflow
  // step. The chat action IS the approval trigger.
  function advanceWorkflow() {
    setWorkflow((prev) => {
      const activeIndex = prev.findIndex((step) => step.status === "active")
      if (activeIndex === -1) return prev
      return prev.map((step, index) => {
        if (index === activeIndex) {
          return { ...step, status: "done" as const, meta: "Just now" }
        }
        if (index === activeIndex + 1) {
          return {
            ...step,
            status: "active" as const,
            meta: "Awaiting response",
          }
        }
        return step
      })
    })
    setTrace((prev) => ({
      ...prev,
      selectionsDone: Math.min(prev.selectionsDone + 1, prev.selectionsTotal),
    }))
    setEmails((prev) =>
      prev.map((email) =>
        email.status === "pending"
          ? { ...email, status: "sent" as const, time: "Just now" }
          : email
      )
    )
  }

  function handleOptionSelect(groupId: string, optionId: string) {
    if (resolvedOptionGroups[groupId]) return
    setResolvedOptionGroups((prev) => ({
      ...prev,
      [groupId]: { optionId, timestamp: formatTime12h(new Date()) },
    }))
    if (optionGroupsById.get(groupId)?.advancesWorkflow) {
      advanceWorkflow()
    }
  }

  function handleAction(messageId: string, actionId: string) {
    if (resolvedActions[messageId]) return
    setResolvedActions((prev) => ({ ...prev, [messageId]: actionId }))

    if (actionId === "proceed-anyway") {
      // The advisory duplicate-repair guard (Initiative 8, §24) — proceeding
      // opens the mandatory condition-to-repair declaration (§25) next.
      advanceWorkflow()
      setExtraMessages((prev) => [
        ...prev,
        aiMessage(
          `${messageId}-declaration`,
          "Before this request can proceed, please confirm the condition-to-repair declaration: the existing unit is not economically or technically repairable.",
          {
            actions: {
              id: `${messageId}-declaration-actions`,
              accentId: "confirm-declaration",
              actions: [
                {
                  id: "confirm-declaration",
                  icon: "check",
                  label: "Confirm Declaration",
                  description: "I confirm the existing unit cannot be repaired",
                },
              ],
            },
          }
        ),
      ])
    } else if (actionId === "confirm-declaration") {
      advanceWorkflow()
      setExtraMessages((prev) => [
        ...prev,
        aiMessage(
          `${messageId}-declaration-confirmed`,
          "Declaration recorded. This request can now proceed to a purchase requisition."
        ),
      ])
      toast.success("Condition-to-repair declaration recorded")
    } else if (actionId === "review-existing") {
      toast("Opening the existing repair chain", {
        description: "See the Repair Register for full status.",
      })
    } else if (actionId === "cancel-request") {
      toast("Request cancelled")
    } else if (actionId === "confirm-plan") {
      const trackingId = nextTrackingId()
      const reservation = nextReservationNumber()
      advanceWorkflow()
      setExtraMessages((prev) => [
        ...prev,
        aiMessage(
          `${messageId}-tracking`,
          `**Utilisation Tracking Created**\n\n${trackingId}\n\nLinked to SAP Reservation **${reservation} / 0010**.\n\nSimulated only — no live SAP write occurred. This mock reservation now feeds the Utilisation Ledger.`
        ),
      ])
      toast.success(`Consumption plan confirmed — Tracking ID ${trackingId}`)
    } else if (actionId === "edit-plan") {
      toast("Editing isn't available in this demo session", {
        description: "Start a new session to capture a different plan.",
      })
    }
  }

  function handleSend(text: string) {
    setExtraMessages((prev) => [...prev, userMessage(`local-${prev.length}`, text)])

    // Live OAR consumption-plan capture takes priority while it's actually
    // in progress — a free-text answer to "what's the purpose?" shouldn't
    // get reinterpreted as a business question.
    const midOarCapture = isDraftSession && oarStep >= 1 && oarStep <= 3
    if (!midOarCapture) {
      // Questions about the material already loaded in this session ("is
      // this material OAR?", "why is ROP higher for this material?") answer
      // from that material's own cross-module signals.
      if (hasMaterial) {
        const contextual = answerForThisMaterial(text, effectiveMaterialId)
        if (contextual) {
          setExtraMessages((prev) => [...prev, aiMessage(`contextual-${prev.length}`, contextual)])
          return
        }
      }
      // General business questions (§30) — routed internally, never by
      // asking the user to pick a module (§31).
      const intent = classifyIntent(text)
      if (intent) {
        setExtraMessages((prev) => [...prev, aiMessage(`intent-${prev.length}`, answerForIntent(intent))])
        return
      }
    }

    // The blank "New session" has no material yet — parse the first message
    // for one (§2), then let the effect above take the classified material
    // into the OAR/repairable follow-up conversation.
    if (isDraftSession && !hasMaterial) {
      const materialId = extractMaterialId(text) ?? findMaterialIdByName(text)
      if (materialId) {
        setLiveMaterialId(materialId)
        setExtraMessages((prev) => [
          ...prev,
          aiMessage(`classify-${materialId}`, undefined, {
            classification: materialId,
            footerNote: "Classified via the Material Router",
          }),
        ])
        setWorkflow((prev) =>
          prev.map((step, index) =>
            index === 0
              ? { ...step, status: "done" as const, meta: "Just now" }
              : index === 1
                ? { ...step, status: "active" as const, meta: "See conversation below" }
                : step
          )
        )
      } else {
        const candidates = findNameMatchCandidates(text)
        if (candidates.length > 1) {
          const list = candidates.map((c) => `• ${c.description} (${c.id})`).join("\n")
          setExtraMessages((prev) => [
            ...prev,
            aiMessage(
              "name-ambiguous",
              `A few materials could match that:\n\n${list}\n\nWhich one did you mean? Try including the code or a bit more detail.`
            ),
          ])
        } else {
          setExtraMessages((prev) => [
            ...prev,
            aiMessage(
              "no-material-found",
              "I couldn't match that to a material or a question I know how to answer. Try a material name or code, e.g. \"Show me the pump seal\" or \"500-14892\", or one of the suggested questions above."
            ),
          ])
        }
      }
      return
    }

    // Live OAR consumption-plan capture (§5) — one question per user reply,
    // ending in a summary the user confirms themselves (no separate form).
    if (isDraftSession && oarStep >= 1 && oarStep <= 3) {
      const answers = [...oarAnswers, text]
      setOarAnswers(answers)
      if (oarStep < 3) {
        setExtraMessages((prev) => [
          ...prev,
          aiMessage(`oar-q-${oarStep + 1}`, OAR_QUESTIONS[oarStep]),
        ])
        setOarStep((s) => s + 1)
      } else {
        const [purpose, equipment, quantityAndDate] = answers
        setExtraMessages((prev) => [
          ...prev,
          aiMessage(
            "oar-summary",
            `**Consumption Plan**\n\nMaterial: ${effectiveMaterialId}\nPurpose: ${purpose}\nEquipment / Project / Job: ${equipment}\nQuantity & planned consumption date: ${quantityAndDate}\n\nReady to confirm?`,
            {
              actions: {
                id: "oar-summary-actions",
                accentId: "confirm-plan",
                actions: [
                  {
                    id: "confirm-plan",
                    icon: "check-circle",
                    label: "Confirm Plan",
                    description: "Creates the Tracking ID and SAP reservation",
                  },
                  {
                    id: "edit-plan",
                    icon: "rotate-ccw",
                    label: "Edit Plan",
                    description: "Go back and change an answer",
                  },
                ],
              },
            }
          ),
        ])
        setOarStep(0)
      }
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader title={session.title} sessionId={session.id} />
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <SuggestedQuestions questions={SUGGESTED_QUESTIONS} onSelect={handleSend} />
        </div>
        <ChatBody
          messages={messages}
          resolvedActions={resolvedActions}
          onAction={handleAction}
          resolvedOptions={resolvedOptionIds}
          onOptionSelect={handleOptionSelect}
        />
        <ChatInput onSend={handleSend} />
      </div>
      <RightPanel
        workflow={workflow}
        emails={emails}
        trace={trace}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  )
}
