import { access } from "node:fs/promises"
import { join } from "node:path"
import type { D3CodeConfig } from "../config/config.js"
import { memoryPath } from "../config/paths.js"

export type EccHermesImportStatus = "adapted" | "reference-only" | "out-of-scope"

export interface EccHermesImport {
  sourceSkill: string
  sourcePath: string
  sourceFamily: "hermes" | "ecc"
  status: EccHermesImportStatus
  d3Skill?: string
  rationale: string
}

export interface ResolvedEccHermesImport extends EccHermesImport {
  resolvedPath: string
  present: boolean
}

export interface HermesStatus {
  enabled: boolean
  eccRoot?: string
  memoryPath: string
  imports: ResolvedEccHermesImport[]
  adapted: number
  present: number
  ready: boolean
}

export const eccHermesImports: EccHermesImport[] = [
  {
    sourceSkill: "hermes-imports",
    sourcePath: "skills/hermes-imports/SKILL.md",
    sourceFamily: "hermes",
    status: "adapted",
    d3Skill: "hermes-workflow-imports",
    rationale: "Sanitized Hermes-to-ECC import discipline becomes D3Code's rule for promoting repeated D3 operator workflows into skills.",
  },
  {
    sourceSkill: "knowledge-ops",
    sourcePath: "skills/knowledge-ops/SKILL.md",
    sourceFamily: "hermes",
    status: "adapted",
    d3Skill: "hermes-operator-memory",
    rationale: "Knowledge operations become verified D3 operator memory with private-data and style-preservation guards.",
  },
  {
    sourceSkill: "eval-harness",
    sourcePath: "skills/eval-harness/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-eval-harness",
    rationale: "Eval-driven development becomes D3-specific capability and regression evals for manuals, tools, BASIC, and migration outputs.",
  },
  {
    sourceSkill: "agent-harness-construction",
    sourcePath: "skills/agent-harness-construction/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-agent-harness-construction",
    rationale: "Action-space, observation, recovery, and context-budget rules directly improve D3Code tools and agent loops.",
  },
  {
    sourceSkill: "iterative-retrieval",
    sourcePath: "skills/iterative-retrieval/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-iterative-retrieval",
    rationale: "Iterative retrieval maps to D3Code RAG: manuals, System Builder, MV BASIC docs, operator notes, then live D3 evidence.",
  },
  {
    sourceSkill: "team-agent-orchestration",
    sourcePath: "skills/team-agent-orchestration/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-team-agent-orchestration",
    rationale: "Team orchestration maps to D3 audit, BASIC review, migration, QA, and reference-research subagent roles.",
  },
  {
    sourceSkill: "agent-introspection-debugging",
    sourcePath: "skills/agent-introspection-debugging/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-agent-introspection-debugging",
    rationale: "Agent introspection becomes structured debugging for tool routing, prompt failures, and wrong D3 assumptions.",
  },
  {
    sourceSkill: "coding-standards",
    sourcePath: "skills/coding-standards/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-coding-standards",
    rationale: "Generic coding standards become D3 style preservation: respect PICK BASIC idioms, local routines, and minimal legacy edits.",
  },
  {
    sourceSkill: "terminal-ops",
    sourcePath: "skills/terminal-ops/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-terminal-ops",
    rationale: "Terminal operations become D3 PTY/TCL/Unix command discipline with explicit command boundaries and transcript evidence.",
  },
  {
    sourceSkill: "token-budget-advisor",
    sourcePath: "skills/token-budget-advisor/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-token-budget-advisor",
    rationale: "Token budgeting maps to RAG-first retrieval, compact D3 tool output, and keeping manuals out of prompt context until needed.",
  },
  {
    sourceSkill: "plan-orchestrate",
    sourcePath: "skills/plan-orchestrate/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-plan-orchestrate",
    rationale: "Plan orchestration becomes D3Code phased execution across account audit, BASIC modernization, migration, QA, and operator handoff.",
  },
  {
    sourceSkill: "dynamic-workflow-mode",
    sourcePath: "skills/dynamic-workflow-mode/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-dynamic-workflow-mode",
    rationale: "Dynamic workflow selection becomes mode switching based on D3 evidence and current safety/risk.",
  },
  {
    sourceSkill: "agent-eval",
    sourcePath: "skills/agent-eval/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-agent-eval",
    rationale: "Agent evaluation becomes harness-level evaluation of D3 tool calls, retrieval, and completion quality.",
  },
  {
    sourceSkill: "production-audit",
    sourcePath: "skills/production-audit/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-production-audit",
    rationale: "Production audit becomes D3 readiness, live-proof, rollback, and generated-app release checks.",
  },
  {
    sourceSkill: "canary-watch",
    sourcePath: "skills/canary-watch/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-canary-watch",
    rationale: "Canary watch becomes post-change monitoring for D3 jobs, APIs, migrated flows, and operator rollback signals.",
  },
  {
    sourceSkill: "gateguard",
    sourcePath: "skills/gateguard/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-gateguard",
    rationale: "Gatekeeping becomes D3Code's proof-before-claim, mutation safety, and rollout gate discipline.",
  },
  {
    sourceSkill: "architecture-decision-records",
    sourcePath: "skills/architecture-decision-records/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-architecture-decision-records",
    rationale: "ADRs become explicit records for D3 modernization boundaries, adapter choices, and System Builder migration decisions.",
  },
  {
    sourceSkill: "error-handling",
    sourcePath: "skills/error-handling/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-error-handling",
    rationale: "Error-handling patterns become clear D3 tool, TCL, curl, compile, and API failure diagnostics.",
  },
  {
    sourceSkill: "research-ops",
    sourcePath: "skills/research-ops/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-research-ops",
    rationale: "Research operations become structured manual/RAG/live-evidence research before D3 changes.",
  },
  {
    sourceSkill: "deep-research",
    sourcePath: "skills/deep-research/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-deep-research",
    rationale: "Deep research becomes multi-source D3, System Builder, MV BASIC, and codebase investigation.",
  },
  {
    sourceSkill: "rules-distill",
    sourcePath: "skills/rules-distill/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-rules-distill",
    rationale: "Rule distillation turns repeated D3 operator corrections into durable skills and memory.",
  },
  {
    sourceSkill: "prompt-optimizer",
    sourcePath: "skills/prompt-optimizer/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-prompt-optimizer",
    rationale: "Prompt optimization becomes D3 tool-prompt, RAG prompt, and mode prompt improvement with eval evidence.",
  },
  {
    sourceSkill: "autonomous-agent-harness",
    sourcePath: "skills/autonomous-agent-harness/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-autonomous-agent-harness",
    rationale: "Autonomous harness patterns become bounded D3 run loops with explicit stop, safety, and evidence gates.",
  },
  {
    sourceSkill: "autonomous-loops",
    sourcePath: "skills/autonomous-loops/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-autonomous-loops",
    rationale: "Autonomous loops become bounded D3 audit/QA/learning loops, never unbounded mutation loops.",
  },
  {
    sourceSkill: "cost-aware-llm-pipeline",
    sourcePath: "skills/cost-aware-llm-pipeline/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-cost-aware-llm-pipeline",
    rationale: "Cost-aware pipeline becomes model routing, RAG-first retrieval, and avoiding large manual/account context dumps.",
  },
  {
    sourceSkill: "cost-tracking",
    sourcePath: "skills/cost-tracking/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-cost-tracking",
    rationale: "Cost tracking becomes model/tool usage accounting for long D3 modernization sessions.",
  },
  {
    sourceSkill: "benchmark",
    sourcePath: "skills/benchmark/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-benchmark",
    rationale: "Benchmarking becomes comparison of retrieval, parser, agent, and generated-app quality over D3 fixtures.",
  },
  {
    sourceSkill: "benchmark-optimization-loop",
    sourcePath: "skills/benchmark-optimization-loop/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-benchmark-optimization-loop",
    rationale: "Optimization loops become measured improvements to D3Code indexing, retrieval, and tool reliability.",
  },
  {
    sourceSkill: "recursive-decision-ledger",
    sourcePath: "skills/recursive-decision-ledger/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-recursive-decision-ledger",
    rationale: "Decision ledger becomes traceable modernization choices and reversibility notes.",
  },
  {
    sourceSkill: "workspace-surface-audit",
    sourcePath: "skills/workspace-surface-audit/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-workspace-surface-audit",
    rationale: "Workspace surface audit becomes inventory of D3Code tools, docs, references, generated artifacts, and operator surfaces.",
  },
  {
    sourceSkill: "mcp-server-patterns",
    sourcePath: "skills/mcp-server-patterns/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-mcp-server-patterns",
    rationale: "MCP patterns inform future D3Code tool server boundaries without replacing current local tool contracts.",
  },
  {
    sourceSkill: "api-connector-builder",
    sourcePath: "skills/api-connector-builder/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-api-connector-builder",
    rationale: "API connector building maps to D3-backed REST adapter and external endpoint integration patterns.",
  },
  {
    sourceSkill: "hexagonal-architecture",
    sourcePath: "skills/hexagonal-architecture/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-hexagonal-architecture",
    rationale: "Hexagonal architecture maps to keeping D3 adapters behind ports while generated web/API logic stays testable.",
  },
  {
    sourceSkill: "backend-patterns",
    sourcePath: "skills/backend-patterns/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-backend-patterns",
    rationale: "Backend patterns guide generated API/services without overriding D3 domain evidence.",
  },
  {
    sourceSkill: "postgres-patterns",
    sourcePath: "skills/postgres-patterns/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-postgres-patterns",
    rationale: "Postgres patterns matter when D3 migration targets relational stores and need MV shape mapping.",
  },
  {
    sourceSkill: "react-patterns",
    sourcePath: "skills/react-patterns/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-react-patterns",
    rationale: "React patterns guide generated D3-backed web UI without inventing workflow semantics.",
  },
  {
    sourceSkill: "react-performance",
    sourcePath: "skills/react-performance/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-react-performance",
    rationale: "React performance matters for generated production-planning and legacy-screen replacement UIs.",
  },
  {
    sourceSkill: "frontend-a11y",
    sourcePath: "skills/frontend-a11y/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-frontend-a11y",
    rationale: "Accessibility patterns apply to generated D3 web migrations and operator workbenches.",
  },
  {
    sourceSkill: "dashboard-builder",
    sourcePath: "skills/dashboard-builder/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-dashboard-builder",
    rationale: "Dashboard patterns apply to D3Code IDE/operator dashboards and migrated operational views.",
  },
  {
    sourceSkill: "git-workflow",
    sourcePath: "skills/git-workflow/SKILL.md",
    sourceFamily: "ecc",
    status: "adapted",
    d3Skill: "ecc-git-workflow",
    rationale: "Git workflow reinforces safe D3Code branch, diff, review, and handoff discipline.",
  },
]

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export function configuredEccRoot(config?: D3CodeConfig, override?: string): string | undefined {
  return override ?? process.env.D3CODE_ECC_REPO ?? config?.hermes?.eccRoot
}

export async function resolveEccHermesImportPaths(eccRoot?: string): Promise<ResolvedEccHermesImport[]> {
  return Promise.all(eccHermesImports.map(async (entry) => {
    const resolvedPath = eccRoot ? join(eccRoot, entry.sourcePath) : entry.sourcePath
    return { ...entry, resolvedPath, present: eccRoot ? await exists(resolvedPath) : false }
  }))
}

export async function createHermesStatus(config: D3CodeConfig, overrideRoot?: string): Promise<HermesStatus> {
  const eccRoot = configuredEccRoot(config, overrideRoot)
  const imports = await resolveEccHermesImportPaths(eccRoot)
  const adapted = imports.filter((entry) => entry.status === "adapted").length
  const present = imports.filter((entry) => entry.present).length
  return {
    enabled: config.hermes?.enabled ?? true,
    eccRoot,
    memoryPath: memoryPath.replace(/\.md$/i, ".jsonl"),
    imports,
    adapted,
    present,
    ready: Boolean((config.hermes?.enabled ?? true) && eccRoot && present >= adapted),
  }
}

export function renderEccHermesImportMap(imports = eccHermesImports): string {
  return [
    "# Hermes and ECC Import Map",
    "",
    ...imports.map((entry) => [
      `- [${entry.status}] ${entry.sourceFamily}:${entry.sourceSkill}`,
      `  source: ${entry.sourcePath}`,
      `  d3 skill: ${entry.d3Skill ?? "none"}`,
      `  rationale: ${entry.rationale}`,
    ].join("\n")),
    "",
  ].join("\n")
}

export function renderHermesStatus(status: HermesStatus): string {
  return [
    "# Hermes / ECC Harness Status",
    "",
    `Enabled: ${status.enabled ? "yes" : "no"}`,
    `Ready: ${status.ready ? "yes" : "no"}`,
    `ECC root: ${status.eccRoot ?? "not configured"}`,
    `Memory: ${status.memoryPath}`,
    `Imports present: ${status.present}/${status.imports.length}`,
    `Adapted imports: ${status.adapted}`,
    "",
    ...status.imports.map((entry) => `- ${entry.present ? "present" : "missing"} [${entry.status}] ${entry.sourceSkill} -> ${entry.d3Skill ?? "reference"} (${entry.resolvedPath})`),
    "",
  ].join("\n")
}
