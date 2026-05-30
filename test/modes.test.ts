import assert from "node:assert/strict"
import test from "node:test"
import { renderSkillCoverage, skillCoverageReport } from "../src/skills/coverage.js"
import { getMode, modeSystemPrompt, renderModeRunbook, renderSkill, skills } from "../src/skills/modes.js"

test("migration mode bakes in D3 modernization skills", () => {
  const mode = getMode("migrate")
  assert.equal(mode?.safetyBias, "ask")
  assert.ok(mode?.skills.includes("d3-database-audit"))
  assert.ok(mode?.skills.includes("rest-api-generation"))
})

test("mode system prompt includes workflow and baked skills", () => {
  const prompt = modeSystemPrompt("migrate")
  assert.match(prompt, /strangler migration/i)
  assert.match(prompt, /Baked-in skills/)
  assert.match(prompt, /Workflow/)
})

test("reference skills are productized as D3 Code skills", () => {
  assert.ok(skills.some((skill) => skill.source === "superpowers"))
  assert.ok(skills.some((skill) => skill.source === "gsd"))
  assert.ok(skills.some((skill) => skill.source === "gstack"))
  assert.ok(skills.some((skill) => skill.source === "rtk"))
  assert.ok(skills.some((skill) => skill.source === "opencode"))
})

test("superpowers reference workflow skills are baked into the catalog", () => {
  for (const id of [
    "brainstorming",
    "writing-plans",
    "executing-plans",
    "red-green-refactor",
    "systematic-debugging",
    "verification-before-completion",
    "requesting-code-review",
    "subagent-driven-development",
    "dispatching-parallel-agents",
    "writing-skills",
  ]) {
    assert.ok(skills.some((skill) => skill.id === id), `missing skill ${id}`)
  }
})

test("mode runbook exposes skill pack, loop, and evidence gates", () => {
  const runbook = renderModeRunbook("migrate")
  assert.match(runbook, /Migration Mode Runbook/)
  assert.match(runbook, /Skill Pack/)
  assert.match(runbook, /rest-api-generation/)
  assert.match(runbook, /Evidence Gate/)
  assert.match(runbook, /connector-strategy/)
})

test("skill info renders baked behavior", () => {
  const info = renderSkill("verification-before-completion")
  assert.match(info, /Source: superpowers/)
  assert.match(info, /Baked Behavior/)
  assert.match(info, /live-D3 gaps/)
})

test("skill coverage report proves reference skill families have product surfaces", () => {
  const report = skillCoverageReport()
  assert.equal(report.ready, true)
  assert.ok(report.items.some((item) => item.source === "gsd" && item.evidence.includes("command:goal-verify")))
  assert.ok(report.items.some((item) => item.source === "gsd" && item.evidence.includes("command:goal-audit-bundle")))
  assert.ok(report.items.some((item) => item.source === "d3code" && item.evidence.includes("command:bundle-brief")))
  assert.ok(report.items.some((item) => item.source === "d3code" && item.evidence.includes("command:agent-run")))
  assert.ok(report.items.some((item) => item.source === "d3code" && item.evidence.includes("command:webapp-smoke")))
  assert.ok(report.items.some((item) => item.source === "d3code" && item.evidence.includes("command:modernization-proof")))
  assert.ok(report.items.some((item) => item.source === "gstack" && item.evidence.includes("command:model-routing")))
  assert.ok(report.items.some((item) => item.source === "gstack" && item.evidence.includes("command:bundle-release-report")))
  assert.match(modeSystemPrompt("api"), /effect-service-patterns/)
  const rendered = renderSkillCoverage()
  assert.match(rendered, /D3 Code Baked Skill Coverage/)
  assert.match(rendered, /Ready: yes/)
  assert.match(rendered, /command:agent-run/)
  assert.match(rendered, /command:webapp-smoke/)
  assert.match(rendered, /command:modernization-proof/)
})
