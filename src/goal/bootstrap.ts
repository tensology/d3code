import type { D3ApplicationBundle } from "../app/bundle.js"
import { advanceGoal, createModernizationGoal, recordGoalEvidence, type D3Goal } from "./goal.js"

export interface BundleGoalOptions {
  title?: string
  outcome?: string
  artifactsOut?: string
  webappReady?: boolean
}

function evidenceForBundle(bundle: D3ApplicationBundle): string {
  return [
    `Parsed D3 application bundle for account ${bundle.account}`,
    `profile=${bundle.profile}`,
    `files=${bundle.files.map((file) => `${file.name}(${file.records.length} records, ${file.dictionary.length} dict items)`).join(", ") || "none"}`,
    `programs=${bundle.programs.map((program) => `${program.file}/${program.item}`).join(", ") || "none"}`,
  ].join("; ")
}

export function createMigrationGoalFromBundle(bundle: D3ApplicationBundle, options: BundleGoalOptions = {}): D3Goal {
  let goal = createModernizationGoal(
    options.title ?? `Migrate ${bundle.account} D3 application`,
    options.outcome ?? `Migrate ${bundle.account} D3 application into a verified web/API slice`,
    "migrate",
  )
  goal = recordGoalEvidence(goal, evidenceForBundle(bundle), "capture")
  goal = advanceGoal(goal, "bundle parsed and captured from provided bundle JSON")

  if (options.artifactsOut) {
    goal = recordGoalEvidence(goal, `Generated audit/code-map/index/backlog artifacts in ${options.artifactsOut}`, "audit")
    goal = advanceGoal(goal, "audit artifacts generated from bundle")
    goal = recordGoalEvidence(goal, `Generated migration-plan/openapi/resource map artifacts in ${options.artifactsOut}`, "map")
    goal = advanceGoal(goal, "migration map artifacts generated from bundle")
    goal = recordGoalEvidence(goal, `Generated web/API scaffold artifacts in ${options.artifactsOut}`, "api")
    if (options.webappReady) goal = recordGoalEvidence(goal, `webapp-check passed for ${options.artifactsOut}`, "api")
    goal = advanceGoal(goal, "API scaffold artifacts generated from bundle")
    goal = recordGoalEvidence(goal, `Generated migration QA plan in ${options.artifactsOut}; live D3/profile and browser proof still required`, "verify")
  }

  return goal
}
