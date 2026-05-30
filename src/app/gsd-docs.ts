import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCodeModernizationPlan } from "./code-plan.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createBundleExecutionPlan } from "./execution-plan.js"
import { createIndexValidationPlan } from "./index-plan.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createMigrationQaPlan } from "./qa-plan.js"
import { createMigrationReadinessReport } from "./readiness.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"

function bullet(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"]
}

function statusLine(status: string): string {
  return status.replace(/-/g, " ")
}

export function createBundlePrd(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): string {
  const execution = createBundleExecutionPlan(bundle, artifacts, webapp, qaEvidence)
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const codePlan = createCodeModernizationPlan(bundle, artifacts)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const nonOkData = dataPlan.items.filter((item) => item.status !== "ok")
  const nonOkIndexes = indexPlan.items.filter((item) => item.status !== "ok")
  const highRiskCode = codePlan.items.filter((item) => item.priority === "P0" || item.priority === "P1")
  const openGates = readiness.gates.filter((gate) => gate.status !== "ok")

  return [
    `# PRD: D3 ${bundle.account} Web Migration`,
    "",
    "## Status",
    "",
    `- Account: ${bundle.account}`,
    `- Profile: ${bundle.profile}`,
    `- Product readiness: ${readiness.ready ? "ready" : "not ready"}`,
    `- Execution ready: ${execution.ready ? "yes" : "no"}`,
    "",
    "## Problem",
    "",
    `The ${bundle.account} D3 application needs a controlled path from account-bound files, dictionaries, and BASIC programs into a web/API surface without losing D3 data shape, locking, compile/catalog, or operational proof.`,
    "",
    "## Goals",
    "",
    ...bullet([
      "Capture D3 files, dictionaries, sampled records, indexes, and BASIC source before changing behavior.",
      "Expose selected D3 files and subroutines through REST contracts and generated TypeScript adapter boundaries.",
      "Validate D3 data shape, index assumptions, mutation policies, and BASIC compile/catalog proof before write paths are trusted.",
      "Keep GSD goal phases, evidence, QA output, and live-D3 gaps auditable.",
    ]),
    "",
    "## Non-Goals",
    "",
    ...bullet([
      "Do not rewrite the full D3 account in one pass.",
      "Do not enable generated mutation endpoints until D3 lock, validation, rollback, and live-account proof are recorded.",
      "Do not claim live Rocket D3 readiness from mock or static evidence alone.",
    ]),
    "",
    "## Scope",
    "",
    ...bullet([
      `Files: ${bundle.files.map((file) => file.name).join(", ") || "none captured"}`,
      `Programs: ${bundle.programs.map((program) => `${program.file}/${program.item}`).join(", ") || "none captured"}`,
      `REST resources: ${artifacts.migrationPlan.resources.map((resource) => resource.resource).join(", ") || "none generated"}`,
      `Services: ${artifacts.migrationPlan.services.map((service) => service.suggestedService).join(", ") || "none generated"}`,
    ]),
    "",
    "## User Stories",
    "",
    ...bullet([
      "As a D3 operator, I can inspect captured account evidence before any migration decision is accepted.",
      "As an API consumer, I can read D3-backed resources through documented REST endpoints.",
      "As a maintainer, I can see which D3 dictionary, index, BASIC, and QA gates block release.",
      "As a migration lead, I can resume the GSD goal and know the next command to run.",
    ]),
    "",
    "## Acceptance Criteria",
    "",
    ...bullet([
      `Bundle capture includes at least ${bundle.files.length} file(s) and ${bundle.programs.length} program(s).`,
      `OpenAPI contains ${Object.keys(artifacts.openapi.paths).length} path(s) for ${artifacts.migrationPlan.resources.length} resource(s).`,
      `Data validation has ${nonOkData.length} non-ok item(s) and index validation has ${nonOkIndexes.length} non-ok item(s), each resolved or explicitly accepted.`,
      `Code modernization has ${highRiskCode.length} P0/P1 item(s), each backed by lint and compile/catalog evidence or an explicit live-D3 gap.`,
      `QA plan has ${qaPlan.checks.length} check(s), and generated qa-evidence is ${qaEvidence?.ready ? "ready" : "required"}.`,
      `Readiness gates have ${openGates.length} open item(s); completion cannot be claimed while any gate is missing or blocked.`,
    ]),
    "",
    "## Execution Plan",
    "",
    ...execution.steps.flatMap((step, index) => [
      `${index + 1}. ${step.phase}: ${step.title}`,
      `   - Status: ${statusLine(step.status)}`,
      `   - Mode: ${step.mode}`,
      `   - Skills: ${step.skills.join(", ")}`,
      `   - Subagents: ${step.subagents.join(", ")}`,
      `   - First command: \`${step.commands[0]}\``,
    ]),
    "",
    "## Risks",
    "",
    ...bullet([
      ...artifacts.migrationPlan.risks,
      ...openGates.map((gate) => `${gate.id}: ${gate.status}`),
    ]),
    "",
    "## Metrics And Evidence",
    "",
    ...bullet([
      "source command: d3code bundle-execution-plan d3-app-bundle.json --artifacts-dir ./migration-output",
      `manual/readiness gates: ${readiness.gates.length}`,
      `data validation items: ${dataPlan.items.length}`,
      `index validation items: ${indexPlan.items.length}`,
      `code modernization items: ${codePlan.items.length}`,
      `qa checks: ${qaPlan.checks.length}`,
      `next command: ${execution.nextCommand}`,
    ]),
    "",
  ].join("\n")
}

export function createBundleAdr(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): string {
  const execution = createBundleExecutionPlan(bundle, artifacts, webapp, qaEvidence)
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const openGates = readiness.gates.filter((gate) => gate.status !== "ok")
  const resources = artifacts.migrationPlan.resources.map((resource) => `${resource.resource} -> ${resource.file}`)

  return [
    `# ADR: Strangler REST Boundary For D3 ${bundle.account}`,
    "",
    "Status: Proposed",
    "",
    "## Context",
    "",
    `The ${bundle.account} account contains D3 files and BASIC programs that need modernization without bypassing D3 account safety, dictionary semantics, multivalue records, locks, or compile/catalog proof.`,
    "",
    "## Decision",
    "",
    "Use an incremental strangler architecture: generated TypeScript REST resources and services sit in front of D3 file/subroutine access through a guarded adapter. Read paths can be proven with captured samples and mock data first. Write paths stay default-off until live D3 proof, lock/rollback policy, validation, and catalog evidence are recorded.",
    "",
    "## Resource Boundary",
    "",
    ...bullet(resources),
    "",
    "## Consequences",
    "",
    ...bullet([
      "D3 remains the source of truth while web/API slices are verified.",
      "OpenAPI schemas preserve D3 dictionary metadata and multivalue hints where captured.",
      "Generated mutation handlers require explicit opt-in and proof before production use.",
      "GSD goal evidence, bundle readiness, and completion audit become release gates.",
    ]),
    "",
    "## Verification",
    "",
    ...bullet([
      "Run `d3code bundle-execution-plan d3-app-bundle.json --artifacts-dir ./migration-output`.",
      "Run `d3code webapp-smoke ./migration-output --record` after artifact generation.",
      "Run `d3code live-proof --profile <profile> --run --goal <goal-id> --phase verify` against the target Rocket D3 account.",
      "Run `d3code goal-audit-bundle <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output --apply`.",
    ]),
    "",
    "## Open Questions",
    "",
    ...bullet([
      ...openGates.map((gate) => `${gate.id}: ${gate.next[0] ?? gate.title}`),
      `Next GSD command: ${execution.nextCommand}`,
    ]),
    "",
  ].join("\n")
}
