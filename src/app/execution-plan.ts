import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCodeModernizationPlan } from "./code-plan.js"
import { createCompletionAuditReport } from "./completion-audit.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createBundleEvidenceReport } from "./evidence.js"
import { createIndexValidationPlan } from "./index-plan.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createMigrationQaPlan } from "./qa-plan.js"
import { createMigrationReadinessReport } from "./readiness.js"
import { createD3ReconciliationPlan } from "./reconciliation-plan.js"
import { createScreenModernizationPlan } from "./screen-plan.js"
import { createWebUiPlan } from "./ui-plan.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"

export type ExecutionStepStatus = "ready" | "review" | "blocked" | "pending-proof"

export interface BundleExecutionStep {
  phase: "capture" | "audit" | "map" | "api" | "verify"
  status: ExecutionStepStatus
  mode: "gsd" | "audit" | "migrate" | "api" | "qa"
  title: string
  objective: string
  skills: string[]
  subagents: string[]
  evidence: string[]
  commands: string[]
  doneWhen: string[]
}

export interface BundleExecutionPlan {
  account: string
  profile: string
  ready: boolean
  nextCommand: string
  steps: BundleExecutionStep[]
}

function rank(status: ExecutionStepStatus): number {
  return { blocked: 0, "pending-proof": 1, review: 2, ready: 3 }[status]
}

function step(values: BundleExecutionStep): BundleExecutionStep {
  return values
}

export function createBundleExecutionPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): BundleExecutionPlan {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const codePlan = createCodeModernizationPlan(bundle, artifacts)
  const screenPlan = createScreenModernizationPlan(bundle)
  const uiPlan = createWebUiPlan(bundle, artifacts)
  const reconciliationPlan = createD3ReconciliationPlan(bundle, artifacts)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  const evidence = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const completion = createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)
  const dataBlockers = dataPlan.items.filter((item) => item.status === "error").length
  const dataReview = dataPlan.items.filter((item) => item.status === "warning" || item.status === "review").length
  const missingIndexes = indexPlan.items.filter((item) => item.status === "missing").length
  const reviewIndexes = indexPlan.items.filter((item) => item.status === "review").length
  const codeP0 = codePlan.items.filter((item) => item.priority === "P0").length
  const codeP1 = codePlan.items.filter((item) => item.priority === "P1").length
  const screenRisks = screenPlan.items.filter((item) => item.risk !== "none" || item.program === "*").length
  const webMissing = webapp?.items.filter((item) => item.status === "missing").length ?? 0
  const readinessGaps = readiness.gates.filter((gate) => gate.status !== "ok")
  const completionGaps = completion.requirements.filter((requirement) => requirement.status !== "proven")
  const reconciliationOpen = reconciliationPlan.checks.filter((item) => item.status !== "ready").length
  const phaseEvidence = new Map(evidence.items.map((item) => [item.phase, item]))

  const auditStatus: ExecutionStepStatus = dataBlockers || missingIndexes || codeP0 ? "blocked" : dataReview || reviewIndexes || codeP1 || screenRisks ? "review" : "ready"
  const apiStatus: ExecutionStepStatus = artifacts.adapters.length === 0 ? "blocked" : webapp ? webapp.ready && webMissing === 0 ? "ready" : "blocked" : "pending-proof"
  const verifyStatus: ExecutionStepStatus = readiness.ready && completionGaps.length === 0 ? "ready" : qaEvidence && !qaEvidence.ready ? "blocked" : "pending-proof"
  const steps: BundleExecutionStep[] = [
    step({
      phase: "capture",
      status: bundle.files.length || bundle.programs.length ? "ready" : "blocked",
      mode: "gsd",
      title: "Capture the D3 application boundary",
      objective: "Pin the active account, files, program items, dictionary samples, record samples, and index evidence before planning changes.",
      skills: ["gsd-phases", "gstack-investigate", "d3-database-audit"],
      subagents: ["d3-operator", "research"],
      evidence: [phaseEvidence.get("capture")?.evidence ?? "No bundle capture evidence generated."],
      commands: ["d3code bundle-capture --profile <profile> --account <account> --files <files> --program-files BP > d3-app-bundle.json", "d3code bundle-goal d3-app-bundle.json --artifacts-out ./migration-output"],
      doneWhen: ["Bundle JSON contains the D3 account, target files, sampled dictionaries/records, observed indexes, and relevant BASIC items."],
    }),
    step({
      phase: "audit",
      status: auditStatus,
      mode: "audit",
      title: "Audit database, indexes, data shape, and BASIC risks",
      objective: "Turn D3 file and code facts into ranked blockers before API or web migration work proceeds.",
      skills: ["d3-database-audit", "systematic-debugging", "architecture-deepening", "verification-before-completion"],
      subagents: ["d3-architect", "d3-linter", "d3-data-mapper"],
      evidence: [`data-blockers:${dataBlockers}`, `data-review:${dataReview}`, `missing-indexes:${missingIndexes}`, `review-indexes:${reviewIndexes}`, `code-p0:${codeP0}`, `code-p1:${codeP1}`, `screen-risks:${screenRisks}`],
      commands: ["d3code bundle-audit d3-app-bundle.json", "d3code bundle-data-plan d3-app-bundle.json", "d3code bundle-index-plan d3-app-bundle.json", "d3code bundle-code-plan d3-app-bundle.json", "d3code bundle-screen-plan d3-app-bundle.json"],
      doneWhen: ["Every non-ok dictionary, shape, index, EXECUTE, write, lock, unresolved CALL, compile/catalog, and legacy screen risk is fixed or explicitly accepted with evidence."],
    }),
    step({
      phase: "map",
      status: artifacts.migrationPlan.resources.length > 0 && Object.keys(artifacts.openapi.paths).length > 0 ? "ready" : "blocked",
      mode: "migrate",
      title: "Map D3 resources and services into a web architecture",
      objective: "Convert files, dictionaries, and BASIC entry points into REST resources, service boundaries, and strangler migration phases.",
      skills: ["d3-migration-map", "gstack-spec", "rest-api-generation", "gstack-design-review"],
      subagents: ["d3-architect", "d3-data-mapper", "research"],
      evidence: [`resources:${artifacts.migrationPlan.resources.length}`, `services:${artifacts.migrationPlan.services.length}`, `openapi-paths:${Object.keys(artifacts.openapi.paths).length}`, `ui-screens:${uiPlan.screens.length}`],
      commands: ["d3code bundle-migration d3-app-bundle.json", "d3code bundle-ui-plan d3-app-bundle.json", "d3code bundle-brief d3-app-bundle.json", "d3code bundle-delegate d3-app-bundle.json"],
      doneWhen: ["Each generated endpoint has a D3 file/subroutine source, field mapping, risk note, migration phase, and a corresponding web UI screen plan when user-facing."],
    }),
    step({
      phase: "api",
      status: apiStatus,
      mode: "api",
      title: "Generate and smoke-test the web/API slice",
      objective: "Write the TypeScript REST scaffold, D3 adapter boundary, mock-data path, browser shell, and API smoke tests.",
      skills: ["rest-api-generation", "effect-service-patterns", "web-app-dogfooding", "browser-qa"],
      subagents: ["d3-test-runner", "d3-data-mapper"],
      evidence: [`adapter-files:${artifacts.adapters.length}`, `webapp:${webapp ? webapp.ready ? "ready" : "not-ready" : "not-checked"}`, `web-missing:${webMissing}`, phaseEvidence.get("api")?.evidence ?? "API evidence not generated."],
      commands: ["d3code bundle-artifacts d3-app-bundle.json --out ./migration-output", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record"],
      doneWhen: ["Generated scaffold builds, `/health`, `/openapi.json`, list/read endpoints, mock-data flow, and D3 record parsing smoke tests pass."],
    }),
    step({
      phase: "verify",
      status: verifyStatus,
      mode: "qa",
      title: "Prove readiness before claiming completion",
      objective: "Attach live D3 proof, generated QA evidence, regression output, and final completion audit to the active goal.",
      skills: ["verification-before-completion", "gstack-ship", "d3-release-readiness", "red-green-refactor"],
      subagents: ["d3-test-runner", "research"],
      evidence: [`qa-checks:${qaPlan.checks.length}`, `qa-evidence:${qaEvidence?.ready ? "ready" : qaEvidence ? "not-ready" : "missing"}`, `reconciliation-open:${reconciliationOpen}`, `readiness-gaps:${readinessGaps.length}`, `completion-gaps:${completionGaps.length}`],
      commands: ["d3code bundle-reconciliation-plan d3-app-bundle.json", "d3code live-proof --profile <profile> --run --goal <goal-id> --phase verify", "d3code bundle-refresh-evidence d3-app-bundle.json --artifacts-dir ./migration-output", "d3code goal-audit-bundle <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output --apply", "npm run regression"],
      doneWhen: ["Goal phases contain evidence, reconciliation checks are recorded or explicitly accepted, readiness has no missing/blocker gates, completion audit is proven, and any unavailable live-D3 proof is explicitly carried as a gap."],
    }),
  ]
  const firstOpen = steps.find((entry) => entry.status !== "ready")

  return {
    account: bundle.account,
    profile: bundle.profile,
    ready: steps.every((entry) => entry.status === "ready"),
    nextCommand: firstOpen?.commands[0] ?? "d3code goal-verify <goal-id>",
    steps: steps.sort((a, b) => rank(a.status) - rank(b.status) || a.phase.localeCompare(b.phase)),
  }
}

export function renderBundleExecutionPlan(plan: BundleExecutionPlan): string {
  return [
    `# D3 Migration Execution Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Ready: ${plan.ready ? "yes" : "no"}`,
    `Next: \`${plan.nextCommand}\``,
    "",
    ...plan.steps.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.phase}: ${entry.title}`,
      `   Mode: ${entry.mode}`,
      `   Objective: ${entry.objective}`,
      `   Skills: ${entry.skills.join(", ")}`,
      `   Subagents: ${entry.subagents.join(", ")}`,
      "   Evidence:",
      ...entry.evidence.map((evidence) => `   - ${evidence}`),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "   Done when:",
      ...entry.doneWhen.map((done) => `   - ${done}`),
      "",
    ]),
  ].join("\n")
}
