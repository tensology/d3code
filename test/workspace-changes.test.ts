import assert from "node:assert/strict"
import test from "node:test"
import { formatWorkspaceChangeFooter, parseGitNumstat, parseGitStatus, renderWorkspaceChangeSummary, summarizeWorkspaceChanges, type WorkspaceSnapshot } from "../src/tui/workspace-changes.js"

function snapshot(raw: string, numstat = ""): WorkspaceSnapshot {
  return { available: true, files: parseGitStatus(raw, parseGitNumstat(numstat)) }
}

test("workspace change summary detects new and modified files after a turn", () => {
  const before = snapshot(" M README.md\n")
  const after = snapshot(" M README.md\n M src/app.ts\n?? scratch.txt\n", "12\t3\tsrc/app.ts\n")

  const summary = summarizeWorkspaceChanges(before, after)

  assert.equal(summary?.filesChanged, 2)
  assert.equal(summary?.added, 1)
  assert.equal(summary?.modified, 1)
  assert.deepEqual(summary?.files.map((file) => `${file.code}:${file.path}`), [" M:src/app.ts", "??:scratch.txt"])
  assert.equal(formatWorkspaceChangeFooter(summary), "files 2 +1 +12/-3")
  assert.equal(renderWorkspaceChangeSummary(summary!), [
    "Files changed: 2 (1 modified, 1 added, +12, -3)",
    "modified src/app.ts +12/-3",
    "added    scratch.txt",
  ].join("\n"))
})

test("workspace change summary detects additional edits to an already modified file", () => {
  const before = snapshot(" M src/app.ts\n", "2\t0\tsrc/app.ts\n")
  const after = snapshot(" M src/app.ts\n", "5\t1\tsrc/app.ts\n")

  const summary = summarizeWorkspaceChanges(before, after)

  assert.equal(summary?.filesChanged, 1)
  assert.equal(summary?.files[0]?.additions, 5)
  assert.equal(summary?.files[0]?.deletions, 1)
  assert.equal(renderWorkspaceChangeSummary(summary!), [
    "Files changed: 1 (1 modified, +5, -1)",
    "modified src/app.ts +5/-1",
  ].join("\n"))
})

test("workspace change summary stays quiet when status did not change", () => {
  const before = snapshot(" M README.md\n", "1\t0\tREADME.md\n")
  const after = snapshot(" M README.md\n", "1\t0\tREADME.md\n")

  assert.equal(summarizeWorkspaceChanges(before, after), undefined)
  assert.equal(formatWorkspaceChangeFooter(undefined), "files --")
})

test("workspace change summary ignores non-git snapshots", () => {
  assert.equal(summarizeWorkspaceChanges({ available: false, files: new Map() }, snapshot(" M README.md\n")), undefined)
})
