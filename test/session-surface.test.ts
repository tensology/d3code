import assert from "node:assert/strict"
import test from "node:test"
import { formatBusyStatus, formatDurationMs, formatElapsedSeconds, formatProjectLocation, formatPromptMeta, formatTimelineProgress, formatTokenUsage } from "../src/tui/session-surface.js"

test("session surface formats elapsed time for active work", () => {
  assert.equal(formatElapsedSeconds(0), "0s")
  assert.equal(formatElapsedSeconds(59), "59s")
  assert.equal(formatElapsedSeconds(65), "1m05s")
  assert.equal(formatDurationMs(84), "84ms")
  assert.equal(formatDurationMs(1250), "1.3s")
  assert.equal(formatDurationMs(65_000), "1m05s")
  assert.equal(formatBusyStatus("streaming response", 5), "working: streaming response 5s  esc to interrupt")
  assert.equal(formatTimelineProgress("✢", "running ! sleep", 65), "✢ running ! sleep 1m05s")
})

test("session surface meta matches the compact prompt footer style", () => {
  assert.equal(formatTokenUsage(undefined), "tok --")
  assert.equal(formatProjectLocation({ cwd: "/work/D3Code", root: "/work/D3Code", instructions: [] }), "cwd D3Code")
  assert.equal(formatTokenUsage({ inputTokens: 12, outputTokens: 5, totalTokens: 17 }), "tok 12i/5o/17t")
  assert.equal(formatPromptMeta({
    model: "kilocode/kilo-auto/free",
    mode: "chat",
    safety: "ask",
    workspaceChanges: { filesChanged: 2, added: 1, removed: 0, modified: 1, files: [] },
    project: { cwd: "/work/D3Code", root: "/work/D3Code", instructions: [] },
  }), "kilocode/kilo-auto/free | D3 off | chat/ask | tok -- | files 2 +1 | cwd D3Code | no instr")
})
