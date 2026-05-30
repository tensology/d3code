import type { BundleEvidenceReport, BundleEvidenceItem } from "../app/evidence.js"
import type { D3Goal, GoalPhase } from "./goal.js"

export interface GoalBundleAuditPhase {
  phase: string
  title: string
  goalStatus: GoalPhase["status"]
  bundleStatus: BundleEvidenceItem["status"] | "not-in-bundle"
  ready: boolean
  evidenceCount: number
  evidence: string[]
  missingEvidence: string[]
  commands: string[]
}

export interface GoalBundleAuditReport {
  goal: string
  title: string
  ready: boolean
  summary: string
  phases: GoalBundleAuditPhase[]
}

function phaseAudit(phase: GoalPhase, item?: BundleEvidenceItem): GoalBundleAuditPhase {
  const bundleStatus = item?.status ?? "not-in-bundle"
  const evidence = phase.evidence ?? []
  const missingEvidence: string[] = []
  if (!item) missingEvidence.push("no bundle evidence generated for this phase")
  if (item?.status === "missing") missingEvidence.push(`bundle evidence missing: ${item.evidence}`)
  if (item?.status === "needs-review") missingEvidence.push(`bundle evidence needs review: ${item.evidence}`)
  if (evidence.length === 0) missingEvidence.push("no evidence has been recorded on the goal phase")
  const ready = bundleStatus === "recorded" && evidence.length > 0
  return {
    phase: phase.id,
    title: phase.title,
    goalStatus: phase.status,
    bundleStatus,
    ready,
    evidenceCount: evidence.length,
    evidence,
    missingEvidence,
    commands: item?.commands ?? phase.commands ?? [],
  }
}

export function auditGoalAgainstBundle(goal: D3Goal, report: BundleEvidenceReport): GoalBundleAuditReport {
  const byPhase = new Map(report.items.map((item) => [item.phase, item]))
  const phases = goal.phases.map((phase) => phaseAudit(phase, byPhase.get(phase.id as BundleEvidenceItem["phase"])))
  const ready = phases.every((phase) => phase.ready)
  const missing = phases.filter((phase) => !phase.ready)
  return {
    goal: goal.id,
    title: goal.title,
    ready,
    summary: ready
      ? "all migration phases have recorded goal evidence and recorded bundle proof"
      : `${missing.length} phase${missing.length === 1 ? "" : "s"} still need proof or review`,
    phases,
  }
}

export function renderGoalBundleAudit(report: GoalBundleAuditReport): string {
  return [
    `# D3 Goal Bundle Audit: ${report.title}`,
    "",
    `Goal: ${report.goal}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Summary: ${report.summary}`,
    "",
    ...report.phases.flatMap((phase) => [
      `- [${phase.ready ? "ready" : "needs-proof"}] ${phase.phase}: ${phase.title}`,
      `  goal-status: ${phase.goalStatus}`,
      `  bundle-status: ${phase.bundleStatus}`,
      `  recorded-evidence: ${phase.evidenceCount}`,
      ...(phase.missingEvidence.length > 0 ? ["  Missing/review:", ...phase.missingEvidence.map((item) => `  - ${item}`)] : ["  Missing/review: none"]),
      ...(phase.commands.length > 0 ? ["  Commands:", ...phase.commands.map((command) => `  - \`${command}\``)] : []),
    ]),
    "",
  ].join("\n")
}
