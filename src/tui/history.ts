import type { ChatMessage } from "../llm/client.js"

export interface HistoryBudget {
  maxChars?: number
  maxMessages?: number
  maxMessageChars?: number
}

export function compactAgentHistory(history: ChatMessage[], budget: HistoryBudget = {}): ChatMessage[] {
  const maxChars = Math.max(4000, budget.maxChars ?? 24_000)
  const maxMessages = Math.max(4, budget.maxMessages ?? 40)
  const maxMessageChars = Math.max(1000, budget.maxMessageChars ?? 8_000)
  const candidates = history.filter((message) => message.role !== "system")
  const kept: ChatMessage[] = []
  let chars = 0

  for (let index = candidates.length - 1; index >= 0 && kept.length < maxMessages; index -= 1) {
    const message = candidates[index]!
    const content = message.content.length > maxMessageChars
      ? `${message.content.slice(0, maxMessageChars - 36).trimEnd()}\n[message truncated by harness]`
      : message.content
    if (kept.length > 0 && chars + content.length > maxChars) break
    kept.unshift({ ...message, content })
    chars += content.length
  }

  if (kept.length < candidates.length) {
    kept.unshift({ role: "assistant", content: `[Harness note: ${candidates.length - kept.length} older message(s) were omitted to keep this turn within the context budget.]` })
  }
  return kept
}
