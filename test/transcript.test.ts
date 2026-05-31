import assert from "node:assert/strict"
import test from "node:test"
import { compactTranscriptContent, transcriptColor, transcriptPrefix, wrapTranscriptLine } from "../src/tui/transcript.js"

test("transcript prefixes make tool and file events first-class message blocks", () => {
  assert.equal(transcriptPrefix("user"), "› ")
  assert.equal(transcriptPrefix("assistant"), "d3code: ")
  assert.equal(transcriptPrefix("assistant-stream"), "  ⎿ ")
  assert.equal(transcriptPrefix("assistant-interrupted"), "  ⎿ ")
  assert.equal(transcriptPrefix("pending"), "  ⎿ ")
  assert.equal(transcriptPrefix("queued"), "queued › ")
  assert.equal(transcriptPrefix("shell-input"), "› ! ")
  assert.equal(transcriptPrefix("d3-input"), "› : ")
  assert.equal(transcriptPrefix("system"), "  ⎿ ")
  assert.equal(transcriptPrefix("tool"), "  ⎿ ")
  assert.equal(transcriptPrefix("tool-live"), "  ⎿ ")
  assert.equal(transcriptPrefix("shell-output"), "  ⎿ ")
  assert.equal(transcriptPrefix("file-change-live"), "  ◆ ")
  assert.equal(transcriptPrefix("file-change"), "  ◆ ")
  assert.equal(transcriptColor("tool-start"), "cyan")
  assert.equal(transcriptColor("shell-input"), "white")
  assert.equal(transcriptColor("d3-input"), "white")
  assert.equal(transcriptColor("assistant-stream"), "green")
  assert.equal(transcriptColor("assistant-interrupted"), "yellow")
  assert.equal(transcriptColor("pending"), "yellow")
  assert.equal(transcriptColor("queued"), "cyan")
  assert.equal(transcriptColor("tool-live"), "yellow")
  assert.equal(transcriptColor("file-change-live"), "yellow")
})

test("transcript compacts noisy tool output", () => {
  const compacted = compactTranscriptContent(["d3_list_files", "one", "two", "three", "four"].join("\n"), 3)

  assert.deepEqual(compacted, ["d3_list_files", "one", "... 3 more lines"])
})

test("transcript wraps long logical lines before compacting", () => {
  assert.deepEqual(wrapTranscriptLine("alpha beta gamma", 10), ["alpha beta", "gamma"])

  const compacted = compactTranscriptContent("Commands:\n/help ".repeat(20), 4)
  assert.equal(compacted.length, 4)
  assert.match(compacted.at(-1) ?? "", /more lines/)
})
