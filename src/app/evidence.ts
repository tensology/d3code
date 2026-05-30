import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCodeModernizationPlan } from "./code-plan.js"
import { createCompletionAuditReport } from "./completion-audit.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createIndexValidationPlan } from "./index-plan.js"
import { createMigrationQaPlan } from "./qa-plan.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createMigrationReadinessReport } from "./readiness.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"

export interface BundleEvidenceItem {
  phase: "capture" | "audit" | "map" | "api" | "verify"
  status: "recorded" | "needs-review" | "missing"
  evidence: string
  commands: string[]
}

export interface BundleEvidenceReport {
  account: string
  profile: string
  items: BundleEvidenceItem[]
}

function item(values: BundleEvidenceItem): BundleEvidenceItem {
  return values
}

function rank(status: BundleEvidenceItem["status"]): number {
  return { missing: 0, "needs-review": 1, recorded: 2 }[status]
}

export function createBundleEvidenceReport(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): BundleEvidenceReport {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const codePlan = createCodeModernizationPlan(bundle, artifacts)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const completion = createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)
  const dataIssues = dataPlan.items.filter((entry) => entry.status !== "ok")
  const indexIssues = indexPlan.items.filter((entry) => entry.status !== "ok")
  const codeRisks = codePlan.items.filter((entry) => entry.priority === "P0" || entry.priority === "P1")
  const readinessGaps = readiness.gates.filter((entry) => entry.status !== "ok")
  const completionGaps = completion.requirements.filter((entry) => entry.status !== "proven")
  const bakedSkillGate = readiness.gates.find((entry) => entry.id === "baked-skill-pack")
  const apiArtifactsGenerated = artifacts.adapters.length > 0
  const apiStatus: BundleEvidenceItem["status"] = !apiArtifactsGenerated
    ? "missing"
    : webapp && bakedSkillGate?.status !== "ok"
      ? "needs-review"
      : "recorded"
  const bakedSkillEvidence = bakedSkillGate
    ? `baked-skills=${bakedSkillGate.status}; ${bakedSkillGate.evidence.join(",")}`
    : "baked-skills=not-checked"

  const items: BundleEvidenceItem[] = [
    item({
      phase: "capture",
      status: bundle.files.length > 0 || bundle.programs.length > 0 ? "recorded" : "missing",
      evidence: `Bundle captured for account ${bundle.account}: files=${bundle.files.length}, programs=${bundle.programs.length}, profile=${bundle.profile}.`,
      commands: ["d3code bundle-capture --profile <profile> --account <account> --files <files> --program-files BP > d3-app-bundle.json"],
    }),
    item({
      phase: "audit",
      status: dataIssues.length || indexIssues.length || codeRisks.length ? "needs-review" : "recorded",
      evidence: `Audit artifacts generated: data-items=${dataPlan.items.length}, data-issues=${dataIssues.length}, index-items=${indexPlan.items.length}, index-issues=${indexIssues.length}, code-risks=${codeRisks.length}.`,
      commands: ["d3code bundle-audit d3-app-bundle.json", "d3code bundle-data-plan d3-app-bundle.json", "d3code bundle-index-plan d3-app-bundle.json", "d3code bundle-code-plan d3-app-bundle.json", "d3code bundle-screen-plan d3-app-bundle.json"],
    }),
    item({
      phase: "map",
      status: artifacts.migrationPlan.resources.length > 0 ? "recorded" : "missing",
      evidence: `Migration map generated: resources=${artifacts.migrationPlan.resources.length}, services=${artifacts.migrationPlan.services.length}, openapi-paths=${Object.keys(artifacts.openapi.paths).length}.`,
      commands: ["d3code bundle-migration d3-app-bundle.json", "d3code bundle-ui-plan d3-app-bundle.json", "d3code bundle-brief d3-app-bundle.json"],
    }),
    item({
      phase: "api",
      status: apiStatus,
      evidence: `API/web artifacts generated: adapter-files=${artifacts.adapters.length}, openapi-paths=${Object.keys(artifacts.openapi.paths).length}, ${bakedSkillEvidence}.`,
      commands: ["d3code bundle-artifacts d3-app-bundle.json --out ./migration-output", "d3code bundle-skill-pack d3-app-bundle.json", "d3code reference-audit reference", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record"],
    }),
    item({
      phase: "verify",
      status: readinessGaps.length || completionGaps.length ? "missing" : "recorded",
      evidence: `Verification plans generated: qa-checks=${qaPlan.checks.length}, qa-evidence=${qaEvidence?.ready ? "ready" : qaEvidence ? "not-ready" : "missing"}, readiness-gaps=${readinessGaps.length}, completion-gaps=${completionGaps.length}.`,
      commands: ["d3code bundle-qa-plan d3-app-bundle.json", "d3code bundle-reconciliation-plan d3-app-bundle.json", "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output", "d3code webapp-smoke ./migration-output --record", "d3code bundle-completion-audit d3-app-bundle.json --artifacts-dir ./migration-output", "npm run regression"],
    }),
  ]

  return {
    account: bundle.account,
    profile: bundle.profile,
    items: items.sort((a, b) => rank(a.status) - rank(b.status) || a.phase.localeCompare(b.phase)),
  }
}

export function renderBundleEvidenceReport(report: BundleEvidenceReport): string {
  return [
    `# D3 Bundle Goal Evidence: ${report.account}`,
    "",
    `Profile: ${report.profile}`,
    `Items: ${report.items.length}`,
    "",
    ...report.items.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.phase}`,
      `   Evidence: ${entry.evidence}`,
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "",
    ]),
  ].join("\n")
}
