import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { getSkill } from "./modes.js"
import { referenceSkillCoverageReady, referenceSkillFamilies, type ReferenceSkillStatus } from "./reference-map.js"

export interface ReferenceSkillAuditItem {
  path: string
  status: ReferenceSkillStatus | "unmapped"
  productSkills: string[]
  rationale: string
}

export interface ReferenceSkillAuditReport {
  root: string
  ready: boolean
  total: number
  items: ReferenceSkillAuditItem[]
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist", "build", ".next", ".turbo"].includes(entry.name)) continue
      files.push(...await walk(path))
    }
    else if (entry.isFile() && entry.name === "SKILL.md") files.push(path)
  }
  return files
}

function mapped(path: string, status: ReferenceSkillAuditItem["status"], productSkills: string[], rationale: string): ReferenceSkillAuditItem {
  return { path, status, productSkills, rationale }
}

export function mapReferenceSkillPath(path: string): ReferenceSkillAuditItem {
  const normalized = path.replace(/\\/g, "/")
  if (normalized.startsWith("opencode/.opencode/skills/")) {
    const id = normalized.split("/")[3]
    const opencode: Record<string, string[]> = {
      "effect": ["effect-service-patterns", "rest-api-generation"],
      "improve-codebase-architecture": ["architecture-deepening", "d3-migration-map", "gstack-review"],
    }
    const skills = opencode[id ?? ""]
    return skills
      ? mapped(path, "adapted", skills, "OpenCode repo skill is adapted into D3 Code's generated TypeScript, migration, and architecture-review behavior.")
      : mapped(path, "unmapped", [], "OpenCode repo skill path is not mapped.")
  }

  if (normalized.startsWith("opencode/packages/opencode/test/fixture/skills/")) {
    const id = normalized.split("/")[6]
    const fixtures: Record<string, string[]> = {
      "agents-sdk": ["edge-agent-platform", "subagent-driven-development"],
      "cloudflare": ["edge-agent-platform", "d3-release-readiness"],
    }
    const skills = fixtures[id ?? ""]
    return skills
      ? mapped(path, "adapted", skills, "OpenCode fixture skill is represented as optional edge-agent and deployment-readiness guidance for migrated D3 web apps.")
      : mapped(path, "unmapped", [], "OpenCode fixture skill path is not mapped.")
  }

  if (normalized.startsWith("skills/superpowers/skills/")) {
    const id = normalized.split("/")[3]
    const superpowers: Record<string, string> = {
      "brainstorming": "brainstorming",
      "dispatching-parallel-agents": "dispatching-parallel-agents",
      "executing-plans": "executing-plans",
      "finishing-a-development-branch": "finishing-development-branch",
      "receiving-code-review": "receiving-code-review",
      "requesting-code-review": "requesting-code-review",
      "subagent-driven-development": "subagent-driven-development",
      "systematic-debugging": "systematic-debugging",
      "test-driven-development": "red-green-refactor",
      "using-git-worktrees": "worktree-isolation",
      "using-superpowers": "using-superpowers",
      "verification-before-completion": "verification-before-completion",
      "writing-plans": "writing-plans",
      "writing-skills": "writing-skills",
    }
    const skill = superpowers[id ?? ""]
    return skill
      ? mapped(path, "baked", [skill], "Superpowers skill is represented as a first-class D3 Code skill.")
      : mapped(path, "unmapped", [], "Superpowers skill path is not mapped.")
  }

  if (normalized.startsWith("skills/rtk/.claude/skills/")) {
    const id = normalized.split("/")[4]
    const rtk: Record<string, string[]> = {
      "code-simplifier": ["systematic-debugging", "gstack-review"],
      "design-patterns": ["gstack-design-review", "d3-migration-map"],
      "issue-triage": ["gstack-investigate", "gsd-phases"],
      "performance": ["token-efficient-tooling", "gstack-review"],
      "pr-review": ["gstack-review", "requesting-code-review"],
      "pr-triage": ["gstack-review", "gstack-ship"],
      "repo-recap": ["gstack-context", "gstack-docs"],
      "rtk-tdd": ["red-green-refactor"],
      "rtk-triage": ["gstack-investigate", "systematic-debugging"],
      "security-guardian": ["gstack-health-guard", "d3-release-readiness"],
      "ship": ["gstack-ship", "d3-release-readiness"],
      "tdd-rust": ["red-green-refactor"],
    }
    const skills = rtk[id ?? ""]
    return skills
      ? mapped(path, "adapted", skills, "RTK skill is adapted into D3 Code review, TDD, context, safety, and compact-tooling behavior.")
      : mapped(path, "unmapped", [], "RTK skill path is not mapped.")
  }

  if (normalized.startsWith("skills/gstack/")) {
    const parts = normalized.split("/")
    const id = parts[2] === "openclaw" && parts[3] === "skills" ? parts[4] : parts[2]
    if (id?.startsWith("ios-")) return mapped(path, "out-of-scope", [], "iOS-specific skills do not apply to D3 Unix modernization.")
    if (["setup-browser-cookies", "setup-deploy", "setup-gbrain", "sync-gbrain", "gstack-upgrade"].includes(id ?? "")) {
      return mapped(path, "out-of-scope", [], "Host-specific gstack setup/sync skills are not part of a D3 terminal coding product.")
    }
    if (id === "browser-skills") return mapped(path, "out-of-scope", [], "Demo browser site skills are not D3-specific; D3 web QA uses browser-qa instead.")
    const gstack: Record<string, string[]> = {
      "SKILL.md": ["gstack-spec", "gstack-review", "gstack-ship"],
      "autoplan": ["gstack-spec", "writing-plans"],
      "benchmark": ["token-efficient-tooling"],
      "benchmark-models": ["token-efficient-tooling"],
      "browse": ["browser-qa", "web-app-dogfooding"],
      "canary": ["gstack-ship", "d3-release-readiness"],
      "careful": ["gstack-health-guard"],
      "codex": ["gstack-context"],
      "context-restore": ["gstack-context"],
      "context-save": ["gstack-context"],
      "cso": ["gstack-investigate"],
      "design-consultation": ["gstack-design-review"],
      "design-html": ["gstack-design-review", "web-app-dogfooding"],
      "design-review": ["gstack-design-review"],
      "design-shotgun": ["gstack-design-review"],
      "devex-review": ["gstack-review"],
      "document-generate": ["gstack-docs"],
      "document-release": ["gstack-docs", "gstack-ship"],
      "freeze": ["gstack-health-guard"],
      "guard": ["gstack-health-guard"],
      "health": ["gstack-health-guard", "d3-release-readiness"],
      "investigate": ["gstack-investigate"],
      "land-and-deploy": ["gstack-ship"],
      "landing-report": ["gstack-ship", "gstack-docs"],
      "learn": ["gstack-investigate"],
      "make-pdf": ["gstack-docs"],
      "office-hours": ["gstack-context", "subagent-driven-development"],
      "open-gstack-browser": ["browser-qa"],
      "pair-agent": ["subagent-driven-development"],
      "plan-ceo-review": ["gstack-review", "spec-first"],
      "plan-design-review": ["gstack-design-review", "spec-first"],
      "plan-devex-review": ["gstack-review", "spec-first"],
      "plan-eng-review": ["gstack-review", "spec-first"],
      "plan-tune": ["gstack-spec", "writing-plans"],
      "qa": ["browser-qa", "web-app-dogfooding"],
      "qa-only": ["browser-qa", "web-app-dogfooding"],
      "retro": ["gstack-docs", "verification-before-completion"],
      "review": ["gstack-review"],
      "scrape": ["gstack-investigate"],
      "ship": ["gstack-ship", "d3-release-readiness"],
      "skillify": ["writing-skills"],
      "spec": ["gstack-spec", "spec-first"],
      "unfreeze": ["gstack-health-guard"],
      "gstack-openclaw-ceo-review": ["gstack-review"],
      "gstack-openclaw-investigate": ["gstack-investigate"],
      "gstack-openclaw-office-hours": ["gstack-context"],
      "gstack-openclaw-retro": ["gstack-docs"],
    }
    const skills = gstack[id ?? ""]
    return skills
      ? mapped(path, "adapted", skills, "gstack skill is adapted into D3 Code modes, bundle artifacts, review, QA, context, or readiness surfaces.")
      : mapped(path, "unmapped", [], "gstack skill path is not mapped.")
  }

  return mapped(path, "unmapped", [], "Reference skill source is not mapped.")
}

export async function auditReferenceSkillInventory(root: string): Promise<ReferenceSkillAuditReport> {
  const files = await walk(root)
  if (files.length === 0) {
    return {
      root,
      ready: referenceSkillCoverageReady(),
      total: referenceSkillFamilies.length,
      items: referenceSkillFamilies.map((family) => ({
        path: `${family.source}:${family.reference}`,
        status: family.status,
        productSkills: family.productSkills,
        rationale: family.rationale,
      })).sort((a, b) => a.path.localeCompare(b.path)),
    }
  }
  const items = files.map((file) => mapReferenceSkillPath(relative(root, file))).sort((a, b) => a.path.localeCompare(b.path))
  const ready = items.every((item) =>
    item.status !== "unmapped" && (item.status === "out-of-scope" || item.productSkills.every((skill) => Boolean(getSkill(skill)))),
  )
  return { root, ready, total: items.length, items }
}

export function renderReferenceSkillAudit(report: ReferenceSkillAuditReport): string {
  const counts = report.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})
  return [
    "# Reference Skill Audit",
    "",
    `Root: ${report.root}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Total SKILL.md: ${report.total}`,
    `Baked: ${counts.baked ?? 0}`,
    `Adapted: ${counts.adapted ?? 0}`,
    `Out of scope: ${counts["out-of-scope"] ?? 0}`,
    `Unmapped: ${counts.unmapped ?? 0}`,
    "",
    ...report.items.map((item) => [
      `- [${item.status}] ${item.path}`,
      `  product skills: ${item.productSkills.length > 0 ? item.productSkills.join(", ") : "none"}`,
      `  rationale: ${item.rationale}`,
    ].join("\n")),
    "",
  ].join("\n")
}
