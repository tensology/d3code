import assert from "node:assert/strict"
import test from "node:test"
import { createBundleArtifacts, parseBundle } from "../src/app/bundle.js"
import { createBundleEvidenceReport } from "../src/app/evidence.js"
import { auditGoalAgainstBundle, renderGoalBundleAudit } from "../src/goal/audit.js"
import { createMigrationGoalFromBundle } from "../src/goal/bootstrap.js"
import { applyBundleEvidenceToGoal, renderAppliedGoalEvidence } from "../src/goal/evidence.js"
import { advanceGoal, blockGoal, createModernizationGoal, goalPlan, goalSummary, recordGoalEvidence, renderGoalVerification, verifyGoal } from "../src/goal/goal.js"
import { renderGoalNext } from "../src/goal/next.js"

test("goal starts with audit phase active", () => {
  const goal = createModernizationGoal("Modernize invoicing", "Web invoicing works")
  assert.equal(goal.phases[0]?.status, "active")
  assert.match(goalSummary(goal), /Active: audit/)
  assert.ok(goal.phases[0]?.checklist?.length)
})

test("goal advances active phase and records note", () => {
  const goal = advanceGoal(createModernizationGoal("Modernize invoicing", "Web invoicing works"), "audit complete")
  assert.equal(goal.phases[0]?.status, "done")
  assert.equal(goal.phases[0]?.notes?.[0], "audit complete")
  assert.equal(goal.phases[1]?.status, "active")
})

test("goal can block active phase", () => {
  const goal = blockGoal(createModernizationGoal("Modernize invoicing", "Web invoicing works"), "D3 login missing")
  assert.equal(goal.phases[0]?.status, "blocked")
  assert.equal(goal.phases[0]?.notes?.[0], "D3 login missing")
})

test("migration goals include capture, audit, mapping, API, and verification phases", () => {
  const goal = createModernizationGoal("Migrate order entry", "Order entry runs as a web slice", "migrate")
  assert.deepEqual(goal.phases.map((phase) => phase.id), ["capture", "audit", "map", "api", "verify"])
  assert.match(goal.phases[0]?.commands?.[0] ?? "", /bundle-capture/)
  assert.match(goal.phases[1]?.commands?.join("\n") ?? "", /agent-run file-audit/)
  assert.match(goal.phases[1]?.commands?.join("\n") ?? "", /agent-run basic-check/)
  assert.match(goal.phases[3]?.commands?.[0] ?? "", /agent-run migration-slice/)
  assert.match(goal.phases[3]?.commands?.join("\n") ?? "", /webapp-smoke/)
})

test("goal plan renders checklist, commands, deliverables, and evidence gates", () => {
  const goal = createModernizationGoal("Migrate order entry", "Order entry runs as a web slice", "migrate")
  const plan = goalPlan(goal)
  assert.match(plan, /Checklist:/)
  assert.match(plan, /Deliverables:/)
  assert.match(plan, /Commands:/)
  assert.match(plan, /Evidence gate:/)
  assert.match(plan, /d3code bundle-capture/)
})

test("goal next renders active phase, baked skills, commands, and subagents", () => {
  const goal = createModernizationGoal("Migrate order entry", "Order entry runs as a web slice", "migrate")
  const next = renderGoalNext(goal)
  assert.match(next, /Active Phase: capture/)
  assert.match(next, /d3code bundle-capture/)
  assert.match(next, /Baked Skills To Apply/)
  assert.match(next, /Suggested Subagents/)
  assert.match(next, /goal-evidence/)
})

test("goal plan surfaces executable agent-run commands in migration phases", () => {
  const goal = createModernizationGoal("Migrate order entry", "Order entry runs as a web slice", "migrate")
  const plan = goalPlan(goal)
  assert.match(plan, /agent-run file-audit/)
  assert.match(plan, /agent-run basic-check/)
  assert.match(plan, /agent-run migration-slice/)
  assert.match(plan, /webapp-smoke/)
})

test("bundle bootstrap creates migration goal with captured evidence", () => {
  const bundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{ name: "CUSTOMERS", dictionary: [{ id: "@ID" }], records: [{ id: "100", raw: "Alice" }] }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  })
  const goal = createMigrationGoalFromBundle(bundle)
  assert.equal(goal.mode, "migrate")
  assert.equal(goal.phases[0]?.status, "done")
  assert.equal(goal.phases[1]?.status, "active")
  assert.match(goal.phases[0]?.evidence?.[0] ?? "", /CUSTOMERS/)
})

test("bundle bootstrap can seed generated artifact evidence through verify phase", () => {
  const bundle = parseBundle({ account: "SALES", profile: "prod", files: [{ name: "CUSTOMERS" }], programs: [] })
  const goal = createMigrationGoalFromBundle(bundle, { artifactsOut: "./migration-output", webappReady: true })
  assert.equal(goal.phases.find((phase) => phase.id === "verify")?.status, "active")
  assert.match(goal.phases.find((phase) => phase.id === "api")?.evidence?.join("\n") ?? "", /webapp-check passed/)
  assert.match(goal.phases.find((phase) => phase.id === "verify")?.evidence?.join("\n") ?? "", /migration QA plan/)
})

test("goal evidence is recorded against the active or selected phase", () => {
  const goal = createModernizationGoal("Audit inventory", "Find indexed data risks", "audit")
  const activeEvidence = recordGoalEvidence(goal, "Captured account index")
  assert.equal(activeEvidence.phases[0]?.evidence?.[0], "Captured account index")

  const selectedEvidence = recordGoalEvidence(activeEvidence, "Dictionary shape findings reviewed", "database")
  assert.equal(selectedEvidence.phases[1]?.evidence?.[0], "Dictionary shape findings reviewed")
  assert.match(goalPlan(selectedEvidence), /Recorded evidence:/)
})

test("bundle evidence can be applied to matching migration goal phases", () => {
  const bundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{ name: "CUSTOMERS", suggestedResource: "customers", dictionary: [{ id: "@ID" }], records: [{ id: "100", raw: "Alice" }] }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  })
  const goal = createModernizationGoal("Migrate customers", "Customers web slice works", "migrate")
  const report = createBundleEvidenceReport(bundle, createBundleArtifacts(bundle))
  const applied = applyBundleEvidenceToGoal(goal, report)
  assert.ok(applied.applied.length >= 5)
  assert.match(applied.goal.phases.find((phase) => phase.id === "capture")?.evidence?.join("\n") ?? "", /Bundle captured/)
  assert.match(applied.goal.phases.find((phase) => phase.id === "verify")?.evidence?.join("\n") ?? "", /Verification plans generated/)
  assert.match(renderAppliedGoalEvidence(applied), /Applied Bundle Evidence/)

  const repeated = applyBundleEvidenceToGoal(applied.goal, report)
  assert.equal(repeated.applied.length, 0)
})

test("goal bundle audit verifies recorded phase evidence against bundle proof", () => {
  const bundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{ name: "CUSTOMERS", suggestedResource: "customers", dictionary: [{ id: "@ID" }], records: [{ id: "100", raw: "Alice" }] }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  })
  const goal = createModernizationGoal("Migrate customers", "Customers web slice works", "migrate")
  const report = createBundleEvidenceReport(bundle, createBundleArtifacts(bundle))
  const missing = auditGoalAgainstBundle(goal, report)
  assert.equal(missing.ready, false)
  assert.ok(missing.phases.some((phase) => phase.phase === "capture" && phase.missingEvidence.some((item) => item.includes("no evidence"))))

  const applied = applyBundleEvidenceToGoal(goal, report)
  const audited = auditGoalAgainstBundle(applied.goal, report)
  assert.equal(audited.ready, false)
  assert.ok(audited.phases.some((phase) => phase.phase === "capture" && phase.ready))
  assert.ok(audited.phases.some((phase) => phase.phase === "verify" && phase.bundleStatus === "missing"))
  const rendered = renderGoalBundleAudit(audited)
  assert.match(rendered, /D3 Goal Bundle Audit/)
  assert.match(rendered, /bundle-status: missing/)
  assert.match(rendered, /d3code webapp-smoke/)
})

test("goal verification reports missing evidence and readiness", () => {
  const goal = createModernizationGoal("Migrate order entry", "Order entry runs as a web slice", "migrate")
  const missing = verifyGoal(goal)
  assert.equal(missing.ready, false)
  assert.match(missing.summary, /active phase.*missing evidence/)

  const withEvidence = recordGoalEvidence(goal, "Bundle parsed and includes CUSTOMERS/BP")
  const advanced = advanceGoal(withEvidence, "capture complete")
  const report = verifyGoal(advanced)
  assert.equal(report.phases[0]?.ready, true)
  assert.equal(report.ready, false)
  assert.match(renderGoalVerification(advanced), /capture \(done\) evidence=1/)
})
