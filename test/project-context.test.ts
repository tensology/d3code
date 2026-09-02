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

test("project context loads shared AGENTS and Decisions harness instructions", async () => {
  const root = join(tmpdir(), `d3code-project-harness-${Date.now()}`)
  const child = join(root, "src")
  await mkdir(join(root, ".decisions"), { recursive: true })
  await mkdir(child, { recursive: true })
  await writeFile(join(root, "AGENTS.md"), "Use the shared developer harness.")
  await writeFile(join(root, ".decisions", "agents.md"), "Load active memory before work.")

  const rendered = renderProjectInstructions(await loadProjectContext(child))

  assert.match(rendered, /AGENTS\.md/)
  assert.match(rendered, /\.decisions\/agents\.md/)
  assert.match(rendered, /Load active memory/)
  assert.equal((await loadProjectContext(child)).root, root)
})

test("project instructions are root-first, bounded, and secret-bearing lines are removed", async () => {
  const root = join(tmpdir(), `d3code-project-safe-${Date.now()}`)
  const child = join(root, "src")
  await mkdir(child, { recursive: true })
  await writeFile(join(root, "AGENTS.md"), "Root rule\nAPI_KEY=do-not-send\n")
  await writeFile(join(child, "CLAUDE.md"), `Child rule\n${"x".repeat(4000)}`)

  const context = await loadProjectContext(child)
  const rendered = renderProjectInstructions(context, 500)

  assert.ok(rendered.indexOf("Root rule") < rendered.indexOf("Child rule"))
  assert.doesNotMatch(rendered, /do-not-send/)
  assert.doesNotMatch(rendered, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(rendered, /truncated by harness/)
  assert.ok(rendered.length <= 500)
})
