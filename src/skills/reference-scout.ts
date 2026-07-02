import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { mapReferenceSkillPath } from "./reference-audit.js"

export type ReferenceSkillScoutScope = "d3"
export type ReferenceSkillScoutDecision = "adopt" | "adapt" | "out-of-scope" | "needs-review"

export interface ReferenceSkillScoutItem {
  path: string
  decision: ReferenceSkillScoutDecision
  mappedSkills: string[]
  rationale: string
}

export interface ReferenceSkillScoutReport {
  root: string
  scope: ReferenceSkillScoutScope
  total: number
  counts: Record<ReferenceSkillScoutDecision, number>
  items: ReferenceSkillScoutItem[]
}

const d3Terms = /\b(d3|rocket d3|pick|pick basic|mv basic|mvbasic|multivalue|multi-value|flashbasic|tcl|aql|dictionary|dict\b|system builder|sb\/xa|sb\+|systembuilder|d-pointer|q-pointer|attribute|subvalue|catalog|hashed file|d3code)\b/i
const genericEngineeringTerms = /\b(test|tdd|debug|security|secret|performance|quality|review|docs|documentation|architecture|frontend|backend|api|database|postgres|react|typescript|git|worktree|plan|planning|verification|lint|build)\b/i
const externalServiceTerms = /\b(slack|spotify|gmail|calendar|notion|discord|trello|jira|asana|salesforce|shopify|woocommerce|stripe|telegram|whatsapp|instagram|tiktok|youtube|weather|sonos|tesla|apple notes|reminders)\b/i

function emptyCounts(): Record<ReferenceSkillScoutDecision, number> {
  return { adopt: 0, adapt: 0, "out-of-scope": 0, "needs-review": 0 }
}

async function walkSkillFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist", "build", ".next", ".turbo"].includes(entry.name)) continue
      files.push(...await walkSkillFiles(path))
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(path)
    }
  }
  return files
}

export function classifyReferenceSkill(path: string, text: string): ReferenceSkillScoutItem {
  const mapped = mapReferenceSkillPath(path)
  if (mapped.status !== "unmapped") {
    const decision: ReferenceSkillScoutDecision = mapped.status === "out-of-scope" ? "out-of-scope" : mapped.status === "baked" ? "adopt" : "adapt"
    return {
      path,
      decision,
      mappedSkills: mapped.productSkills,
      rationale: `Already mapped by D3Code reference audit: ${mapped.rationale}`,
    }
  }

  const haystack = `${path}\n${text}`
  if (d3Terms.test(haystack)) {
    return {
      path,
      decision: "adopt",
      mappedSkills: ["scoped-reference-projection"],
      rationale: "Contains D3 manual/reference vocabulary and should be reviewed as a D3Code-native skill candidate.",
    }
  }
  if (externalServiceTerms.test(haystack)) {
    return {
      path,
      decision: "out-of-scope",
      mappedSkills: [],
      rationale: "External-service automation is outside the Rocket D3 manual/reference scope for this pass.",
    }
  }
  if (genericEngineeringTerms.test(haystack)) {
    return {
      path,
      decision: "adapt",
      mappedSkills: ["scoped-reference-projection"],
      rationale: "Generic engineering workflow may be useful only after it is narrowed to D3Code evidence gates.",
    }
  }
  return {
    path,
    decision: "needs-review",
    mappedSkills: [],
    rationale: "No D3 manual/reference vocabulary or known D3Code mapping was found.",
  }
}

export async function scoutReferenceSkills(root: string, options: { scope?: ReferenceSkillScoutScope } = {}): Promise<ReferenceSkillScoutReport> {
  const scope = options.scope ?? "d3"
  const files = await walkSkillFiles(root)
  const items = (await Promise.all(files.map(async (file) => {
    const path = relative(root, file).replace(/\\/g, "/")
    return classifyReferenceSkill(path, await readFile(file, "utf8"))
  }))).sort((a, b) => a.path.localeCompare(b.path))
  const counts = emptyCounts()
  for (const item of items) counts[item.decision] += 1
  return { root, scope, total: items.length, counts, items }
}

export function renderReferenceSkillScout(report: ReferenceSkillScoutReport): string {
  return [
    "# Reference Skill Scout",
    "",
    `Root: ${report.root}`,
    `Scope: ${report.scope}`,
    `Total SKILL.md: ${report.total}`,
    `Adopt: ${report.counts.adopt}`,
    `Adapt: ${report.counts.adapt}`,
    `Out of scope: ${report.counts["out-of-scope"]}`,
    `Needs review: ${report.counts["needs-review"]}`,
    "",
    ...report.items.map((item) => [
      `- [${item.decision}] ${item.path}`,
      `  mapped skills: ${item.mappedSkills.length ? item.mappedSkills.join(", ") : "none"}`,
      `  rationale: ${item.rationale}`,
    ].join("\n")),
    "",
  ].join("\n")
}
