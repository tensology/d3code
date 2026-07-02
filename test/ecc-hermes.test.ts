import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { eccHermesImports, renderEccHermesImportMap, resolveEccHermesImportPaths } from "../src/operator/ecc-hermes.js"
import { skillCoverageReport } from "../src/skills/coverage.js"
import { getMode, modeSystemPrompt, renderSkill, skills } from "../src/skills/modes.js"

const eccRoot = "/Users/paul/development/TENSOLOGY/DECISIONS/COMPETITION/ecc"

test("D3Code bakes relevant ECC and Hermes skills into its catalog", () => {
  for (const id of [
    "hermes-operator-memory",
    "hermes-workflow-imports",
    "ecc-eval-harness",
    "ecc-agent-harness-construction",
    "ecc-iterative-retrieval",
    "ecc-team-agent-orchestration",
    "ecc-agent-introspection-debugging",
    "ecc-coding-standards",
    "ecc-terminal-ops",
    "ecc-token-budget-advisor",
  ]) {
    assert.ok(skills.some((skill) => skill.id === id), `missing skill ${id}`)
  }

  assert.match(renderSkill("hermes-operator-memory"), /local coding idioms/)
  assert.match(modeSystemPrompt("audit"), /ecc-iterative-retrieval/)
  assert.ok(getMode("gsd")?.skills.includes("ecc-team-agent-orchestration"))
})

test("ECC/Hermes import map points every adapted source at a baked D3Code skill", () => {
  for (const item of eccHermesImports.filter((entry) => entry.status === "adapted")) {
    assert.ok(skills.some((skill) => skill.id === item.d3Skill), `${item.sourceSkill} maps to missing ${item.d3Skill}`)
  }

  const rendered = renderEccHermesImportMap()
  assert.match(rendered, /Hermes and ECC Import Map/)
  assert.match(rendered, /hermes-imports/)
  assert.match(rendered, /agent-harness-construction/)
})

test("ECC/Hermes source paths resolve against the local ECC checkout when present", async () => {
  if (!existsSync(eccRoot)) return
  const resolved = await resolveEccHermesImportPaths(eccRoot)

  assert.ok(resolved.some((entry) => entry.sourceSkill === "hermes-imports" && entry.present))
  assert.ok(resolved.some((entry) => entry.sourceSkill === "eval-harness" && entry.present))
})

test("skill coverage includes Hermes memory, orchestration, evals, and retrieval", () => {
  const report = skillCoverageReport()

  assert.equal(report.ready, true)
  assert.ok(report.items.some((item) => item.source === "hermes" && item.covered))
  assert.ok(report.items.some((item) => item.source === "ecc" && item.covered))
})
