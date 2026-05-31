import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

async function cli(args: string[]) {
  return execFileAsync("node", ["dist/src/cli.js", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: join(tmpdir(), `d3code-test-${Date.now()}`) },
  })
}

test("CLI lists baked-in modes and skills", async () => {
  const modes = await cli(["modes"])
  assert.match(modes.stdout, /migrate/)
  assert.match(modes.stdout, /audit/)

  const skills = await cli(["skills"])
  assert.match(skills.stdout, /d3-database-audit/)
  assert.match(skills.stdout, /rest-api-generation/)
  const skillsJson = await cli(["skills", "--json"])
  const parsedSkills = JSON.parse(skillsJson.stdout) as Array<{ id: string; source: string }>
  assert.ok(parsedSkills.some((skill) => skill.id === "d3-database-audit" && skill.source === "d3code"))

  const coverage = await cli(["skill-coverage"])
  assert.match(coverage.stdout, /Ready: yes/)
  assert.match(coverage.stdout, /bundle-brief/)
  const coverageJson = await cli(["skill-coverage", "--json"])
  const parsedCoverage = JSON.parse(coverageJson.stdout) as { ready: boolean; items: Array<{ source: string; covered: boolean; evidence: string[] }> }
  assert.equal(parsedCoverage.ready, true)
  assert.ok(parsedCoverage.items.some((item) => item.source === "gsd" && item.covered && item.evidence.includes("command:goal-verify")))

  const referenceSkills = await cli(["reference-skills"])
  assert.match(referenceSkills.stdout, /Reference Skill Map/)
  assert.match(referenceSkills.stdout, /gstack-review/)
  assert.match(referenceSkills.stdout, /out-of-scope/)
  const referenceSkillsJson = await cli(["reference-skills", "--json"])
  const parsedReferenceSkills = JSON.parse(referenceSkillsJson.stdout) as { ready: boolean; families: Array<{ source: string; status: string; productSurfaces: string[] }> }
  assert.equal(parsedReferenceSkills.ready, true)
  assert.ok(parsedReferenceSkills.families.some((family) => family.source === "gstack" && family.status === "out-of-scope"))

  const referenceAudit = await cli(["reference-audit", "reference"])
  assert.match(referenceAudit.stdout, /Reference Skill Audit/)
  assert.match(referenceAudit.stdout, /Ready: yes/)
  assert.match(referenceAudit.stdout, /Unmapped: 0/)

  const readiness = await cli(["readiness"])
  assert.match(readiness.stdout, /D3 Code Readiness/)
  assert.match(readiness.stdout, /Ready: no/)
  assert.match(readiness.stdout, /D3 Profile/)

  const status = await cli(["status", "--mode", "migrate"])
  assert.match(status.stdout, /D3 Code IDE Status/)
  assert.match(status.stdout, /Mode: migrate/)
  assert.match(status.stdout, /Next Commands/)

  const terminalPlan = await cli(["terminal-plan"])
  assert.match(terminalPlan.stdout, /D3 Terminal Bridge Plan/)
  assert.match(terminalPlan.stdout, /UOPY/)

  const ideTerminal = await cli(["ide-terminal"])
  assert.match(ideTerminal.stdout, /D3 IDE Terminal Contract/)
  assert.match(ideTerminal.stdout, /PowerTerm/)

  const connectorStrategy = await cli(["connector-strategy"])
  assert.match(connectorStrategy.stdout, /D3 Connector Strategy/)
  assert.match(connectorStrategy.stdout, /persistent PTY/)
  assert.match(connectorStrategy.stdout, /UOPY/)

  const installProof = await cli(["install-proof"])
  assert.match(installProof.stdout, /D3 Code Install Proof/)
  assert.match(installProof.stdout, /Ready: yes/)
  assert.match(installProof.stdout, /d3code-help/)
  assert.match(installProof.stdout, /interactive-default-launch/)
  assert.match(installProof.stdout, /ink-app-render:yes/)

  const productAudit = await cli(["product-audit", "--allow-incomplete"])
  assert.match(productAudit.stdout, /D3 Code Product Completion Audit/)
  assert.match(productAudit.stdout, /reference-skills-baked/)
  assert.match(productAudit.stdout, /live-d3-proof/)

  const liveProofDir = await mkdtemp(join(tmpdir(), "d3code-cli-live-proof-"))
  await writeFile(join(liveProofDir, "live-proof-manifest.json"), JSON.stringify({ profile: "prod", account: "SALES", screenCommand: "RUN BP MENU", basicFile: "BP", basicItem: "TEST", requiredArtifacts: ["profile-doctor.json", "terminal-capture.json", "screen-buffer.json", "operator-notes.md", "compile-catalog-transcript.txt", "rollback.md"], safety: { terminalSends: "blocked-until-D3CODE_TERMINAL_ENABLED", mutations: "blocked-until-D3CODE_ALLOW_WRITES", transcriptRecording: "redacted-unless-D3CODE_TERMINAL_RECORD_TRANSCRIPT" } }))
  await writeFile(join(liveProofDir, "profile-doctor.json"), JSON.stringify({ profile: "prod", type: "local", account: "SALES", sessionMode: "persistent", ready: true, checks: [{ name: "who", command: "WHO", ok: true, exitCode: 0, durationMs: 1, output: "SALES" }, { name: "version", command: "VERSION", ok: true, exitCode: 0, durationMs: 1, output: "D3 10.3" }, { name: "md-list", command: "LIST MD (N", ok: true, exitCode: 0, durationMs: 1, output: "MD" }] }))
  await writeFile(join(liveProofDir, "terminal-transcript.txt"), "@(-1)MENU")
  await writeFile(join(liveProofDir, "screen-buffer.json"), JSON.stringify({ width: 24, height: 6, row: 0, col: 4, events: [{ type: "text", value: "M", row: 0, col: 0 }], lines: ["MENU"] }))
  await writeFile(join(liveProofDir, "terminal-capture.json"), JSON.stringify({ profile: "prod", account: "SALES", command: "RUN BP MENU", risk: "read", result: { stdout: "@(-1)MENU", stderr: "", exitCode: 0, durationMs: 1 }, screen: { width: 24, height: 6, row: 0, col: 4, events: [{ type: "text", value: "M", row: 0, col: 0 }], lines: ["MENU"] } }))
  await writeFile(join(liveProofDir, "operator-notes.md"), "D3 operator verified and approved parity.\n")
  await writeFile(join(liveProofDir, "compile-catalog-transcript.txt"), "BASIC BP TEST\nBASIC OK\nCATALOG BP TEST\nCATALOG OK\n")
  await writeFile(join(liveProofDir, "rollback.md"), "Rollback: restore before backup for disposable TEST.\n")
  const liveProofCheck = await cli(["live-proof-check", liveProofDir])
  assert.match(liveProofCheck.stdout, /D3 Live Proof Artifact Check/)
  assert.match(liveProofCheck.stdout, /Ready: yes/)
  assert.match(liveProofCheck.stdout, /manifest/)
  const liveProofScaffoldDir = join(liveProofDir, "scaffold")
  const liveProofInit = await cli(["live-proof-init", liveProofScaffoldDir, "--profile", "prod", "--account", "SALES", "--basic-file", "BP", "--basic-item", "TEST"])
  assert.match(liveProofInit.stdout, /D3 Live Proof Scaffold/)
  assert.match(await readFile(join(liveProofScaffoldDir, "live-proof-manifest.json"), "utf8"), /TEST/)
  assert.match(await readFile(join(liveProofScaffoldDir, "README.md"), "utf8"), /profile-doctor/)

  const screenDir = await mkdtemp(join(tmpdir(), "d3code-screen-"))
  const screenFile = join(screenDir, "screen.txt")
  await writeFile(screenFile, "@(-1)MENU@(5,2)Choice:")
  const screen = await cli(["screen-parse", screenFile, "--width", "24", "--height", "6"])
  assert.match(screen.stdout, /D3 Screen Buffer/)
  assert.match(screen.stdout, /Choice:/)

  const routing = await cli(["model-routing", "migrate", "--bias", "speed"])
  assert.match(routing.stdout, /D3 Model Routing Plan: migrate/)
  assert.match(routing.stdout, /web\/API scaffold implementer/)

  const routingJson = await cli(["model-routing", "audit", "--bias", "ollama", "--json"])
  const parsedRouting = JSON.parse(routingJson.stdout) as { routes: Array<{ recommended: string }> }
  assert.ok(parsedRouting.routes.every((route) => route.recommended === "ollama/llama3.1"))
})

test("CLI runs mock end-to-end acceptance", async () => {
  const result = await cli(["acceptance"])
  assert.match(result.stdout, /D3 Code Mock Acceptance/)
  assert.match(result.stdout, /Ready: yes/)
  assert.match(result.stdout, /profile-doctor/)
  assert.match(result.stdout, /webapp-check/)

  const json = await cli(["acceptance", "--json"])
  const parsed = JSON.parse(json.stdout) as { ready: boolean; steps: Array<{ id: string; ok: boolean }> }
  assert.equal(parsed.ready, true)
  assert.ok(parsed.steps.some((step) => step.id === "completion-audit" && step.ok))
})

test("CLI creates migration plan from JSON fixture", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-migration-"))
  const fixture = join(dir, "migration.json")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    users: [{ id: "ops", roles: ["operator"] }],
    files: [{ file: "ORDERS", suggestedResource: "orders" }],
    programs: [{ file: "BP", item: "GET.ORDER", source: "SUBROUTINE GET.ORDER(ID)\nOPEN \"ORDERS\" TO F ELSE STOP\nRETURN\n" }],
  }))
  const result = await cli(["migration-plan", fixture])
  const parsed = JSON.parse(result.stdout) as { resources: Array<{ resource: string }>; phases: string[] }
  assert.equal(parsed.resources[0]?.resource, "orders")
  assert.ok(parsed.phases.length >= 5)
})

test("CLI generates OpenAPI from migration plan", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-openapi-"))
  const fixture = join(dir, "plan.json")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    strategy: "strangler",
    resources: [{ file: "CUSTOMERS", resource: "customers", endpoints: [] }],
    services: [],
    phases: [],
    risks: [],
  }))
  const result = await cli(["openapi", fixture])
  const parsed = JSON.parse(result.stdout) as { openapi: string; paths: Record<string, unknown> }
  assert.equal(parsed.openapi, "3.1.0")
  assert.ok(parsed.paths["/customers/{id}"])
})

test("CLI generates adapter skeleton from migration plan", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-adapter-"))
  const fixture = join(dir, "plan.json")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    strategy: "strangler",
    resources: [{ file: "CUSTOMERS", resource: "customers", endpoints: [] }],
    services: [],
    phases: [],
    risks: [],
  }))
  const result = await cli(["adapter-skeleton", fixture])
  const parsed = JSON.parse(result.stdout) as Array<{ path: string; content: string }>
  assert.ok(parsed.some((file) => file.path === "src/customers/customers.repository.ts"))
  assert.ok(parsed.some((file) => file.content.includes("D3CustomersRepository")))
})

test("CLI generates web app scaffold from migration plan", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-webapp-"))
  const fixture = join(dir, "plan.json")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    strategy: "strangler",
    resources: [{ file: "CUSTOMERS", resource: "customers", endpoints: [] }],
    services: [],
    phases: [],
    risks: [],
  }))
  const result = await cli(["webapp-skeleton", fixture])
  const parsed = JSON.parse(result.stdout) as Array<{ path: string; content: string }>
  assert.ok(parsed.some((file) => file.path === "src/server.ts" && file.content.includes("createServer")))
  assert.ok(parsed.some((file) => file.path === "package.json"))
  assert.ok(parsed.some((file) => file.path === "test/api-smoke.test.mjs" && file.content.includes("D3CODE_MOCK")))
})

test("CLI writes adapter skeleton files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-adapter-write-"))
  const fixture = join(dir, "plan.json")
  const out = join(dir, "out")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    strategy: "strangler",
    resources: [{ file: "CUSTOMERS", resource: "customers", endpoints: [] }],
    services: [],
    phases: [],
    risks: [],
  }))
  const result = await cli(["adapter-write", fixture, "--out", out])
  const parsed = JSON.parse(result.stdout) as { written: string[] }
  assert.ok(parsed.written.some((file) => file.endsWith("src/customers/customers.repository.ts")))
})

test("CLI renders baked workflow", async () => {
  const result = await cli(["workflow", "migrate"])
  assert.match(result.stdout, /D3-to-Web Migration Workflow/)
  assert.match(result.stdout, /Baked Skills/)
})

test("CLI renders baked runbooks and skill info", async () => {
  const runbook = await cli(["runbook", "migrate"])
  assert.match(runbook.stdout, /Migration Mode Runbook/)
  assert.match(runbook.stdout, /Evidence Gate/)

  const skill = await cli(["skill-info", "verification-before-completion"])
  assert.match(skill.stdout, /Source: superpowers/)
  assert.match(skill.stdout, /Baked Behavior/)

  const delegation = await cli(["delegate", "migrate"])
  assert.match(delegation.stdout, /Migration Mode Delegation Plan/)
  assert.match(delegation.stdout, /d3-data-mapper/)

  const promptPack = await cli(["delegate-prompts", "migrate"])
  assert.match(promptPack.stdout, /Migration Mode Delegation Plan Prompt Pack/)
  assert.match(promptPack.stdout, /Allowed tools:/)
  assert.match(promptPack.stdout, /Denied actions:/)

  const promptPackJson = await cli(["delegate-prompts", "migrate", "--json"])
  const parsedPromptPack = JSON.parse(promptPackJson.stdout) as { specs: Array<{ agent: string; allowedTools: string[] }> }
  assert.ok(parsedPromptPack.specs.some((spec) => spec.agent === "d3-test-runner" && spec.allowedTools.includes("d3_compile_basic")))
})

test("CLI renders baked recipes", async () => {
  const list = await cli(["recipes"])
  assert.match(list.stdout, /migrate/)
  const recipe = await cli(["recipe", "migrate"])
  assert.match(recipe.stdout, /D3-to-Web Migration Recipe/)
  assert.match(recipe.stdout, /connector-strategy/)
  assert.match(recipe.stdout, /terminal-capture/)
  assert.match(recipe.stdout, /adapter-write/)
})

test("CLI audits database samples", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-audit-db-"))
  const fixture = join(dir, "db.json")
  await writeFile(fixture, JSON.stringify([
    {
      file: "CUSTOMERS",
      dictionary: [{ id: "NAME", type: "A", attribute: 1 }],
      records: [{ id: "1", raw: "Alice" }],
      expectedIndexes: ["NAME"],
      observedIndexes: [],
    },
  ]))
  const result = await cli(["audit-db", fixture])
  const parsed = JSON.parse(result.stdout) as { files: Array<{ dictionaryFindings: unknown[]; indexFindings: Array<{ message: string }> }> }
  assert.ok(parsed.files[0]?.dictionaryFindings.length)
  assert.ok(parsed.files[0]?.indexFindings.some((finding) => finding.message.includes("NAME")))
})

test("CLI generates bundle artifacts and bundle index", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-bundle-"))
  const fixture = join(dir, "bundle.json")
  const out = join(dir, "out")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "CUSTOMERS",
      suggestedResource: "customers",
      dictionary: [{ id: "@ID", type: "A", attribute: 0 }, { id: "NAME", type: "A", attribute: 1 }],
      records: [{ id: "100", raw: "Alice" }],
      expectedIndexes: ["NAME"],
      observedIndexes: ["NAME"],
    }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nCRT @(-1):@(5,2):\"Customer\"\nINPUT ID\nOPEN \"CUSTOMERS\" TO F ELSE STOP\nRETURN\n" }],
  }))
  const index = await cli(["bundle-index", fixture])
  const parsedIndex = JSON.parse(index.stdout) as { documents: Array<{ uri: string }> }
  assert.ok(parsedIndex.documents.some((doc) => doc.uri === "d3://prod/SALES/BP/GET.CUSTOMER"))

  const indexPlan = await cli(["bundle-index-plan", fixture])
  assert.match(indexPlan.stdout, /D3 Index Validation Plan: SALES/)
  assert.match(indexPlan.stdout, /CUSTOMERS index NAME/)

  const indexPlanJson = await cli(["bundle-index-plan", fixture, "--json"])
  const parsedIndexPlan = JSON.parse(indexPlanJson.stdout) as { items: Array<{ index: string }> }
  assert.ok(parsedIndexPlan.items.some((item) => item.index === "NAME"))

  const dataPlan = await cli(["bundle-data-plan", fixture])
  assert.match(dataPlan.stdout, /D3 Data Validation Plan: SALES/)
  assert.match(dataPlan.stdout, /sampled-data/)

  const dataPlanJson = await cli(["bundle-data-plan", fixture, "--json"])
  const parsedDataPlan = JSON.parse(dataPlanJson.stdout) as { items: Array<{ subject: string }> }
  assert.ok(parsedDataPlan.items.some((item) => item.subject === "sampled-data"))

  const codeMap = await cli(["bundle-code-map", fixture])
  const parsedCodeMap = JSON.parse(codeMap.stdout) as { programs: Array<{ program: string }>; fileUsage: Array<{ file: string }> }
  assert.ok(parsedCodeMap.programs.some((program) => program.program === "BP/GET.CUSTOMER"))

  const codePlan = await cli(["bundle-code-plan", fixture])
  assert.match(codePlan.stdout, /D3 BASIC Modernization Plan: SALES/)
  assert.match(codePlan.stdout, /compile-catalog-proof/)
  assert.match(codePlan.stdout, /modernization-proof/)

  const codePlanJson = await cli(["bundle-code-plan", fixture, "--json"])
  const parsedCodePlan = JSON.parse(codePlanJson.stdout) as { items: Array<{ subject: string }> }
  assert.ok(parsedCodePlan.items.some((item) => item.subject === "compile-catalog-proof"))

  const screenPlan = await cli(["bundle-screen-plan", fixture])
  assert.match(screenPlan.stdout, /D3 Screen Modernization Plan: SALES/)
  assert.match(screenPlan.stdout, /legacy screen operation/)
  assert.match(screenPlan.stdout, /screen-parse/)

  const screenPlanJson = await cli(["bundle-screen-plan", fixture, "--json"])
  const parsedScreenPlan = JSON.parse(screenPlanJson.stdout) as { items: Array<{ risk: string; operations: Array<{ kind: string }> }> }
  assert.equal(parsedScreenPlan.items[0]?.risk, "high")
  assert.ok(parsedScreenPlan.items[0]?.operations.some((operation) => operation.kind === "input"))

  const beforePath = join(dir, "GET.CUSTOMER.before.txt")
  const afterPath = join(dir, "GET.CUSTOMER.txt")
  const compilePath = join(dir, "compile-output.txt")
  await writeFile(beforePath, "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n")
  await writeFile(afterPath, "SUBROUTINE GET.CUSTOMER(ID)\nID = TRIM(ID)\nRETURN\n")
  await writeFile(compilePath, "BASIC OK\n")
  const modernizationProof = await cli(["modernization-proof", "--before", beforePath, "--after", afterPath, "--compile-output", compilePath])
  assert.match(modernizationProof.stdout, /D3 BASIC Modernization Proof/)
  assert.match(modernizationProof.stdout, /Ready: yes/)

  await writeFile(afterPath, "SUBROUTINE GET.CUSTOMER(ID)\nEXECUTE \"CLEAR-FILE CUSTOMERS\"\nRETURN\n")
  await writeFile(compilePath, "LINE 2 ERROR: Destructive command\n")
  await assert.rejects(
    cli(["modernization-proof", "--before", beforePath, "--after", afterPath, "--compile-output", compilePath]),
    (error: unknown) => {
      const err = error as { stdout?: string; code?: number }
      assert.equal(err.code, 1)
      assert.match(err.stdout ?? "", /symbols-executes/)
      assert.match(err.stdout ?? "", /compile-proof/)
      return true
    },
  )

  const brief = await cli(["bundle-brief", fixture])
  assert.match(brief.stdout, /D3 Modernization Brief: SALES/)
  assert.match(brief.stdout, /GSD Evidence To Record/)

  const backlog = await cli(["bundle-backlog", fixture])
  assert.match(backlog.stdout, /D3 Modernization Backlog: SALES/)
  assert.match(backlog.stdout, /Build REST resource customers/)

  const backlogJson = await cli(["bundle-backlog", fixture, "--json"])
  const parsedBacklog = JSON.parse(backlogJson.stdout) as { items: Array<{ title: string }> }
  assert.ok(parsedBacklog.items.some((item) => item.title.includes("Build REST resource customers")))

  const qaPlan = await cli(["bundle-qa-plan", fixture])
  assert.match(qaPlan.stdout, /D3 Migration QA Plan: SALES/)
  assert.match(qaPlan.stdout, /browser/)

  const qaPlanJson = await cli(["bundle-qa-plan", fixture, "--json"])
  const parsedQaPlan = JSON.parse(qaPlanJson.stdout) as { checks: Array<{ surface: string }> }
  assert.ok(parsedQaPlan.checks.some((check) => check.surface === "api"))

  const readiness = await cli(["bundle-readiness", fixture])
  assert.match(readiness.stdout, /D3 Migration Readiness Report: SALES/)
  assert.match(readiness.stdout, /live-d3-proof/)
  assert.match(readiness.stdout, /legacy-screen-modernization/)
  assert.match(readiness.stdout, /cutover-reconciliation/)

  const bundleDelegate = await cli(["bundle-delegate", fixture])
  assert.match(bundleDelegate.stdout, /D3 Bundle Subagent Plan: SALES/)
  assert.match(bundleDelegate.stdout, /d3-architect/)

  const bundleDelegateJson = await cli(["bundle-delegate", fixture, "--json"])
  const parsedBundleDelegate = JSON.parse(bundleDelegateJson.stdout) as { tasks: Array<{ agent: string }> }
  assert.ok(parsedBundleDelegate.tasks.some((task) => task.agent === "d3-test-runner"))

  const completionAudit = await cli(["bundle-completion-audit", fixture])
  assert.match(completionAudit.stdout, /D3 Goal Completion Audit: SALES/)
  assert.match(completionAudit.stdout, /live-d3-and-qa-proof/)
  assert.match(completionAudit.stdout, /legacy-screen-modernization/)
  assert.match(completionAudit.stdout, /cutover-reconciliation/)

  const completionAuditJson = await cli(["bundle-completion-audit", fixture, "--json"])
  const parsedCompletionAudit = JSON.parse(completionAuditJson.stdout) as { complete: boolean; requirements: Array<{ id: string }> }
  assert.equal(parsedCompletionAudit.complete, false)
  assert.ok(parsedCompletionAudit.requirements.some((requirement) => requirement.id === "skills-baked"))

  const bundleEvidence = await cli(["bundle-evidence", fixture])
  assert.match(bundleEvidence.stdout, /D3 Bundle Goal Evidence: SALES/)
  assert.match(bundleEvidence.stdout, /capture/)

  const bundleEvidenceJson = await cli(["bundle-evidence", fixture, "--json"])
  const parsedBundleEvidence = JSON.parse(bundleEvidenceJson.stdout) as { items: Array<{ phase: string }> }
  assert.ok(parsedBundleEvidence.items.some((item) => item.phase === "verify"))

  const executionPlan = await cli(["bundle-execution-plan", fixture])
  assert.match(executionPlan.stdout, /D3 Migration Execution Plan: SALES/)
  assert.match(executionPlan.stdout, /bundle-screen-plan/)
  assert.match(executionPlan.stdout, /bundle-reconciliation-plan/)
  assert.match(executionPlan.stdout, /bundle-artifacts/)
  assert.match(executionPlan.stdout, /live-proof/)

  const executionPlanJson = await cli(["bundle-execution-plan", fixture, "--json"])
  const parsedExecutionPlan = JSON.parse(executionPlanJson.stdout) as { steps: Array<{ phase: string; skills: string[] }>; nextCommand: string }
  assert.ok(parsedExecutionPlan.steps.some((step) => step.phase === "api" && step.skills.includes("rest-api-generation")))
  assert.match(parsedExecutionPlan.nextCommand, /bundle-audit|bundle-screen-plan|bundle-reconciliation-plan|bundle-artifacts|webapp-check|live-proof/)

  const erpPlan = await cli(["bundle-erp-plan", fixture])
  assert.match(erpPlan.stdout, /D3 ERP Migration Blueprint: SALES/)
  assert.match(erpPlan.stdout, /Target Data Model/)

  const uiPlan = await cli(["bundle-ui-plan", fixture])
  assert.match(uiPlan.stdout, /D3 Web UI Plan: SALES/)
  assert.match(uiPlan.stdout, /Navigation:/)

  const uiPlanJson = await cli(["bundle-ui-plan", fixture, "--json"])
  const parsedUiPlan = JSON.parse(uiPlanJson.stdout) as { screens: Array<{ resource: string }> }
  assert.ok(parsedUiPlan.screens.some((screen) => screen.resource === "customers"))

  const reconciliationPlan = await cli(["bundle-reconciliation-plan", fixture])
  assert.match(reconciliationPlan.stdout, /D3 Cutover Reconciliation Plan: SALES/)
  assert.match(reconciliationPlan.stdout, /row count parity/)

  const reconciliationPlanJson = await cli(["bundle-reconciliation-plan", fixture, "--json"])
  const parsedReconciliationPlan = JSON.parse(reconciliationPlanJson.stdout) as { checks: Array<{ id: string }>; stages: Array<{ id: string }> }
  assert.ok(parsedReconciliationPlan.checks.some((check) => check.id === "row-count:CUSTOMERS"))
  assert.ok(parsedReconciliationPlan.stages.some((stage) => stage.id === "rollback"))

  const accessPlan = await cli(["bundle-access-plan", fixture])
  assert.match(accessPlan.stdout, /D3 Access Plan: SALES/)
  assert.match(accessPlan.stdout, /No users were captured/)

  const accessPlanJson = await cli(["bundle-access-plan", fixture, "--json"])
  const parsedAccessPlan = JSON.parse(accessPlanJson.stdout) as { warnings: string[] }
  assert.ok(parsedAccessPlan.warnings.some((warning) => warning.includes("No users were captured")))

  const prd = await cli(["bundle-prd", fixture])
  assert.match(prd.stdout, /PRD: D3 SALES Web Migration/)
  assert.match(prd.stdout, /Acceptance Criteria/)

  const adr = await cli(["bundle-adr", fixture])
  assert.match(adr.stdout, /ADR: Strangler REST Boundary For D3 SALES/)
  assert.match(adr.stdout, /customers -> CUSTOMERS/)

  const release = await cli(["bundle-release-report", fixture])
  assert.match(release.stdout, /D3 Migration Release Report: SALES/)
  assert.match(release.stdout, /Decision: blocked/)

  const releaseJson = await cli(["bundle-release-report", fixture, "--json"])
  const parsedRelease = JSON.parse(releaseJson.stdout) as { decision: string; rollback: string[] }
  assert.equal(parsedRelease.decision, "blocked")
  assert.ok(parsedRelease.rollback.some((step) => step.includes("D3CODE_ALLOW_WRITES")))

  const contextPack = await cli(["bundle-context-pack", fixture])
  assert.match(contextPack.stdout, /D3 Context Pack: SALES/)
  assert.match(contextPack.stdout, /Subagent Queue/)
  assert.match(contextPack.stdout, /baked skills: needs-proof/)

  await assert.rejects(
    cli(["safety-guard", "--bundle", fixture, "--command", "CLEAR-FILE CUSTOMERS"]),
    (error: unknown) => {
      const stdout = (error as { stdout?: string }).stdout ?? ""
      assert.match(stdout, /D3 Safety Guard/)
      assert.match(stdout, /CLEAR-FILE CUSTOMERS/)
      return true
    },
  )

  const goalHome = join(dir, "goal-home")
  const bundleGoal = await execFileAsync("node", ["dist/src/cli.js", "bundle-goal", fixture, "--artifacts-out", out], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: goalHome },
  })
  assert.match(bundleGoal.stdout, /Active: verify/)
  assert.match(bundleGoal.stdout, /webapp-check passed/)

  const written = await cli(["bundle-artifacts", fixture, "--out", out])
  const parsedWritten = JSON.parse(written.stdout) as { written: string[] }
  assert.ok(parsedWritten.written.some((file) => file.endsWith("audit.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("code-map.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("modernization-brief.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("modernization-backlog.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("modernization-backlog.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("migration-qa-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("migration-qa-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("live-operator-runbook.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/live-operator-runbook.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("live-operator-runbook.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("index-validation-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/index-validation-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("index-validation-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("data-validation-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/data-validation-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("data-validation-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("access-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("access-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("code-modernization-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/code-modernization-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("code-modernization-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("screen-modernization-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/screen-modernization-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("screen-modernization-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("web-ui-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("web-ui-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("ide-terminal.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/ide-terminal.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("ide-terminal.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3-connector-strategy.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3-connector-strategy.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("reconciliation-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("reconciliation-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("migration-readiness.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("migration-readiness.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("subagent-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("subagent-plan.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("subagent-prompts.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/subagent-prompts.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("subagent-prompts.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3code-skill-pack.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3code-skill-pack.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3code-skill-manifest.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/skill-manifest.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3code-reference-skill-audit.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("d3code-reference-skill-audit.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/reference-skill-audit.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("completion-audit.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("completion-audit.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("goal-evidence.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("goal-evidence.md")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("mock-data.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("package.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("src/server.ts")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("src/d3-client.ts")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("src/d3-record.ts")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/index.html")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/app.js")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/ui-plan.json")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("public/styles.css")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("test/api-smoke.test.mjs")))
  assert.ok(parsedWritten.written.some((file) => file.endsWith("src/customers/customers.repository.ts")))

  const webappCheck = await cli(["webapp-check", out])
  assert.match(webappCheck.stdout, /Generated Web App Check/)
  assert.match(webappCheck.stdout, /Ready: yes/)
  assert.match(webappCheck.stdout, /ui-index/)
  assert.match(webappCheck.stdout, /ui-plan-rendering/)
  assert.match(webappCheck.stdout, /api-smoke-test/)
  assert.match(webappCheck.stdout, /d3-record-mapper/)

  const skillPack = await cli(["bundle-skill-pack", fixture])
  assert.match(skillPack.stdout, /D3 Code Skill Pack: SALES/)
  assert.match(skillPack.stdout, /Migration Mode/)
  const skillPackJson = await cli(["bundle-skill-pack", fixture, "--json"])
  const parsedSkillPack = JSON.parse(skillPackJson.stdout) as { modes: Array<{ mode: string; commands: string[] }>; evidenceGates: Array<{ id: string }> }
  assert.ok(parsedSkillPack.modes.some((mode) => mode.mode === "migrate" && mode.commands.some((command) => command.includes("webapp-check"))))
  assert.ok(parsedSkillPack.evidenceGates.some((gate) => gate.id === "live-d3-proof"))

  const webappSmoke = await cli(["webapp-smoke", out, "--record"])
  assert.match(webappSmoke.stdout, /Generated Web App Smoke/)
  assert.match(webappSmoke.stdout, /Ready: yes/)

  const refreshed = await cli(["bundle-refresh-evidence", fixture, "--artifacts-dir", out])
  const parsedRefreshed = JSON.parse(refreshed.stdout) as { written: string[] }
  assert.ok(parsedRefreshed.written.some((file) => file.endsWith("migration-readiness.json")))
  assert.ok(parsedRefreshed.written.some((file) => file.endsWith("completion-audit.json")))
  assert.ok(parsedRefreshed.written.some((file) => file.endsWith("goal-evidence.json")))
  assert.ok(parsedRefreshed.written.some((file) => file.endsWith("release-report.json")))
  assert.ok(parsedRefreshed.written.some((file) => file.endsWith("proof-data.json")))

  const readinessWithArtifacts = await cli(["bundle-readiness", fixture, "--artifacts-dir", out, "--json"])
  const parsedReadiness = JSON.parse(readinessWithArtifacts.stdout) as { gates: Array<{ id: string; status: string }> }
  assert.ok(parsedReadiness.gates.some((gate) => gate.id === "webapp-scaffold" && gate.status === "ok"))
  assert.ok(parsedReadiness.gates.some((gate) => gate.id === "baked-skill-pack" && gate.status === "ok"))
  assert.ok(parsedReadiness.gates.some((gate) => gate.id === "qa-evidence" && gate.status === "ok"))

  const completionWithArtifacts = await cli(["bundle-completion-audit", fixture, "--artifacts-dir", out, "--json"])
  const parsedCompletionWithArtifacts = JSON.parse(completionWithArtifacts.stdout) as { requirements: Array<{ id: string; status: string }> }
  assert.ok(parsedCompletionWithArtifacts.requirements.some((requirement) => requirement.id === "skills-baked" && requirement.status === "proven"))
  assert.ok(parsedCompletionWithArtifacts.requirements.some((requirement) => requirement.id === "live-d3-and-qa-proof" && requirement.status === "partial"))

  const evidenceWithArtifacts = await cli(["bundle-evidence", fixture, "--artifacts-dir", out])
  assert.match(evidenceWithArtifacts.stdout, /D3 Bundle Goal Evidence: SALES/)
  assert.match(evidenceWithArtifacts.stdout, /baked-skills=ok/)
  assert.match(evidenceWithArtifacts.stdout, /d3code-reference-skill-audit-ready:ok/)
  assert.match(evidenceWithArtifacts.stdout, /qa-evidence=ready/)
  const contextPackWithArtifacts = await cli(["bundle-context-pack", fixture, "--artifacts-dir", out])
  assert.match(contextPackWithArtifacts.stdout, /baked skills: ready/)
  assert.match(contextPackWithArtifacts.stdout, /d3code-reference-skill-audit-ready:ok/)
  assert.match(await readFile(join(out, "goal-evidence.md"), "utf8"), /qa-evidence=ready/)
  assert.match(await readFile(join(out, "completion-audit.md"), "utf8"), /qa-evidence:ok/)
  assert.match(await readFile(join(out, "release-report.md"), "utf8"), /Decision: canary|Decision: blocked/)
  assert.match(await readFile(join(out, "public/proof-data.json"), "utf8"), /readiness/)
})

test("CLI captures bundle through local shell profile", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-capture-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nNAME\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'NAME\\n' ;;",
    "  *'SELECT CUSTOMERS'*) printf '100\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Alice' ;;",
    "  *'SELECT BP'*) printf 'GET.CUSTOMER\\n' ;;",
    "  *'CT BP GET.CUSTOMER'*) printf 'SUBROUTINE GET.CUSTOMER(ID)\\nRETURN\\n' ;;",
    "  *) printf 'CUSTOMERS\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })
  const result = await execFileAsync("node", ["dist/src/cli.js", "bundle-capture", "--profile", "fake", "--files", "CUSTOMERS", "--program-files", "BP", "--sample-limit", "1"], { cwd: process.cwd(), env })
  const bundle = JSON.parse(result.stdout) as { files: Array<{ name: string; records: Array<{ raw: string }>; observedIndexes?: string[] }>; programs: Array<{ item: string }> }
  assert.equal(bundle.files[0]?.name, "CUSTOMERS")
  assert.equal(bundle.files[0]?.records[0]?.raw, "Alice")
  assert.deepEqual(bundle.files[0]?.observedIndexes, ["NAME"])
  assert.equal(bundle.programs[0]?.item, "GET.CUSTOMER")
})

test("CLI indexes and searches a D3 account cache", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-index-account-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST MD'*) printf 'CUSTOMERS D Customer file\\nORDERS D Order file\\n' ;;",
    "  *) printf 'CUSTOMERS D Customer file\\nORDERS D Order file\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })

  const indexed = await execFileAsync("node", ["dist/src/cli.js", "index-account", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(indexed.stdout, /Indexed 1 document/)
  assert.match(indexed.stdout, /profile-fake/)

  const searched = await execFileAsync("node", ["dist/src/cli.js", "search-account", "ORDERS", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(searched.stdout, /d3:\/\/fake\/SALES\/MD\/__file_pointers__:/)
  assert.match(searched.stdout, /Order file/)

  const toolSearch = await execFileAsync("node", ["dist/src/cli.js", "tool-compact", "d3_search", "{\"query\":\"CUSTOMERS\"}", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(toolSearch.stdout, /CUSTOMERS/)
})

test("CLI exposes first-class D3 item, dictionary, lock, diff, and write commands", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-cli-d3-edit-"))
  const script = join(home, "fake-d3.sh")
  const proposed = join(home, "proposed.txt")
  await writeFile(proposed, "001 CUSTOMER\nNEW.NAME\n")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'CT CUSTOMERS 100'*) printf '001 CUSTOMER\\nOLD.NAME\\n' ;;",
    "  *'CT DICT CUSTOMERS NAME'*) printf '001 D\\n002 1\\n003 Name\\n' ;;",
    "  *'LIST-LOCKS'*) printf 'No locks present\\n' ;;",
    "  *'ED CUSTOMERS 100'*) printf 'ITEM SAVED\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })

  const read = await execFileAsync("node", ["dist/src/cli.js", "read-item", "CUSTOMERS", "100", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(read.stdout, /OLD.NAME/)

  const dict = await execFileAsync("node", ["dist/src/cli.js", "read-dict", "CUSTOMERS", "NAME", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(dict.stdout, /Name/)

  const locks = await execFileAsync("node", ["dist/src/cli.js", "locks", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(locks.stdout, /No locks present/)

  const diff = await execFileAsync("node", ["dist/src/cli.js", "diff-item", "CUSTOMERS", "100", "--profile", "fake", "--body-file", proposed], { cwd: process.cwd(), env })
  assert.match(diff.stdout, /--- current:CUSTOMERS\/100/)
  assert.match(diff.stdout, /-OLD.NAME/)
  assert.match(diff.stdout, /\+NEW.NAME/)

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "write-item", "CUSTOMERS", "100", "001 CUSTOMER\\nNEW.NAME", "--profile", "fake"], { cwd: process.cwd(), env }),
    /Confirmation required/,
  )

  const write = await execFileAsync("node", ["dist/src/cli.js", "write-item", "CUSTOMERS", "100", "--profile", "fake", "--body-file", proposed, "--confirm"], { cwd: process.cwd(), env })
  assert.match(write.stdout, /ITEM SAVED/)
})

test("CLI exposes first-class D3 AQL, compile, catalog, and call commands", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-cli-d3-code-loop-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST CUSTOMERS'*) printf '100 Alice\\n101 Bob\\n' ;;",
    "  *'BASIC BP GET.CUSTOMER'*) printf 'BASIC OK\\n' ;;",
    "  *'CATALOG BP GET.CUSTOMER (G'*) printf 'CATALOG GLOBAL OK\\n' ;;",
    "  *'CATALOG BP GET.CUSTOMER'*) printf 'CATALOG OK\\n' ;;",
    "  *'CALL GET.CUSTOMER 100'*) printf 'CALL OK\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })

  const aql = await execFileAsync("node", ["dist/src/cli.js", "query-aql", "LIST", "CUSTOMERS", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(aql.stdout, /Alice/)

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "compile-basic", "BP", "GET.CUSTOMER", "--profile", "fake"], { cwd: process.cwd(), env }),
    /Confirmation required/,
  )

  const compile = await execFileAsync("node", ["dist/src/cli.js", "compile-basic", "BP", "GET.CUSTOMER", "--profile", "fake", "--confirm"], { cwd: process.cwd(), env })
  assert.match(compile.stdout, /BASIC OK/)

  const catalog = await execFileAsync("node", ["dist/src/cli.js", "catalog-basic", "BP", "GET.CUSTOMER", "--profile", "fake", "--global", "--confirm"], { cwd: process.cwd(), env })
  assert.match(catalog.stdout, /CATALOG GLOBAL OK/)

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "call-subroutine", "GET.CUSTOMER", "100", "--profile", "fake"], { cwd: process.cwd(), env }),
    /Confirmation required/,
  )

  const call = await execFileAsync("node", ["dist/src/cli.js", "call-subroutine", "GET.CUSTOMER", "100", "--profile", "fake", "--confirm"], { cwd: process.cwd(), env })
  assert.match(call.stdout, /CALL OK/)
})

test("CLI runs a bounded D3 agent task with evidence", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-cli-agent-run-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'CT BP GET.CUSTOMER'*) printf 'SUBROUTINE GET.CUSTOMER(ID)\\nOPEN \"CUSTOMERS\" TO F ELSE STOP\\nRETURN\\n' ;;",
    "  *'BASIC BP GET.CUSTOMER'*) printf 'BASIC OK\\n' ;;",
    "  *'CATALOG BP GET.CUSTOMER'*) printf 'CATALOG OK\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "agent-run", "basic-check", "BP", "GET.CUSTOMER", "--profile", "fake", "--compile", "--catalog"], { cwd: process.cwd(), env }),
    (error: unknown) => {
      assert.match((error as { stdout?: string }).stdout ?? "", /Ready: no/)
      assert.match((error as { stdout?: string }).stdout ?? "", /compile-basic/)
      return true
    },
  )

  const result = await execFileAsync("node", ["dist/src/cli.js", "agent-run", "basic-check", "BP", "GET.CUSTOMER", "--profile", "fake", "--compile", "--catalog", "--confirm"], { cwd: process.cwd(), env })
  assert.match(result.stdout, /D3 Agent Run: basic-check/)
  assert.match(result.stdout, /Ready: yes/)
  assert.match(result.stdout, /read-item/)
  assert.match(result.stdout, /compile-basic/)
  assert.match(result.stdout, /catalog-basic/)
})

test("CLI runs a bounded D3 file audit agent task", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-cli-agent-file-audit-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nNAME\\nPHONE\\n' ;;",
    "  *'CT DICT CUSTOMERS @ID'*) printf '001 A\\n002 0\\n003 ID\\n' ;;",
    "  *'CT DICT CUSTOMERS NAME'*) printf '001 A\\n002 1\\n003 Name\\n' ;;",
    "  *'CT DICT CUSTOMERS PHONE'*) printf '001 A\\n002 2\\n003 Phone\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'NAME\\n' ;;",
    "  *'SELECT CUSTOMERS SAMPLE 2'*) printf '100\\n101\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Aliceþ555-0100\\n' ;;",
    "  *'CT CUSTOMERS 101'*) printf 'Bobþ555-0101\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })

  const result = await execFileAsync("node", ["dist/src/cli.js", "agent-run", "file-audit", "CUSTOMERS", "--profile", "fake", "--sample-limit", "2"], { cwd: process.cwd(), env })
  assert.match(result.stdout, /D3 Agent Run: file-audit/)
  assert.match(result.stdout, /d3-data-mapper/)
  assert.match(result.stdout, /dictionary-inventory/)
  assert.match(result.stdout, /dictionary-validation/)
  assert.match(result.stdout, /observed indexes:NAME/)
  assert.match(result.stdout, /index-validation/)
  assert.match(result.stdout, /100:attrs=2/)
  assert.match(result.stdout, /data-shape-validation/)
})

test("CLI runs a bounded D3 migration slice agent task", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-cli-agent-migration-slice-"))
  const bundleFile = join(home, "bundle.json")
  const out = join(home, "out")
  await writeFile(bundleFile, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "CUSTOMERS",
      suggestedResource: "customers",
      dictionary: [{ id: "@ID", attribute: 0 }, { id: "NAME", attribute: 1 }],
      records: [{ id: "100", raw: "Alice" }],
      observedIndexes: ["NAME"],
    }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  }))

  const result = await execFileAsync("node", ["dist/src/cli.js", "agent-run", "migration-slice", bundleFile, "--out", out], { cwd: process.cwd() })
  assert.match(result.stdout, /D3 Agent Run: migration-slice/)
  assert.match(result.stdout, /Ready: yes/)
  assert.match(result.stdout, /write-artifacts/)
  assert.match(result.stdout, /webapp-check/)
  assert.match(result.stdout, /webapp-smoke/)
  assert.match(result.stdout, /qa-evidence/)
  assert.match(result.stdout, /refresh-proof/)
  assert.match(result.stdout, /items:[1-9][0-9]/)
})

test("CLI login can switch only to allowed D3 accounts", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-login-allowed-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LOGTO SALES'*) printf 'LOGTO SALES\\nSALES\\nD3 10.3 MOCK\\n' ;;",
    "  *WHO*) printf 'SALES\\nD3 10.3 MOCK\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script, "--allowed-accounts", "SALES,DM"], { cwd: process.cwd(), env })

  const ok = await execFileAsync("node", ["dist/src/cli.js", "login", "--profile", "fake", "--account", "SALES", "--safety", "trust"], { cwd: process.cwd(), env })
  assert.match(ok.stdout, /LOGTO SALES/)
  assert.match(ok.stdout, /D3 10.3 MOCK/)

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "login", "--profile", "fake", "--account", "DEV", "--safety", "trust"], { cwd: process.cwd(), env }),
    /Account DEV is not allowed/,
  )
})

test("CLI captures a terminal transcript and parsed screen artifacts", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-terminal-capture-"))
  const out = join(home, "terminal-proof")
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--session", "persistent"], { cwd: process.cwd(), env })

  const result = await execFileAsync("node", ["dist/src/cli.js", "terminal-capture", "--profile", "fake", "--out", out, "--width", "24", "--height", "6", "printf", "'@(-1)MENU@(5,2)Choice:'"], { cwd: process.cwd(), env })
  assert.match(result.stdout, /D3 Terminal Capture/)
  assert.match(result.stdout, /terminal-transcript\.txt/)
  assert.match(await readFile(join(out, "screen-buffer.md"), "utf8"), /Choice:/)

  const json = await execFileAsync("node", ["dist/src/cli.js", "terminal-capture", "--profile", "fake", "--width", "24", "--height", "6", "--json", "printf", "'@(-1)OK'"], { cwd: process.cwd(), env })
  const parsed = JSON.parse(json.stdout) as { risk: string; screen: { events: Array<{ type: string }> } }
  assert.equal(parsed.risk, "read")
  assert.ok(parsed.screen.events.some((event) => event.type === "clear-screen"))
})

test("CLI profile doctor runs read-only D3 smoke checks", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-profile-doctor-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *WHO*) printf 'SALES\\n' ;;",
    "  *VERSION*) printf 'D3 10.3 MOCK\\n' ;;",
    "  *'LIST MD'*) printf 'CUSTOMERS\\nBP\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "fake", "--account", "SALES", "--entry", script], { cwd: process.cwd(), env })
  const result = await execFileAsync("node", ["dist/src/cli.js", "profile-doctor", "--profile", "fake"], { cwd: process.cwd(), env })
  assert.match(result.stdout, /Ready: yes/)
  assert.match(result.stdout, /LIST MD/)
  const proof = await execFileAsync("node", ["dist/src/cli.js", "live-proof", "--profile", "fake", "--run"], { cwd: process.cwd(), env })
  assert.match(proof.stdout, /D3 Live Proof Plan/)
  assert.match(proof.stdout, /Ready: no|Ready: yes/)
  assert.match(proof.stdout, /who:ok/)

  const created = await execFileAsync("node", ["dist/src/cli.js", "goal", "--mode", "migrate", "Live", "proof"], { cwd: process.cwd(), env })
  const goalId = created.stdout.match(/goal_[a-z0-9]+/)?.[0]
  assert.ok(goalId)

  const recorded = await execFileAsync("node", ["dist/src/cli.js", "live-proof", "--profile", "fake", "--run", "--goal", goalId, "--phase", "verify"], { cwd: process.cwd(), env })
  assert.match(recorded.stdout, /profile-doctor passed for fake/)

  const plan = await execFileAsync("node", ["dist/src/cli.js", "goal-plan", goalId], { cwd: process.cwd(), env })
  assert.match(plan.stdout, /profile-doctor passed for fake/)
  assert.match(plan.stdout, /checks=who:ok,version:ok,md-list:ok/)
})

test("CLI profiles are isolated under D3CODE_HOME", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-home-"))
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "local-test", "--account", "DM", "--session", "persistent"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  const result = await execFileAsync("node", ["dist/src/cli.js", "profiles"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  assert.match(result.stdout, /local-test/)
  assert.match(result.stdout, /account=DM/)
  assert.match(result.stdout, /session=persistent/)
})

test("CLI setup supports noninteractive model/key configuration", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-setup-"))
  const result = await execFileAsync("node", ["dist/src/cli.js", "setup", "--provider", "openai", "--default-model", "gpt-5-mini", "--api-key-env", "OPENAI_API_KEY", "--default-safety", "trust", "--skip-d3"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  assert.match(result.stdout, /Configured openai\/gpt-5-mini/)
  const doctor = await execFileAsync("node", ["dist/src/cli.js", "doctor"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  assert.match(doctor.stdout, /Default model: openai\/gpt-5-mini/)
  assert.match(doctor.stdout, /Default safety: trust/)
  const proof = await execFileAsync("node", ["dist/src/cli.js", "model-proof"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home, OPENAI_API_KEY: "test-key" },
  })
  assert.match(proof.stdout, /D3 Model Proof/)
  assert.match(proof.stdout, /Ready: yes/)
})

test("CLI setup can bootstrap a persistent D3 profile noninteractively", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-setup-profile-"))
  const result = await execFileAsync("node", [
    "dist/src/cli.js",
    "setup",
    "--provider",
    "anthropic",
    "--default-model",
    "claude-sonnet-4-5",
    "--api-key-env",
    "ANTHROPIC_API_KEY",
    "--default-safety",
    "ask",
    "--d3",
    "local",
    "--profile-name",
    "prod",
    "--account",
    "SALES",
    "--entry",
    "d3",
    "--startup-input",
    "dm\\ndm\\n",
    "--prompt",
    ">",
    "--allowed-accounts",
    "SALES,DM",
  ], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  assert.match(result.stdout, /Configured anthropic\/claude-sonnet-4-5/)
  assert.match(result.stdout, /Default profile: prod/)

  const profiles = await execFileAsync("node", ["dist/src/cli.js", "profiles"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  assert.match(profiles.stdout, /prod/)
  assert.match(profiles.stdout, /account=SALES/)
  assert.match(profiles.stdout, /session=persistent/)
  assert.match(profiles.stdout, /allowed=SALES,DM/)
  const config = JSON.parse(await readFile(join(home, "config.jsonc"), "utf8")) as { profiles: Array<{ startupInput?: string }> }
  assert.equal(config.profiles[0]?.startupInput, "dm\ndm\n")

  const readiness = await execFileAsync("node", ["dist/src/cli.js", "readiness"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home, ANTHROPIC_API_KEY: "test-key" },
  })
  assert.match(readiness.stdout, /\[ok\] Model Selection/)
  assert.match(readiness.stdout, /\[ok\] First-run Setup Proof/)
  assert.match(readiness.stdout, /\[ok\] Terminal-like Session Behavior/)

  const setupProof = await execFileAsync("node", ["dist/src/cli.js", "setup-proof"], {
    cwd: process.cwd(),
    env: { ...process.env, D3CODE_HOME: home },
  })
  assert.match(setupProof.stdout, /D3 Code Setup Proof/)
  assert.match(setupProof.stdout, /Ready: yes/)
  assert.match(setupProof.stdout, /Account allowlist/)
})

test("CLI executes compact tool output", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-tool-"))
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", ["dist/src/cli.js", "profile-add-local", "--name", "local"], { cwd: process.cwd(), env })
  const result = await execFileAsync("node", ["dist/src/cli.js", "tool-compact", "d3_tcl", "{\"command\":\"printf TOOL_OK\"}", "--profile", "local"], { cwd: process.cwd(), env })
  assert.match(result.stdout, /TOOL_OK/)
})

test("CLI persists and advances goals", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-goals-"))
  const env = { ...process.env, D3CODE_HOME: home }
  const created = await execFileAsync("node", ["dist/src/cli.js", "goal", "--mode", "migrate", "Modernize", "orders"], { cwd: process.cwd(), env })
  const id = created.stdout.match(/goal_[a-z0-9]+/)?.[0]
  assert.ok(id)
  assert.match(created.stdout, /Active: capture/)

  const listed = await execFileAsync("node", ["dist/src/cli.js", "goals"], { cwd: process.cwd(), env })
  assert.match(listed.stdout, new RegExp(id))

  const plan = await execFileAsync("node", ["dist/src/cli.js", "goal-plan", id], { cwd: process.cwd(), env })
  assert.match(plan.stdout, /d3code bundle-capture/)
  assert.match(plan.stdout, /Evidence gate/)

  const next = await execFileAsync("node", ["dist/src/cli.js", "goal-next", id], { cwd: process.cwd(), env })
  assert.match(next.stdout, /Active Phase: capture/)
  assert.match(next.stdout, /Baked Skills To Apply/)

  const evidence = await execFileAsync("node", ["dist/src/cli.js", "goal-evidence", id, "--evidence", "Captured bundle fixture"], { cwd: process.cwd(), env })
  assert.match(evidence.stdout, /Recorded evidence/)
  assert.match(evidence.stdout, /Captured bundle fixture/)

  const verification = await execFileAsync("node", ["dist/src/cli.js", "goal-verify", id], { cwd: process.cwd(), env })
  assert.match(verification.stdout, /Ready: no/)
  assert.match(verification.stdout, /capture \(active\) evidence=1/)

  const advanced = await execFileAsync("node", ["dist/src/cli.js", "goal-advance", id, "--note", "audit done"], { cwd: process.cwd(), env })
  assert.match(advanced.stdout, /Active: audit/)
  assert.match(advanced.stdout, /capture: Capture D3 application bundle/)

  const bundlePath = join(home, "bundle.json")
  await writeFile(bundlePath, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{ name: "CUSTOMERS", suggestedResource: "customers", dictionary: [{ id: "@ID", attribute: 0 }], records: [{ id: "100", raw: "Alice" }] }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  }))
  const applied = await execFileAsync("node", ["dist/src/cli.js", "goal-apply-bundle-evidence", id, bundlePath], { cwd: process.cwd(), env })
  assert.match(applied.stdout, /Applied Bundle Evidence/)
  assert.match(applied.stdout, /capture/)
  const appliedPlan = await execFileAsync("node", ["dist/src/cli.js", "goal-plan", id], { cwd: process.cwd(), env })
  assert.match(appliedPlan.stdout, /Bundle captured for account SALES/)

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "goal-audit-bundle", id, bundlePath], { cwd: process.cwd(), env }),
    (error: unknown) => {
      const err = error as { stdout?: string; code?: number }
      assert.equal(err.code, 1)
      assert.match(err.stdout ?? "", /D3 Goal Bundle Audit/)
      assert.match(err.stdout ?? "", /webapp-smoke/)
      return true
    },
  )

  await assert.rejects(
    execFileAsync("node", ["dist/src/cli.js", "goal-audit-bundle", id, bundlePath, "--apply"], { cwd: process.cwd(), env }),
    (error: unknown) => {
      const err = error as { stdout?: string; code?: number }
      assert.equal(err.code, 1)
      assert.match(err.stdout ?? "", /recorded-evidence/)
      assert.match(err.stdout ?? "", /bundle-status: missing/)
      return true
    },
  )
})
