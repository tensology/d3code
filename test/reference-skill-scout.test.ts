import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { classifyReferenceSkill, scoutReferenceSkills, renderReferenceSkillScout } from "../src/skills/reference-scout.js"

test("reference skill scout classifies D3-relevant, generic, external, and unknown skills", () => {
  assert.equal(classifyReferenceSkill("skills/d3-database-audit/SKILL.md", "Audit Rocket D3 dictionaries and MV BASIC programs.").decision, "adopt")
  assert.equal(classifyReferenceSkill("skills/test-driven-development/SKILL.md", "Write failing tests before implementation.").decision, "adapt")
  assert.equal(classifyReferenceSkill("skills/spotify/SKILL.md", "Control Spotify playlists and playback.").decision, "out-of-scope")
  assert.equal(classifyReferenceSkill("skills/novel-workflow/SKILL.md", "A bespoke workflow with no product vocabulary.").decision, "needs-review")
})

test("reference skill scout walks a reference directory and renders decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "d3code-skill-scout-"))
  await mkdir(join(root, "skills", "d3-audit"), { recursive: true })
  await mkdir(join(root, "skills", "security-review"), { recursive: true })
  await mkdir(join(root, "skills", "slack"), { recursive: true })
  await writeFile(join(root, "skills", "d3-audit", "SKILL.md"), "Audit Rocket D3 accounts, dictionaries, and PICK BASIC.")
  await writeFile(join(root, "skills", "security-review", "SKILL.md"), "Review code for security and secret handling.")
  await writeFile(join(root, "skills", "slack", "SKILL.md"), "Send Slack messages and inspect channels.")

  const report = await scoutReferenceSkills(root, { scope: "d3" })

  assert.equal(report.scope, "d3")
  assert.equal(report.total, 3)
  assert.equal(report.counts.adopt, 1)
  assert.equal(report.counts.adapt, 1)
  assert.equal(report.counts["out-of-scope"], 1)
  assert.match(renderReferenceSkillScout(report), /Reference Skill Scout/)
  assert.match(renderReferenceSkillScout(report), /D3 manual\/reference vocabulary/)
})
