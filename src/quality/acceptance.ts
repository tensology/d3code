import { chmod, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { bundleToIndex, createBundleArtifacts } from "../app/bundle.js"
import { createCompletionAuditReport } from "../app/completion-audit.js"
import { createBundleEvidenceReport } from "../app/evidence.js"
import { createMigrationReadinessReport } from "../app/readiness.js"
import { createQaEvidenceFromWebAppSmoke, writeQaEvidence } from "../app/qa-evidence.js"
import { createD3Session } from "../d3/adapter.js"
import { diagnoseProfile } from "../d3/profile-doctor.js"
import type { ConnectionProfile } from "../domain/types.js"
import { auditGoalAgainstBundle } from "../goal/audit.js"
import { applyBundleEvidenceToGoal } from "../goal/evidence.js"
import { createModernizationGoal, verifyGoal } from "../goal/goal.js"
import { checkGeneratedWebApp, runGeneratedWebAppSmoke } from "../migration/webapp-check.js"
import { refreshBundleProofArtifacts, writeBundleArtifacts } from "../app/write.js"
import { captureBundleFromSession } from "../capture/capture.js"
import { runAgentTask } from "../agents/run.js"
import { createModernizationProof } from "../app/modernization-proof.js"

export interface AcceptanceStep {
  id: string
  ok: boolean
  evidence: string[]
}

export interface AcceptanceReport {
  ready: boolean
  root: string
  steps: AcceptanceStep[]
}

function step(id: string, ok: boolean, evidence: string[]): AcceptanceStep {
  return { id, ok, evidence }
}

async function writeMockD3(root: string): Promise<string> {
  const script = join(root, "mock-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *WHO*) printf 'SALES\\n' ;;",
    "  *VERSION*) printf 'D3 10.3 MOCK\\n' ;;",
    "  *'LIST MD'*) printf 'CUSTOMERS\\nBP\\n' ;;",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nNAME\\nAMOUNT\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'NAME\\n' ;;",
    "  *'SELECT CUSTOMERS'*) printf '100\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Alice' ;;",
    "  *'SELECT BP'*) printf 'GET.CUSTOMER\\n' ;;",
    "  *'CT BP GET.CUSTOMER'*) printf 'SUBROUTINE GET.CUSTOMER(ID)\\nOPEN \"CUSTOMERS\" TO F ELSE STOP\\nRETURN\\n' ;;",
    "  *'BASIC BP GET.CUSTOMER'*) printf 'BASIC OK\\n' ;;",
    "  *'CATALOG BP GET.CUSTOMER'*) printf 'CATALOG OK\\n' ;;",
    "  *) printf 'CUSTOMERS\\n' ;;",
    "esac",
    "",
  ].join("\n"))
  await chmod(script, 0o755)
  return script
}

export async function runMockAcceptance(): Promise<AcceptanceReport> {
  const root = await mkdtemp(join(tmpdir(), "d3code-acceptance-"))
  const entry = await writeMockD3(root)
  const profile: ConnectionProfile = { name: "mock", type: "local", account: "SALES", entryCommand: entry }
  const doctor = await diagnoseProfile(profile)
  const session = createD3Session(profile)
  const bundle = await captureBundleFromSession(session, {
    profile: profile.name,
    account: profile.account ?? "SALES",
    files: ["CUSTOMERS"],
    programFiles: ["BP"],
    sampleLimit: 1,
  })
  await session.close()
  const artifacts = createBundleArtifacts(bundle)
  const out = join(root, "migration-output")
  const written = await writeBundleArtifacts(out, artifacts, bundle)
  const webapp = await checkGeneratedWebApp(out)
  const smoke = await runGeneratedWebAppSmoke(out)
  const qaEvidence = createQaEvidenceFromWebAppSmoke(smoke)
  await writeQaEvidence(out, qaEvidence)
  const refreshed = await refreshBundleProofArtifacts(out, artifacts, bundle)
  const evidence = createBundleEvidenceReport(bundle, artifacts)
  const goal = createModernizationGoal("Mock acceptance migration", "Mock D3 app produces web/API migration evidence", "migrate")
  const applied = applyBundleEvidenceToGoal(goal, evidence)
  const verification = verifyGoal(applied.goal)
  const goalBundleAudit = auditGoalAgainstBundle(applied.goal, evidence)
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const completion = createCompletionAuditReport(bundle, artifacts)
  const indexDocs = bundleToIndex(bundle)
  const bundleFile = join(root, "d3-app-bundle.json")
  await writeFile(bundleFile, `${JSON.stringify(bundle, null, 2)}\n`)
  const agentBasic = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: profile.name,
    profiles: [profile],
    modelSecrets: {},
  }, { task: "basic-check", file: "BP", item: "GET.CUSTOMER", profile: profile.name, compile: true, catalog: true, confirm: true })
  const agentFile = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: profile.name,
    profiles: [profile],
    modelSecrets: {},
  }, { task: "file-audit", file: "CUSTOMERS", profile: profile.name, sampleLimit: 1 })
  const agentMigrationOut = join(root, "agent-migration-output")
  const agentMigration = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    profiles: [],
    modelSecrets: {},
  }, { task: "migration-slice", file: bundleFile, outDir: agentMigrationOut })
  const beforeSource = bundle.programs[0]?.source ?? "RETURN\n"
  const modernizationProof = createModernizationProof({
    before: beforeSource,
    after: beforeSource.replace("RETURN", "ID = TRIM(ID)\nRETURN"),
    compileOutput: "BASIC OK",
  })

  const steps = [
    step("profile-doctor", doctor.ready, doctor.checks.map((check) => `${check.name}:${check.ok ? "ok" : "fail"}`)),
    step("bundle-capture", bundle.files.length === 1 && bundle.programs.length === 1, [`files:${bundle.files.length}`, `programs:${bundle.programs.length}`]),
    step("bundle-index", indexDocs.length >= 3, [`documents:${indexDocs.length}`]),
    step("bundle-artifacts", written.written.some((file) => file.endsWith("openapi.json")) && written.written.some((file) => file.endsWith("goal-evidence.md")), [`written:${written.written.length}`]),
    step("webapp-check", webapp.ready, [`ready:${webapp.ready ? "yes" : "no"}`, `items:${webapp.items.length}`]),
    step("qa-evidence", qaEvidence.ready && readiness.gates.some((gate) => gate.id === "qa-evidence" && gate.status === "ok"), [`ready:${qaEvidence.ready ? "yes" : "no"}`, `checks:${qaEvidence.checks.map((check) => `${check.id}:${check.status}`).join(",")}`]),
    step("bundle-refresh-evidence", refreshed.written.some((file) => file.endsWith("goal-evidence.md")) && refreshed.written.some((file) => file.endsWith("completion-audit.md")) && refreshed.written.some((file) => file.endsWith("release-report.md")) && refreshed.written.some((file) => file.endsWith("proof-data.json")), [`written:${refreshed.written.length}`]),
    step("agent-basic-check", agentBasic.ready, [`ready:${agentBasic.ready ? "yes" : "no"}`, `steps:${agentBasic.steps.map((item) => `${item.id}:${item.status}`).join(",")}`]),
    step("agent-file-audit", agentFile.ready, [`ready:${agentFile.ready ? "yes" : "no"}`, `steps:${agentFile.steps.map((item) => `${item.id}:${item.status}`).join(",")}`]),
    step("agent-migration-slice", agentMigration.ready, [`ready:${agentMigration.ready ? "yes" : "no"}`, `steps:${agentMigration.steps.map((item) => `${item.id}:${item.status}`).join(",")}`]),
    step("modernization-proof", modernizationProof.ready, [`ready:${modernizationProof.ready ? "yes" : "no"}`, `checks:${modernizationProof.checks.map((item) => `${item.id}:${item.status}`).join(",")}`]),
    step("goal-evidence", applied.applied.length >= 5, [`applied:${applied.applied.length}`, `goal-ready:${verification.ready ? "yes" : "no"}`]),
    step("goal-bundle-audit", !goalBundleAudit.ready && goalBundleAudit.phases.some((phase) => phase.phase === "verify" && phase.bundleStatus === "missing"), [`ready:${goalBundleAudit.ready ? "yes" : "no"}`, `phases:${goalBundleAudit.phases.map((phase) => `${phase.phase}:${phase.bundleStatus}`).join(",")}`]),
    step("readiness-gates", !readiness.ready && readiness.gates.some((gate) => gate.id === "live-d3-proof"), [`ready:${readiness.ready ? "yes" : "no"}`, `gates:${readiness.gates.map((gate) => gate.id).join(",")}`]),
    step("completion-audit", !completion.complete && completion.requirements.some((item) => item.id === "live-d3-and-qa-proof"), [`complete:${completion.complete ? "yes" : "no"}`, `requirements:${completion.requirements.map((item) => item.id).join(",")}`]),
  ]

  return {
    root,
    ready: steps.every((entry) => entry.ok),
    steps,
  }
}

export function renderAcceptanceReport(report: AcceptanceReport): string {
  return [
    "# D3 Code Mock Acceptance",
    "",
    `Root: ${report.root}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.steps.map((entry) => `- [${entry.ok ? "ok" : "fail"}] ${entry.id}: ${entry.evidence.join("; ")}`),
    "",
  ].join("\n")
}
