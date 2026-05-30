import assert from "node:assert/strict"
import test from "node:test"
import { formatBusyStatus, formatElapsedSeconds, formatPromptMeta, formatTokenUsage } from "../src/tui/session-surface.js"

test("session surface formats elapsed time for active work", () => {
  assert.equal(formatElapsedSeconds(0), "0s")
  assert.equal(formatElapsedSeconds(59), "59s")
  assert.equal(formatElapsedSeconds(65), "1m05s")
  assert.equal(formatBusyStatus("streaming response", 5), "streaming response 5s  esc interrupt")
})

test("session surface meta matches the compact prompt footer style", () => {
  assert.equal(formatTokenUsage(undefined), "tok --")
  assert.equal(formatTokenUsage({ inputTokens: 12, outputTokens: 5, totalTokens: 17 }), "tok 12i/5o/17t")
  assert.equal(formatPromptMeta({
    model: "kilocode/kilo-auto/free",
    mode: "chat",
    safety: "ask",
    workspaceChanges: { filesChanged: 2, added: 1, removed: 0, modified: 1, files: [] },
  }), "kilocode/kilo-auto/free | D3 off | chat/ask | tok -- | files 2 +1 | no instr")
})
