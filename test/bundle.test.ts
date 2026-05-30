import assert from "node:assert/strict"
import test from "node:test"
import { createD3AccessPlan, renderD3AccessPlan } from "../src/app/access-plan.js"
import { createModernizationBacklog, renderModernizationBacklog } from "../src/app/backlog.js"
import { createModernizationBrief } from "../src/app/brief.js"
import { bundleToIndex, createBundleArtifacts, parseBundle, validateBundleUris } from "../src/app/bundle.js"
import { createCodeModernizationPlan, renderCodeModernizationPlan } from "../src/app/code-plan.js"
import { createCompletionAuditReport, renderCompletionAuditReport } from "../src/app/completion-audit.js"
import { createBundleContextPack, renderBundleContextPack } from "../src/app/context-pack.js"
import { createBundleIdeReport, renderBundleIdeReport } from "../src/app/ide-report.js"
import { createDataValidationPlan, renderDataValidationPlan } from "../src/app/data-plan.js"
import { createBundleEvidenceReport, renderBundleEvidenceReport } from "../src/app/evidence.js"
import { createBundleExecutionPlan, renderBundleExecutionPlan } from "../src/app/execution-plan.js"
import { createErpMigrationBlueprint, renderErpMigrationBlueprint } from "../src/app/erp-migration.js"
import { createBundleAdr, createBundlePrd } from "../src/app/gsd-docs.js"
import { createIndexValidationPlan, renderIndexValidationPlan } from "../src/app/index-plan.js"
import { createLiveOperatorRunbook, renderLiveOperatorRunbook } from "../src/app/live-runbook.js"
import { createMigrationQaPlan, renderMigrationQaPlan } from "../src/app/qa-plan.js"
import type { MigrationQaEvidenceReport } from "../src/app/qa-evidence.js"
import { createMigrationReadinessReport, renderMigrationReadinessReport } from "../src/app/readiness.js"
import { createBundleReleaseReport, renderBundleReleaseReport } from "../src/app/release-report.js"
import { createD3ReconciliationPlan, renderD3ReconciliationPlan } from "../src/app/reconciliation-plan.js"
import { createSafetyGuardReport, renderSafetyGuardReport } from "../src/app/safety-guard.js"
import { createScreenModernizationPlan, renderScreenModernizationPlan } from "../src/app/screen-plan.js"
import { createBundleSkillManifest, createBundleSkillPack, renderBundleSkillPack } from "../src/app/skill-pack.js"
import { createBundleSubagentPlan, renderBundleSubagentPlan } from "../src/app/subagents.js"
import { createWebUiPlan, renderWebUiPlan } from "../src/app/ui-plan.js"
import type { D3CodeConfig } from "../src/config/config.js"

const bundle = parseBundle({
  account: "SALES",
  profile: "prod",
  files: [
    {
      name: "CUSTOMERS",
      suggestedResource: "customers",
      dictionary: [{ id: "@ID", type: "A", attribute: 0 }, { id: "NAME", type: "A", attribute: 1 }],
      records: [{ id: "100", raw: "Alice\u00feRetail" }],
      expectedIndexes: ["NAME"],
      observedIndexes: ["NAME"],
    },
  ],
  programs: [
    { file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nOPEN \"CUSTOMERS\" TO F ELSE STOP\nRETURN\n" },
  ],
})

test("bundle creates valid D3 index URIs", () => {
  validateBundleUris(bundle)
  const docs = bundleToIndex(bundle)
  assert.ok(docs.some((doc) => doc.uri === "d3://prod/SALES/BP/GET.CUSTOMER"))
  assert.ok(docs.some((doc) => doc.uri === "d3dict://prod/SALES/CUSTOMERS/__dictionary__"))
})

test("bundle creates audit, migration, openapi, adapter and index artifacts", () => {
  const artifacts = createBundleArtifacts(bundle)
  assert.equal(artifacts.audit.account, "SALES")
  assert.equal(artifacts.migrationPlan.resources[0]?.resource, "customers")
  assert.deepEqual(artifacts.migrationPlan.resources[0]?.fields?.map((field) => field.name), ["name"])
  assert.ok(artifacts.openapi.paths["/customers"])
  assert.match(JSON.stringify(artifacts.openapi.components.schemas.Customers), /x-d3-dictionary/)
  assert.ok(artifacts.adapters.some((file) => file.path.endsWith("customers.repository.ts")))
  assert.ok(artifacts.codeMap.programs.some((entry) => entry.program === "BP/GET.CUSTOMER"))
  assert.ok(artifacts.index.length >= 3)
})

test("bundle creates a human-readable modernization brief", () => {
  const artifacts = createBundleArtifacts(bundle)
  const brief = createModernizationBrief(bundle, artifacts)
  assert.match(brief, /D3 Modernization Brief: SALES/)
  assert.match(brief, /Resource Map/)
  assert.match(brief, /customers: D3 file CUSTOMERS/)
  assert.match(brief, /GSD Evidence To Record/)
})

test("bundle creates a prioritized modernization backlog", () => {
  const riskyBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "ORDERS",
      dictionary: [{ id: "AMOUNT", type: "A", attribute: 3 }],
      records: [{ id: "100", raw: "A\u00feB" }, { id: "101", raw: "A" }],
      expectedIndexes: ["CUSTOMER"],
      observedIndexes: [],
    }],
    programs: [{
      file: "BP",
      item: "UPDATE.ORDER",
      source: "SUBROUTINE UPDATE.ORDER(ID)\nOPEN \"ORDERS\" TO F ELSE STOP\nWRITE ID ON F,ID\nEXECUTE \"LIST ORDERS\"\nCALL MISSING.SUB\nRETURN\n",
    }],
  })
  const backlog = createModernizationBacklog(riskyBundle, createBundleArtifacts(riskyBundle))
  assert.ok(backlog.items.some((item) => item.title.includes("Validate D3 indexes")))
  assert.ok(backlog.items.some((item) => item.title.includes("Isolate TCL EXECUTE")))
  assert.ok(backlog.items.some((item) => item.title.includes("Resolve external CALL target")))
  assert.equal(backlog.items[0]?.priority, "P1")
  assert.match(renderModernizationBacklog(backlog), /D3 Modernization Backlog: SALES/)
  assert.match(renderModernizationBacklog(backlog), /Done when:/)
})

test("bundle creates a migration QA plan for D3, API, browser, and regression evidence", () => {
  const artifacts = createBundleArtifacts(bundle)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  assert.ok(qaPlan.checks.some((check) => check.surface === "d3" && check.command.includes("profile-doctor")))
  assert.ok(qaPlan.checks.some((check) => check.id === "webapp-smoke" && check.command.includes("webapp-smoke") && check.command.includes("--record")))
  assert.ok(qaPlan.checks.some((check) => check.surface === "api" && check.command.includes("/customers")))
  assert.ok(qaPlan.checks.some((check) => check.surface === "browser" && check.command.includes("localhost:3000")))
  assert.ok(qaPlan.checks.some((check) => check.surface === "regression" && check.command.includes("npm run regression")))
  assert.match(renderMigrationQaPlan(qaPlan), /D3 Migration QA Plan: SALES/)

  const runbook = createLiveOperatorRunbook(bundle, artifacts)
  assert.ok(runbook.phases.some((phase) => phase.id === "live-d3-proof" && phase.commands.some((command) => command.includes("live-proof"))))
  assert.ok(runbook.phases.some((phase) => phase.commands.some((command) => command.includes("live-proof-init") && command.includes("--screen-command"))))
  assert.ok(runbook.phases.some((phase) => phase.commands.some((command) => command.includes("live-proof-check ./live-proof"))))
  assert.ok(runbook.phases.some((phase) => phase.evidence.some((proof) => proof.includes("live-proof-manifest.json"))))
  assert.ok(runbook.phases.some((phase) => phase.id === "generated-qa-proof" && phase.commands.some((command) => command.includes("webapp-smoke"))))
  assert.match(renderLiveOperatorRunbook(runbook), /D3 Live Operator Runbook: SALES/)
  assert.match(renderLiveOperatorRunbook(runbook), /live-proof-manifest\.json/)
  assert.match(renderLiveOperatorRunbook(runbook), /profile-doctor/)
})

test("bundle creates an ordered GSD migration execution plan", () => {
  const artifacts = createBundleArtifacts(bundle)
  const plan = createBundleExecutionPlan(bundle, artifacts)
  assert.equal(plan.ready, false)
  assert.ok(plan.steps.some((step) => step.phase === "capture" && step.skills.includes("gsd-phases")))
  assert.ok(plan.steps.some((step) => step.phase === "audit" && step.subagents.includes("d3-data-mapper")))
  assert.ok(plan.steps.some((step) => step.phase === "api" && step.commands.some((command) => command.includes("webapp-smoke"))))
  assert.ok(plan.steps.some((step) => step.phase === "verify" && step.commands.some((command) => command.includes("bundle-reconciliation-plan"))))
  assert.ok(plan.steps.some((step) => step.phase === "verify" && step.commands.some((command) => command.includes("live-proof"))))
  assert.match(plan.nextCommand, /webapp-check|live-proof|bundle-artifacts|bundle-reconciliation-plan/)
  assert.match(renderBundleExecutionPlan(plan), /D3 Migration Execution Plan: SALES/)
  assert.match(renderBundleExecutionPlan(plan), /Skills: /)
})

test("bundle creates a D3 Code skill pack with modes, recipes, and evidence gates", () => {
  const artifacts = createBundleArtifacts(bundle)
  const pack = createBundleSkillPack(bundle, artifacts)
  assert.equal(pack.account, "SALES")
  assert.ok(pack.modes.some((mode) => mode.mode === "migrate" && mode.commands.some((command) => command.includes("bundle-artifacts"))))
  assert.ok(pack.modes.some((mode) => mode.mode === "gsd" && mode.skills.some((skill) => skill.id === "gsd-phases")))
  assert.ok(pack.evidenceGates.some((gate) => gate.id === "live-d3-proof"))
  assert.ok(pack.adaptedReferences.some((entry) => entry.source === "superpowers"))
  assert.ok(pack.outOfScopeReferences.some((entry) => entry.reference.includes("ios")))
  assert.match(renderBundleSkillPack(pack), /D3 Code Skill Pack: SALES/)
  assert.match(renderBundleSkillPack(pack), /Migration Mode/)
  assert.match(renderBundleSkillPack(pack), /bundle-artifacts/)
  const manifest = createBundleSkillManifest(bundle, artifacts)
  assert.equal(manifest.coverage.ready, true)
  assert.equal(manifest.referenceSkills.ready, true)
  assert.ok(manifest.bakedSkills.some((skill) => skill.id === "d3-database-audit"))
  assert.ok(manifest.skillPack.modes.some((mode) => mode.mode === "migrate"))
  assert.ok(manifest.phaseSkillMap.some((phase) => phase.phase === "api" && phase.skills.includes("rest-api-generation")))
  assert.ok(manifest.phaseSkillMap.some((phase) => phase.phase === "verify" && phase.commands.some((command) => command.includes("npm run regression"))))
})

test("bundle creates GSD-style PRD and ADR migration docs", () => {
  const artifacts = createBundleArtifacts(bundle)
  const prd = createBundlePrd(bundle, artifacts)
  assert.match(prd, /PRD: D3 SALES Web Migration/)
  assert.match(prd, /Acceptance Criteria/)
  assert.match(prd, /bundle-execution-plan/)
  assert.match(prd, /live-d3-proof/)

  const adr = createBundleAdr(bundle, artifacts)
  assert.match(adr, /ADR: Strangler REST Boundary For D3 SALES/)
  assert.match(adr, /Status: Proposed/)
  assert.match(adr, /customers -> CUSTOMERS/)
  assert.match(adr, /D3 remains the source of truth/)
})

test("bundle creates an index validation plan from captured D3 index evidence", () => {
  const riskyBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "ORDERS",
      suggestedResource: "orders",
      dictionary: [{ id: "@ID", attribute: 0 }, { id: "CUSTOMER", attribute: 1 }, { id: "DATE", attribute: 2 }],
      records: [{ id: "100", raw: "C100\u00fe2026-01-01" }],
      expectedIndexes: ["CUSTOMER"],
      observedIndexes: [],
    }],
    programs: [],
  })
  const plan = createIndexValidationPlan(riskyBundle, createBundleArtifacts(riskyBundle))
  assert.ok(plan.items.some((entry) => entry.status === "missing" && entry.index === "CUSTOMER"))
  assert.ok(plan.items.some((entry) => entry.status === "review" && entry.index === "DATE"))
  assert.match(renderIndexValidationPlan(plan), /D3 Index Validation Plan: SALES/)
  assert.match(renderIndexValidationPlan(plan), /LIST-INDEX ORDERS/)
})

test("bundle creates a data validation plan for dictionary and shape migration risks", () => {
  const riskyBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "ORDERS",
      suggestedResource: "orders",
      dictionary: [{ id: "AMOUNT", attribute: 1, type: "A" }, { id: "TAGS", attribute: 2, type: "A", raw: "TAGS]A" }],
      records: [{ id: "100", raw: "10\u00feA\u00fdB" }, { id: "101", raw: "20" }],
    }],
    programs: [],
  })
  const plan = createDataValidationPlan(riskyBundle, createBundleArtifacts(riskyBundle))
  assert.ok(plan.items.some((entry) => entry.subject === "record-shape" && entry.status === "warning"))
  assert.ok(plan.items.some((entry) => entry.subject === "api-field:tags"))
  assert.ok(plan.items.some((entry) => entry.subject === "api-field:amount"))
  assert.match(renderDataValidationPlan(plan), /D3 Data Validation Plan: SALES/)
})

test("bundle creates a BASIC modernization plan from code-map risks", () => {
  const riskyBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "ORDERS",
      suggestedResource: "orders",
      dictionary: [{ id: "AMOUNT", attribute: 1, type: "A" }],
      records: [{ id: "100", raw: "10" }],
    }],
    programs: [{
      file: "BP",
      item: "UPDATE.ORDER",
      source: "SUBROUTINE UPDATE.ORDER(ID)\nOPEN \"ORDERS\" TO F ELSE STOP\nWRITE ID ON F,ID\nEXECUTE \"LIST ORDERS\"\nCALL MISSING.SUB\nRETURN\n",
    }],
  })
  const plan = createCodeModernizationPlan(riskyBundle, createBundleArtifacts(riskyBundle))
  assert.ok(plan.items.some((entry) => entry.subject === "write-policy"))
  assert.ok(plan.items.some((entry) => entry.subject === "execute-isolation"))
  assert.ok(plan.items.some((entry) => entry.subject === "unresolved-call:MISSING.SUB"))
  assert.ok(plan.items.some((entry) => entry.subject === "compile-catalog-proof"))
  assert.ok(plan.items.some((entry) => entry.doneWhen.some((criterion) => criterion.includes("Compile output"))))
  assert.match(renderCodeModernizationPlan(plan), /D3 BASIC Modernization Plan: SALES/)
})

test("bundle creates a screen modernization plan from legacy BASIC screen evidence", () => {
  const screenBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{ name: "ORDERS", dictionary: [{ id: "@ID", attribute: 0 }], records: [] }],
    programs: [{
      file: "BP",
      item: "ORDER.SCREEN",
      source: "SUBROUTINE ORDER.SCREEN()\nCRT @(-1):@(5,2):\"Order\"\nINPUT ORDER.ID\nCALL SCREEN.DISPLAY(ORDER.ID)\nRETURN\n",
    }],
  })
  const plan = createScreenModernizationPlan(screenBundle)
  assert.equal(plan.items[0]?.program, "BP/ORDER.SCREEN")
  assert.equal(plan.items[0]?.priority, "P1")
  assert.equal(plan.items[0]?.risk, "high")
  assert.ok(plan.items[0]?.operations.some((operation) => operation.kind === "clear"))
  assert.ok(plan.items[0]?.operations.some((operation) => operation.kind === "input"))
  assert.ok(plan.items[0]?.commands.some((command) => command.includes("screen-parse")))
  assert.match(renderScreenModernizationPlan(plan), /D3 Screen Modernization Plan: SALES/)
  assert.match(renderScreenModernizationPlan(plan), /Every INPUT operation/)

  const artifacts = createBundleArtifacts(screenBundle)
  const readiness = createMigrationReadinessReport(screenBundle, artifacts)
  assert.ok(readiness.gates.some((entry) => entry.id === "legacy-screen-modernization" && entry.status === "warning"))
  assert.match(renderMigrationReadinessReport(readiness), /terminal-capture/)

  const completion = createCompletionAuditReport(screenBundle, artifacts)
  assert.ok(completion.requirements.some((entry) => entry.id === "legacy-screen-modernization" && entry.status === "partial"))
  assert.match(renderCompletionAuditReport(completion), /ORDER\.SCREEN:screen-risk:high/)

  const execution = createBundleExecutionPlan(screenBundle, artifacts)
  assert.ok(execution.steps.some((step) => step.phase === "audit" && step.status === "review" && step.evidence.some((entry) => entry === "screen-risks:1")))
  assert.match(renderBundleExecutionPlan(execution), /bundle-screen-plan/)
})

test("bundle creates a migration readiness report with proof gates", () => {
  const artifacts = createBundleArtifacts(bundle)
  const report = createMigrationReadinessReport(bundle, artifacts, {
    root: "/tmp/migration-output",
    ready: true,
    items: [
      { id: "health-route", status: "ok", message: "health route is present" },
      { id: "d3code-skill-pack", status: "ok", message: "d3code-skill-pack.json exists" },
      { id: "d3code-skill-pack-modes", status: "ok", message: "modes:plan,gsd,migrate" },
      { id: "d3code-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
      { id: "d3code-reference-skill-audit-decisions", status: "ok", message: "reference skill decisions exist" },
      { id: "public-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
    ],
  })
  assert.equal(report.ready, false)
  assert.ok(report.gates.some((entry) => entry.id === "live-d3-proof" && entry.status === "missing"))
  assert.ok(report.gates.some((entry) => entry.id === "webapp-scaffold" && entry.status === "ok"))
  assert.ok(report.gates.some((entry) => entry.id === "baked-skill-pack" && entry.status === "ok"))
  assert.ok(report.gates.find((entry) => entry.id === "baked-skill-pack")?.evidence.some((entry) => entry === "d3code-reference-skill-audit-ready:ok"))
  assert.ok(report.gates.some((entry) => entry.id === "qa-evidence" && entry.status === "missing"))
  assert.ok(report.gates.some((entry) => entry.id === "legacy-screen-modernization" && entry.status === "ok"))
  assert.ok(report.gates.some((entry) => entry.id === "cutover-reconciliation" && entry.status === "warning"))
  assert.match(renderMigrationReadinessReport(report), /D3 Migration Readiness Report: SALES/)
  assert.match(renderMigrationReadinessReport(report), /webapp-smoke/)
})

test("bundle readiness consumes recorded QA evidence", () => {
  const artifacts = createBundleArtifacts(bundle)
  const qaEvidence: MigrationQaEvidenceReport = {
    ready: true,
    source: "webapp-smoke",
    checks: [
      { id: "typescript-build", status: "ok", message: "generated TypeScript compiled", evidence: ["root:/tmp/migration-output"] },
      { id: "api-smoke-tests", status: "ok", message: "ran generated smoke tests", evidence: ["root:/tmp/migration-output"] },
    ],
  }
  const report = createMigrationReadinessReport(bundle, artifacts, {
    root: "/tmp/migration-output",
    ready: true,
    items: [
      { id: "health-route", status: "ok", message: "health route is present" },
      { id: "d3code-skill-pack", status: "ok", message: "d3code-skill-pack.json exists" },
      { id: "d3code-skill-pack-modes", status: "ok", message: "modes:plan,gsd,migrate" },
      { id: "d3code-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
      { id: "d3code-reference-skill-audit-decisions", status: "ok", message: "reference skill decisions exist" },
      { id: "public-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
    ],
  }, qaEvidence)
  assert.ok(report.gates.some((entry) => entry.id === "qa-evidence" && entry.status === "ok"))
  assert.match(renderMigrationReadinessReport(report), /qa-evidence/)
  assert.match(renderMigrationReadinessReport(report), /api-smoke-tests:ok/)
})

test("bundle creates a subagent task plan from D3 evidence", () => {
  const riskyBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "ORDERS",
      suggestedResource: "orders",
      dictionary: [{ id: "AMOUNT", attribute: 1, type: "A" }],
      records: [{ id: "100", raw: "10\u00feA" }, { id: "101", raw: "20" }],
      expectedIndexes: ["CUSTOMER"],
      observedIndexes: [],
    }],
    programs: [{
      file: "BP",
      item: "UPDATE.ORDER",
      source: "SUBROUTINE UPDATE.ORDER(ID)\nOPEN \"ORDERS\" TO F ELSE STOP\nWRITE ID ON F,ID\nEXECUTE \"LIST ORDERS\"\nRETURN\n",
    }],
  })
  const plan = createBundleSubagentPlan(riskyBundle, createBundleArtifacts(riskyBundle))
  assert.ok(plan.tasks.some((entry) => entry.agent === "d3-architect"))
  assert.ok(plan.tasks.some((entry) => entry.agent === "d3-data-mapper" && entry.bundleEvidence.some((evidence) => evidence.includes("index-non-ok"))))
  assert.ok(plan.tasks.some((entry) => entry.agent === "d3-basic-modernizer"))
  assert.ok(plan.tasks.some((entry) => entry.agent === "d3-test-runner"))
  assert.match(renderBundleSubagentPlan(plan), /D3 Bundle Subagent Plan: SALES/)
})

test("bundle creates a GSD completion audit with proof and gaps", () => {
  const report = createCompletionAuditReport(bundle, createBundleArtifacts(bundle))
  assert.equal(report.complete, false)
  assert.ok(report.requirements.some((entry) => entry.id === "skills-baked" && entry.status === "partial"))
  assert.ok(report.requirements.some((entry) => entry.id === "executable-agent-loops" && entry.status === "proven"))
  assert.ok(report.requirements.some((entry) => entry.id === "live-d3-and-qa-proof" && entry.status === "missing"))
  assert.ok(report.requirements.some((entry) => entry.id === "legacy-screen-modernization" && entry.status === "proven"))
  assert.ok(report.requirements.some((entry) => entry.id === "cutover-reconciliation" && entry.status === "partial"))
  assert.ok(report.requirements.some((entry) => entry.id === "migration-mode"))
  assert.match(renderCompletionAuditReport(report), /D3 Goal Completion Audit: SALES/)
  assert.match(renderCompletionAuditReport(report), /agent-run migration-slice/)
  assert.match(renderCompletionAuditReport(report), /webapp-smoke/)
  assert.match(renderCompletionAuditReport(report), /Requirement:/)
})

test("completion audit consumes recorded QA evidence from artifacts", () => {
  const artifacts = createBundleArtifacts(bundle)
  const qaEvidence: MigrationQaEvidenceReport = {
    ready: true,
    source: "webapp-smoke",
    checks: [
      { id: "typescript-build", status: "ok", message: "generated TypeScript compiled", evidence: ["root:/tmp/migration-output"] },
      { id: "api-smoke-tests", status: "ok", message: "ran generated smoke tests", evidence: ["root:/tmp/migration-output"] },
    ],
  }
  const report = createCompletionAuditReport(bundle, artifacts, {
    root: "/tmp/migration-output",
    ready: true,
    items: [{ id: "health-route", status: "ok", message: "health route is present" }],
  }, qaEvidence)
  assert.equal(report.complete, false)
  assert.ok(report.requirements.some((entry) => entry.id === "live-d3-and-qa-proof" && entry.status === "partial"))
  assert.match(renderCompletionAuditReport(report), /qa-evidence:ok/)
  assert.match(renderCompletionAuditReport(report), /live-d3-proof:missing/)
  assert.match(renderCompletionAuditReport(report), /--artifacts-dir/)
})

test("bundle creates a ship and canary release report", () => {
  const artifacts = createBundleArtifacts(bundle)
  const blocked = createBundleReleaseReport(bundle, artifacts)
  assert.equal(blocked.decision, "blocked")
  assert.ok(blocked.blockers.some((blocker) => blocker.includes("live-d3-proof")))
  assert.match(renderBundleReleaseReport(blocked), /D3 Migration Release Report: SALES/)
  assert.match(renderBundleReleaseReport(blocked), /Rollback/)

  const qaEvidence: MigrationQaEvidenceReport = {
    ready: true,
    source: "webapp-smoke",
    checks: [
      { id: "typescript-build", status: "ok", message: "generated TypeScript compiled", evidence: ["root:/tmp/migration-output"] },
      { id: "api-smoke-tests", status: "ok", message: "ran generated smoke tests", evidence: ["root:/tmp/migration-output"] },
    ],
  }
  const canary = createBundleReleaseReport(bundle, artifacts, {
    root: "/tmp/migration-output",
    ready: true,
    items: [{ id: "health-route", status: "ok", message: "health route is present" }],
  }, qaEvidence)
  assert.equal(canary.decision, "canary")
  assert.ok(canary.canaryScope.some((scope) => scope.includes("read-only")))
})

test("bundle creates ERP migration, D3 estate IDE, safety, and context reports", () => {
  const erpBundle = parseBundle({
    account: "SALES",
    profile: "prod",
    users: [{ id: "paul", name: "Paul", roles: ["admin"] }],
    files: [
      {
        name: "CUSTOMERS",
        suggestedResource: "customers",
        dictionary: [
          { id: "@ID", type: "A", attribute: 0 },
          { id: "NAME", type: "A", attribute: 1 },
          { id: "PHONE.NOS", type: "A", attribute: 3, raw: "A]3" },
          { id: "PHONE.NOS.COPY", type: "A", attribute: 4 },
        ],
        records: [{ id: "100", raw: "Alice\u00feRetail\u00fe111\u00fd222" }],
        expectedIndexes: ["NAME"],
        observedIndexes: ["NAME"],
      },
    ],
    programs: [
      { file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nOPEN \"CUSTOMERS\" TO F ELSE STOP\nEXECUTE \"CLEAR-FILE TEMP.WORK\"\nRETURN\n" },
    ],
  })
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "prod",
    profiles: [{ name: "prod", type: "local", account: "SALES", allowedAccounts: ["SALES"] }],
    modelSecrets: {},
  }
  const artifacts = createBundleArtifacts(erpBundle)
  const blueprint = createErpMigrationBlueprint(erpBundle, artifacts)
  assert.ok(blueprint.tables[0]?.childTables.some((table) => table.includes("phone")))
  assert.ok(blueprint.screens.some((screen) => screen.layout === "master-detail"))
  assert.match(renderErpMigrationBlueprint(blueprint), /D3 ERP Migration Blueprint: SALES/)
  assert.match(renderErpMigrationBlueprint(blueprint), /Target Data Model/)

  const uiPlan = createWebUiPlan(erpBundle, artifacts)
  assert.ok(uiPlan.screens.some((screen) => screen.layout === "master-detail"))
  assert.ok(uiPlan.screens.some((screen) => screen.fields.some((field) => field.kind === "multivalue")))
  assert.match(renderWebUiPlan(uiPlan), /D3 Web UI Plan: SALES/)

  const reconciliation = createD3ReconciliationPlan(erpBundle, artifacts, "warehouse")
  assert.ok(reconciliation.checks.some((check) => check.id === "row-count:CUSTOMERS"))
  assert.ok(reconciliation.checks.some((check) => check.id.includes("sample-compare:CUSTOMERS")))
  assert.ok(reconciliation.checks.some((check) => check.id.includes("multivalue-order")))
  assert.ok(reconciliation.stages.some((stage) => stage.id === "rollback"))
  assert.match(renderD3ReconciliationPlan(reconciliation), /D3 Cutover Reconciliation Plan: SALES/)

  const access = createD3AccessPlan(erpBundle, artifacts)
  assert.ok(access.users.some((user) => user.id === "paul" && user.status === "ready"))
  assert.ok(access.grants.some((grant) => grant.user === "paul" && grant.access === "admin-review"))
  assert.ok(access.warnings.some((warning) => warning.includes("Write/admin grants")))
  assert.match(renderD3AccessPlan(access), /D3 Access Plan: SALES/)

  const IDE = createBundleIdeReport(erpBundle, artifacts)
  assert.ok(IDE.nodes.some((node) => node.kind === "user"))
  assert.ok(IDE.nodes.some((node) => node.kind === "dictionary"))
  assert.ok(IDE.nodes.some((node) => node.kind === "data-model"))
  assert.ok(IDE.edges.some((edge) => edge.label === "logical D3 view"))
  assert.ok(IDE.panels.some((panel) => panel.id === "access" && panel.items.some((item) => item.includes("grants="))))
  assert.ok(IDE.panels.some((panel) => panel.id === "risks"))
  assert.ok(IDE.panels.some((panel) => panel.id === "model" && panel.title === "D3 Logical Model"))
  assert.ok(IDE.nextCommands.some((command) => command.includes("terminal-capture")))
  assert.ok(!IDE.nextCommands.some((command) => command.includes("bundle-erp-plan")))
  assert.match(renderBundleIdeReport(IDE), /D3 IDE: SALES/)

  const guard = createSafetyGuardReport(config, { safety: "ask", profile: "prod", bundle: erpBundle })
  assert.equal(guard.ready, false)
  assert.ok(guard.commands.some((command) => command.command.includes("CLEAR-FILE") && command.action === "ask"))
  assert.match(renderSafetyGuardReport(guard), /D3 Safety Guard/)

  const contextPack = createBundleContextPack(config, erpBundle, artifacts, { model: "openai/gpt-5", safety: "ask", mode: "migrate", profile: "prod" })
  assert.equal(contextPack.state.safetyGuard, "needs-confirmation")
  assert.equal(contextPack.state.bakedSkills, "needs-proof")
  assert.ok(contextPack.nextCommands.some((command) => command.includes("reference-audit")))
  assert.ok(contextPack.subagentQueue.length > 0)
  assert.match(renderBundleContextPack(contextPack), /D3 Context Pack: SALES/)
  assert.match(renderBundleContextPack(contextPack), /baked skills: needs-proof/)

  const contextPackWithSkills = createBundleContextPack(config, erpBundle, artifacts, { model: "openai/gpt-5", safety: "ask", mode: "migrate", profile: "prod" }, {
    root: "/tmp/migration-output",
    ready: true,
    items: [
      { id: "health-route", status: "ok", message: "health route is present" },
      { id: "d3code-skill-pack", status: "ok", message: "d3code-skill-pack.json exists" },
      { id: "d3code-skill-pack-modes", status: "ok", message: "modes:plan,gsd,migrate" },
      { id: "d3code-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
      { id: "d3code-reference-skill-audit-decisions", status: "ok", message: "reference skill decisions exist" },
      { id: "public-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
    ],
  })
  assert.equal(contextPackWithSkills.state.bakedSkills, "ready")
  assert.match(renderBundleContextPack(contextPackWithSkills), /d3code-reference-skill-audit-ready:ok/)
})

test("bundle creates phase-specific goal evidence suggestions", () => {
  const report = createBundleEvidenceReport(bundle, createBundleArtifacts(bundle))
  assert.ok(report.items.some((entry) => entry.phase === "capture" && entry.status === "recorded"))
  assert.ok(report.items.some((entry) => entry.phase === "verify" && entry.status === "missing"))
  assert.match(renderBundleEvidenceReport(report), /D3 Bundle Goal Evidence: SALES/)
  assert.match(renderBundleEvidenceReport(report), /webapp-smoke/)
})

test("bundle evidence includes artifact QA proof when supplied", () => {
  const artifacts = createBundleArtifacts(bundle)
  const qaEvidence: MigrationQaEvidenceReport = {
    ready: true,
    source: "webapp-smoke",
    checks: [
      { id: "typescript-build", status: "ok", message: "generated TypeScript compiled", evidence: ["root:/tmp/migration-output"] },
      { id: "api-smoke-tests", status: "ok", message: "ran generated smoke tests", evidence: ["root:/tmp/migration-output"] },
    ],
  }
  const report = createBundleEvidenceReport(bundle, artifacts, {
    root: "/tmp/migration-output",
    ready: true,
    items: [
      { id: "health-route", status: "ok", message: "health route is present" },
      { id: "d3code-skill-pack", status: "ok", message: "d3code-skill-pack.json exists" },
      { id: "d3code-skill-pack-modes", status: "ok", message: "modes:plan,gsd,migrate" },
      { id: "d3code-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
      { id: "d3code-reference-skill-audit-decisions", status: "ok", message: "reference skill decisions exist" },
      { id: "public-reference-skill-audit-ready", status: "ok", message: "mapped:88/88" },
    ],
  }, qaEvidence)
  const api = report.items.find((entry) => entry.phase === "api")
  assert.equal(api?.status, "recorded")
  assert.match(api?.evidence ?? "", /baked-skills=ok/)
  assert.match(api?.evidence ?? "", /d3code-reference-skill-audit-ready:ok/)
  const verify = report.items.find((entry) => entry.phase === "verify")
  assert.match(verify?.evidence ?? "", /qa-evidence=ready/)
  assert.match(renderBundleEvidenceReport(report), /qa-evidence=ready/)
  assert.match(renderBundleEvidenceReport(report), /baked-skills=ok/)
})
