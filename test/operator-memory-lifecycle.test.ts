import assert from "node:assert/strict"
import { mkdir, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { appendOperatorMemory, createOperatorMemoryEntry, readOperatorMemory, supersedeOperatorMemory } from "../src/operator/memory.js"

test("operator memory skips corrupt records and keeps secure permissions", async () => {
  const root = join(tmpdir(), `d3code-memory-lifecycle-${Date.now()}`)
  const path = join(root, "memory.jsonl")
  await mkdir(root, { recursive: true })
  await writeFile(path, "not-json\n")
  const entry = createOperatorMemoryEntry({ project: "D3Code", kind: "fix", summary: "Validate read tools", evidence: "regression test" })
  await appendOperatorMemory(path, entry)

  assert.deepEqual((await readOperatorMemory(path)).map((item) => item.id), [entry.id])
  assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test("operator memory can supersede a stale verified lesson", async () => {
  const root = join(tmpdir(), `d3code-memory-supersede-${Date.now()}`)
  const path = join(root, "memory.jsonl")
  const oldEntry = createOperatorMemoryEntry({ project: "D3Code", kind: "lesson", summary: "Old rule", evidence: "old test" })
  const replacement = createOperatorMemoryEntry({ project: "D3Code", kind: "lesson", summary: "Corrected rule", evidence: "new test" })
  await appendOperatorMemory(path, oldEntry)
  await supersedeOperatorMemory(path, oldEntry.id, replacement)

  assert.deepEqual((await readOperatorMemory(path)).map((item) => item.summary), ["Corrected rule"])
  const all = await readOperatorMemory(path, undefined, true)
  assert.equal(all[0]?.status, "superseded")
  assert.equal(all[1]?.supersedes, oldEntry.id)
})
