import assert from "node:assert/strict"
import test from "node:test"
import { appendLiveTerminalChunk, estimateStreamTokens, formatBusyStatus, formatByteCount, formatDurationMs, formatElapsedSeconds, formatProjectLocation, formatPromptMeta, formatTimelineProgress, formatTokenUsage, summarizeLiveOutput } from "../src/tui/session-surface.js"

test("session surface formats elapsed time for active work", () => {
  assert.equal(formatElapsedSeconds(0), "0s")
  assert.equal(formatElapsedSeconds(59), "59s")
  assert.equal(formatElapsedSeconds(65), "1m05s")
  assert.equal(formatDurationMs(84), "84ms")
  assert.equal(formatDurationMs(1250), "1.3s")
  assert.equal(formatDurationMs(65_000), "1m05s")
  assert.equal(formatBusyStatus("streaming response", 5), "working: streaming response 5s  esc interrupt")
  assert.equal(formatBusyStatus("streaming response", 5, "↓ 12 tokens"), "working: streaming response 5s · ↓ 12 tokens  esc interrupt")
  assert.equal(formatBusyStatus("streaming response", 5, "↓ 12 tokens", "esc again to interrupt"), "working: streaming response 5s · ↓ 12 tokens  esc again interrupt")
  assert.equal(formatTimelineProgress("✢", "running ! sleep", 65), "✢ running ! sleep 1m05s")
  assert.equal(estimateStreamTokens(""), 0)
  assert.equal(estimateStreamTokens("hello d3code"), 3)
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
  assert.equal(formatPromptMeta({
    model: "openai/gpt-5",
    profile: "prod",
    d3Attached: false,
    mode: "chat",
    safety: "ask",
    project: { cwd: "/work/D3Code", root: "/work/D3Code", instructions: [] },
  }), "openai/gpt-5 | D3 prod profile | chat/ask | tok -- | files -- | cwd D3Code | no instr")
  assert.equal(formatPromptMeta({
    model: "openai/gpt-5",
    profile: "prod",
    d3Attached: true,
    mode: "d3",
    safety: "ask",
    project: { cwd: "/work/D3Code", root: "/work/D3Code", instructions: [] },
  }), "openai/gpt-5 | D3 prod attached | d3/ask | tok -- | files -- | cwd D3Code | no instr")
})

test("live shell output summary mirrors Claude-style recent-line progress", () => {
  const summary = summarizeLiveOutput("one\ntwo\nthree\nfour\nfive\nsix\n", 7)
  assert.equal(summary.preview, "two\nthree\nfour\nfive\nsix")
  assert.equal(summary.status, "+1 lines · 7s · 28 B")
  assert.equal(summary.progress, "6 lines")
  assert.equal(summary.lineCount, 6)
})

test("live shell output summary reports running state before output", () => {
  const summary = summarizeLiveOutput("", 3)
  assert.equal(summary.preview, "Running...")
  assert.equal(summary.status, "3s")
  assert.equal(summary.progress, "")
  assert.equal(formatByteCount(1536), "1.5 KB")
})

test("live shell output summary renders carriage-return progress like a terminal", () => {
  const summary = summarizeLiveOutput("download 10%\rdownload 40%\rdownload 100%", 2)

  assert.equal(summary.preview, "download 100%")
  assert.equal(summary.progress, "1 line")
})

test("live terminal chunks preserve stderr text without synthetic labels", () => {
  const output = [
    ["", "stdout: ready\n"],
    ["stdout: ready\n", "warning from stderr\n"],
  ].reduce((current, [, chunk]) => appendLiveTerminalChunk(current, chunk), "")
  const summary = summarizeLiveOutput(output, 1)

  assert.equal(output, "stdout: ready\nwarning from stderr\n")
  assert.equal(summary.preview, "stdout: ready\nwarning from stderr")
  assert.equal(summary.preview.includes("stderr:"), false)
})
