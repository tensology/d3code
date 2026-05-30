import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createBundleExecutionPlan } from "./execution-plan.js"
import { getMode, getSkill, skills, type D3CodeModeID } from "../skills/modes.js"
import { skillCoverageReport, type SkillCoverageReport } from "../skills/coverage.js"
import { recipes, type RecipeID } from "../skills/recipes.js"
import { referenceSkillCoverageReady, referenceSkillFamilies, type ReferenceSkillFamily } from "../skills/reference-map.js"

export interface BundleSkillPackMode {
  mode: D3CodeModeID
  title: string
  safety: string
  skills: Array<{ id: string; source: string; behavior: string[] }>
  workflow: string[]
  commands: string[]
}

export interface BundleSkillPack {
  account: string
  profile: string
  summary: string
  estate: {
    files: number
    dictionaries: number
    programs: number
    resources: number
    indexes: number
    users: number
  }
  modes: BundleSkillPackMode[]
  evidenceGates: Array<{ id: string; proof: string[] }>
  adaptedReferences: Array<{ source: string; reference: string; status: string; surfaces: string[] }>
  outOfScopeReferences: Array<{ source: string; reference: string; rationale: string }>
}

export interface BundleSkillManifest {
  account: string
  profile: string
  generatedFor: "d3code-migration-bundle"
  skillPack: BundleSkillPack
  bakedSkills: typeof skills
  coverage: SkillCoverageReport
  referenceSkills: {
    ready: boolean
    families: ReferenceSkillFamily[]
  }
  phaseSkillMap: Array<{
    phase: string
    status: string
    mode: string
    skills: string[]
    subagents: string[]
    commands: string[]
    doneWhen: string[]
  }>
}

const bundleModes: Array<{ mode: D3CodeModeID; recipe?: RecipeID }> = [
  { mode: "plan" },
  { mode: "gsd" },
  { mode: "audit", recipe: "audit" },
  { mode: "migrate", recipe: "migrate" },
  { mode: "api", recipe: "api" },
  { mode: "modernize", recipe: "modernize" },
  { mode: "qa" },
]

function commandsFor(mode: D3CodeModeID, recipe?: RecipeID): string[] {
  if (recipe) return recipes[recipe].commands
  if (mode === "plan") return ["d3code runbook plan", "d3code workflow plan", "d3code goal --mode migrate <title> <outcome>"]
  if (mode === "gsd") return ["d3code goal-next <goal-id>", "d3code goal-plan <goal-id>", "d3code goal-verify <goal-id>"]
  if (mode === "qa") return ["d3code bundle-qa-plan d3-app-bundle.json", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record", "npm run regression"]
  return []
}

export function createBundleSkillPack(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): BundleSkillPack {
  const modes = bundleModes.map(({ mode, recipe }) => {
    const definition = getMode(mode)!
    return {
      mode,
      title: definition.title,
      safety: definition.safetyBias,
      workflow: definition.workflow,
      commands: commandsFor(mode, recipe),
      skills: definition.skills.map((skillID) => getSkill(skillID)).filter((skill): skill is NonNullable<ReturnType<typeof getSkill>> => Boolean(skill)).map((skill) => ({
        id: skill.id,
        source: skill.source,
        behavior: skill.bakedBehavior,
      })),
    }
  })

  return {
    account: bundle.account,
    profile: bundle.profile,
    summary: "Bundle-specific D3 Code skill pack. Use this as the operating map for GSD, audit, migrate, API, modernization, and QA work on this D3 estate.",
    estate: {
      files: bundle.files.length,
      dictionaries: bundle.files.flatMap((file) => file.dictionary).length,
      programs: bundle.programs.length,
      resources: artifacts.migrationPlan.resources.length,
      indexes: bundle.files.flatMap((file) => file.observedIndexes ?? []).length,
      users: bundle.users.length,
    },
    modes,
    evidenceGates: [
      { id: "database-audit", proof: ["audit.json", "index-validation-plan.md", "data-validation-plan.md"] },
      { id: "code-modernization", proof: ["code-map.json", "code-modernization-plan.md", "modernization-proof output"] },
      { id: "web-migration", proof: ["migration-plan.json", "openapi.json", "src/*/*.repository.ts", "webapp-check"] },
      { id: "legacy-screen-modernization", proof: ["screen-modernization-plan.md", "terminal-capture artifacts", "screen-buffer.json"] },
      { id: "qa-and-goal-proof", proof: ["migration-qa-plan.md", "qa-evidence.md", "goal-evidence.md", "completion-audit.md"] },
      { id: "live-d3-proof", proof: ["profile-doctor", "live-proof", "operator-approved terminal transcript"] },
    ],
    adaptedReferences: referenceSkillFamilies
      .filter((family) => family.status !== "out-of-scope")
      .map((family) => ({ source: family.source, reference: family.reference, status: family.status, surfaces: family.productSurfaces })),
    outOfScopeReferences: referenceSkillFamilies
      .filter((family) => family.status === "out-of-scope")
      .map((family) => ({ source: family.source, reference: family.reference, rationale: family.rationale })),
  }
}

export function createBundleSkillManifest(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): BundleSkillManifest {
  const executionPlan = createBundleExecutionPlan(bundle, artifacts)
  return {
    account: bundle.account,
    profile: bundle.profile,
    generatedFor: "d3code-migration-bundle",
    skillPack: createBundleSkillPack(bundle, artifacts),
    bakedSkills: skills,
    coverage: skillCoverageReport(),
    referenceSkills: {
      ready: referenceSkillCoverageReady(),
      families: referenceSkillFamilies,
    },
    phaseSkillMap: executionPlan.steps.map((step) => ({
      phase: step.phase,
      status: step.status,
      mode: step.mode,
      skills: step.skills,
      subagents: step.subagents,
      commands: step.commands,
      doneWhen: step.doneWhen,
    })),
  }
}

export function renderBundleSkillPack(pack: BundleSkillPack): string {
  return [
    `# D3 Code Skill Pack: ${pack.account}`,
    "",
    `Profile: ${pack.profile}`,
    pack.summary,
    "",
    "Estate:",
    `- files=${pack.estate.files}`,
    `- dictionaries=${pack.estate.dictionaries}`,
    `- programs=${pack.estate.programs}`,
    `- resources=${pack.estate.resources}`,
    `- indexes=${pack.estate.indexes}`,
    `- users=${pack.estate.users}`,
    "",
    "Modes:",
    ...pack.modes.flatMap((mode) => [
      `- ${mode.title} (${mode.mode}, safety=${mode.safety})`,
      `  skills: ${mode.skills.map((skill) => skill.id).join(", ")}`,
      `  workflow: ${mode.workflow.join(" -> ")}`,
      `  commands: ${mode.commands.join(" | ") || "none"}`,
    ]),
    "",
    "Evidence Gates:",
    ...pack.evidenceGates.map((gate) => `- ${gate.id}: ${gate.proof.join("; ")}`),
    "",
    "Adapted Reference Skills:",
    ...pack.adaptedReferences.map((entry) => `- [${entry.status}] ${entry.source}: ${entry.reference} -> ${entry.surfaces.join(", ")}`),
    "",
    "Out Of Scope:",
    ...(pack.outOfScopeReferences.length ? pack.outOfScopeReferences.map((entry) => `- ${entry.source}: ${entry.reference} (${entry.rationale})`) : ["- none"]),
  ].join("\n")
}
