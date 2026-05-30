import { getAgent, type AgentInfo } from "./registry.js"
import { getMode } from "../skills/modes.js"

export interface DelegationTask {
  agent: string
  safety: "ask" | "plan" | "trust"
  objective: string
  inputs: string[]
  outputs: string[]
  evidenceGate: string[]
}

export interface DelegationPlan {
  mode: string
  title: string
  primary: AgentInfo
  tasks: DelegationTask[]
}

const taskCatalog: Record<string, DelegationTask[]> = {
  audit: [
    {
      agent: "d3-data-mapper",
      safety: "plan",
      objective: "Inventory files, dictionaries, sampled records, observed indexes, and data-shape risks.",
      inputs: ["D3 application bundle", "database samples", "manual search results for dictionaries/indexes"],
      outputs: ["database findings", "index validation notes", "file/resource evidence"],
      evidenceGate: ["Every finding names file, dictionary item, record sample, or index source."],
    },
    {
      agent: "d3-linter",
      safety: "plan",
      objective: "Audit BASIC/TCL hazards, compile-output issues, lock/write risks, and destructive EXECUTE commands.",
      inputs: ["program sources", "compile output", "code-map.json"],
      outputs: ["ranked code findings", "compile/catalog remediation notes"],
      evidenceGate: ["Each high-risk item includes program, line or command evidence, and remediation."],
    },
  ],
  migrate: [
    {
      agent: "d3-architect",
      safety: "plan",
      objective: "Map D3 files, dictionaries, programs, calls, and side effects into migration domains.",
      inputs: ["d3-app-bundle.json", "code-map.json", "audit.json"],
      outputs: ["domain/resource map", "strangler boundaries", "migration risks"],
      evidenceGate: ["Every proposed boundary maps back to D3 files/programs and named risks."],
    },
    {
      agent: "d3-data-mapper",
      safety: "plan",
      objective: "Design JSON shapes for D3 records, including multivalue/subvalue handling and indexes.",
      inputs: ["dictionary samples", "record shape analysis", "observed indexes"],
      outputs: ["resource schemas", "normalization notes", "query/index concerns"],
      evidenceGate: ["Schemas preserve D3 item-id and dictionary attribution."],
    },
    {
      agent: "d3-test-runner",
      safety: "ask",
      objective: "Verify generated OpenAPI, adapter files, and regression outputs for the migration slice.",
      inputs: ["migration-output", "test commands", "QA acceptance criteria"],
      outputs: ["test evidence", "failing checks", "live-D3 gaps"],
      evidenceGate: ["No migration slice is complete without test output or explicit unverified D3 gap."],
    },
  ],
  api: [
    {
      agent: "d3-architect",
      safety: "plan",
      objective: "Choose resource boundaries and service operations from D3 files/subroutines.",
      inputs: ["migration-plan.json", "code-map.json"],
      outputs: ["REST resource decisions", "service side-effect map"],
      evidenceGate: ["Each endpoint points to a D3 file, subroutine, or explicit adapter gap."],
    },
    {
      agent: "d3-test-runner",
      safety: "ask",
      objective: "Validate OpenAPI and adapter skeleton generation.",
      inputs: ["openapi.json", "generated adapter files", "npm test output"],
      outputs: ["contract verification", "adapter test findings"],
      evidenceGate: ["Generated files and schemas must be referenced by path or output."],
    },
  ],
  modernize: [
    {
      agent: "d3-basic-modernizer",
      safety: "ask",
      objective: "Propose behavior-preserving BASIC improvements from code-map and lint findings.",
      inputs: ["program source", "code-map.json", "compile output"],
      outputs: ["safe refactor plan", "rollback notes", "changed BASIC item if approved"],
      evidenceGate: ["Every change preserves file/lock/transaction behavior or calls out the risk."],
    },
    {
      agent: "d3-linter",
      safety: "plan",
      objective: "Review modernization changes for D3 semantic regressions.",
      inputs: ["diff", "lint output", "compile/catalog output"],
      outputs: ["findings-first review", "missing test list"],
      evidenceGate: ["Critical lock/write/transaction regressions block completion."],
    },
  ],
  qa: [
    {
      agent: "d3-test-runner",
      safety: "ask",
      objective: "Run focused D3, API, and generated-web regression checks.",
      inputs: ["goal plan", "acceptance criteria", "test commands"],
      outputs: ["verification evidence", "failures first"],
      evidenceGate: ["Every pass/fail claim includes command output or captured artifact."],
    },
    {
      agent: "research",
      safety: "plan",
      objective: "Gather manual/reference context for ambiguous D3 behavior.",
      inputs: ["manual index", "reference folder", "code-map questions"],
      outputs: ["cited D3 behavior notes", "open questions"],
      evidenceGate: ["Manual claims include topic/search evidence."],
    },
  ],
}

export function delegationPlanForMode(modeID: string): DelegationPlan {
  const mode = getMode(modeID) ?? getMode("gsd")!
  const primary = getAgent(modeID === "plan" ? "plan" : modeID === "audit" || modeID === "migrate" ? "d3-operator" : "build") ?? getAgent("build")!
  const tasks = taskCatalog[mode.id] ?? [
    {
      agent: "research",
      safety: "plan",
      objective: "Gather relevant D3, codebase, and reference context before execution.",
      inputs: ["project files", "manual index", "reference folder"],
      outputs: ["context summary", "open risks"],
      evidenceGate: ["Claims are grounded in files, command output, or manual references."],
    },
    {
      agent: "d3-test-runner",
      safety: "ask",
      objective: "Run the verification checks named by the active plan.",
      inputs: ["goal plan", "test commands"],
      outputs: ["verification evidence"],
      evidenceGate: ["Completion requires direct test or command evidence."],
    },
  ]
  return {
    mode: mode.id,
    title: `${mode.title} Delegation Plan`,
    primary,
    tasks,
  }
}

export function renderDelegationPlan(modeID: string): string {
  const plan = delegationPlanForMode(modeID)
  return [
    `# ${plan.title}`,
    "",
    `Primary: ${plan.primary.id} (${plan.primary.defaultSafety}) - ${plan.primary.description}`,
    "",
    "## Subagent Tasks",
    ...plan.tasks.flatMap((task, index) => [
      "",
      `${index + 1}. ${task.agent} (${task.safety})`,
      `   Objective: ${task.objective}`,
      "   Inputs:",
      ...task.inputs.map((input) => `   - ${input}`),
      "   Outputs:",
      ...task.outputs.map((output) => `   - ${output}`),
      "   Evidence gate:",
      ...task.evidenceGate.map((gate) => `   - ${gate}`),
    ]),
    "",
  ].join("\n")
}
