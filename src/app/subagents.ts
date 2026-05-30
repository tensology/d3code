import type { AgentInfo } from "../agents/registry.js"
import { getAgent } from "../agents/registry.js"
import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createCodeModernizationPlan } from "./code-plan.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createIndexValidationPlan } from "./index-plan.js"
import { createMigrationQaPlan } from "./qa-plan.js"
import { createMigrationReadinessReport } from "./readiness.js"

export interface BundleSubagentTask {
  id: string
  agent: string
  safety: AgentInfo["defaultSafety"]
  title: string
  objective: string
  inputs: string[]
  outputs: string[]
  evidenceGate: string[]
  bundleEvidence: string[]
}

export interface BundleSubagentPlan {
  account: string
  profile: string
  tasks: BundleSubagentTask[]
}

export interface BundleSubagentPromptPacket {
  id: string
  agent: string
  safety: AgentInfo["defaultSafety"]
  title: string
  allowedTools: string[]
  deniedActions: string[]
  prompt: string
}

export interface BundleSubagentPromptPack {
  account: string
  profile: string
  packets: BundleSubagentPromptPacket[]
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "task"
}

function task(values: BundleSubagentTask): BundleSubagentTask {
  return values
}

function safety(agent: string): AgentInfo["defaultSafety"] {
  return getAgent(agent)?.defaultSafety ?? "plan"
}

function allowedToolsForTask(task: BundleSubagentTask): string[] {
  if (task.safety === "plan") return ["d3_detect", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_index_account", "d3_search"]
  if (task.agent === "d3-test-runner") return ["d3_login", "d3_tcl", "d3_compile_basic", "d3_catalog", "d3_locks", "d3_search"]
  if (task.agent === "d3-basic-modernizer") return ["d3_read_item", "d3_write_item", "d3_compile_basic", "d3_catalog", "d3_search"]
  return ["d3_tcl", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_search"]
}

function deniedActionsForTask(task: BundleSubagentTask): string[] {
  const denied = ["No account delete/restore.", "No CLEAR-FILE or broad deletes.", "No shell escapes.", "No lock breaks without explicit typed confirmation."]
  if (task.safety === "plan") denied.unshift("No writes, compile, catalog, LOGTO, or mutation tools.")
  if (task.safety === "ask") denied.unshift("No mutation tool unless the primary agent/user provided explicit approval.")
  return denied
}

function createTaskPrompt(task: BundleSubagentTask, allowedTools: string[], deniedActions: string[]): string {
  const agent = getAgent(task.agent)
  return [
    agent?.system ?? `You are ${task.agent}, a D3 Code subagent.`,
    "",
    `Bundle task: ${task.title}`,
    `Objective: ${task.objective}`,
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
    "Bundle evidence:",
    ...task.bundleEvidence.map((evidence) => `- ${evidence}`),
    "",
    "Evidence gate:",
    ...task.evidenceGate.map((gate) => `- ${gate}`),
    "",
    "Return findings first, then exact evidence, then open gaps and next commands. Do not claim completion without direct bundle, artifact, command, or live-D3 proof.",
  ].join("\n")
}

export function createBundleSubagentPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): BundleSubagentPlan {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const indexPlan = createIndexValidationPlan(bundle, artifacts)
  const codePlan = createCodeModernizationPlan(bundle, artifacts)
  const qaPlan = createMigrationQaPlan(bundle, artifacts)
  const readiness = createMigrationReadinessReport(bundle, artifacts)
  const tasks: BundleSubagentTask[] = []

  if (artifacts.migrationPlan.resources.length > 0) {
    tasks.push(task({
      id: "architecture-resource-map",
      agent: "d3-architect",
      safety: safety("d3-architect"),
      title: "Map D3 resources and strangler boundaries",
      objective: "Turn captured D3 files, dictionaries, programs, and generated REST resources into migration boundaries.",
      inputs: ["d3-app-bundle.json", "migration-plan.json", "code-map.json", "audit.json"],
      outputs: ["resource/domain map", "service boundary notes", "migration risks"],
      evidenceGate: ["Every boundary names the D3 file, program, generated route, and unresolved risk it depends on."],
      bundleEvidence: artifacts.migrationPlan.resources.map((resource) => `resource:${resource.resource}->${resource.file}`),
    }))
  }

  const dataReview = dataPlan.items.filter((item) => item.status !== "ok")
  const indexReview = indexPlan.items.filter((item) => item.status !== "ok")
  if (dataReview.length > 0 || indexReview.length > 0) {
    tasks.push(task({
      id: "data-index-validation",
      agent: "d3-data-mapper",
      safety: safety("d3-data-mapper"),
      title: "Validate D3 data shape, dictionaries, and indexes",
      objective: "Review non-ok data and index plan items before REST schemas or list/search endpoints are treated as stable.",
      inputs: ["data-validation-plan.json", "index-validation-plan.json", "audit.json", "sampled D3 records"],
      outputs: ["accepted dictionary conventions", "record shape notes", "index/AQL risk list"],
      evidenceGate: ["Every accepted risk has file, dictionary item, sample record, or LIST-INDEX evidence."],
      bundleEvidence: [
        `data-non-ok:${dataReview.length}`,
        `index-non-ok:${indexReview.length}`,
        ...dataReview.slice(0, 5).map((item) => `data:${item.file}:${item.subject}:${item.status}`),
        ...indexReview.slice(0, 5).map((item) => `index:${item.file}:${item.index}:${item.status}`),
      ],
    }))
  }

  const codeReview = codePlan.items.filter((item) => item.priority === "P0" || item.priority === "P1")
  for (const program of artifacts.codeMap.programs.filter((entry) => entry.risk !== "low")) {
    tasks.push(task({
      id: `basic-${slug(program.program)}`,
      agent: program.symbols.writes.length > 0 || program.symbols.executes.length > 0 ? "d3-basic-modernizer" : "d3-linter",
      safety: program.symbols.writes.length > 0 || program.symbols.executes.length > 0 ? safety("d3-basic-modernizer") : safety("d3-linter"),
      title: `Modernize/review ${program.program}`,
      objective: "Resolve BASIC lint, write, EXECUTE, CALL, lock, and compile/catalog risks without changing behavior.",
      inputs: ["code-modernization-plan.json", "code-map.json", `${program.program} source`, "compile output when available"],
      outputs: ["findings-first review", "safe refactor plan", "compile/catalog proof checklist"],
      evidenceGate: ["No code change is accepted without lint output and compile/catalog evidence or a named live-D3 gap."],
      bundleEvidence: [`program:${program.program}`, `risk:${program.risk}`, `findings:${program.findings.length}`, `writes:${program.symbols.writes.length}`, `executes:${program.symbols.executes.length}`],
    }))
  }
  if (codeReview.length > 0 && tasks.every((entry) => entry.agent !== "d3-linter")) {
    tasks.push(task({
      id: "code-risk-review",
      agent: "d3-linter",
      safety: safety("d3-linter"),
      title: "Review prioritized BASIC modernization risks",
      objective: "Perform an independent findings-first review of P0/P1 code modernization items.",
      inputs: ["code-modernization-plan.json", "code-map.json"],
      outputs: ["ranked code findings", "missing compile/catalog evidence"],
      evidenceGate: ["Critical lock/write/transaction/destructive TCL findings block readiness."],
      bundleEvidence: [`p0-p1-code-items:${codeReview.length}`],
    }))
  }

  const readinessGaps = readiness.gates.filter((gate) => gate.status !== "ok")
  tasks.push(task({
    id: "qa-readiness-proof",
    agent: "d3-test-runner",
    safety: safety("d3-test-runner"),
    title: "Prove migration QA and readiness gates",
    objective: "Execute or collect the evidence needed for D3, generated API, browser, and regression readiness.",
    inputs: ["migration-qa-plan.json", "migration-readiness.json", "migration-output", "goal evidence"],
    outputs: ["executed command output", "failing checks", "explicit live-D3 gaps"],
    evidenceGate: ["Readiness remains no until live D3 profile proof and executed QA/regression output are recorded."],
    bundleEvidence: [`qa-checks:${qaPlan.checks.length}`, `readiness-gaps:${readinessGaps.length}`, ...readinessGaps.map((gate) => `gate:${gate.id}:${gate.status}`)],
  }))

  tasks.push(task({
    id: "manual-context",
    agent: "research",
    safety: safety("research"),
    title: "Gather D3 manual context for ambiguous migration behavior",
    objective: "Use the indexed Rocket D3 manual and reference folder to clarify D3 behavior before risky rewrites.",
    inputs: ["manual index", "reference folder", "code/data/readiness questions"],
    outputs: ["manual-backed context notes", "open questions"],
    evidenceGate: ["Manual claims name the searched topic or source artifact that supports them."],
    bundleEvidence: [`account:${bundle.account}`, `programs:${bundle.programs.length}`, `files:${bundle.files.length}`],
  }))

  return {
    account: bundle.account,
    profile: bundle.profile,
    tasks,
  }
}

export function createBundleSubagentPromptPack(plan: BundleSubagentPlan): BundleSubagentPromptPack {
  return {
    account: plan.account,
    profile: plan.profile,
    packets: plan.tasks.map((task) => {
      const allowedTools = allowedToolsForTask(task)
      const deniedActions = deniedActionsForTask(task)
      return {
        id: task.id,
        agent: task.agent,
        safety: task.safety,
        title: task.title,
        allowedTools,
        deniedActions,
        prompt: createTaskPrompt(task, allowedTools, deniedActions),
      }
    }),
  }
}

export function renderBundleSubagentPromptPack(pack: BundleSubagentPromptPack): string {
  return [
    `# D3 Bundle Subagent Prompt Pack: ${pack.account}`,
    "",
    `Profile: ${pack.profile}`,
    `Packets: ${pack.packets.length}`,
    "",
    ...pack.packets.flatMap((packet) => [
      `## ${packet.id}`,
      "",
      `Agent: ${packet.agent}`,
      `Safety: ${packet.safety}`,
      "",
      "Allowed tools:",
      ...packet.allowedTools.map((tool) => `- ${tool}`),
      "",
      "Denied actions:",
      ...packet.deniedActions.map((action) => `- ${action}`),
      "",
      "Prompt:",
      "```text",
      packet.prompt,
      "```",
      "",
    ]),
  ].join("\n")
}

export function renderBundleSubagentPlan(plan: BundleSubagentPlan): string {
  return [
    `# D3 Bundle Subagent Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Tasks: ${plan.tasks.length}`,
    "",
    ...plan.tasks.flatMap((entry, index) => [
      `${index + 1}. ${entry.agent} (${entry.safety}) - ${entry.title}`,
      `   Objective: ${entry.objective}`,
      "   Inputs:",
      ...entry.inputs.map((input) => `   - ${input}`),
      "   Outputs:",
      ...entry.outputs.map((output) => `   - ${output}`),
      "   Evidence gate:",
      ...entry.evidenceGate.map((gate) => `   - ${gate}`),
      "   Bundle evidence:",
      ...entry.bundleEvidence.map((evidence) => `   - ${evidence}`),
      "",
    ]),
  ].join("\n")
}
