import type { BundleEvidenceReport } from "../app/evidence.js"
import { recordGoalEvidence, type D3Goal } from "./goal.js"

export interface AppliedGoalEvidence {
  goal: D3Goal
  applied: Array<{ phase: string; status: string; evidence: string }>
}

export function applyBundleEvidenceToGoal(goal: D3Goal, report: BundleEvidenceReport): AppliedGoalEvidence {
  let next = structuredClone(goal)
  const applied: AppliedGoalEvidence["applied"] = []
  for (const item of report.items) {
    const phase = next.phases.find((entry) => entry.id === item.phase)
    if (!phase) continue
    const evidence = `[${item.status}] ${item.evidence}`
    if (phase.evidence?.includes(evidence)) continue
    next = recordGoalEvidence(next, evidence, item.phase)
    applied.push({ phase: item.phase, status: item.status, evidence })
  }
  return { goal: next, applied }
}

export function renderAppliedGoalEvidence(result: AppliedGoalEvidence): string {
  return [
    "# Applied Bundle Evidence",
    "",
    `Goal: ${result.goal.id}`,
    `Applied: ${result.applied.length}`,
    "",
    ...result.applied.map((item) => `- [${item.status}] ${item.phase}: ${item.evidence}`),
    "",
  ].join("\n")
}
