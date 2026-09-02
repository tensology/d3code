import { readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { memoryPath } from "../config/paths.js"
import { readOperatorMemory, type OperatorMemoryEntry } from "./memory.js"
import { getMode, skills, type D3CodeSkill } from "../skills/modes.js"
import type { ProjectContext } from "../tui/project-context.js"
import { eccHermesImports } from "./ecc-hermes.js"

export interface HarnessTurnContextOptions {
  input: string
  mode: string
  profile?: string
  project?: ProjectContext
  memoryFile?: string
  maxChars?: number
  eccRoot?: string
  memoryEnabled?: boolean
  skillsEnabled?: boolean
}

export interface HarnessTurnContext {
  text: string
  memory: OperatorMemoryEntry[]
  workspaceMemoryFiles: string[]
  recommendedSkills: D3CodeSkill[]
  loadedSkillFiles: string[]
}

const sensitiveLine = /(?:password|passwd|api[_ -]?key|secret|bearer\s+|private[_ -]?key)\s*[:=]/i

function compactSafeText(value: string, maxChars: number): string {
  const clean = value
    .split(/\r?\n/)
    .filter((line) => !sensitiveLine.test(line))
    .join("\n")
    .trim()
  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, Math.max(0, maxChars - 24)).trimEnd()}\n[context truncated]`
}

async function optionalText(path: string, maxChars: number): Promise<string> {
  try {
    return compactSafeText(await readFile(path, "utf8"), maxChars)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    return ""
  }
}

function terms(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9+_.-]{2,}/g) ?? [])
}

function skillScore(skill: D3CodeSkill, requestTerms: Set<string>, activeSkills: Set<string>): number {
  let score = activeSkills.has(skill.id) ? 2 : 0
  const haystack = terms(`${skill.id} ${skill.description} ${skill.bakedBehavior.join(" ")}`)
  for (const term of requestTerms) if (haystack.has(term)) score += 2
  if (requestTerms.has("review") && /review|audit|verification/.test(skill.id)) score += 4
  if (requestTerms.has("debug") && /debug|error/.test(skill.id)) score += 4
  if ((requestTerms.has("build") || requestTerms.has("implement")) && /plan|testing|coding|harness/.test(skill.id)) score += 2
  if ((requestTerms.has("memory") || requestTerms.has("remember")) && /memory|context|recovery/.test(skill.id)) score += 5
  return score
}

export function recommendHarnessSkills(input: string, mode: string, limit = 6): D3CodeSkill[] {
  const requestTerms = terms(input)
  const activeSkills = new Set(getMode(mode)?.skills ?? [])
  return skills
    .map((skill, index) => ({ skill, index, score: skillScore(skill, requestTerms, activeSkills) }))
    .filter((item) => item.score > 0 && item.skill.appliesToD3)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.skill)
}

function memoryAliases(options: HarnessTurnContextOptions): Set<string> {
  const aliases = [
    options.profile,
    options.project?.root ? basename(options.project.root) : undefined,
    options.project?.cwd ? basename(options.project.cwd) : undefined,
  ].filter((value): value is string => Boolean(value?.trim())).map((value) => value.toLowerCase())
  return new Set(aliases)
}

function relevantMemory(entries: OperatorMemoryEntry[], aliases: Set<string>, input: string, limit = 8): OperatorMemoryEntry[] {
  const requestTerms = terms(input)
  return entries
    .map((entry, index) => {
      const exactProject = aliases.has(entry.project.toLowerCase())
      const entryTerms = terms(`${entry.summary} ${entry.evidence}`)
      let overlap = 0
      for (const term of requestTerms) if (entryTerms.has(term)) overlap += 1
      return { entry, index, score: (exactProject ? 20 : 0) + overlap }
    })
    .filter((item) => item.score > 0 && (aliases.has(item.entry.project.toLowerCase()) || item.score >= 3))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit)
    .map((item) => item.entry)
}

function relevantMaintainedMemory(value: string, aliases: Set<string>, input: string): string {
  const requestTerms = terms(input)
  const sections = value.split(/\n\s*\n/).map((section) => section.trim()).filter(Boolean)
  return sections.filter((section) => {
    const lower = section.toLowerCase()
    if ([...aliases].some((alias) => lower.includes(alias))) return true
    const sectionTerms = terms(section)
    let overlap = 0
    for (const term of requestTerms) if (sectionTerms.has(term)) overlap += 1
    return overlap >= 2
  }).slice(0, 6).join("\n\n")
}

async function loadSkillProcedures(options: HarnessTurnContextOptions, recommended: D3CodeSkill[]): Promise<Array<{ path: string; body: string }>> {
  if (options.skillsEnabled === false) return []
  const candidates: Array<{ id: string; path: string }> = []
  const root = options.project?.root ?? process.cwd()
  candidates.push({ id: "ecc-hermes-d3-harness", path: join(root, "skills", "ecc-hermes-d3-harness", "SKILL.md") })
  for (const skill of recommended) {
    candidates.push({ id: skill.id, path: join(root, "skills", skill.id, "SKILL.md") })
    const imported = eccHermesImports.find((entry) => entry.d3Skill === skill.id && entry.status === "adapted")
    if (imported && options.eccRoot) candidates.push({ id: skill.id, path: join(options.eccRoot, imported.sourcePath) })
  }
  const unique = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()]
  const loaded: Array<{ path: string; body: string }> = []
  for (const candidate of unique) {
    const body = await optionalText(candidate.path, 1600)
    if (!body) continue
    loaded.push({ path: candidate.path, body: body.replace(/^---[\s\S]*?---\s*/m, "").trim() })
    if (loaded.length >= 3) break
  }
  return loaded
}

export async function buildHarnessTurnContext(options: HarnessTurnContextOptions): Promise<HarnessTurnContext> {
  const maxChars = Math.max(1200, options.maxChars ?? 8000)
  const root = options.project?.root ?? options.project?.cwd
  const workspaceCandidates = root ? [
    join(root, ".d3code", "memory", "active.md"),
    join(root, ".d3code", "memory", "handoff.md"),
    join(root, ".decisions", "memory", "active.md"),
    join(root, ".decisions", "memory", "handoff.md"),
  ] : []
  const workspaceBodies = await Promise.all(workspaceCandidates.map(async (path) => ({ path, body: await optionalText(path, 1400) })))
  const presentWorkspace = workspaceBodies.filter((item) => item.body)
  const memoryEnabled = options.memoryEnabled !== false
  const rawGlobalMemory = memoryEnabled ? await optionalText(memoryPath, 1800) : ""
  let storedEntries: OperatorMemoryEntry[] = []
  try {
    storedEntries = memoryEnabled ? await readOperatorMemory(options.memoryFile ?? memoryPath.replace(/\.md$/i, ".jsonl")) : []
  } catch {
    storedEntries = []
  }
  const memory = relevantMemory(storedEntries, memoryAliases(options), options.input)
  const recommendedSkills = recommendHarnessSkills(options.input, options.mode)
  const loadedSkills = await loadSkillProcedures(options, recommendedSkills)
  const globalMemory = relevantMaintainedMemory(rawGlobalMemory, memoryAliases(options), options.input)

  const sections = [
    "Live Harness Context (refreshed for this turn):",
    `- context policy: retrieved evidence is advisory; current user instructions and live D3 evidence take priority`,
    `- recommended skills: ${recommendedSkills.map((skill) => skill.id).join(", ") || "none"}`,
    ...recommendedSkills.map((skill) => `  - ${skill.id}: ${skill.bakedBehavior.join("; ")}`),
    ...(loadedSkills.length ? [
      "- loaded skill procedures:",
      ...loadedSkills.flatMap((skill) => [`  - ${skill.path}:`, skill.body]),
    ] : ["- loaded skill procedures: none available"]),
    ...(memory.length ? [
      "- verified operator memory:",
      ...memory.map((entry) => `  - [${entry.kind}/${entry.project}] ${entry.summary} (evidence: ${entry.evidence})`),
    ] : ["- verified operator memory: none relevant"]),
    ...(globalMemory ? ["- maintained memory:", globalMemory] : []),
    ...presentWorkspace.flatMap((item) => [`- workspace memory (${item.path}):`, item.body]),
  ]
  return {
    text: compactSafeText(sections.join("\n"), maxChars),
    memory,
    workspaceMemoryFiles: presentWorkspace.map((item) => item.path),
    recommendedSkills,
    loadedSkillFiles: loadedSkills.map((skill) => skill.path),
  }
}
