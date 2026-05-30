import assert from "node:assert/strict"
import test from "node:test"
import { formatWorkspaceChangeFooter, parseGitStatus, renderWorkspaceChangeSummary, summarizeWorkspaceChanges, type WorkspaceSnapshot } from "../src/tui/workspace-changes.js"

function snapshot(raw: string): WorkspaceSnapshot {
  return { available: true, files: parseGitStatus(raw) }
}

test("workspace change summary detects new and modified files after a turn", () => {
  const before = snapshot(" M README.md\n")
  const after = snapshot(" M README.md\n M src/app.ts\n?? scratch.txt\n")

  const summary = summarizeWorkspaceChanges(before, after)

  assert.equal(summary?.filesChanged, 2)
  assert.equal(summary?.added, 1)
  assert.equal(summary?.modified, 1)
  assert.deepEqual(summary?.files.map((file) => `${file.code}:${file.path}`), [" M:src/app.ts", "??:scratch.txt"])
  assert.equal(formatWorkspaceChangeFooter(summary), "files 2 +1")
  assert.equal(renderWorkspaceChangeSummary(summary!), [
    "Files changed: 2 (1 modified, 1 added)",
    "modified src/app.ts",
    "added    scratch.txt",
  ].join("\n"))
})

test("workspace change summary stays quiet when status did not change", () => {
  const before = snapshot(" M README.md\n")
  const after = snapshot(" M README.md\n")

  assert.equal(summarizeWorkspaceChanges(before, after), undefined)
  assert.equal(formatWorkspaceChangeFooter(undefined), "files --")
})

test("workspace change summary ignores non-git snapshots", () => {
  assert.equal(summarizeWorkspaceChanges({ available: false, files: new Map() }, snapshot(" M README.md\n")), undefined)
})
