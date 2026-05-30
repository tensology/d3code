import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createErpMigrationBlueprint } from "./erp-migration.js"
import { createIndexValidationPlan } from "./index-plan.js"

export interface ReconciliationCheck {
  id: string
  subject: string
  status: "required" | "review" | "ready"
  command: string
  evidence: string[]
  doneWhen: string[]
}

export interface CutoverStage {
  id: "freeze" | "extract" | "load" | "reconcile" | "canary" | "rollback"
  title: string
  commands: string[]
  doneWhen: string[]
}

export interface D3ReconciliationPlan {
  account: string
  profile: string
  targetDatabase: string
  checks: ReconciliationCheck[]
  stages: CutoverStage[]
}

function check(values: ReconciliationCheck): ReconciliationCheck {
  return values
}

function stage(values: CutoverStage): CutoverStage {
  return values
}

export function createD3ReconciliationPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, targetDatabase = "target database"): D3ReconciliationPlan {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const blueprint = createErpMigrationBlueprint(bundle, artifacts, targetDatabase)
  const checks: ReconciliationCheck[] = []

  for (const resource of artifacts.migrationPlan.resources) {
    const bundleFile = bundle.files.find((file) => file.name === resource.file)
    const table = blueprint.tables.find((entry) => entry.d3File === resource.file)
    checks.push(check({
      id: `row-count:${resource.file}`,
      subject: `${resource.file} row count parity`,
      status: bundleFile?.records.length ? "review" : "required",
      command: `COUNT ${resource.file}`,
      evidence: [`sampled-records:${bundleFile?.records.length ?? 0}`, `target:${targetDatabase}`, `resource:${resource.resource}`],
      doneWhen: ["D3 source count, extracted record count, loaded target count, and API list count are recorded and match or have approved exceptions."],
    }))
    checks.push(check({
      id: `sample-compare:${resource.file}`,
      subject: `${resource.file} sampled value comparison`,
      status: bundleFile?.records.length ? "review" : "required",
      command: `CT ${resource.file} <sample-id>`,
      evidence: [`sample-ids:${bundleFile?.records.map((record) => record.id).slice(0, 5).join(",") || "none"}`, `fields:${resource.fields?.length ?? 0}`],
      doneWhen: ["Sampled D3 raw attributes, generated API JSON, and target database row values are compared field-by-field."],
    }))
    for (const child of table?.childTables ?? []) {
      checks.push(check({
        id: `multivalue-order:${child}`,
        subject: `${child} multivalue ordering`,
        status: "review",
        command: `LIST DICT ${resource.file}`,
        evidence: [`d3-file:${resource.file}`, `child:${child}`],
        doneWhen: ["Value/subvalue order is preserved with explicit ordinals or an approved JSON ordered-array representation."],
      }))
    }
  }

  for (const item of dataPlan.items.filter((entry) => entry.status !== "ok")) {
    checks.push(check({
      id: `data-risk:${item.file}:${item.subject}`,
      subject: `${item.file} ${item.subject}`,
      status: item.status === "error" ? "required" : "review",
      command: item.commands[0] ?? "d3code bundle-data-plan d3-app-bundle.json",
      evidence: item.evidence,
      doneWhen: ["Data issue is fixed before migration or explicitly accepted with a documented exception and compensating check."],
    }))
  }

  for (const item of indexPlan.items.filter((entry) => entry.status !== "ok")) {
    checks.push(check({
      id: `index-risk:${item.file}:${item.index}`,
      subject: `${item.file} index ${item.index}`,
      status: item.status === "missing" ? "required" : "review",
      command: item.commands[0] ?? `LIST-INDEX ${item.file}`,
      evidence: item.evidence,
      doneWhen: ["D3 access path, generated API query path, and target database lookup/index strategy are reconciled."],
    }))
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    targetDatabase,
    checks,
    stages: [
      stage({
        id: "freeze",
        title: "Freeze risky source changes",
        commands: ["d3code safety-guard d3-app-bundle.json CLEAR-FILE <file>", "d3code profile-doctor --profile <profile>"],
        doneWhen: ["Operators know the freeze window, write paths are guarded, and destructive D3 commands are blocked or explicitly confirmed."],
      }),
      stage({
        id: "extract",
        title: "Extract D3 records with raw evidence",
        commands: ["d3code bundle-capture --profile <profile> --account <account> --files <files> --sample-limit 25 > d3-app-bundle.json", "d3code bundle-data-plan d3-app-bundle.json"],
        doneWhen: ["Raw D3 records, dictionaries, indexes, and record-shape evidence are captured for the migration slice."],
      }),
      stage({
        id: "load",
        title: `Load into ${targetDatabase}`,
        commands: ["d3code bundle-erp-plan d3-app-bundle.json --target-db <target>", "d3code bundle-ui-plan d3-app-bundle.json"],
        doneWhen: ["Target structures, multivalue handling, duplicate-column decisions, and generated UI screens are reviewed before load."],
      }),
      stage({
        id: "reconcile",
        title: "Reconcile counts, samples, indexes, and multivalue order",
        commands: ["d3code bundle-reconciliation-plan d3-app-bundle.json", "d3code webapp-smoke ./migration-output --record"],
        doneWhen: ["Every required/review reconciliation check has evidence or an approved exception."],
      }),
      stage({
        id: "canary",
        title: "Run read-only canary",
        commands: ["d3code bundle-release-report d3-app-bundle.json --artifacts-dir ./migration-output", "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output"],
        doneWhen: ["Generated API/UI canary is read-only, QA evidence is recorded, and rollback is rehearsed."],
      }),
      stage({
        id: "rollback",
        title: "Rollback to D3 source of truth",
        commands: ["unset D3CODE_ALLOW_WRITES", "route users back to the D3 terminal workflow"],
        doneWhen: ["D3 remains the source of truth, write gates are disabled, and affected users are routed back to verified D3 flows."],
      }),
    ],
  }
}

export function renderD3ReconciliationPlan(plan: D3ReconciliationPlan): string {
  return [
    `# D3 Cutover Reconciliation Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Target database: ${plan.targetDatabase}`,
    `Checks: ${plan.checks.length}`,
    "",
    "Stages:",
    ...plan.stages.flatMap((stage) => [
      `- ${stage.id}: ${stage.title}`,
      `  Commands: ${stage.commands.map((command) => `\`${command}\``).join(", ")}`,
      `  Done when: ${stage.doneWhen.join("; ")}`,
    ]),
    "",
    "Checks:",
    ...(plan.checks.length ? plan.checks.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.subject}`,
      `   Command: \`${entry.command}\``,
      `   Evidence: ${entry.evidence.join(", ")}`,
      `   Done when: ${entry.doneWhen.join("; ")}`,
    ]) : ["- none"]),
  ].join("\n")
}
