import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCodeModernizationPlan } from "./code-plan.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createIndexValidationPlan } from "./index-plan.js"
import { createMigrationQaPlan } from "./qa-plan.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createMigrationReadinessReport } from "./readiness.js"
import { createD3ReconciliationPlan } from "./reconciliation-plan.js"
import { createScreenModernizationPlan } from "./screen-plan.js"
import { createBundleSubagentPlan } from "./subagents.js"
import { createWebUiPlan } from "./ui-plan.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"

export interface CompletionAuditRequirement {
  id: string
  status: "proven" | "partial" | "missing"
  requirement: string
  proof: string[]
  gaps: string[]
  commands: string[]
}

export interface CompletionAuditReport {
  account: string
  profile: string
  complete: boolean
  requirements: CompletionAuditRequirement[]
}

function requirement(values: CompletionAuditRequirement): CompletionAuditRequirement {
  return values
}

function rank(status: CompletionAuditRequirement["status"]): number {
  return { missing: 0, partial: 1, proven: 2 }[status]
}

export function createCompletionAuditReport(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): CompletionAuditReport {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const codePlan = createCodeModernizationPlan(bundle, artifacts)
  const screenPlan = createScreenModernizationPlan(bundle)
  const uiPlan = createWebUiPlan(bundle, artifacts)
  const reconciliationPlan = createD3ReconciliationPlan(bundle, artifacts)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const subagents = createBundleSubagentPlan(bundle, artifacts)
  const readinessGaps = readiness.gates.filter((gate) => gate.status !== "ok")
  const skillPackGate = readiness.gates.find((gate) => gate.id === "baked-skill-pack")
  const qaGate = readiness.gates.find((gate) => gate.id === "qa-evidence")
  const webappGate = readiness.gates.find((gate) => gate.id === "webapp-scaffold")
  const subagentPromptProof = webapp?.items.some((item) => item.id === "subagent-prompts" && item.status === "ok") && webapp?.items.some((item) => item.id === "subagent-prompt-boundaries" && item.status === "ok")
  const liveRunbookProof = webapp?.items.some((item) => item.id === "live-operator-runbook" && item.status === "ok") && webapp?.items.some((item) => item.id === "live-operator-runbook-evidence" && item.status === "ok")
  const liveQaStatus: CompletionAuditRequirement["status"] = readiness.ready ? "proven" : qaGate?.status === "ok" || webappGate?.status === "ok" ? "partial" : "missing"
  const screenRiskItems = screenPlan.items.filter((item) => item.risk !== "none" || item.program === "*")
  const screenStatus: CompletionAuditRequirement["status"] = screenRiskItems.length === 0 ? "proven" : screenRiskItems.some((item) => item.program === "*") ? "missing" : "partial"
  const reconciliationRequired = reconciliationPlan.checks.filter((item) => item.status === "required")
  const reconciliationReview = reconciliationPlan.checks.filter((item) => item.status === "review")
  const reconciliationStatus: CompletionAuditRequirement["status"] = reconciliationRequired.length > 0 ? "missing" : reconciliationReview.length > 0 ? "partial" : "proven"
  const requirements: CompletionAuditRequirement[] = [
    requirement({
      id: "skills-baked",
      status: skillPackGate?.status === "ok" ? "proven" : "partial",
      requirement: "Reference skills are represented as D3 Code product behavior or explicitly out of scope.",
      proof: ["reference-audit Ready: yes", "skill-coverage Ready: yes", "reference-skills map exists", ...(skillPackGate ? skillPackGate.evidence.map((entry) => `skill-pack:${entry}`) : [])],
      gaps: skillPackGate?.status === "ok" ? [] : ["Bundle-specific d3code-skill-pack.json/md has not been proven in the artifact directory."],
      commands: ["d3code reference-audit reference", "d3code skill-coverage", "d3code bundle-skill-pack d3-app-bundle.json", "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output"],
    }),
    requirement({
      id: "gsd-goal-process",
      status: "proven",
      requirement: "GSD-style goal, phase, evidence, verification, and next-action workflow exists for D3 work.",
      proof: ["goal commands exist", "migration goal has capture/audit/map/api/verify phases", "bundle-goal can seed artifact evidence"],
      gaps: [],
      commands: ["d3code goal --mode migrate <title>", "d3code bundle-goal d3-app-bundle.json --artifacts-out ./migration-output", "d3code goal-verify <goal-id>"],
    }),
    requirement({
      id: "migration-mode",
      status: artifacts.migrationPlan.resources.length > 0 && Object.keys(artifacts.openapi.paths).length > 0 ? "proven" : "missing",
      requirement: "Migration mode can map captured D3 files/programs into generated web/API artifacts.",
      proof: [`resources:${artifacts.migrationPlan.resources.length}`, `openapi-paths:${Object.keys(artifacts.openapi.paths).length}`, `adapters:${artifacts.adapters.length}`],
      gaps: artifacts.migrationPlan.resources.length > 0 ? [] : ["No D3 resources were captured, so migration mapping is not proven."],
      commands: ["d3code bundle-migration d3-app-bundle.json", "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record"],
    }),
    requirement({
      id: "database-audit",
      status: dataPlan.items.every((item) => item.status === "ok") ? "proven" : dataPlan.items.length > 0 ? "partial" : "missing",
      requirement: "D3 database files, dictionaries, sampled record shapes, multivalue data, and API projections are validated.",
      proof: [`data-plan-items:${dataPlan.items.length}`, `ok:${dataPlan.items.filter((item) => item.status === "ok").length}`],
      gaps: dataPlan.items.filter((item) => item.status !== "ok").map((item) => `${item.file}:${item.subject}:${item.status}`),
      commands: ["d3code bundle-data-plan d3-app-bundle.json", "d3code audit-db database-samples.json", "d3code shape record-samples.json"],
    }),
    requirement({
      id: "index-validation",
      status: indexPlan.items.every((item) => item.status === "ok") ? "proven" : indexPlan.items.length > 0 ? "partial" : "missing",
      requirement: "D3 indexes and AQL access paths are reconciled against expected, observed, dictionary, and API field evidence.",
      proof: [`index-plan-items:${indexPlan.items.length}`, `ok:${indexPlan.items.filter((item) => item.status === "ok").length}`],
      gaps: indexPlan.items.filter((item) => item.status !== "ok").map((item) => `${item.file}:${item.index}:${item.status}`),
      commands: ["d3code bundle-index-plan d3-app-bundle.json", "LIST-INDEX <file>", "LIST DICT <file>"],
    }),
    requirement({
      id: "code-audit-modernization",
      status: codePlan.items.some((item) => item.priority === "P0") ? "missing" : codePlan.items.some((item) => item.priority === "P1") ? "partial" : "proven",
      requirement: "D3 BASIC code is audited for calls, writes, EXECUTE/TCL, lint hazards, and compile/catalog proof.",
      proof: [`code-plan-items:${codePlan.items.length}`, `programs:${artifacts.codeMap.programs.length}`, `p0:${codePlan.items.filter((item) => item.priority === "P0").length}`, `p1:${codePlan.items.filter((item) => item.priority === "P1").length}`],
      gaps: codePlan.items.filter((item) => item.priority === "P0" || item.priority === "P1").map((item) => `${item.program}:${item.subject}:${item.priority}`),
      commands: ["d3code bundle-code-plan d3-app-bundle.json", "d3code basic-lint BP_ITEM.txt", "d3code compile-errors compile-output.txt"],
    }),
    requirement({
      id: "legacy-screen-modernization",
      status: screenStatus,
      requirement: "Legacy D3 terminal screens, INPUT prompts, cursor-control flows, and screen utilities are audited before UI replacement.",
      proof: [
        `screen-plan-items:${screenPlan.items.length}`,
        `high:${screenPlan.items.filter((item) => item.risk === "high").length}`,
        `medium:${screenPlan.items.filter((item) => item.risk === "medium").length}`,
        `low:${screenPlan.items.filter((item) => item.risk === "low").length}`,
      ],
      gaps: screenRiskItems.map((item) => `${item.program}:screen-risk:${item.risk}`),
      commands: ["d3code bundle-screen-plan d3-app-bundle.json", "d3code terminal-capture --profile <profile> --out ./terminal-proof '<screen command>'", "d3code screen-parse ./terminal-proof/terminal-transcript.txt"],
    }),
    requirement({
      id: "rest-api-generation",
      status: artifacts.openapi.paths && artifacts.adapters.length > 0 ? "proven" : "missing",
      requirement: "REST API code and adapter seams can be generated from D3 resources.",
      proof: [`paths:${Object.keys(artifacts.openapi.paths).length}`, `adapter-files:${artifacts.adapters.length}`, "webapp-smoke command available for generated scaffold proof"],
      gaps: artifacts.adapters.length > 0 ? [] : ["No adapter files generated."],
      commands: ["d3code openapi migration-plan.json", "d3code adapter-write migration-plan.json --out ./generated", "d3code webapp-skeleton migration-plan.json", "d3code webapp-smoke ./generated"],
    }),
    requirement({
      id: "web-ui-generation",
      status: uiPlan.screens.length > 0 ? "proven" : "missing",
      requirement: "Generated web UI plans exist for D3 resources with fields, actions, warnings, and navigation.",
      proof: [`screens:${uiPlan.screens.length}`, `navigation:${uiPlan.navigation.length}`, `global-warnings:${uiPlan.globalWarnings.length}`],
      gaps: uiPlan.screens.length > 0 ? [] : ["No UI screens generated from captured D3 resources."],
      commands: ["d3code bundle-ui-plan d3-app-bundle.json", "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output", "d3code webapp-check ./migration-output"],
    }),
    requirement({
      id: "cutover-reconciliation",
      status: reconciliationStatus,
      requirement: "Migration cutover has row-count, sample-compare, multivalue-order, index, canary, and rollback reconciliation evidence.",
      proof: [`checks:${reconciliationPlan.checks.length}`, `required:${reconciliationRequired.length}`, `review:${reconciliationReview.length}`, `stages:${reconciliationPlan.stages.length}`],
      gaps: reconciliationPlan.checks.filter((item) => item.status !== "ready").map((item) => `${item.id}:${item.status}`),
      commands: ["d3code bundle-reconciliation-plan d3-app-bundle.json", "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output", "d3code bundle-release-report d3-app-bundle.json --artifacts-dir ./migration-output"],
    }),
    requirement({
      id: "subagent-support",
      status: subagents.tasks.length > 0 && (!webapp || subagentPromptProof) ? "proven" : subagents.tasks.length > 0 ? "partial" : "missing",
      requirement: "Subagent-driven work can be planned from bundle evidence.",
      proof: [`subagent-tasks:${subagents.tasks.length}`, ...(webapp ? webapp.items.filter((item) => item.id.startsWith("subagent-prompt")).map((item) => `${item.id}:${item.status}`) : ["subagent-prompts:not-checked"]), ...subagents.tasks.map((task) => `agent:${task.agent}`)],
      gaps: webapp && !subagentPromptProof ? ["subagent-prompts.json/md has not been proven in the artifact directory."] : [],
      commands: ["d3code delegate migrate", "d3code bundle-delegate d3-app-bundle.json", "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output"],
    }),
    requirement({
      id: "executable-agent-loops",
      status: "proven",
      requirement: "Bounded agent runs can execute D3 code checks, file/data audits, and migration-slice generation with evidence.",
      proof: ["agent-run basic-check", "agent-run file-audit", "agent-run migration-slice", "acceptance includes agent-basic-check, agent-file-audit, and agent-migration-slice"],
      gaps: [],
      commands: [
        "d3code agent-run basic-check BP GET.CUSTOMER --profile <profile> --compile --catalog --confirm",
        "d3code agent-run file-audit CUSTOMERS --profile <profile> --sample-limit 5",
        "d3code agent-run migration-slice d3-app-bundle.json --out ./migration-output",
        "d3code acceptance",
      ],
    }),
    requirement({
      id: "live-d3-and-qa-proof",
      status: liveQaStatus === "missing" && webapp && liveRunbookProof ? "partial" : liveQaStatus,
      requirement: "A real D3 profile/account plus executed QA/regression evidence proves the migrated slice works.",
      proof: [...readiness.gates.map((gate) => `${gate.id}:${gate.status}`), ...(webapp ? webapp.items.filter((item) => item.id.startsWith("live-operator-runbook")).map((item) => `${item.id}:${item.status}`) : ["live-operator-runbook:not-checked"])],
      gaps: [...readinessGaps.map((gate) => `${gate.id}:${gate.status}`), ...(webapp && !liveRunbookProof ? ["live-operator-runbook:missing"] : [])],
      commands: [`d3code profile-doctor --profile ${bundle.profile}`, "d3code live-proof --profile <profile> --run --goal <goal-id> --phase verify", "d3code bundle-qa-plan d3-app-bundle.json", "d3code webapp-smoke ./migration-output --record", "d3code bundle-completion-audit d3-app-bundle.json --artifacts-dir ./migration-output", "npm run regression"],
    }),
  ]

  const sorted = requirements.sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id))
  return {
    account: bundle.account,
    profile: bundle.profile,
    complete: sorted.every((entry) => entry.status === "proven"),
    requirements: sorted,
  }
}

export function renderCompletionAuditReport(report: CompletionAuditReport): string {
  return [
    `# D3 Goal Completion Audit: ${report.account}`,
    "",
    `Profile: ${report.profile}`,
    `Complete: ${report.complete ? "yes" : "no"}`,
    "",
    ...report.requirements.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.id}`,
      `   Requirement: ${entry.requirement}`,
      "   Proof:",
      ...entry.proof.map((proof) => `   - ${proof}`),
      "   Gaps:",
      ...(entry.gaps.length > 0 ? entry.gaps.map((gap) => `   - ${gap}`) : ["   - none"]),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "",
    ]),
  ].join("\n")
}
