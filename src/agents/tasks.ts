import { delegationPlanForMode, type DelegationTask } from "./delegation.js"
import { getAgent, type AgentInfo } from "./registry.js"

export interface SubagentTaskSpec {
  id: string
  agent: string
  safety: AgentInfo["defaultSafety"]
  system: string
  objective: string
  allowedTools: string[]
  deniedActions: string[]
  inputs: string[]
  expectedOutputs: string[]
  evidenceGate: string[]
  prompt: string
}

export interface SubagentPromptPack {
  mode: string
  title: string
  specs: SubagentTaskSpec[]
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "subagent-task"
}

function allowedToolsFor(task: DelegationTask): string[] {
  if (task.safety === "plan") return ["d3_detect", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_index_account", "d3_search"]
  if (task.agent === "d3-test-runner") return ["d3_login", "d3_tcl", "d3_compile_basic", "d3_catalog", "d3_locks", "d3_search"]
  if (task.agent === "d3-basic-modernizer") return ["d3_read_item", "d3_write_item", "d3_compile_basic", "d3_catalog", "d3_search"]
  return ["d3_tcl", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_search"]
}

function deniedActionsFor(task: DelegationTask): string[] {
  const denied = ["No account delete/restore.", "No CLEAR-FILE or broad deletes.", "No shell escapes.", "No lock breaks without explicit typed confirmation."]
  if (task.safety === "plan") denied.unshift("No writes, compile, catalog, LOGTO, or mutation tools.")
  if (task.safety === "ask") denied.unshift("No mutation tool unless the primary agent/user provided explicit approval.")
  return denied
}

function createPrompt(agent: AgentInfo, task: DelegationTask, allowedTools: string[], deniedActions: string[]): string {
  return [
    agent.system,
    "",
    `Objective: ${task.objective}`,
    "",
    `Safety: ${task.safety}`,
    "",
    "Allowed tools:",
    ...allowedTools.map((tool) => `- ${tool}`),
    "",
    "Denied actions:",
    ...deniedActions.map((action) => `- ${action}`),
    "",
    "Inputs to inspect:",
    ...task.inputs.map((input) => `- ${input}`),
    "",
    "Expected outputs:",
    ...task.outputs.map((output) => `- ${output}`),
    "",
    "Evidence gate:",
    ...task.evidenceGate.map((gate) => `- ${gate}`),
    "",
    "Return findings first, then evidence, then open gaps. Do not claim completion without direct evidence.",
  ].join("\n")
}

export function createSubagentPromptPack(modeID: string): SubagentPromptPack {
  const plan = delegationPlanForMode(modeID)
  const specs = plan.tasks.map((task, index) => {
    const agent = getAgent(task.agent) ?? plan.primary
    const allowedTools = allowedToolsFor(task)
    const deniedActions = deniedActionsFor(task)
    return {
      id: `${index + 1}-${slug(task.agent)}-${slug(task.objective)}`,
      agent: agent.id,
      safety: task.safety,
      system: agent.system,
      objective: task.objective,
      allowedTools,
      deniedActions,
      inputs: task.inputs,
      expectedOutputs: task.outputs,
      evidenceGate: task.evidenceGate,
      prompt: createPrompt(agent, task, allowedTools, deniedActions),
    }
  })
  return { mode: plan.mode, title: `${plan.title} Prompt Pack`, specs }
}

export function renderSubagentPromptPack(pack: SubagentPromptPack): string {
  return [
    `# ${pack.title}`,
    "",
    `Mode: ${pack.mode}`,
    `Tasks: ${pack.specs.length}`,
    "",
    ...pack.specs.flatMap((spec) => [
      `## ${spec.id}`,
      "",
      `Agent: ${spec.agent}`,
      `Safety: ${spec.safety}`,
      "",
      "Allowed tools:",
      ...spec.allowedTools.map((tool) => `- ${tool}`),
      "",
      "Denied actions:",
      ...spec.deniedActions.map((action) => `- ${action}`),
      "",
      "Prompt:",
      "```text",
      spec.prompt,
      "```",
      "",
    ]),
  ].join("\n")
}
