import { getSkill } from "./modes.js"

export type ReferenceSkillStatus = "baked" | "adapted" | "out-of-scope"

export interface ReferenceSkillFamily {
  source: "superpowers" | "gsd" | "gstack" | "rtk" | "opencode" | "rocket-mvbasic"
  reference: string
  status: ReferenceSkillStatus
  productSkills: string[]
  productSurfaces: string[]
  rationale: string
}

export const referenceSkillFamilies: ReferenceSkillFamily[] = [
  {
    source: "superpowers",
    reference: "skills/*/SKILL.md",
    status: "baked",
    productSkills: [
      "using-superpowers",
      "brainstorming",
      "spec-first",
      "writing-plans",
      "executing-plans",
      "red-green-refactor",
      "systematic-debugging",
      "verification-before-completion",
      "requesting-code-review",
      "receiving-code-review",
      "worktree-isolation",
      "subagent-driven-development",
      "dispatching-parallel-agents",
      "finishing-development-branch",
      "writing-skills",
    ],
    productSurfaces: ["modes", "runbook", "workflow", "goal-plan", "goal-verify", "delegate"],
    rationale: "All Superpowers workflow skills are represented as D3 Code skills and mode behaviors.",
  },
  {
    source: "gsd",
    reference: "README.md, docs/*, docs/prd, docs/adr, agents/gsd-*.md",
    status: "adapted",
    productSkills: ["gsd-phases", "gstack-spec", "gstack-review", "verification-before-completion"],
    productSurfaces: ["goal", "goals", "goal-plan", "goal-evidence", "goal-verify", "goal-advance", "goal-block", "bundle-execution-plan", "bundle-skill-pack", "bundle-prd", "bundle-adr"],
    rationale: "GSD is adapted into persistent goals, phases, PRD/ADR-style bundle docs, evidence gates, and mode runbooks instead of copied as a separate planner runtime.",
  },
  {
    source: "gstack",
    reference: "spec, autoplan, plan-*",
    status: "adapted",
    productSkills: ["gstack-spec", "spec-first", "writing-plans"],
    productSurfaces: ["plan mode", "workflow plan", "runbook plan", "goal-plan"],
    rationale: "Planning skills become D3 plan mode and goal plans with D3 account/file/program acceptance criteria.",
  },
  {
    source: "gstack",
    reference: "qa, qa-only, browse, open-gstack-browser",
    status: "adapted",
    productSkills: ["browser-qa", "web-app-dogfooding"],
    productSurfaces: ["qa mode", "workflow qa", "bundle-brief", "readiness"],
    rationale: "Browser QA is mapped to migrated web/API validation and evidence capture.",
  },
  {
    source: "gstack",
    reference: "review, devex-review, plan-eng-review, plan-devex-review",
    status: "adapted",
    productSkills: ["gstack-review", "requesting-code-review", "receiving-code-review"],
    productSurfaces: ["delegate", "runbook api", "runbook modernize", "goal-verify"],
    rationale: "Review skills are represented as findings-first checks for D3 code, generated adapters, and migration artifacts.",
  },
  {
    source: "gstack",
    reference: "ship, land-and-deploy, canary, landing-report",
    status: "adapted",
    productSkills: ["gstack-ship", "d3-release-readiness", "finishing-development-branch"],
    productSurfaces: ["readiness", "bundle-brief", "bundle-release-report", "goal-verify"],
    rationale: "Shipping is adapted into readiness evidence, verified artifacts, canary/rollback reports, and explicit user-controlled release steps.",
  },
  {
    source: "gstack",
    reference: "health, guard, careful, freeze, unfreeze",
    status: "adapted",
    productSkills: ["gstack-health-guard", "d3-release-readiness"],
    productSurfaces: ["readiness", "setup-proof", "permission", "profile-doctor", "terminal-plan", "cockpit-terminal", "terminal-capture", "safety modes", "safety-guard"],
    rationale: "Safety and health checks are D3-specific gates around setup proof, profile checks, terminal transcript capture, destructive TCL, and regression proof.",
  },
  {
    source: "gstack",
    reference: "investigate, learn, scrape, cso",
    status: "adapted",
    productSkills: ["gstack-investigate", "d3-database-audit", "token-efficient-tooling"],
    productSurfaces: ["audit mode", "index-account", "bundle-capture", "bundle-index", "search-manual"],
    rationale: "Research/investigation becomes account indexing, manual search, and D3 audit evidence gathering.",
  },
  {
    source: "gstack",
    reference: "context-save, context-restore, pair-agent, office-hours",
    status: "adapted",
    productSkills: ["gstack-context", "subagent-driven-development"],
    productSurfaces: ["sessions", "resume", "delegate", "agents", "bundle-context-pack"],
    rationale: "Context and pairing skills are productized as resumable sessions and mode-aware subagent delegation.",
  },
  {
    source: "gstack",
    reference: "document-generate, document-release, make-pdf, retro",
    status: "adapted",
    productSkills: ["gstack-docs", "gstack-ship"],
    productSurfaces: ["bundle-brief", "bundle-prd", "bundle-adr", "bundle-release-report", "runbook", "workflow", "recipe"],
    rationale: "Documentation skills are mapped to generated modernization briefs, recipes, and evidence summaries.",
  },
  {
    source: "gstack",
    reference: "design-review, design-consultation, design-html, design-shotgun",
    status: "adapted",
    productSkills: ["gstack-design-review", "web-app-dogfooding"],
    productSurfaces: ["migrate mode", "qa mode", "ide", "bundle-ui-plan", "bundle-access-plan", "bundle-screen-plan", "cockpit-terminal", "terminal-capture", "screen-parse", "bundle-brief"],
    rationale: "Design skills are adapted for migrated web UX parity, generated UI and access plans, and D3 legacy screen understanding, including terminal transcript capture and IDE inspection.",
  },
  {
    source: "gstack",
    reference: "benchmark, benchmark-models, model-overlays",
    status: "adapted",
    productSkills: ["token-efficient-tooling"],
    productSurfaces: ["models", "resolve-model", "model-routing", "readiness"],
    rationale: "Model comparison is represented by provider/model selection, D3 role-based model routing, and proof gates rather than gstack benchmark scripts.",
  },
  {
    source: "gstack",
    reference: "ios-*",
    status: "out-of-scope",
    productSkills: [],
    productSurfaces: ["none"],
    rationale: "iOS-specific build/test skills do not fit D3 Unix modernization unless a future migrated mobile app is in scope.",
  },
  {
    source: "gstack",
    reference: "setup-browser-cookies, setup-deploy, setup-gbrain, sync-gbrain, gstack-upgrade",
    status: "out-of-scope",
    productSkills: [],
    productSurfaces: ["none"],
    rationale: "Host-specific setup and upgrade automation belongs to gstack itself, not a D3 terminal coding product.",
  },
  {
    source: "gstack",
    reference: "skillify",
    status: "adapted",
    productSkills: ["writing-skills"],
    productSurfaces: ["skills", "skill-info", "skill-coverage", "reference-skills", "reference-audit", "bundle-skill-pack"],
    rationale: "Skill authoring becomes tested D3 Code product-skill catalog behavior.",
  },
  {
    source: "rtk",
    reference: "README.md, CLAUDE.md, hooks/*",
    status: "adapted",
    productSkills: ["compact-output", "token-efficient-tooling"],
    productSurfaces: ["tool-compact", "bundle-index", "index-account"],
    rationale: "RTK is baked as compact tool output and large-account context management.",
  },
  {
    source: "opencode",
    reference: ".opencode/skills/effect, packages/opencode/test/fixture/skills/*",
    status: "adapted",
    productSkills: ["effect-service-patterns", "edge-agent-platform", "rest-api-generation"],
    productSurfaces: ["migrate mode", "api mode", "ide", "bundle-erp-plan", "bundle-ui-plan", "bundle-access-plan", "bundle-reconciliation-plan", "bundle-execution-plan", "webapp-skeleton", "adapter-write", "webapp-check", "webapp-smoke"],
    rationale: "OpenCode implementation skills are adapted into generated TypeScript service discipline and optional edge-agent migration targets.",
  },
  {
    source: "opencode",
    reference: ".opencode/skills/improve-codebase-architecture",
    status: "adapted",
    productSkills: ["architecture-deepening", "d3-migration-map", "gstack-review"],
    productSurfaces: ["migrate mode", "modernize mode", "bundle-code-map", "bundle-code-plan", "bundle-screen-plan", "bundle-backlog", "bundle-delegate"],
    rationale: "OpenCode architecture-review behavior becomes D3-aware code mapping, modernization backlog generation, and reviewable refactor candidates.",
  },
  {
    source: "rocket-mvbasic",
    reference: "docs/usage/Connection.md, OnlineEditing.md, HashedFileEditing.md, Compile.md, Debugging.md, Diagnostics.md, References.md, Completion.md",
    status: "adapted",
    productSkills: ["mvbasic-ide-parity", "d3-database-audit", "d3-migration-map"],
    productSurfaces: ["mvbasic-reference-audit", "ide", "cockpit-terminal", "bundle-code-plan", "bundle-screen-plan", "bundle-access-plan", "live-proof"],
    rationale: "Rocket MV BASIC extension docs become an IDE-parity checklist for D3 Code: profile/account connection, online editing locks, hashed-file workbench behavior, compile/catalog loops, diagnostics, references, completion, and explicit debugger-proof boundaries.",
  },
]

export function referenceSkillCoverageReady(): boolean {
  return referenceSkillFamilies.every((family) =>
    family.status === "out-of-scope" || family.productSkills.every((skillID) => Boolean(getSkill(skillID))),
  )
}

export function renderReferenceSkillMap(): string {
  const ready = referenceSkillCoverageReady()
  return [
    "# Reference Skill Map",
    "",
    `Ready: ${ready ? "yes" : "no"}`,
    "",
    ...referenceSkillFamilies.map((family) => [
      `- [${family.status}] ${family.source}: ${family.reference}`,
      `  product skills: ${family.productSkills.length > 0 ? family.productSkills.join(", ") : "none"}`,
      `  surfaces: ${family.productSurfaces.join(", ")}`,
      `  rationale: ${family.rationale}`,
    ].join("\n")),
    "",
  ].join("\n")
}
