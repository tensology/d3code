import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { buildHarnessTurnContext, recommendHarnessSkills } from "../src/operator/harness-context.js"

test("harness context retrieves project memory and active workspace handoff", async () => {
  const root = join(tmpdir(), `d3code-harness-context-${Date.now()}`)
  const memoryFile = join(root, "memory.jsonl")
  await mkdir(join(root, ".d3code", "memory"), { recursive: true })
  await writeFile(join(root, ".d3code", "memory", "active.md"), "Current task: preserve ORDERS multivalues.\n")
  await writeFile(memoryFile, `${JSON.stringify({ id: "mem_1", createdAt: new Date().toISOString(), project: "SALES", kind: "lesson", summary: "ORDERS uses multivalues", evidence: "dictionary audit" })}\n`)

  const context = await buildHarnessTurnContext({
    input: "review ORDERS memory",
    mode: "audit",
    profile: "SALES",
    project: { cwd: root, root, instructions: [] },
    memoryFile,
  })

  assert.match(context.text, /ORDERS uses multivalues/)
  assert.match(context.text, /preserve ORDERS multivalues/)
  assert.ok(context.recommendedSkills.some((skill) => skill.id === "hermes-operator-memory"))
})

test("harness context removes obvious secret-bearing lines", async () => {
  const root = join(tmpdir(), `d3code-harness-secrets-${Date.now()}`)
  await mkdir(join(root, ".d3code", "memory"), { recursive: true })
  await writeFile(join(root, ".d3code", "memory", "handoff.md"), "Safe fact\nAPI_KEY=do-not-inject\n")

  const context = await buildHarnessTurnContext({ input: "pick up", mode: "chat", project: { cwd: root, root, instructions: [] } })

  assert.match(context.text, /Safe fact/)
  assert.doesNotMatch(context.text, /do-not-inject/)
})

test("skill recommendations select task-relevant baked capabilities", () => {
  const ids = recommendHarnessSkills("debug and review the memory harness", "chat").map((skill) => skill.id)
  assert.ok(ids.some((id) => /memory|debug|review/.test(id)))
})

test("harness loads available skill procedures on demand", async () => {
  const root = join(tmpdir(), `d3code-harness-skills-${Date.now()}`)
  const skillDir = join(root, "skills", "ecc-hermes-d3-harness")
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: core\n---\n# Procedure\nRun the evidence gate.")

  const context = await buildHarnessTurnContext({
    input: "review the D3 harness",
    mode: "audit",
    project: { cwd: root, root, instructions: [] },
  })

  assert.equal(context.loadedSkillFiles.length, 1)
  assert.match(context.text, /Run the evidence gate/)
  assert.doesNotMatch(context.text, /name: core/)
})

test("harness honors disabled memory and skills", async () => {
  const root = join(tmpdir(), `d3code-harness-disabled-${Date.now()}`)
  const memoryFile = join(root, "memory.jsonl")
  await mkdir(root, { recursive: true })
  await writeFile(memoryFile, `${JSON.stringify({ id: "mem_1", createdAt: new Date().toISOString(), project: "D3Code", kind: "lesson", summary: "Do not load", evidence: "test" })}\n`)

  const context = await buildHarnessTurnContext({ input: "review D3Code memory", mode: "chat", memoryFile, memoryEnabled: false, skillsEnabled: false })

  assert.deepEqual(context.memory, [])
  assert.deepEqual(context.loadedSkillFiles, [])
  assert.doesNotMatch(context.text, /Do not load/)
})
