import { skills, modes } from "./modes.js"
import { referenceSkillCoverageReady } from "./reference-map.js"

export interface SkillCoverageItem {
  source: string
  expected: string
  covered: boolean
  evidence: string[]
}

export interface SkillCoverageReport {
  ready: boolean
  items: SkillCoverageItem[]
}

const coverageItems: Array<Omit<SkillCoverageItem, "covered">> = [
  {
    source: "superpowers",
    expected: "brainstorming/spec-first planning",
    evidence: ["skill:brainstorming", "skill:spec-first", "mode:plan", "command:runbook"],
  },
  {
    source: "superpowers",
    expected: "writing and executing plans",
    evidence: ["skill:writing-plans", "skill:executing-plans", "mode:gsd", "command:goal-plan"],
  },
  {
    source: "superpowers",
    expected: "test-driven development and verification before completion",
    evidence: ["skill:red-green-refactor", "skill:verification-before-completion", "command:goal-verify", "command:product-audit", "script:regression"],
  },
  {
    source: "superpowers",
    expected: "subagent-driven development and review",
    evidence: ["skill:subagent-driven-development", "skill:dispatching-parallel-agents", "skill:requesting-code-review", "command:delegate", "command:delegate-prompts", "command:bundle-delegate", "command:agent-run"],
  },
  {
    source: "gsd",
    expected: "goal, phase, evidence, and verification process",
    evidence: ["skill:gsd-phases", "mode:gsd", "command:goal", "command:bundle-goal", "command:goal-evidence", "command:goal-apply-bundle-evidence", "command:goal-audit-bundle", "command:goal-verify", "command:bundle-execution-plan", "command:bundle-prd", "command:bundle-adr", "command:bundle-completion-audit", "command:bundle-evidence", "command:bundle-refresh-evidence", "command:bundle-skill-pack"],
  },
  {
    source: "gstack",
    expected: "spec, review, QA, ship, health, docs, context, investigation, and design-review workflows adapted to D3",
    evidence: ["skill:gstack-spec", "skill:gstack-review", "skill:gstack-ship", "skill:gstack-health-guard", "skill:gstack-investigate", "skill:gstack-context", "skill:gstack-docs", "skill:gstack-design-review", "command:ide", "command:setup-proof", "command:bundle-ui-plan", "command:safety-guard", "command:bundle-context-pack", "command:bundle-prd", "command:bundle-adr", "command:bundle-release-report", "command:bundle-readiness", "command:reference-skills"],
  },
  {
    source: "gstack",
    expected: "model benchmarking and overlays adapted into D3 role-based model routing",
    evidence: ["skill:token-efficient-tooling", "command:models", "command:resolve-model", "command:model-routing"],
  },
  {
    source: "gstack",
    expected: "web/API dogfooding and QA evidence",
    evidence: ["skill:browser-qa", "skill:web-app-dogfooding", "mode:qa", "mode:migrate", "command:bundle-ui-plan", "command:bundle-qa-plan", "command:bundle-readiness", "command:webapp-smoke", "command:acceptance"],
  },
  {
    source: "rtk",
    expected: "compact output and token-efficient large-account tooling",
    evidence: ["skill:compact-output", "skill:token-efficient-tooling", "command:tool-compact"],
  },
  {
    source: "opencode",
    expected: "Effect-style TypeScript services, codebase architecture improvement, and optional edge agent deployment guidance",
    evidence: ["skill:effect-service-patterns", "skill:architecture-deepening", "skill:edge-agent-platform", "mode:migrate", "mode:api", "mode:modernize", "command:webapp-skeleton", "command:webapp-check", "command:webapp-smoke", "command:reference-audit"],
  },
  {
    source: "d3code",
    expected: "D3 database/code audit and indexing validation",
    evidence: ["skill:d3-database-audit", "command:audit-db", "command:bundle-capture", "command:bundle-audit", "command:bundle-index-plan", "command:bundle-data-plan", "command:bundle-code-plan", "command:bundle-screen-plan", "command:bundle-backlog", "command:profile-doctor", "command:terminal-plan", "command:ide-terminal", "command:terminal-capture", "command:live-proof-init", "command:live-proof-check", "command:screen-parse", "command:agent-run"],
  },
  {
    source: "d3code",
    expected: "D3 migration and REST API generation",
    evidence: ["skill:d3-migration-map", "skill:rest-api-generation", "mode:migrate", "mode:api", "command:bundle-execution-plan", "command:bundle-erp-plan", "command:bundle-ui-plan", "command:bundle-reconciliation-plan", "command:bundle-access-plan", "command:ide", "command:bundle-prd", "command:bundle-adr", "command:bundle-artifacts", "command:bundle-brief", "command:bundle-readiness", "command:bundle-skill-pack", "command:acceptance", "command:webapp-skeleton", "command:webapp-check", "command:webapp-smoke", "command:agent-run"],
  },
  {
    source: "d3code",
    expected: "D3 BASIC modernization",
    evidence: ["mode:modernize", "command:basic-lint", "command:code-map", "command:bundle-code-plan", "command:bundle-screen-plan", "command:terminal-capture", "command:screen-parse", "command:compile-errors", "command:modernization-proof", "command:agent-run"],
  },
  {
    source: "rocket-mvbasic",
    expected: "IDE parity for MV BASIC connection, online editing, locks, compile/catalog, hashed files, diagnostics, and debugger boundaries",
    evidence: ["skill:mvbasic-ide-parity", "command:mvbasic-reference-audit", "command:ide-terminal", "command:bundle-screen-plan", "command:bundle-code-plan"],
  },
  {
    source: "d3code",
    expected: "explicit reference skill map with adapted and out-of-scope decisions",
    evidence: ["command:reference-skills", "command:reference-audit", "skill:d3-release-readiness"],
  },
]

const commandNames = new Set([
  "runbook",
  "goal",
  "bundle-goal",
  "bundle-completion-audit",
  "bundle-evidence",
  "bundle-execution-plan",
  "bundle-erp-plan",
  "bundle-ui-plan",
  "bundle-reconciliation-plan",
  "bundle-access-plan",
  "bundle-prd",
  "bundle-adr",
  "bundle-release-report",
  "bundle-context-pack",
  "ide",
  "setup-proof",
  "safety-guard",
  "bundle-refresh-evidence",
  "bundle-skill-pack",
  "goal-plan",
  "goal-evidence",
  "goal-apply-bundle-evidence",
  "goal-audit-bundle",
  "goal-verify",
  "delegate",
  "delegate-prompts",
  "bundle-delegate",
  "agent-run",
  "tool-compact",
  "models",
  "resolve-model",
  "model-routing",
  "audit-db",
  "bundle-capture",
  "bundle-audit",
  "bundle-index-plan",
  "bundle-data-plan",
  "bundle-code-plan",
  "bundle-screen-plan",
  "bundle-backlog",
  "bundle-qa-plan",
  "bundle-readiness",
  "profile-doctor",
  "terminal-plan",
  "ide-terminal",
  "terminal-capture",
  "live-proof-init",
  "live-proof-check",
  "screen-parse",
  "bundle-artifacts",
  "bundle-brief",
  "webapp-skeleton",
  "webapp-check",
  "webapp-smoke",
  "basic-lint",
  "code-map",
  "compile-errors",
  "modernization-proof",
  "reference-skills",
  "reference-audit",
  "mvbasic-reference-audit",
  "acceptance",
  "product-audit",
])

const scripts = new Set(["regression"])

function hasEvidence(evidence: string): boolean {
  const [kind, id] = evidence.split(":")
  if (!kind || !id) return false
  if (kind === "skill") return skills.some((skill) => skill.id === id)
  if (kind === "mode") return modes.some((mode) => mode.id === id)
  if (kind === "command") return commandNames.has(id)
  if (kind === "script") return scripts.has(id)
  return false
}

export function skillCoverageReport(): SkillCoverageReport {
  const items = coverageItems.map((item) => ({
    ...item,
    covered: item.evidence.every(hasEvidence) && (item.evidence.includes("command:reference-skills") ? referenceSkillCoverageReady() : true),
  }))
  return {
    ready: items.every((item) => item.covered),
    items,
  }
}

export function renderSkillCoverage(): string {
  const report = skillCoverageReport()
  return [
    "# D3 Code Baked Skill Coverage",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.items.map((item) => [
      `- [${item.covered ? "covered" : "missing"}] ${item.source}: ${item.expected}`,
      `  evidence: ${item.evidence.join(", ")}`,
    ].join("\n")),
    "",
  ].join("\n")
}
