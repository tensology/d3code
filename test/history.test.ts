import assert from "node:assert/strict"
import test from "node:test"
import { compactAgentHistory } from "../src/tui/history.js"

test("agent history is bounded and preserves the newest conversation", () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" as const : "user" as const,
    content: `message-${index}-${"x".repeat(500)}`,
  }))
  const compact = compactAgentHistory(history, { maxChars: 4000, maxMessages: 8, maxMessageChars: 1000 })

  assert.match(compact[0]?.content ?? "", /older message/)
  assert.match(compact.at(-1)?.content ?? "", /message-19/)
  assert.ok(compact.length <= 9)
})

test("agent history removes stale system prompts", () => {
  assert.deepEqual(compactAgentHistory([
    { role: "system", content: "stale" },
    { role: "user", content: "current" },
  ]), [{ role: "user", content: "current" }])
})
