import { getMode, getSkill } from "./modes.js"

export interface WorkflowStep {
  id: string
  title: string
  output: string
}

export interface WorkflowTemplate {
  mode: string
  title: string
  description: string
  steps: WorkflowStep[]
}

const templates: Record<string, WorkflowTemplate> = {
  plan: {
    mode: "plan",
    title: "D3 Planning Workflow",
    description: "Spec-first workflow for D3 work before mutation.",
    steps: [
      { id: "ground", title: "Ground in evidence", output: "Manual references, account/file inventory, existing code, constraints." },
      { id: "intent", title: "Clarify intent", output: "Goal, success criteria, in/out of scope, risks." },
      { id: "design", title: "Design approach", output: "D3 account/file/program impacts and safety policy." },
      { id: "tests", title: "Define verification", output: "Regression fixtures, compile/catalog checks, data validation." },
      { id: "handoff", title: "Write implementation plan", output: "Decision-complete plan with commands and acceptance checks." },
    ],
  },
  gsd: {
    mode: "gsd",
    title: "D3 GSD Workflow",
    description: "Goal/phase execution loop adapted for D3 modernization.",
    steps: [
      { id: "goal", title: "Create goal", output: "Persisted goal with outcome and active audit phase." },
      { id: "audit", title: "Audit phase", output: "Account inventory, dictionary checks, shape/index/code findings." },
      { id: "map", title: "Map phase", output: "File/resource map, BASIC service map, call graph." },
      { id: "execute", title: "Execute phase", output: "Tests first, then code/API/migration changes." },
      { id: "verify", title: "Verify phase", output: "Regression suite, D3 compile/catalog evidence, web/API checks." },
    ],
  },
  migrate: {
    mode: "migrate",
    title: "D3-to-Web Migration Workflow",
    description: "Strangler migration workflow for converting D3 apps into web apps.",
    steps: [
      { id: "audit-db", title: "Audit database", output: "Dictionary, shape, multivalue, subvalue, and index findings." },
      { id: "audit-code", title: "Audit code", output: "BASIC symbols, calls, opens, writes, EXECUTE, lock risks." },
      { id: "resources", title: "Map resources", output: "D3 files to REST resources and JSON shapes." },
      { id: "services", title: "Map services", output: "Subroutines/programs to service methods and side effects." },
      { id: "api", title: "Generate API", output: "OpenAPI and adapter skeletons." },
      { id: "qa", title: "Validate web slice", output: "API tests and browser QA evidence." },
    ],
  },
  audit: {
    mode: "audit",
    title: "D3 Audit Workflow",
    description: "Read-only audit workflow for D3 code and database state.",
    steps: [
      { id: "inventory", title: "Inventory", output: "Profiles, account, MD/file pointers, dictionaries." },
      { id: "data", title: "Validate data", output: "Sample shapes, missing dictionary metadata, index expectations." },
      { id: "code", title: "Validate code", output: "BASIC lint findings, compile-output parsing, call graph." },
      { id: "risk", title: "Rank risk", output: "Severity-ranked findings with remediation." },
    ],
  },
  api: {
    mode: "api",
    title: "D3 REST API Workflow",
    description: "Generate API contracts and adapters from D3 resources.",
    steps: [
      { id: "resource", title: "Choose resource", output: "File, dictionary, item-id semantics, shape." },
      { id: "contract", title: "Generate contract", output: "OpenAPI paths and schemas." },
      { id: "adapter", title: "Generate adapter", output: "Repository/routes skeleton with D3 commands isolated." },
      { id: "tests", title: "Add tests", output: "Contract and adapter tests with D3 fixtures." },
    ],
  },
  modernize: {
    mode: "modernize",
    title: "D3 BASIC Modernization Workflow",
    description: "Behavior-preserving modernization workflow.",
    steps: [
      { id: "understand", title: "Understand behavior", output: "Symbols, call graph, files opened, writes, EXECUTE commands." },
      { id: "fixture", title: "Create fixture", output: "Representative input/output or compile-output fixture." },
      { id: "change", title: "Modernize", output: "Small refactor with explicit rollback path." },
      { id: "verify", title: "Verify", output: "Lint, compile/catalog, and regression checks." },
    ],
  },
  qa: {
    mode: "qa",
    title: "D3/Web QA Workflow",
    description: "Regression and evidence workflow for D3 and migrated web flows.",
    steps: [
      { id: "criteria", title: "Acceptance criteria", output: "D3 behavior and web/API outcomes." },
      { id: "checks", title: "Run checks", output: "Focused regression commands and API/browser tests." },
      { id: "evidence", title: "Capture evidence", output: "Outputs, screenshots, diffs, failures first." },
    ],
  },
}

export function workflowForMode(modeID: string): WorkflowTemplate {
  return templates[modeID] ?? templates.chat ?? templates.plan
}

export function renderWorkflow(modeID: string): string {
  const mode = getMode(modeID)
  const template = workflowForMode(modeID)
  const skills = mode?.skills.map((skillID) => getSkill(skillID)).filter(Boolean) ?? []
  return [
    `# ${template.title}`,
    "",
    template.description,
    "",
    "## Baked Skills",
    ...skills.map((skill) => `- ${skill!.id} (${skill!.source}): ${skill!.description}`),
    "",
    "## Steps",
    ...template.steps.map((step, index) => `${index + 1}. ${step.title}\n   - Output: ${step.output}`),
    "",
  ].join("\n")
}
