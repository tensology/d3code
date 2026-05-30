import { execFile } from "node:child_process"
import { access, readFile, readdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

export interface WebAppCheckItem {
  id: string
  status: "ok" | "missing" | "warning"
  message: string
}

export interface WebAppCheckReport {
  ready: boolean
  root: string
  items: WebAppCheckItem[]
}

export interface WebAppSmokeStep {
  id: string
  status: "ok" | "missing" | "failed"
  message: string
}

export interface WebAppSmokeReport {
  ready: boolean
  root: string
  steps: WebAppSmokeStep[]
}

const execFileAsync = promisify(execFile)
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return ""
  }
}

function item(id: string, status: WebAppCheckItem["status"], message: string): WebAppCheckItem {
  return { id, status, message }
}

export async function checkGeneratedWebApp(root: string): Promise<WebAppCheckReport> {
  const packagePath = join(root, "package.json")
  const tsconfigPath = join(root, "tsconfig.json")
  const serverPath = join(root, "src/server.ts")
  const d3ClientPath = join(root, "src/d3-client.ts")
  const d3RecordPath = join(root, "src/d3-record.ts")
  const apiSmokeTestPath = join(root, "test/api-smoke.test.mjs")
  const indexPath = join(root, "public/index.html")
  const appPath = join(root, "public/app.js")
  const stylesPath = join(root, "public/styles.css")
  const openApiPath = join(root, "openapi.json")
  const mockDataPath = join(root, "mock-data.json")
  const uiPlanPath = join(root, "public/ui-plan.json")
  const dashboardDataPath = join(root, "public/dashboard-data.json")
  const proofDashboardPath = join(root, "public/proof-dashboard.json")
  const accessPlanPath = join(root, "access-plan.json")
  const publicDataValidationPath = join(root, "public", "data-validation-plan.json")
  const publicIndexValidationPath = join(root, "public", "index-validation-plan.json")
  const publicCodeModernizationPath = join(root, "public", "code-modernization-plan.json")
  const publicScreenModernizationPath = join(root, "public", "screen-modernization-plan.json")
  const cockpitTerminalPath = join(root, "cockpit-terminal.json")
  const publicCockpitTerminalPath = join(root, "public", "cockpit-terminal.json")
  const connectorStrategyPath = join(root, "d3-connector-strategy.json")
  const skillPackPath = join(root, "d3code-skill-pack.json")
  const skillManifestPath = join(root, "d3code-skill-manifest.json")
  const publicSkillManifestPath = join(root, "public", "skill-manifest.json")
  const referenceSkillAuditPath = join(root, "d3code-reference-skill-audit.json")
  const publicReferenceSkillAuditPath = join(root, "public", "reference-skill-audit.json")
  const subagentPromptsPath = join(root, "subagent-prompts.json")
  const publicSubagentPromptsPath = join(root, "public", "subagent-prompts.json")
  const liveRunbookPath = join(root, "live-operator-runbook.json")
  const publicLiveRunbookPath = join(root, "public", "live-operator-runbook.json")
  const liveProofReadmePath = join(root, "live-proof", "README.md")
  const liveProofManifestPath = join(root, "live-proof", "live-proof-manifest.json")
  const liveProofProfileDoctorPath = join(root, "live-proof", "profile-doctor.json")
  const liveProofOperatorNotesPath = join(root, "live-proof", "operator-notes.md")
  const liveProofCompileCatalogPath = join(root, "live-proof", "compile-catalog-transcript.txt")
  const liveProofRollbackPath = join(root, "live-proof", "rollback.md")
  const migrationPlanPath = join(root, "migration-plan.json")
  const items: WebAppCheckItem[] = []

  const packageText = await readIfExists(packagePath)
  items.push(item("package", packageText ? "ok" : "missing", packageText ? "package.json exists" : "package.json is missing"))
  if (packageText) {
    try {
      const parsed = JSON.parse(packageText) as { scripts?: Record<string, string>; type?: string }
      items.push(item("package-type", parsed.type === "module" ? "ok" : "warning", parsed.type === "module" ? "package uses ESM" : "package should use type=module"))
      items.push(item("package-build", parsed.scripts?.build ? "ok" : "missing", parsed.scripts?.build ? `build script: ${parsed.scripts.build}` : "build script is missing"))
      items.push(item("package-test", parsed.scripts?.test ? "ok" : "missing", parsed.scripts?.test ? `test script: ${parsed.scripts.test}` : "test script is missing"))
      items.push(item("package-start", parsed.scripts?.start ? "ok" : "missing", parsed.scripts?.start ? `start script: ${parsed.scripts.start}` : "start script is missing"))
    } catch {
      items.push(item("package-json", "missing", "package.json is not valid JSON"))
    }
  }

  items.push(item("tsconfig", await exists(tsconfigPath) ? "ok" : "missing", await exists(tsconfigPath) ? "tsconfig.json exists" : "tsconfig.json is missing"))

  const serverText = await readIfExists(serverPath)
  items.push(item("server", serverText ? "ok" : "missing", serverText ? "src/server.ts exists" : "src/server.ts is missing"))
  if (serverText) {
    items.push(item("health-route", serverText.includes("/health") ? "ok" : "missing", serverText.includes("/health") ? "health route is present" : "health route is missing"))
    items.push(item("openapi-route", serverText.includes("/openapi.json") ? "ok" : "missing", serverText.includes("/openapi.json") ? "OpenAPI route is present" : "OpenAPI route is missing"))
    items.push(item("http-server", serverText.includes("createServer") ? "ok" : "missing", serverText.includes("createServer") ? "HTTP server is present" : "HTTP server is missing"))
    items.push(item("static-ui-route", serverText.includes("sendStatic") ? "ok" : "missing", serverText.includes("sendStatic") ? "static UI route is present" : "static UI route is missing"))
    items.push(item("ui-plan-route", serverText.includes("/ui-plan.json") ? "ok" : "warning", serverText.includes("/ui-plan.json") ? "UI plan route is present" : "UI plan route is missing"))
    items.push(item("dashboard-data-route", serverText.includes("/dashboard-data.json") ? "ok" : "warning", serverText.includes("/dashboard-data.json") ? "dashboard data route is present" : "dashboard data route is missing"))
    items.push(item("proof-dashboard-route", serverText.includes("/proof-dashboard.json") ? "ok" : "warning", serverText.includes("/proof-dashboard.json") ? "proof dashboard route is present" : "proof dashboard route is missing"))
    items.push(item("validation-plan-routes", serverText.includes("/data-validation-plan.json") && serverText.includes("/index-validation-plan.json") ? "ok" : "warning", serverText.includes("/data-validation-plan.json") && serverText.includes("/index-validation-plan.json") ? "data/index validation plan routes are present" : "data/index validation plan routes are missing"))
    items.push(item("modernization-plan-routes", serverText.includes("/code-modernization-plan.json") && serverText.includes("/screen-modernization-plan.json") ? "ok" : "warning", serverText.includes("/code-modernization-plan.json") && serverText.includes("/screen-modernization-plan.json") ? "code/screen modernization plan routes are present" : "code/screen modernization plan routes are missing"))
    items.push(item("skill-manifest-route", serverText.includes("/skill-manifest.json") ? "ok" : "warning", serverText.includes("/skill-manifest.json") ? "skill manifest route is present" : "skill manifest route is missing"))
    items.push(item("reference-skill-audit-route", serverText.includes("/reference-skill-audit.json") ? "ok" : "warning", serverText.includes("/reference-skill-audit.json") ? "reference skill audit route is present" : "reference skill audit route is missing"))
    items.push(item("operations-artifact-routes", serverText.includes("/subagent-prompts.json") && serverText.includes("/live-operator-runbook.json") ? "ok" : "warning", serverText.includes("/subagent-prompts.json") && serverText.includes("/live-operator-runbook.json") ? "subagent prompt and live runbook routes are present" : "subagent prompt or live runbook routes are missing"))
    items.push(item("cockpit-terminal-route", serverText.includes("/cockpit-terminal.json") ? "ok" : "warning", serverText.includes("/cockpit-terminal.json") ? "cockpit terminal contract route is present" : "cockpit terminal contract route is missing"))
    items.push(item("connector-strategy-route", serverText.includes("/connector-strategy.json") ? "ok" : "warning", serverText.includes("/connector-strategy.json") ? "connector strategy route is present" : "connector strategy route is missing"))
    items.push(item("access-plan-route", serverText.includes("/access-plan.json") ? "ok" : "warning", serverText.includes("/access-plan.json") ? "access plan route is present" : "access plan route is missing"))
    items.push(item("access-role-guard", serverText.includes("x-d3code-role") && serverText.includes("D3 access denied") ? "ok" : "missing", serverText.includes("x-d3code-role") && serverText.includes("D3 access denied") ? "cockpit role guard is present on mutation routes" : "cockpit role guard is missing from mutation routes"))
    items.push(item("mutation-journal", serverText.includes("writeMutationJournal") && serverText.includes("mutation-journal.jsonl") ? "ok" : "missing", serverText.includes("writeMutationJournal") && serverText.includes("mutation-journal.jsonl") ? "mutation journal is written by generated write routes" : "mutation journal is missing from generated write routes"))
    items.push(item("mutation-rollback-proof", serverText.includes("rollback:") && serverText.includes("before payload") ? "ok" : "missing", serverText.includes("rollback:") && serverText.includes("before payload") ? "mutation journal includes rollback instructions" : "mutation journal rollback instructions are missing"))
    items.push(item("terminal-send-route", serverText.includes("/terminal/send") ? "ok" : "missing", serverText.includes("/terminal/send") ? "cockpit terminal send route is present" : "cockpit terminal send route is missing"))
    items.push(item("terminal-screen-parser", serverText.includes("parseTerminalScreen") && serverText.includes("D3CODE_TERMINAL_ENABLED") ? "ok" : "missing", serverText.includes("parseTerminalScreen") && serverText.includes("D3CODE_TERMINAL_ENABLED") ? "terminal screen parser and live-D3 enable guard are present" : "terminal screen parser or live-D3 enable guard is missing"))
    items.push(item("terminal-journal", serverText.includes("writeTerminalJournal") && serverText.includes("terminal-journal.jsonl") ? "ok" : "missing", serverText.includes("writeTerminalJournal") && serverText.includes("terminal-journal.jsonl") ? "terminal screen metadata journal is written by cockpit terminal route" : "terminal screen metadata journal is missing from cockpit terminal route"))
    items.push(item("terminal-transcript-redaction", serverText.includes("D3CODE_TERMINAL_RECORD_TRANSCRIPT") && serverText.includes("transcriptRedacted") ? "ok" : "missing", serverText.includes("D3CODE_TERMINAL_RECORD_TRANSCRIPT") && serverText.includes("transcriptRedacted") ? "terminal transcript capture is redacted unless explicitly enabled" : "terminal transcript redaction guard is missing"))
  }

  const d3ClientText = await readIfExists(d3ClientPath)
  items.push(item("d3-client", d3ClientText ? "ok" : "missing", d3ClientText ? "src/d3-client.ts exists" : "src/d3-client.ts is missing"))
  if (d3ClientText) {
    items.push(item("d3-command-env", d3ClientText.includes("D3CODE_D3_COMMAND") ? "ok" : "missing", d3ClientText.includes("D3CODE_D3_COMMAND") ? "D3 command environment seam is present" : "D3 command environment seam is missing"))
    items.push(item("mock-mode", d3ClientText.includes("D3CODE_MOCK") ? "ok" : "warning", d3ClientText.includes("D3CODE_MOCK") ? "mock mode is present" : "mock mode is missing"))
    items.push(item("d3-write-guard", d3ClientText.includes("D3CODE_ALLOW_WRITES") && d3ClientText.includes("mutation blocked") ? "ok" : "missing", d3ClientText.includes("D3CODE_ALLOW_WRITES") && d3ClientText.includes("mutation blocked") ? "D3 mutation opt-in guard is present" : "D3 mutation opt-in guard is missing"))
  }

  const d3RecordText = await readIfExists(d3RecordPath)
  items.push(item("d3-record-mapper", d3RecordText ? "ok" : "missing", d3RecordText ? "src/d3-record.ts exists" : "src/d3-record.ts is missing"))
  if (d3RecordText) {
    items.push(item("d3-record-attributes", d3RecordText.includes("\\u00fe") && d3RecordText.includes("\\u00fd") ? "ok" : "missing", d3RecordText.includes("\\u00fe") && d3RecordText.includes("\\u00fd") ? "attribute and multivalue parsing is present" : "attribute and multivalue parsing is missing"))
    items.push(item("d3-record-serializer", d3RecordText.includes("formatD3Record") ? "ok" : "missing", d3RecordText.includes("formatD3Record") ? "attribute and multivalue serialization is present" : "attribute and multivalue serialization is missing"))
  }

  const apiSmokeTestText = await readIfExists(apiSmokeTestPath)
  items.push(item("api-smoke-test", apiSmokeTestText ? "ok" : "missing", apiSmokeTestText ? "test/api-smoke.test.mjs exists" : "test/api-smoke.test.mjs is missing"))
  if (apiSmokeTestText) {
    items.push(item("api-smoke-health", apiSmokeTestText.includes("/health") && apiSmokeTestText.includes("D3CODE_MOCK") ? "ok" : "missing", apiSmokeTestText.includes("/health") && apiSmokeTestText.includes("D3CODE_MOCK") ? "mock health smoke test is present" : "mock health smoke test is incomplete"))
    items.push(item("api-smoke-openapi", apiSmokeTestText.includes("/openapi.json") && apiSmokeTestText.includes("3.1.0") ? "ok" : "missing", apiSmokeTestText.includes("/openapi.json") && apiSmokeTestText.includes("3.1.0") ? "OpenAPI smoke test is present" : "OpenAPI smoke test is missing"))
    items.push(item("api-smoke-public-artifacts", apiSmokeTestText.includes("/ui-plan.json") && apiSmokeTestText.includes("/dashboard-data.json") && apiSmokeTestText.includes("/proof-dashboard.json") && apiSmokeTestText.includes("/skill-manifest.json") ? "ok" : "missing", apiSmokeTestText.includes("/ui-plan.json") && apiSmokeTestText.includes("/dashboard-data.json") && apiSmokeTestText.includes("/proof-dashboard.json") && apiSmokeTestText.includes("/skill-manifest.json") ? "public cockpit/proof/skill artifact smoke tests are present" : "public cockpit/proof/skill artifact smoke tests are missing"))
    items.push(item("api-smoke-reference-skill-audit", apiSmokeTestText.includes("/reference-skill-audit.json") && apiSmokeTestText.includes("referenceSkillAudit.items") ? "ok" : "missing", apiSmokeTestText.includes("/reference-skill-audit.json") && apiSmokeTestText.includes("referenceSkillAudit.items") ? "reference skill audit smoke test is present" : "reference skill audit smoke test is missing"))
    items.push(item("api-smoke-operations-artifacts", apiSmokeTestText.includes("/subagent-prompts.json") && apiSmokeTestText.includes("/live-operator-runbook.json") && apiSmokeTestText.includes("subagentPrompts.packets") && apiSmokeTestText.includes("liveRunbook.phases") ? "ok" : "missing", apiSmokeTestText.includes("/subagent-prompts.json") && apiSmokeTestText.includes("/live-operator-runbook.json") && apiSmokeTestText.includes("subagentPrompts.packets") && apiSmokeTestText.includes("liveRunbook.phases") ? "subagent prompt and live runbook smoke tests are present" : "subagent prompt or live runbook smoke tests are missing"))
    items.push(item("api-smoke-validation-plans", apiSmokeTestText.includes("/data-validation-plan.json") && apiSmokeTestText.includes("/index-validation-plan.json") && apiSmokeTestText.includes("dataValidation.items") && apiSmokeTestText.includes("indexValidation.items") ? "ok" : "missing", apiSmokeTestText.includes("/data-validation-plan.json") && apiSmokeTestText.includes("/index-validation-plan.json") && apiSmokeTestText.includes("dataValidation.items") && apiSmokeTestText.includes("indexValidation.items") ? "data/index validation plan smoke tests are present" : "data/index validation plan smoke tests are missing"))
    items.push(item("api-smoke-modernization-plans", apiSmokeTestText.includes("/code-modernization-plan.json") && apiSmokeTestText.includes("/screen-modernization-plan.json") && apiSmokeTestText.includes("codeModernization.items") && apiSmokeTestText.includes("screenModernization.items") ? "ok" : "missing", apiSmokeTestText.includes("/code-modernization-plan.json") && apiSmokeTestText.includes("/screen-modernization-plan.json") && apiSmokeTestText.includes("codeModernization.items") && apiSmokeTestText.includes("screenModernization.items") ? "code/screen modernization plan smoke tests are present" : "code/screen modernization plan smoke tests are missing"))
    items.push(item("api-smoke-mock-data", apiSmokeTestText.includes("mockData") && apiSmokeTestText.includes("mock-data.json") ? "ok" : "missing", apiSmokeTestText.includes("mockData") && apiSmokeTestText.includes("mock-data.json") ? "captured mock data smoke test is present" : "captured mock data smoke test is missing"))
    items.push(item("api-smoke-free-port", apiSmokeTestText.includes("createTcpServer") && apiSmokeTestText.includes("freePort") ? "ok" : "missing", apiSmokeTestText.includes("createTcpServer") && apiSmokeTestText.includes("freePort") ? "generated smoke tests reserve available ports" : "generated smoke tests use collision-prone fixed/random ports"))
    items.push(item("api-smoke-record-roundtrip", apiSmokeTestText.includes("formatD3Record") && apiSmokeTestText.includes("parseD3Record") ? "ok" : "missing", apiSmokeTestText.includes("formatD3Record") && apiSmokeTestText.includes("parseD3Record") ? "D3 record roundtrip smoke test is present" : "D3 record roundtrip smoke test is missing"))
    items.push(item("api-smoke-access-denied", apiSmokeTestText.includes("access denied") && apiSmokeTestText.includes("D3CODE_ALLOW_WRITES") ? "ok" : "missing", apiSmokeTestText.includes("access denied") && apiSmokeTestText.includes("D3CODE_ALLOW_WRITES") ? "cockpit access-denied write smoke test is present" : "cockpit access-denied write smoke test is missing"))
    items.push(item("api-smoke-terminal-send", apiSmokeTestText.includes("/terminal/send") && apiSmokeTestText.includes("terminal.screen.lines") ? "ok" : "missing", apiSmokeTestText.includes("/terminal/send") && apiSmokeTestText.includes("terminal.screen.lines") ? "mock cockpit terminal send smoke test is present" : "mock cockpit terminal send smoke test is missing"))
    items.push(item("api-smoke-terminal-journal", apiSmokeTestText.includes("terminal-journal.jsonl") && apiSmokeTestText.includes("transcriptRedacted") ? "ok" : "missing", apiSmokeTestText.includes("terminal-journal.jsonl") && apiSmokeTestText.includes("transcriptRedacted") ? "mock cockpit terminal journal smoke test is present" : "mock cockpit terminal journal smoke test is missing"))
    items.push(item("api-smoke-cockpit-terminal", apiSmokeTestText.includes("/cockpit-terminal.json") && apiSmokeTestText.includes("requiredLiveProof") && apiSmokeTestText.includes("terminal-capture") && apiSmokeTestText.includes("sendPolicy.enabledByDefault") && apiSmokeTestText.includes("compile-catalog") ? "ok" : "missing", apiSmokeTestText.includes("/cockpit-terminal.json") && apiSmokeTestText.includes("requiredLiveProof") && apiSmokeTestText.includes("terminal-capture") && apiSmokeTestText.includes("sendPolicy.enabledByDefault") && apiSmokeTestText.includes("compile-catalog") ? "cockpit terminal contract smoke test is present" : "cockpit terminal contract smoke test is missing"))
    items.push(item("api-smoke-connector-strategy", apiSmokeTestText.includes("/connector-strategy.json") && apiSmokeTestText.includes("screen-buffer") && apiSmokeTestText.includes("uopy") ? "ok" : "missing", apiSmokeTestText.includes("/connector-strategy.json") && apiSmokeTestText.includes("screen-buffer") && apiSmokeTestText.includes("uopy") ? "connector strategy smoke test is present" : "connector strategy smoke test is missing"))
    items.push(item("api-smoke-mutation-journal", apiSmokeTestText.includes("mutation-journal.jsonl") && apiSmokeTestText.includes("JOURNAL-SMOKE") && apiSmokeTestText.includes("\"rollback\"") ? "ok" : "missing", apiSmokeTestText.includes("mutation-journal.jsonl") && apiSmokeTestText.includes("JOURNAL-SMOKE") && apiSmokeTestText.includes("\"rollback\"") ? "mock mutation journal smoke test is present" : "mock mutation journal smoke test is missing"))
  }

  const migrationPlanText = await readIfExists(migrationPlanPath)
  items.push(item("migration-plan", migrationPlanText ? "ok" : "warning", migrationPlanText ? "migration-plan.json exists" : "migration-plan.json is missing; resource route checks are limited"))
  if (migrationPlanText) {
    try {
      const plan = JSON.parse(migrationPlanText) as { resources?: Array<{ resource: string }> }
      for (const resource of plan.resources ?? []) {
        const base = join(root, "src", resource.resource)
        items.push(item(`resource-${resource.resource}-routes`, await exists(join(base, `${resource.resource}.routes.ts`)) ? "ok" : "missing", `routes for ${resource.resource}`))
        items.push(item(`resource-${resource.resource}-repository`, await exists(join(base, `${resource.resource}.repository.ts`)) ? "ok" : "missing", `repository for ${resource.resource}`))
        items.push(item(`resource-${resource.resource}-types`, await exists(join(base, `${resource.resource}.types.ts`)) ? "ok" : "missing", `types for ${resource.resource}`))
      }
    } catch {
      items.push(item("migration-plan-json", "warning", "migration-plan.json is not valid JSON"))
    }
  }

  items.push(item("openapi", await exists(openApiPath) ? "ok" : "warning", await exists(openApiPath) ? "openapi.json exists" : "openapi.json is missing"))
  items.push(item("mock-data", await exists(mockDataPath) ? "ok" : "warning", await exists(mockDataPath) ? "mock-data.json exists" : "mock-data.json is missing; generated mock mode has no captured records"))
  items.push(item("ui-plan", await exists(uiPlanPath) ? "ok" : "warning", await exists(uiPlanPath) ? "public/ui-plan.json exists" : "public/ui-plan.json is missing; generated browser UI has only resource metadata"))
  const dashboardDataText = await readIfExists(dashboardDataPath)
  items.push(item("dashboard-data", dashboardDataText ? "ok" : "warning", dashboardDataText ? "public/dashboard-data.json exists" : "public/dashboard-data.json is missing; cockpit graph has no bundled estate data"))
  if (dashboardDataText) {
    try {
      const dashboard = JSON.parse(dashboardDataText) as { nodes?: unknown[]; edges?: unknown[]; panels?: Array<{ id?: string }> }
      items.push(item("dashboard-data-graph", Array.isArray(dashboard.nodes) && Array.isArray(dashboard.edges) ? "ok" : "warning", Array.isArray(dashboard.nodes) && Array.isArray(dashboard.edges) ? `nodes:${dashboard.nodes.length}; edges:${dashboard.edges.length}` : "dashboard graph nodes/edges are missing"))
      items.push(item("dashboard-data-panels", dashboard.panels?.some((panel) => panel.id === "risks") && dashboard.panels?.some((panel) => panel.id === "model") ? "ok" : "warning", dashboard.panels ? `panels:${dashboard.panels.map((panel) => panel.id).join(",")}` : "dashboard panels are missing"))
    } catch {
      items.push(item("dashboard-data-json", "warning", "public/dashboard-data.json is not valid JSON"))
    }
  }
  const proofDashboardText = await readIfExists(proofDashboardPath)
  items.push(item("proof-dashboard", proofDashboardText ? "ok" : "warning", proofDashboardText ? "public/proof-dashboard.json exists" : "public/proof-dashboard.json is missing; GSD proof state is not bundled for the cockpit"))
  if (proofDashboardText) {
    try {
      const proof = JSON.parse(proofDashboardText) as { readiness?: { gates?: unknown[] }; completion?: { requirements?: unknown[] }; release?: { decision?: string }; qaEvidence?: unknown }
      items.push(item("proof-dashboard-readiness", Array.isArray(proof.readiness?.gates) ? "ok" : "warning", Array.isArray(proof.readiness?.gates) ? `gates:${proof.readiness.gates.length}` : "proof dashboard readiness gates are missing"))
      items.push(item("proof-dashboard-completion", Array.isArray(proof.completion?.requirements) ? "ok" : "warning", Array.isArray(proof.completion?.requirements) ? `requirements:${proof.completion.requirements.length}` : "proof dashboard completion requirements are missing"))
      items.push(item("proof-dashboard-release", proof.release?.decision ? "ok" : "warning", proof.release?.decision ? `decision:${proof.release.decision}` : "proof dashboard release decision is missing"))
    } catch {
      items.push(item("proof-dashboard-json", "warning", "public/proof-dashboard.json is not valid JSON"))
    }
  }
  const dataValidationText = await readIfExists(publicDataValidationPath)
  items.push(item("public-data-validation-plan", dataValidationText ? "ok" : "warning", dataValidationText ? "public data-validation-plan.json exists" : "public data-validation-plan.json is missing"))
  if (dataValidationText) {
    try {
      const dataValidation = JSON.parse(dataValidationText) as { items?: unknown[] }
      items.push(item("public-data-validation-items", Array.isArray(dataValidation.items) ? "ok" : "warning", Array.isArray(dataValidation.items) ? `items:${dataValidation.items.length}` : "data validation items are missing"))
    } catch {
      items.push(item("public-data-validation-json", "warning", "public data-validation-plan.json is not valid JSON"))
    }
  }
  const indexValidationText = await readIfExists(publicIndexValidationPath)
  items.push(item("public-index-validation-plan", indexValidationText ? "ok" : "warning", indexValidationText ? "public index-validation-plan.json exists" : "public index-validation-plan.json is missing"))
  if (indexValidationText) {
    try {
      const indexValidation = JSON.parse(indexValidationText) as { items?: unknown[] }
      items.push(item("public-index-validation-items", Array.isArray(indexValidation.items) ? "ok" : "warning", Array.isArray(indexValidation.items) ? `items:${indexValidation.items.length}` : "index validation items are missing"))
    } catch {
      items.push(item("public-index-validation-json", "warning", "public index-validation-plan.json is not valid JSON"))
    }
  }
  const codeModernizationText = await readIfExists(publicCodeModernizationPath)
  items.push(item("public-code-modernization-plan", codeModernizationText ? "ok" : "warning", codeModernizationText ? "public code-modernization-plan.json exists" : "public code-modernization-plan.json is missing"))
  if (codeModernizationText) {
    try {
      const codeModernization = JSON.parse(codeModernizationText) as { items?: unknown[] }
      items.push(item("public-code-modernization-items", Array.isArray(codeModernization.items) ? "ok" : "warning", Array.isArray(codeModernization.items) ? `items:${codeModernization.items.length}` : "code modernization items are missing"))
    } catch {
      items.push(item("public-code-modernization-json", "warning", "public code-modernization-plan.json is not valid JSON"))
    }
  }
  const screenModernizationText = await readIfExists(publicScreenModernizationPath)
  items.push(item("public-screen-modernization-plan", screenModernizationText ? "ok" : "warning", screenModernizationText ? "public screen-modernization-plan.json exists" : "public screen-modernization-plan.json is missing"))
  if (screenModernizationText) {
    try {
      const screenModernization = JSON.parse(screenModernizationText) as { items?: unknown[] }
      items.push(item("public-screen-modernization-items", Array.isArray(screenModernization.items) ? "ok" : "warning", Array.isArray(screenModernization.items) ? `items:${screenModernization.items.length}` : "screen modernization items are missing"))
    } catch {
      items.push(item("public-screen-modernization-json", "warning", "public screen-modernization-plan.json is not valid JSON"))
    }
  }
  const accessPlanText = await readIfExists(accessPlanPath)
  items.push(item("access-plan", accessPlanText ? "ok" : "warning", accessPlanText ? "access-plan.json exists" : "access-plan.json is missing; cockpit user/role access proof is not bundled"))
  if (accessPlanText) {
    try {
      const accessPlan = JSON.parse(accessPlanText) as { users?: unknown[]; grants?: unknown[] }
      items.push(item("access-plan-users", Array.isArray(accessPlan.users) ? "ok" : "warning", Array.isArray(accessPlan.users) ? `users:${accessPlan.users.length}` : "access-plan users are missing"))
      items.push(item("access-plan-grants", Array.isArray(accessPlan.grants) ? "ok" : "warning", Array.isArray(accessPlan.grants) ? `grants:${accessPlan.grants.length}` : "access-plan grants are missing"))
    } catch {
      items.push(item("access-plan-json", "warning", "access-plan.json is not valid JSON"))
    }
  }
  const cockpitTerminalText = await readIfExists(cockpitTerminalPath)
  items.push(item("cockpit-terminal-contract", cockpitTerminalText ? "ok" : "warning", cockpitTerminalText ? "cockpit-terminal.json exists" : "cockpit-terminal.json is missing; terminal bridge proof is not bundled"))
  if (cockpitTerminalText) {
    try {
      const contract = JSON.parse(cockpitTerminalText) as { terminalModel?: string; features?: Array<{ id?: string }>; sendPolicy?: { enabledByDefault?: boolean; enableEnv?: string; blockedUntil?: string[] }; commandPlan?: Array<{ id?: string; safety?: string }>; screenParity?: { requiredEvidence?: string[]; unsupportedUntilProven?: string[] } }
      items.push(item("cockpit-terminal-powerterm", contract.terminalModel ? "ok" : "warning", contract.terminalModel ? `terminal model: ${contract.terminalModel}` : "terminal model is missing"))
      items.push(item("cockpit-terminal-uopy-risk", contract.features?.some((feature) => feature.id === "uopy") ? "ok" : "warning", contract.features?.some((feature) => feature.id === "uopy") ? "UOPY adapter risk is represented" : "UOPY adapter risk is missing"))
      items.push(item("cockpit-terminal-send-policy", contract.sendPolicy?.enabledByDefault === false && contract.sendPolicy.enableEnv === "D3CODE_TERMINAL_ENABLED=1" ? "ok" : "warning", contract.sendPolicy ? "terminal sends are explicitly gated" : "terminal send policy is missing"))
      items.push(item("cockpit-terminal-command-plan", contract.commandPlan?.some((command) => command.id === "screen-capture") && contract.commandPlan?.some((command) => command.id === "compile-catalog" && command.safety === "confirm") ? "ok" : "warning", contract.commandPlan ? `commands:${contract.commandPlan.map((command) => command.id).join(",")}` : "terminal command plan is missing"))
      items.push(item("cockpit-terminal-screen-parity", contract.screenParity?.requiredEvidence?.some((entry) => entry.includes("@()")) && contract.screenParity?.unsupportedUntilProven?.some((entry) => entry.includes("UOPY")) ? "ok" : "warning", contract.screenParity ? "PowerTerm screen parity evidence is explicit" : "screen parity contract is missing"))
    } catch {
      items.push(item("cockpit-terminal-json", "warning", "cockpit-terminal.json is not valid JSON"))
    }
  }
  items.push(item("public-cockpit-terminal-contract", await exists(publicCockpitTerminalPath) ? "ok" : "warning", await exists(publicCockpitTerminalPath) ? "public cockpit-terminal.json exists for generated cockpit rendering" : "public cockpit-terminal.json is missing"))
  const connectorStrategyText = await readIfExists(connectorStrategyPath)
  items.push(item("d3-connector-strategy", connectorStrategyText ? "ok" : "warning", connectorStrategyText ? "d3-connector-strategy.json exists" : "d3-connector-strategy.json is missing; connector proof is not bundled"))
  if (connectorStrategyText) {
    try {
      const strategy = JSON.parse(connectorStrategyText) as { layers?: Array<{ id?: string }>; cockpitRequirements?: string[]; liveSpikes?: string[] }
      items.push(item("d3-connector-strategy-layers", strategy.layers?.some((layer) => layer.id === "screen-buffer") && strategy.layers?.some((layer) => layer.id === "uopy") ? "ok" : "warning", strategy.layers ? `layers:${strategy.layers.map((layer) => layer.id).join(",")}` : "connector strategy layers are missing"))
      items.push(item("d3-connector-strategy-proof", strategy.cockpitRequirements?.some((entry) => entry.includes("UOPY")) && strategy.liveSpikes?.some((entry) => entry.includes("terminal-capture")) ? "ok" : "warning", "connector strategy names cockpit requirements and terminal-capture live proof"))
    } catch {
      items.push(item("d3-connector-strategy-json", "warning", "d3-connector-strategy.json is not valid JSON"))
    }
  }
  const skillPackText = await readIfExists(skillPackPath)
  items.push(item("d3code-skill-pack", skillPackText ? "ok" : "warning", skillPackText ? "d3code-skill-pack.json exists" : "d3code-skill-pack.json is missing; bundle-specific baked skill proof is not bundled"))
  if (skillPackText) {
    try {
      const pack = JSON.parse(skillPackText) as { modes?: Array<{ mode?: string }>; evidenceGates?: Array<{ id?: string }> }
      items.push(item("d3code-skill-pack-modes", pack.modes?.some((mode) => mode.mode === "migrate") && pack.modes?.some((mode) => mode.mode === "gsd") ? "ok" : "warning", pack.modes ? `modes:${pack.modes.map((mode) => mode.mode).join(",")}` : "skill pack modes are missing"))
      items.push(item("d3code-skill-pack-evidence", pack.evidenceGates?.some((gate) => gate.id === "live-d3-proof") ? "ok" : "warning", pack.evidenceGates?.some((gate) => gate.id === "live-d3-proof") ? "skill pack includes live-D3 proof gate" : "skill pack live-D3 proof gate is missing"))
    } catch {
      items.push(item("d3code-skill-pack-json", "warning", "d3code-skill-pack.json is not valid JSON"))
    }
  }
  const skillManifestText = await readIfExists(skillManifestPath)
  items.push(item("d3code-skill-manifest", skillManifestText ? "ok" : "warning", skillManifestText ? "d3code-skill-manifest.json exists" : "d3code-skill-manifest.json is missing; portable baked skill manifest is not bundled"))
  if (skillManifestText) {
    try {
      const manifest = JSON.parse(skillManifestText) as { bakedSkills?: unknown[]; coverage?: { ready?: boolean; items?: unknown[] }; referenceSkills?: { ready?: boolean; families?: unknown[] }; skillPack?: { modes?: unknown[] }; phaseSkillMap?: Array<{ phase?: string; skills?: unknown[]; subagents?: unknown[]; commands?: unknown[] }> }
      items.push(item("d3code-skill-manifest-skills", Array.isArray(manifest.bakedSkills) && manifest.bakedSkills.length > 0 ? "ok" : "warning", Array.isArray(manifest.bakedSkills) ? `skills:${manifest.bakedSkills.length}` : "baked skill catalog is missing from manifest"))
      items.push(item("d3code-skill-manifest-coverage", manifest.coverage?.ready === true && Array.isArray(manifest.coverage.items) ? "ok" : "warning", manifest.coverage?.ready === true && Array.isArray(manifest.coverage.items) ? `coverage:${manifest.coverage.items.length}` : "skill coverage is not ready in manifest"))
      items.push(item("d3code-skill-manifest-references", manifest.referenceSkills?.ready === true && Array.isArray(manifest.referenceSkills.families) ? "ok" : "warning", manifest.referenceSkills?.ready === true && Array.isArray(manifest.referenceSkills.families) ? `reference families:${manifest.referenceSkills.families.length}` : "reference skill mapping is not ready in manifest"))
      items.push(item("d3code-skill-manifest-pack", Array.isArray(manifest.skillPack?.modes) ? "ok" : "warning", Array.isArray(manifest.skillPack?.modes) ? `bundle modes:${manifest.skillPack.modes.length}` : "bundle skill pack is missing from manifest"))
      items.push(item("d3code-skill-manifest-phases", manifest.phaseSkillMap?.some((phase) => phase.phase === "api" && Array.isArray(phase.skills) && phase.skills.includes("rest-api-generation")) && manifest.phaseSkillMap?.some((phase) => phase.phase === "verify" && Array.isArray(phase.commands) && phase.commands.some((command) => String(command).includes("npm run regression"))) ? "ok" : "warning", manifest.phaseSkillMap ? `phase skill map:${manifest.phaseSkillMap.map((phase) => phase.phase).join(",")}` : "phase skill map is missing from manifest"))
    } catch {
      items.push(item("d3code-skill-manifest-json", "warning", "d3code-skill-manifest.json is not valid JSON"))
    }
  }
  items.push(item("public-skill-manifest", await exists(publicSkillManifestPath) ? "ok" : "warning", await exists(publicSkillManifestPath) ? "public skill-manifest.json exists for cockpit/subagent inspection" : "public skill-manifest.json is missing"))
  const referenceSkillAuditText = await readIfExists(referenceSkillAuditPath)
  items.push(item("d3code-reference-skill-audit", referenceSkillAuditText ? "ok" : "warning", referenceSkillAuditText ? "d3code-reference-skill-audit.json exists" : "d3code-reference-skill-audit.json is missing; per-reference skill proof is not bundled"))
  if (referenceSkillAuditText) {
    try {
      const audit = JSON.parse(referenceSkillAuditText) as { ready?: boolean; total?: number; items?: Array<{ status?: string; productSkills?: unknown[] }> }
      items.push(item("d3code-reference-skill-audit-ready", audit.ready === true && Array.isArray(audit.items) ? "ok" : "warning", audit.ready === true && Array.isArray(audit.items) ? `mapped:${audit.items.length}/${audit.total ?? audit.items.length}` : "reference skill audit is not ready"))
      items.push(item("d3code-reference-skill-audit-decisions", audit.items?.some((entry) => entry.status === "baked") && audit.items?.some((entry) => entry.status === "adapted") && audit.items?.some((entry) => entry.status === "out-of-scope") ? "ok" : "warning", "reference skill audit includes baked, adapted, and out-of-scope decisions"))
    } catch {
      items.push(item("d3code-reference-skill-audit-json", "warning", "d3code-reference-skill-audit.json is not valid JSON"))
    }
  }
  const publicReferenceSkillAuditText = await readIfExists(publicReferenceSkillAuditPath)
  items.push(item("public-reference-skill-audit", publicReferenceSkillAuditText ? "ok" : "warning", publicReferenceSkillAuditText ? "public reference-skill-audit.json exists for cockpit rendering" : "public reference-skill-audit.json is missing"))
  if (publicReferenceSkillAuditText) {
    try {
      const audit = JSON.parse(publicReferenceSkillAuditText) as { ready?: boolean; total?: number; items?: unknown[] }
      items.push(item("public-reference-skill-audit-ready", audit.ready === true && Array.isArray(audit.items) ? "ok" : "warning", audit.ready === true && Array.isArray(audit.items) ? `mapped:${audit.items.length}/${audit.total ?? audit.items.length}` : "public reference skill audit is not ready"))
    } catch {
      items.push(item("public-reference-skill-audit-json", "warning", "public reference-skill-audit.json is not valid JSON"))
    }
  }
  const subagentPromptsText = await readIfExists(subagentPromptsPath)
  items.push(item("subagent-prompts", subagentPromptsText ? "ok" : "warning", subagentPromptsText ? "subagent-prompts.json exists" : "subagent-prompts.json is missing; isolated bundle subagent prompts are not bundled"))
  if (subagentPromptsText) {
    try {
      const prompts = JSON.parse(subagentPromptsText) as { packets?: Array<{ agent?: string; prompt?: string; allowedTools?: unknown[]; deniedActions?: unknown[] }> }
      items.push(item("subagent-prompt-packets", Array.isArray(prompts.packets) && prompts.packets.length > 0 ? "ok" : "warning", Array.isArray(prompts.packets) ? `packets:${prompts.packets.length}` : "subagent prompt packets are missing"))
      items.push(item("subagent-prompt-boundaries", prompts.packets?.some((packet) => Array.isArray(packet.allowedTools) && Array.isArray(packet.deniedActions) && String(packet.prompt ?? "").includes("Evidence gate")) ? "ok" : "warning", prompts.packets?.some((packet) => Array.isArray(packet.allowedTools) && Array.isArray(packet.deniedActions) && String(packet.prompt ?? "").includes("Evidence gate")) ? "subagent prompt packets include tool, denial, and evidence boundaries" : "subagent prompt packets are missing tool, denial, or evidence boundaries"))
    } catch {
      items.push(item("subagent-prompts-json", "warning", "subagent-prompts.json is not valid JSON"))
    }
  }
  const publicSubagentPromptsText = await readIfExists(publicSubagentPromptsPath)
  items.push(item("public-subagent-prompts", publicSubagentPromptsText ? "ok" : "warning", publicSubagentPromptsText ? "public subagent-prompts.json exists for cockpit operations rendering" : "public subagent-prompts.json is missing"))
  if (publicSubagentPromptsText) {
    try {
      const prompts = JSON.parse(publicSubagentPromptsText) as { packets?: Array<{ prompt?: string; allowedTools?: unknown[]; deniedActions?: unknown[] }> }
      items.push(item("public-subagent-prompt-packets", Array.isArray(prompts.packets) && prompts.packets.length > 0 ? "ok" : "warning", Array.isArray(prompts.packets) ? `packets:${prompts.packets.length}` : "public subagent prompt packets are missing"))
      items.push(item("public-subagent-prompt-boundaries", prompts.packets?.some((packet) => Array.isArray(packet.allowedTools) && Array.isArray(packet.deniedActions) && String(packet.prompt ?? "").includes("Evidence gate")) ? "ok" : "warning", "public subagent prompt packets expose tool, denial, and evidence boundaries"))
    } catch {
      items.push(item("public-subagent-prompts-json", "warning", "public subagent-prompts.json is not valid JSON"))
    }
  }
  const liveRunbookText = await readIfExists(liveRunbookPath)
  items.push(item("live-operator-runbook", liveRunbookText ? "ok" : "warning", liveRunbookText ? "live-operator-runbook.json exists" : "live-operator-runbook.json is missing; live D3 operator proof path is not bundled"))
  if (liveRunbookText) {
    try {
      const runbook = JSON.parse(liveRunbookText) as { phases?: Array<{ id?: string; commands?: unknown[]; evidence?: unknown[] }> }
      items.push(item("live-operator-runbook-phases", runbook.phases?.some((phase) => phase.id === "live-d3-proof") && runbook.phases?.some((phase) => phase.id === "generated-qa-proof") ? "ok" : "warning", runbook.phases ? `phases:${runbook.phases.map((phase) => phase.id).join(",")}` : "live operator runbook phases are missing"))
      items.push(item("live-operator-runbook-evidence", runbook.phases?.some((phase) => Array.isArray(phase.commands) && Array.isArray(phase.evidence) && phase.commands.some((command) => String(command).includes("live-proof"))) ? "ok" : "warning", runbook.phases?.some((phase) => Array.isArray(phase.commands) && Array.isArray(phase.evidence) && phase.commands.some((command) => String(command).includes("live-proof"))) ? "live operator runbook names commands and evidence gates" : "live operator runbook is missing live-proof commands or evidence gates"))
      const runbookCommands = runbook.phases?.flatMap((phase) => Array.isArray(phase.commands) ? phase.commands.map(String) : []) ?? []
      const runbookEvidence = runbook.phases?.flatMap((phase) => Array.isArray(phase.evidence) ? phase.evidence.map(String) : []) ?? []
      items.push(item("live-operator-runbook-scaffold", runbookCommands.some((command) => command.includes("live-proof-init") && command.includes("--screen-command")) && runbookCommands.some((command) => command.includes("live-proof-check")) && runbookEvidence.some((proof) => proof.includes("live-proof-manifest.json")) ? "ok" : "warning", "live operator runbook creates and verifies the manifest-backed live-proof folder"))
    } catch {
      items.push(item("live-operator-runbook-json", "warning", "live-operator-runbook.json is not valid JSON"))
    }
  }
  const publicLiveRunbookText = await readIfExists(publicLiveRunbookPath)
  items.push(item("public-live-operator-runbook", publicLiveRunbookText ? "ok" : "warning", publicLiveRunbookText ? "public live-operator-runbook.json exists for cockpit operations rendering" : "public live-operator-runbook.json is missing"))
  if (publicLiveRunbookText) {
    try {
      const runbook = JSON.parse(publicLiveRunbookText) as { phases?: Array<{ id?: string; commands?: unknown[]; evidence?: unknown[] }> }
      items.push(item("public-live-operator-runbook-phases", runbook.phases?.some((phase) => phase.id === "live-d3-proof") && runbook.phases?.some((phase) => phase.id === "generated-qa-proof") ? "ok" : "warning", runbook.phases ? `phases:${runbook.phases.map((phase) => phase.id).join(",")}` : "public live operator runbook phases are missing"))
      items.push(item("public-live-operator-runbook-evidence", runbook.phases?.some((phase) => Array.isArray(phase.commands) && Array.isArray(phase.evidence) && phase.commands.some((command) => String(command).includes("live-proof"))) ? "ok" : "warning", "public live operator runbook exposes commands and evidence gates"))
    } catch {
      items.push(item("public-live-operator-runbook-json", "warning", "public live-operator-runbook.json is not valid JSON"))
    }
  }
  const liveProofReadmeText = await readIfExists(liveProofReadmePath)
  items.push(item("live-proof-scaffold", liveProofReadmeText ? "ok" : "warning", liveProofReadmeText ? "live-proof scaffold README exists" : "live-proof scaffold README is missing"))
  if (liveProofReadmeText) {
    items.push(item("live-proof-scaffold-checklist", liveProofReadmeText.includes("live-proof-check") && liveProofReadmeText.includes("terminal-capture") && liveProofReadmeText.includes("live-proof-manifest.json") ? "ok" : "warning", liveProofReadmeText.includes("live-proof-check") && liveProofReadmeText.includes("terminal-capture") && liveProofReadmeText.includes("live-proof-manifest.json") ? "live-proof scaffold names manifest, check, and capture commands" : "live-proof scaffold checklist is incomplete"))
  }
  items.push(item("live-proof-scaffold-manifest", await exists(liveProofManifestPath) ? "ok" : "warning", await exists(liveProofManifestPath) ? "live-proof manifest placeholder exists" : "live-proof manifest placeholder is missing"))
  items.push(item("live-proof-scaffold-profile-doctor", await exists(liveProofProfileDoctorPath) ? "ok" : "warning", await exists(liveProofProfileDoctorPath) ? "live-proof profile-doctor placeholder exists" : "live-proof profile-doctor placeholder is missing"))
  items.push(item("live-proof-scaffold-operator-notes", await exists(liveProofOperatorNotesPath) ? "ok" : "warning", await exists(liveProofOperatorNotesPath) ? "live-proof operator notes placeholder exists" : "live-proof operator notes placeholder is missing"))
  items.push(item("live-proof-scaffold-compile-catalog", await exists(liveProofCompileCatalogPath) ? "ok" : "warning", await exists(liveProofCompileCatalogPath) ? "live-proof compile/catalog placeholder exists" : "live-proof compile/catalog placeholder is missing"))
  items.push(item("live-proof-scaffold-rollback", await exists(liveProofRollbackPath) ? "ok" : "warning", await exists(liveProofRollbackPath) ? "live-proof rollback placeholder exists" : "live-proof rollback placeholder is missing"))
  const indexText = await readIfExists(indexPath)
  const appText = await readIfExists(appPath)
  items.push(item("ui-index", indexText ? "ok" : "missing", indexText ? "public/index.html exists" : "public/index.html is missing"))
  items.push(item("ui-app", appText ? "ok" : "missing", appText ? "public/app.js exists" : "public/app.js is missing"))
  items.push(item("ui-styles", await exists(stylesPath) ? "ok" : "missing", await exists(stylesPath) ? "public/styles.css exists" : "public/styles.css is missing"))
  if (indexText) items.push(item("ui-resource-shell", indexText.includes("resources") ? "ok" : "missing", indexText.includes("resources") ? "resource browser shell is present" : "resource browser shell is missing"))
  if (appText) items.push(item("ui-health-fetch", appText.includes("/health") ? "ok" : "missing", appText.includes("/health") ? "UI fetches health endpoint" : "UI does not fetch health endpoint"))
  if (appText) items.push(item("ui-plan-rendering", appText.includes("/ui-plan.json") && appText.includes("renderScreenPlan") ? "ok" : "warning", appText.includes("/ui-plan.json") && appText.includes("renderScreenPlan") ? "UI renders generated screen plan" : "UI screen plan rendering is missing"))
  if (appText) items.push(item("ui-dashboard-rendering", appText.includes("/dashboard-data.json") && appText.includes("renderCockpit") ? "ok" : "warning", appText.includes("/dashboard-data.json") && appText.includes("renderCockpit") ? "UI renders bundled D3 cockpit graph data" : "UI cockpit graph rendering is missing"))
  if (appText) items.push(item("ui-proof-rendering", appText.includes("/proof-dashboard.json") && appText.includes("renderProofDashboard") ? "ok" : "warning", appText.includes("/proof-dashboard.json") && appText.includes("renderProofDashboard") ? "UI renders bundled GSD proof dashboard data" : "UI proof dashboard rendering is missing"))
  if (appText) items.push(item("ui-validation-rendering", appText.includes("/data-validation-plan.json") && appText.includes("/index-validation-plan.json") && appText.includes("renderValidationPlans") ? "ok" : "warning", appText.includes("/data-validation-plan.json") && appText.includes("/index-validation-plan.json") && appText.includes("renderValidationPlans") ? "UI renders bundled D3 data/index validation plans" : "UI validation plan rendering is missing"))
  if (appText) items.push(item("ui-modernization-rendering", appText.includes("/code-modernization-plan.json") && appText.includes("/screen-modernization-plan.json") && appText.includes("renderModernizationPlans") ? "ok" : "warning", appText.includes("/code-modernization-plan.json") && appText.includes("/screen-modernization-plan.json") && appText.includes("renderModernizationPlans") ? "UI renders bundled D3 code/screen modernization plans" : "UI modernization plan rendering is missing"))
  if (appText) items.push(item("ui-skill-manifest-rendering", appText.includes("/skill-manifest.json") && appText.includes("/reference-skill-audit.json") && appText.includes("renderSkillManifest") ? "ok" : "warning", appText.includes("/skill-manifest.json") && appText.includes("/reference-skill-audit.json") && appText.includes("renderSkillManifest") ? "UI renders bundled baked skill manifest and reference audit" : "UI skill manifest/reference audit rendering is missing"))
  if (appText) items.push(item("ui-operations-rendering", appText.includes("/subagent-prompts.json") && appText.includes("/live-operator-runbook.json") && appText.includes("renderOperations") ? "ok" : "warning", appText.includes("/subagent-prompts.json") && appText.includes("/live-operator-runbook.json") && appText.includes("renderOperations") ? "UI renders bundled subagent prompts and live runbook" : "UI operations rendering is missing"))
  if (appText) items.push(item("ui-cockpit-terminal-rendering", appText.includes("/cockpit-terminal.json") && appText.includes("renderTerminalContract") ? "ok" : "warning", appText.includes("/cockpit-terminal.json") && appText.includes("renderTerminalContract") ? "UI renders bundled cockpit terminal contract" : "UI cockpit terminal contract rendering is missing"))
  if (appText) items.push(item("ui-connector-rendering", appText.includes("/connector-strategy.json") && appText.includes("renderConnectorStrategy") ? "ok" : "warning", appText.includes("/connector-strategy.json") && appText.includes("renderConnectorStrategy") ? "UI renders bundled D3 connector strategy" : "UI connector strategy rendering is missing"))

  return {
    root,
    ready: items.every((entry) => entry.status === "ok" || entry.status === "warning"),
    items,
  }
}

export function renderWebAppCheck(report: WebAppCheckReport): string {
  return [
    "# Generated Web App Check",
    "",
    `Root: ${report.root}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.items.map((entry) => `- [${entry.status}] ${entry.id}: ${entry.message}`),
    "",
  ].join("\n")
}

export async function runGeneratedWebAppSmoke(root: string): Promise<WebAppSmokeReport> {
  const steps: WebAppSmokeStep[] = []
  const tscPath = join(packageRoot, "node_modules/typescript/bin/tsc")
  const typeRoots = join(packageRoot, "node_modules/@types")
  if (!await exists(tscPath)) {
    return {
      root,
      ready: false,
      steps: [{ id: "typescript-toolchain", status: "missing", message: `TypeScript compiler not found at ${tscPath}` }],
    }
  }

  try {
    await execFileAsync(process.execPath, [tscPath, "-p", join(root, "tsconfig.json"), "--typeRoots", typeRoots], { cwd: root })
    steps.push({ id: "typescript-build", status: "ok", message: "generated TypeScript compiled" })
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string }
    steps.push({ id: "typescript-build", status: "failed", message: (failure.stderr || failure.stdout || failure.message).trim().slice(0, 500) })
    return { root, ready: false, steps }
  }

  try {
    const tests = (await readdir(join(root, "test")))
      .filter((file) => file.endsWith(".test.mjs"))
      .map((file) => join("test", file))
    if (tests.length === 0) {
      steps.push({ id: "api-smoke-tests", status: "missing", message: "no generated smoke tests found" })
    } else {
      let lastFailure: Error & { stdout?: string; stderr?: string } | undefined
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await execFileAsync(process.execPath, ["--test", ...tests], { cwd: root, env: { ...process.env, D3CODE_MOCK: "1" } })
          steps.push({ id: "api-smoke-tests", status: "ok", message: `ran ${tests.length} generated smoke test file(s)${attempt > 1 ? ` after retry ${attempt}` : ""}` })
          lastFailure = undefined
          break
        } catch (error) {
          lastFailure = error as Error & { stdout?: string; stderr?: string }
        }
      }
      if (lastFailure) throw lastFailure
    }
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string }
    steps.push({ id: "api-smoke-tests", status: "failed", message: (failure.stderr || failure.stdout || failure.message).trim().slice(0, 500) })
  }

  return {
    root,
    ready: steps.every((step) => step.status === "ok"),
    steps,
  }
}

export function renderWebAppSmoke(report: WebAppSmokeReport): string {
  return [
    "# Generated Web App Smoke",
    "",
    `Root: ${report.root}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.steps.map((step) => `- [${step.status}] ${step.id}: ${step.message}`),
    "",
  ].join("\n")
}
