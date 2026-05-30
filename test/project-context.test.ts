import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { loadProjectContext, renderProjectInstructions } from "../src/tui/project-context.js"

test("project context loads D3Code and Claude-style folder instructions upward", async () => {
  const root = join(tmpdir(), `d3code-project-context-${Date.now()}`)
  const child = join(root, "accounts", "sales")
  await mkdir(child, { recursive: true })
  await writeFile(join(root, "D3CODE.md"), "Use SALES as the working D3 account.\n")
  await writeFile(join(child, "CLAUDE.md"), "Prefer read-only inspection before writes.\n")

  const context = await loadProjectContext(child)
  const rendered = renderProjectInstructions(context)

  assert.equal(context.cwd, child)
  assert.equal(context.instructions.length, 2)
  assert.match(rendered, /D3CODE\.md/)
  assert.match(rendered, /CLAUDE\.md/)
  assert.match(rendered, /Use SALES/)
  assert.match(rendered, /read-only inspection/)
})
