import type { D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import type { WebAppCheckReport } from "../migration/webapp-check.js"
import { createBundleSubagentPlan } from "./subagents.js"
import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCompletionAuditReport } from "./completion-audit.js"
import { createBundleEvidenceReport } from "./evidence.js"
import { createBundleExecutionPlan } from "./execution-plan.js"
import type { MigrationQaEvidenceReport } from "./qa-evidence.js"
import { createMigrationReadinessReport } from "./readiness.js"
import { createSafetyGuardReport } from "./safety-guard.js"

export interface RuntimeContextPackInput {
  model: string
  safety: SafetyMode
  mode: string
  profile?: string
}

export interface BundleContextPack {
  generatedAt: string
  runtime: RuntimeContextPackInput
  account: string
  profile: string
  summary: string[]
  state: {
    readiness: "ready" | "blocked"
    completion: "complete" | "incomplete"
    safetyGuard: "ready" | "needs-confirmation"
    qaEvidence: "ready" | "missing" | "not-ready"
    bakedSkills: "ready" | "needs-proof"
  }
  nextCommands: string[]
  subagentQueue: string[]
  restorePrompt: string
}

export function createBundleContextPack(config: D3CodeConfig, bundle: D3ApplicationBundle, artifacts: BundleArtifacts, runtime: RuntimeContextPackInput, webapp?: WebAppCheckReport, qaEvidence?: MigrationQaEvidenceReport): BundleContextPack {
  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const completion = createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)
  const execution = createBundleExecutionPlan(bundle, artifacts, webapp, qaEvidence)
  const evidence = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
  const subagents = createBundleSubagentPlan(bundle, artifacts)
  const guard = createSafetyGuardReport(config, { safety: runtime.safety, profile: runtime.profile ?? bundle.profile, bundle })
  const pendingEvidence = evidence.items.filter((item) => item.status !== "recorded")
  const bakedSkillGate = readiness.gates.find((gate) => gate.id === "baked-skill-pack")
  const bakedSkillEvidence = bakedSkillGate?.evidence ?? []
  const subagentQueue = subagents.tasks.slice(0, 5).map((task) => `${task.agent}: ${task.objective}`)
  const bakedSkillCommands = bakedSkillGate?.status === "ok" ? [] : [
    "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output",
    "d3code reference-audit reference",
  ]

  return {
    generatedAt: new Date().toISOString(),
    runtime,
    account: bundle.account,
    profile: bundle.profile,
    summary: [
      `Bundle account=${bundle.account}, profile=${bundle.profile}, files=${bundle.files.length}, programs=${bundle.programs.length}.`,
      `Readiness gates=${readiness.gates.length}, blockers=${readiness.gates.filter((gate) => gate.status !== "ok").length}.`,
      `Completion requirements=${completion.requirements.length}, gaps=${completion.requirements.filter((requirement) => requirement.status !== "proven").length}.`,
      `Baked skills gate=${bakedSkillGate?.status ?? "not-checked"}; ${bakedSkillEvidence.join(", ") || "no skill evidence"}.`,
      `Pending evidence phases=${pendingEvidence.map((item) => item.phase).join(", ") || "none"}.`,
    ],
    state: {
      readiness: readiness.ready ? "ready" : "blocked",
      completion: completion.complete ? "complete" : "incomplete",
      safetyGuard: guard.ready ? "ready" : "needs-confirmation",
      qaEvidence: qaEvidence?.ready ? "ready" : qaEvidence ? "not-ready" : "missing",
      bakedSkills: bakedSkillGate?.status === "ok" ? "ready" : "needs-proof",
    },
    nextCommands: [
      `d3code --mode ${runtime.mode} --model ${runtime.model} --safety ${runtime.safety}${runtime.profile ? ` --profile ${runtime.profile}` : ""}`,
      ...bakedSkillCommands,
      execution.nextCommand,
      "d3code bundle-release-report d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code safety-guard --bundle d3-app-bundle.json --safety ask",
    ],
    subagentQueue,
    restorePrompt: `Resume D3 Code work for ${bundle.account}. Start from bundle-context-pack, keep d3code-skill-pack and d3code-reference-skill-audit evidence with the handoff, run the next proof command, keep mutations behind safety policy, and do not claim completion until live D3 and QA evidence are recorded.`,
  }
}

export function renderBundleContextPack(pack: BundleContextPack): string {
  return [
    `# D3 Context Pack: ${pack.account}`,
    "",
    `Generated: ${pack.generatedAt}`,
    `Runtime: mode=${pack.runtime.mode} model=${pack.runtime.model} safety=${pack.runtime.safety} profile=${pack.runtime.profile ?? "none"}`,
    "",
    "Summary:",
    ...pack.summary.map((item) => `- ${item}`),
    "",
    "State:",
    `- readiness: ${pack.state.readiness}`,
    `- completion: ${pack.state.completion}`,
    `- safety guard: ${pack.state.safetyGuard}`,
    `- QA evidence: ${pack.state.qaEvidence}`,
    `- baked skills: ${pack.state.bakedSkills}`,
    "",
    "Subagent Queue:",
    ...(pack.subagentQueue.length ? pack.subagentQueue.map((task) => `- ${task}`) : ["- none"]),
    "",
    "Next Commands:",
    ...pack.nextCommands.map((command) => `- \`${command}\``),
    "",
    "Restore Prompt:",
    pack.restorePrompt,
  ].join("\n")
}
