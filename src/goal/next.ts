import { delegationPlanForMode } from "../agents/delegation.js"
import { getMode, getSkill } from "../skills/modes.js"
import { activePhase, type D3Goal } from "./goal.js"

export function renderGoalNext(goal: D3Goal): string {
  const phase = activePhase(goal)
  const mode = getMode(goal.mode) ?? getMode("gsd")!
  const skills = mode.skills.map((skillID) => getSkill(skillID)).filter(Boolean)
  const delegation = delegationPlanForMode(goal.mode)

  if (!phase) {
    return [
      `# Next: ${goal.title}`,
      "",
      `Goal: ${goal.id}`,
      "No active or pending phase remains.",
      "Run `d3code goal-verify <goal-id>` to confirm readiness before claiming completion.",
      "",
    ].join("\n")
  }

  const phaseTasks = [
    ...(phase.checklist ?? []).map((item) => `- ${item}`),
    ...(phase.commands ?? []).map((command) => `- run \`${command}\``),
  ]
  const matchingTasks = delegation.tasks.filter((task) =>
    task.inputs.some((input) => input.toLowerCase().includes(phase.id))
    || task.outputs.some((output) => output.toLowerCase().includes(phase.id))
    || task.objective.toLowerCase().includes(phase.id)
    || phase.title.toLowerCase().split(/\s+/).some((word) => word.length > 4 && task.objective.toLowerCase().includes(word)),
  )
  const tasks = matchingTasks.length > 0 ? matchingTasks : delegation.tasks.slice(0, 2)

  return [
    `# Next: ${goal.title}`,
    "",
    `Goal: ${goal.id}`,
    `Mode: ${goal.mode}`,
    `Outcome: ${goal.outcome}`,
    "",
    `## Active Phase: ${phase.id} (${phase.status})`,
    phase.title,
    "",
    "## Do Next",
    ...(phaseTasks.length ? phaseTasks : ["- Inspect current state and record evidence before advancing."]),
    "",
    "## Baked Skills To Apply",
    ...skills.slice(0, 8).map((skill) => `- ${skill!.id}: ${skill!.bakedBehavior.join("; ")}`),
    "",
    "## Evidence Gate",
    ...phase.verification.map((item) => `- ${item}`),
    ...(phase.evidence?.length ? ["", "## Recorded Evidence", ...phase.evidence.map((item) => `- ${item}`)] : []),
    "",
    "## Suggested Subagents",
    ...tasks.map((task) => `- ${task.agent} (${task.safety}): ${task.objective}`),
    "",
    "## Advance Rule",
    "- Add evidence with `d3code goal-evidence <goal-id> --evidence \"...\"` before `d3code goal-advance <goal-id>`.",
    "- If a live D3 check is required but unavailable, record that gap explicitly instead of marking the phase ready.",
    "",
  ].join("\n")
}
