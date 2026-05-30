import { createCodeModernizationPlan } from "./code-plan.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createIndexValidationPlan } from "./index-plan.js"
import { createMigrationQaPlan } from "./qa-plan.js"
import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createD3ReconciliationPlan } from "./reconciliation-plan.js"
import { createScreenModernizationPlan } from "./screen-plan.js"
import { createWebUiPlan } from "./ui-plan.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"

export interface MigrationReadinessGate {
  id: string
  status: "ok" | "warning" | "missing" | "blocker"
  title: string
  evidence: string[]
  next: string[]
}

export interface MigrationReadinessReport {
  account: string
  profile: string
  ready: boolean
  gates: MigrationReadinessGate[]
}

function gate(values: MigrationReadinessGate): MigrationReadinessGate {
  return values
}

function rank(status: MigrationReadinessGate["status"]): number {
  return { blocker: 0, missing: 1, warning: 2, ok: 3 }[status]
}

export function createMigrationReadinessReport(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): MigrationReadinessReport {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const codePlan = createCodeModernizationPlan(bundle, artifacts)
  const screenPlan = createScreenModernizationPlan(bundle)
  const uiPlan = createWebUiPlan(bundle, artifacts)
  const reconciliationPlan = createD3ReconciliationPlan(bundle, artifacts)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  const dataBlockers = dataPlan.items.filter((item) => item.status === "error")
  const dataWarnings = dataPlan.items.filter((item) => item.status === "warning" || item.status === "review")
  const missingIndexes = indexPlan.items.filter((item) => item.status === "missing")
  const reviewIndexes = indexPlan.items.filter((item) => item.status === "review")
  const codeBlockers = codePlan.items.filter((item) => item.priority === "P0")
  const codeWarnings = codePlan.items.filter((item) => item.priority === "P1")
  const screenHigh = screenPlan.items.filter((item) => item.risk === "high")
  const screenReview = screenPlan.items.filter((item) => item.risk === "medium" || item.risk === "low")
  const screenUnknown = screenPlan.items.some((item) => item.program === "*" && item.risk === "none")
  const reconciliationRequired = reconciliationPlan.checks.filter((item) => item.status === "required")
  const reconciliationReview = reconciliationPlan.checks.filter((item) => item.status === "review")
  const webMissing = webapp?.items.filter((item) => item.status === "missing") ?? []
  const skillPackReady = Boolean(webapp)
    && webapp!.items.some((item) => item.id === "d3code-skill-pack" && item.status === "ok")
    && webapp!.items.some((item) => item.id === "d3code-skill-pack-modes" && item.status === "ok")
    && webapp!.items.some((item) => item.id === "d3code-reference-skill-audit-ready" && item.status === "ok")
    && webapp!.items.some((item) => item.id === "d3code-reference-skill-audit-decisions" && item.status === "ok")
    && webapp!.items.some((item) => item.id === "public-reference-skill-audit-ready" && item.status === "ok")

  const gates: MigrationReadinessGate[] = [
    gate({
      id: "baked-skill-pack",
      status: webapp ? skillPackReady ? "ok" : "missing" : "missing",
      title: "Bundle-specific baked skill pack",
      evidence: webapp
        ? webapp.items
          .filter((item) => item.id.startsWith("d3code-skill-pack") || item.id.startsWith("d3code-reference-skill-audit") || item.id.startsWith("public-reference-skill-audit"))
          .map((item) => `${item.id}:${item.status}`)
        : ["artifacts-dir:not-provided"],
      next: webapp ? ["Keep d3code-skill-pack.json/md plus d3code-reference-skill-audit.json/md with the migration output so GSD, migrate, audit, API, modernize, QA, evidence gates, and out-of-scope decisions travel with the bundle."] : ["Run `d3code bundle-artifacts d3-app-bundle.json --out ./migration-output` or `d3code bundle-skill-pack d3-app-bundle.json`, then pass `--artifacts-dir ./migration-output`."],
    }),
    gate({
      id: "live-d3-proof",
      status: "missing",
      title: "Live D3 profile/account proof",
      evidence: [`profile:${bundle.profile}`, `account:${bundle.account}`],
      next: [`Run \`d3code profile-doctor --profile ${bundle.profile}\` and record WHO, VERSION, and LIST MD output as goal evidence.`],
    }),
    gate({
      id: "data-validation",
      status: dataBlockers.length > 0 ? "blocker" : dataWarnings.length > 0 ? "warning" : "ok",
      title: "D3 dictionary and sampled data validation",
      evidence: [`errors:${dataBlockers.length}`, `warnings-or-review:${dataWarnings.length}`, `items:${dataPlan.items.length}`],
      next: dataBlockers.length || dataWarnings.length ? ["Run `d3code bundle-data-plan d3-app-bundle.json` and resolve or explicitly accept every non-ok item."] : ["Keep data validation plan with the migration evidence."],
    }),
    gate({
      id: "index-validation",
      status: missingIndexes.length > 0 ? "blocker" : reviewIndexes.length > 0 ? "warning" : "ok",
      title: "D3 index and AQL access validation",
      evidence: [`missing:${missingIndexes.length}`, `review:${reviewIndexes.length}`, `items:${indexPlan.items.length}`],
      next: missingIndexes.length || reviewIndexes.length ? ["Run `d3code bundle-index-plan d3-app-bundle.json` and reconcile expected, observed, and API-exposed index usage."] : ["Keep index validation plan with the migration evidence."],
    }),
    gate({
      id: "basic-modernization",
      status: codeBlockers.length > 0 ? "blocker" : codeWarnings.length > 0 ? "warning" : "ok",
      title: "D3 BASIC modernization risk review",
      evidence: [`p0:${codeBlockers.length}`, `p1:${codeWarnings.length}`, `items:${codePlan.items.length}`],
      next: codeBlockers.length || codeWarnings.length ? ["Run `d3code bundle-code-plan d3-app-bundle.json` and collect compile/catalog proof for risky programs."] : ["Keep code modernization plan with the migration evidence."],
    }),
    gate({
      id: "legacy-screen-modernization",
      status: screenHigh.length || screenReview.length || screenUnknown ? "warning" : "ok",
      title: "Legacy D3 screen and terminal-flow modernization",
      evidence: [
        `screen-items:${screenPlan.items.length}`,
        `high:${screenHigh.length}`,
        `review:${screenReview.length}`,
        `unknown:${screenUnknown ? "yes" : "no"}`,
      ],
      next: screenHigh.length || screenReview.length || screenUnknown
        ? ["Run `d3code bundle-screen-plan d3-app-bundle.json`, capture representative screens with `d3code terminal-capture --out ./terminal-proof '<screen command>'`, and map INPUT/cursor flows before replacing the UI."]
        : ["Keep screen modernization plan with the migration evidence."],
    }),
    gate({
      id: "api-contract",
      status: artifacts.migrationPlan.resources.length > 0 && Object.keys(artifacts.openapi.paths).length > 0 ? "ok" : "missing",
      title: "Generated REST API contract and resource map",
      evidence: [`resources:${artifacts.migrationPlan.resources.length}`, `paths:${Object.keys(artifacts.openapi.paths).length}`],
      next: ["Run `d3code bundle-artifacts d3-app-bundle.json --out ./migration-output` and review generated OpenAPI/resource adapters."],
    }),
    gate({
      id: "web-ui-plan",
      status: uiPlan.screens.length > 0 ? "ok" : "missing",
      title: "Generated web UI screen plan",
      evidence: [`screens:${uiPlan.screens.length}`, `navigation:${uiPlan.navigation.length}`, `warnings:${uiPlan.globalWarnings.length}`],
      next: uiPlan.screens.length > 0 ? ["Keep web-ui-plan.json/md with the migration evidence and generated browser shell."] : ["Run `d3code bundle-ui-plan d3-app-bundle.json` after capturing D3 resources."],
    }),
    gate({
      id: "cutover-reconciliation",
      status: reconciliationRequired.length > 0 ? "missing" : reconciliationReview.length > 0 ? "warning" : "ok",
      title: "Cutover reconciliation and rollback proof",
      evidence: [`checks:${reconciliationPlan.checks.length}`, `required:${reconciliationRequired.length}`, `review:${reconciliationReview.length}`, `stages:${reconciliationPlan.stages.length}`],
      next: reconciliationRequired.length || reconciliationReview.length
        ? ["Run `d3code bundle-reconciliation-plan d3-app-bundle.json` and record row-count, sample-compare, multivalue-order, index, canary, and rollback evidence."]
        : ["Keep reconciliation-plan.json/md with the migration evidence."],
    }),
    gate({
      id: "webapp-scaffold",
      status: webapp ? webMissing.length > 0 || !webapp.ready ? "blocker" : "ok" : "missing",
      title: "Generated web/API scaffold health and smoke proof",
      evidence: webapp ? [`ready:${webapp.ready ? "yes" : "no"}`, `missing:${webMissing.length}`, `root:${webapp.root}`] : ["artifacts-dir:not-provided"],
      next: webapp ? ["Run `d3code webapp-check ./migration-output` and `d3code webapp-smoke ./migration-output --record` after each artifact regeneration."] : ["Pass `--artifacts-dir ./migration-output` or run `d3code bundle-artifacts ...`, then prove scaffold health with `d3code webapp-check` and `d3code webapp-smoke ./migration-output --record`."],
    }),
    gate({
      id: "qa-evidence",
      status: qaEvidence ? qaEvidence.ready ? "ok" : "blocker" : "missing",
      title: "Executed QA and regression evidence",
      evidence: qaEvidence ? [`source:${qaEvidence.source}`, `ready:${qaEvidence.ready ? "yes" : "no"}`, `checks:${qaEvidence.checks.length}`, ...qaEvidence.checks.map((check) => `${check.id}:${check.status}`)] : [`planned-checks:${qaPlan.checks.length}`],
      next: qaEvidence?.ready ? ["Keep qa-evidence.json and qa-evidence.md with the migration evidence bundle."] : ["Run `d3code bundle-qa-plan d3-app-bundle.json`, execute the relevant D3/API/browser/regression checks, and attach outputs to the active goal. For generated API proof, run `d3code webapp-smoke ./migration-output --record`."],
    }),
  ]

  const sorted = gates.sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id))
  return {
    account: bundle.account,
    profile: bundle.profile,
    ready: sorted.every((entry) => entry.status === "ok"),
    gates: sorted,
  }
}

export function renderMigrationReadinessReport(report: MigrationReadinessReport): string {
  return [
    `# D3 Migration Readiness Report: ${report.account}`,
    "",
    `Profile: ${report.profile}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.gates.flatMap((entry) => [
      `- [${entry.status}] ${entry.id}: ${entry.title}`,
      "  Evidence:",
      ...entry.evidence.map((evidence) => `  - ${evidence}`),
      "  Next:",
      ...entry.next.map((next) => `  - ${next}`),
    ]),
    "",
  ].join("\n")
}
