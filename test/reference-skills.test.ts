import assert from "node:assert/strict"
import test from "node:test"
import { skillCoverageReport } from "../src/skills/coverage.js"
import { auditReferenceSkillInventory, mapReferenceSkillPath, renderReferenceSkillAudit } from "../src/skills/reference-audit.js"
import { referenceSkillCoverageReady, referenceSkillFamilies, renderReferenceSkillMap } from "../src/skills/reference-map.js"
import { getSkill, modeSystemPrompt } from "../src/skills/modes.js"

test("reference skill families are mapped to baked product surfaces or explicit out-of-scope decisions", () => {
  assert.equal(referenceSkillCoverageReady(), true)
  assert.ok(referenceSkillFamilies.some((family) => family.source === "gstack" && family.reference.includes("qa")))
  assert.ok(referenceSkillFamilies.some((family) => family.reference.includes("ship") && family.productSurfaces.includes("bundle-release-report")))
  assert.ok(referenceSkillFamilies.some((family) => family.reference.includes("health") && family.productSurfaces.includes("safety-guard")))
  assert.ok(referenceSkillFamilies.some((family) => family.reference.includes("context-save") && family.productSurfaces.includes("bundle-context-pack")))
  assert.ok(referenceSkillFamilies.some((family) => family.source === "opencode" && family.productSurfaces.includes("ide")))
  assert.ok(referenceSkillFamilies.some((family) => family.source === "opencode" && family.productSkills.includes("architecture-deepening")))
  assert.ok(referenceSkillFamilies.some((family) => family.reference.includes("benchmark") && family.productSurfaces.includes("model-routing")))
  assert.ok(referenceSkillFamilies.some((family) => family.status === "out-of-scope" && family.reference.includes("ios")))
  assert.match(renderReferenceSkillMap(), /Reference Skill Map/)
  assert.match(renderReferenceSkillMap(), /gstack-review/)
})

test("gstack and release-readiness skills are first-class D3 Code skills", () => {
  for (const skillID of ["gstack-spec", "gstack-review", "gstack-ship", "gstack-health-guard", "gstack-investigate", "gstack-context", "gstack-docs", "gstack-design-review", "d3-release-readiness"]) {
    assert.ok(getSkill(skillID), `${skillID} should be baked into the skill catalog`)
  }
  assert.match(modeSystemPrompt("migrate"), /gstack-design-review/)
  assert.match(modeSystemPrompt("qa"), /d3-release-readiness/)
})

test("skill coverage includes the reference skill map gate", () => {
  const report = skillCoverageReport()
  assert.equal(report.ready, true)
  assert.ok(report.items.some((item) => item.expected.includes("model benchmarking") && item.evidence.includes("command:model-routing") && item.covered))
  assert.ok(report.items.some((item) => item.expected.includes("reference skill map") && item.covered))
  assert.ok(report.items.some((item) => item.expected.includes("subagent-driven") && item.evidence.includes("command:agent-run") && item.covered))
})

test("reference skill audit maps concrete SKILL.md paths", () => {
  assert.equal(mapReferenceSkillPath("skills/superpowers/skills/test-driven-development/SKILL.md").productSkills[0], "red-green-refactor")
  assert.equal(mapReferenceSkillPath("skills/gstack/ios-qa/SKILL.md").status, "out-of-scope")
  assert.ok(mapReferenceSkillPath("skills/gstack/ship/SKILL.md").productSkills.includes("gstack-ship"))
  assert.ok(mapReferenceSkillPath("skills/rtk/.claude/skills/security-guardian/SKILL.md").productSkills.includes("gstack-health-guard"))
  assert.ok(mapReferenceSkillPath("opencode/.opencode/skills/effect/SKILL.md").productSkills.includes("effect-service-patterns"))
  assert.ok(mapReferenceSkillPath("opencode/.opencode/skills/improve-codebase-architecture/SKILL.md").productSkills.includes("architecture-deepening"))
  assert.ok(mapReferenceSkillPath("opencode/packages/opencode/test/fixture/skills/agents-sdk/SKILL.md").productSkills.includes("edge-agent-platform"))
})

test("reference skill audit covers the local reference folder inventory", async () => {
  const report = await auditReferenceSkillInventory("reference")
  assert.equal(report.ready, true)
  assert.ok(report.total >= 19)
  assert.equal(report.items.filter((item) => item.status === "unmapped").length, 0)
  assert.ok(report.items.some((item) => item.path === "opencode:.opencode/skills/effect, packages/opencode/test/fixture/skills/*"))
  assert.ok(report.items.some((item) => item.path === "rocket-mvbasic:docs/usage/Connection.md, OnlineEditing.md, HashedFileEditing.md, Compile.md, Debugging.md, Diagnostics.md, References.md, Completion.md"))
  assert.match(renderReferenceSkillAudit(report), /Reference Skill Audit/)
  assert.match(renderReferenceSkillAudit(report), /Out of scope:/)
})
