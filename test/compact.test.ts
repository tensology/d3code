import { formatD3ToolResultForModel } from "../src/d3/connection-message.js"
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
      "MD............... A0................. A1................. A2.................",
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

test("compactToolOutput reports persistent session completion without exit unknown", () => {
  const compact = compactToolOutput({
    command: "CT BP GET.CUSTOMER",
    stdout: "CRT @(-1):'Order Entry'",
    stderr: "",
    exitCode: null,
    durationMs: 55,
  })

  assert.match(compact, /completed · 55ms/)
  assert.doesNotMatch(compact, /exit unknown/)
})


test("lossless read baselines survive compact tool feedback without truncation", () => {
  const record = { body: "A".repeat(8192), baseline: { profile: "office", connection: "f".repeat(64), original: Buffer.alloc(8192,65).toString("base64") } }
  for (const name of ["d3_read_item", "d3_read_dict"]) {
    const compact = compactToolOutput(record,name)
    assert.ok(!compact.includes("baseline"))
    assert.ok(compact.length < 4100)
    assert.deepEqual(JSON.parse(formatD3ToolResultForModel({compact, raw:record})),record)
  }
})

test("replacement summaries omit encoded readback bytes", () => {
  for (const name of ["d3_write_item", "d3_create_item", "d3_write_dict", "d3_build_basic_program"]) assert.deepEqual(JSON.parse(compactToolOutput({ saved: true, original: "c2F2ZWQ=" },name)),{saved:true})
})

test("operations summaries identify each fixed report even when native output has no command echo", () => {
  for (const command of ["LIST-JOBS (N", "SP-STATUS (N", "LISTPEQS (N"]) {
    const compact = compactToolOutput({ command, stdout: "Native status report", stderr: "Native warning", exitCode: null, durationMs: 5 }, "d3_operations_status")
    assert.ok(compact.startsWith("TCL: " + command + "\n"))
    assert.match(compact, /Native status report/)
    assert.match(compact, /Native warning/)
  }
})

test("long operations evidence retains an explicit omission marker for the model", () => {
  const raw = { command: "LISTPEQS (N", stdout: Array.from({ length: 80 }, (_, i) => `Queue entry ${i + 1}`).join("\n"), stderr: "", exitCode: null, durationMs: 5 }
  const compact = compactToolOutput(raw, "d3_operations_status")
  const feedback = formatD3ToolResultForModel({ compact, raw })
  assert.match(feedback, /62 lines omitted/)
  assert.match(feedback, /Queue entry 1\n/)
  assert.match(feedback, /Queue entry 80$/)
  assert.doesNotMatch(feedback, /Queue entry 40\n/)
})
