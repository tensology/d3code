import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCompletionAuditReport } from "./completion-audit.js"
import { createBundleExecutionPlan } from "./execution-plan.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createMigrationReadinessReport } from "./readiness.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"

export type ReleaseDecision = "blocked" | "canary" | "ready"

export interface ReleaseReport {
  account: string
  profile: string
  decision: ReleaseDecision
  summary: string
  proof: string[]
  blockers: string[]
  canaryScope: string[]
  rollback: string[]
  commands: string[]
}

function decision(readinessReady: boolean, completionComplete: boolean, qaReady: boolean, webReady: boolean): ReleaseDecision {
  if (readinessReady && completionComplete) return "ready"
  if (qaReady && webReady) return "canary"
  return "blocked"
}

export function createBundleReleaseReport(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): ReleaseReport {
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const completion = createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)
  const execution = createBundleExecutionPlan(bundle, artifacts, webapp, qaEvidence)
  const readinessGaps = readiness.gates.filter((gate) => gate.status !== "ok")
  const completionGaps = completion.requirements.filter((requirement) => requirement.status !== "proven")
  const webReady = Boolean(webapp?.ready)
  const qaReady = Boolean(qaEvidence?.ready)
  const releaseDecision = decision(readiness.ready, completion.complete, qaReady, webReady)
  const resources = artifacts.migrationPlan.resources.map((resource) => resource.resource)
  const paths = Object.keys(artifacts.openapi.paths)

  return {
    account: bundle.account,
    profile: bundle.profile,
    decision: releaseDecision,
    summary: releaseDecision === "ready"
      ? "Release can proceed with recorded D3, QA, readiness, and completion proof."
      : releaseDecision === "canary"
        ? "Only a guarded read-only canary is reasonable; live D3 and/or completion proof is still incomplete."
        : "Release is blocked until generated web/API proof, QA evidence, and readiness gates are recorded.",
    proof: [
      `resources:${resources.length}`,
      `openapi-paths:${paths.length}`,
      `webapp:${webReady ? "ready" : webapp ? "not-ready" : "missing"}`,
      `qa-evidence:${qaReady ? "ready" : qaEvidence ? "not-ready" : "missing"}`,
      `readiness:${readiness.ready ? "ready" : "not-ready"}`,
      `completion:${completion.complete ? "complete" : "incomplete"}`,
      `next:${execution.nextCommand}`,
    ],
    blockers: [
      ...readinessGaps.map((gate) => `${gate.id}:${gate.status}`),
      ...completionGaps.map((requirement) => `${requirement.id}:${requirement.status}`),
    ],
    canaryScope: [
      `resources:${resources.join(", ") || "none"}`,
      "read-only endpoints first",
      "mutation endpoints remain behind D3CODE_ALLOW_WRITES=1 until lock/rollback/live-D3 proof is recorded",
      "route a small operator/test cohort through the generated web/API shell before widening access",
    ],
    rollback: [
      "unset D3CODE_ALLOW_WRITES",
      "stop the generated web/API process",
      "route users back to the D3 terminal workflow",
      "keep D3 as source of truth; do not replay failed writes without item-level evidence",
    ],
    commands: [
      "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code bundle-completion-audit d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code live-proof --profile <profile> --run --goal <goal-id> --phase verify",
      "d3code webapp-smoke ./migration-output --record",
      "npm run regression",
    ],
  }
}

export function renderBundleReleaseReport(report: ReleaseReport): string {
  return [
    `# D3 Migration Release Report: ${report.account}`,
    "",
    `Profile: ${report.profile}`,
    `Decision: ${report.decision}`,
    `Summary: ${report.summary}`,
    "",
    "## Proof",
    ...report.proof.map((proof) => `- ${proof}`),
    "",
    "## Blockers",
    ...(report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "## Canary Scope",
    ...report.canaryScope.map((scope) => `- ${scope}`),
    "",
    "## Rollback",
    ...report.rollback.map((step) => `- ${step}`),
    "",
    "## Commands",
    ...report.commands.map((command) => `- \`${command}\``),
    "",
  ].join("\n")
}
