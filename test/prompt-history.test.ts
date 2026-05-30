import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"
import { appendPromptHistory, compactPromptHistory, loadPromptHistory } from "../src/tui/prompt-history.js"

test("compact prompt history trims blanks, adjacent duplicates, and old entries", () => {
  const entries = compactPromptHistory([
    { input: "  ", time: "1" },
    { input: "hello", time: "2" },
    { input: "hello", time: "3" },
    { input: "LIST MD", time: "4" },
  ], 2)

  assert.deepEqual(entries.map((entry) => `${entry.input}:${entry.time}`), ["hello:3", "LIST MD:4"])
})

test("prompt history load self-heals corrupt jsonl", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-history-"))
  const file = join(dir, "prompt-history.jsonl")
  try {
    await writeFile(file, [
      "{\"input\":\"/help\",\"time\":\"2026-05-30T00:00:00.000Z\"}",
      "not-json",
      "{\"input\":\"\",\"time\":\"2026-05-30T00:00:01.000Z\"}",
      "{\"input\":\"/status\",\"mode\":\"chat\",\"profile\":\"prod\",\"time\":\"2026-05-30T00:00:02.000Z\"}",
    ].join("\n"))

    const loaded = await loadPromptHistory(file)
    assert.deepEqual(loaded.map((entry) => entry.input), ["/help", "/status"])
    assert.equal(loaded[1]?.mode, "chat")
    assert.equal(loaded[1]?.profile, "prod")
    assert.doesNotMatch(await readFile(file, "utf8"), /not-json/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("prompt history append writes jsonl entry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-history-"))
  const file = join(dir, "prompt-history.jsonl")
  try {
    await appendPromptHistory("  /d3 prod  ", { mode: "chat", profile: "prod" }, file)
    const loaded = await loadPromptHistory(file)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0]?.input, "/d3 prod")
    assert.equal(loaded[0]?.profile, "prod")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
