import assert from "node:assert/strict"
import test from "node:test"
import { compactToolOutput, sanitizeD3TerminalOutput } from "../src/tools/compact.js"

test("sanitizeD3TerminalOutput drops SSH and expect noise", () => {
  const raw = [
    "spawn ssh -tt root@office.example d3",
    "** WARNING: connection is not using a post-quantum key exchange algorithm.",
    "master dictionary: dm",
    ":LIST MD WITH A1 = \"D\" A0 A1 A2 (N",
    "fonts             fonts               D                   3159",
    "users             users               D                   3187",
    "[405] 39 items listed out of 1789 items.",
    ":OFF",
  ].join("\n")
  const cleaned = sanitizeD3TerminalOutput(raw)
  assert.doesNotMatch(cleaned, /spawn ssh/i)
  assert.match(cleaned, /LIST MD/)
  assert.match(cleaned, /fonts/)
})

test("compactToolOutput summarizes LIST MD file pointers", () => {
  const compact = compactToolOutput({
    command: "expect -c ...",
    stdout: [
      "spawn ssh -tt root@office.example d3",
      ":LIST MD WITH A1 = \"D\" A0 A1 A2 (N",
      "fonts             fonts               D                   3159",
      "users             users               D                   3187",
      "hosts             hosts               D                   3940",
      "[405] 39 items listed out of 1789 items.",
    ].join("\n"),
    stderr: "",
    exitCode: 0,
    durationMs: 120,
  }, "d3_list_files")
  assert.match(compact, /39 data files listed out of 1789/)
  assert.match(compact, /fonts/)
  assert.doesNotMatch(compact, /expect -c/)
  assert.doesNotMatch(compact, /spawn ssh/)
})

// Re-export summarizeListOutput for test - wait I didn't export it. Fix test to not use it or export it.
