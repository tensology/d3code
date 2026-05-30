import assert from "node:assert/strict"
import test from "node:test"
import { compactTranscriptContent, transcriptColor, transcriptPrefix } from "../src/tui/transcript.js"

test("transcript prefixes make tool and file events first-class message blocks", () => {
  assert.equal(transcriptPrefix("user"), "› ")
  assert.equal(transcriptPrefix("assistant"), "d3code: ")
  assert.equal(transcriptPrefix("shell-input"), "! ")
  assert.equal(transcriptPrefix("tool"), "  ⎿ ")
  assert.equal(transcriptPrefix("shell-output"), "  ⎿ ")
  assert.equal(transcriptPrefix("file-change"), "  ◆ ")
  assert.equal(transcriptColor("tool-start"), "cyan")
  assert.equal(transcriptColor("shell-input"), "yellow")
})

test("transcript compacts noisy tool output", () => {
  const compacted = compactTranscriptContent(["d3_list_files", "one", "two", "three", "four"].join("\n"), 3)

  assert.deepEqual(compacted, ["d3_list_files", "one", "... 3 more lines"])
})
