export type D3CodeModeID = "chat" | "plan" | "gsd" | "migrate" | "audit" | "api" | "modernize" | "qa"

export interface D3CodeSkill {
  id: string
  source: "d3code" | "superpowers" | "gsd" | "gstack" | "rtk" | "opencode" | "rocket-mvbasic"
  description: string
  appliesToD3: boolean
  bakedBehavior: string[]
}

export interface D3CodeMode {
  id: D3CodeModeID
  title: string
  description: string
  safetyBias: "plan" | "ask" | "trust"
  system: string
  skills: string[]
  workflow: string[]
}

export const skills: D3CodeSkill[] = [
  {
    id: "using-superpowers",
    source: "superpowers",
    description: "Route work through the right methodology before acting, instead of treating skills as passive docs.",
    appliesToD3: true,
    bakedBehavior: ["select mode-specific workflow", "announce active skill pack", "keep evidence tied to each step"],
  },
  {
    id: "brainstorming",
    source: "superpowers",
    description: "Refine rough D3 modernization ideas into intent, constraints, alternatives, and a readable design.",
    appliesToD3: true,
    bakedBehavior: ["ask intent-changing questions", "explore D3/web alternatives", "present design in reviewable chunks"],
  },
  {
    id: "spec-first",
    source: "superpowers",
    description: "Clarify intent before building, then lock a readable spec and implementation plan.",
    appliesToD3: true,
    bakedBehavior: ["ask intent-changing questions", "separate design from execution", "make plans implementable"],
  },
  {
    id: "writing-plans",
    source: "superpowers",
    description: "Turn approved D3 designs into small, verifiable implementation steps with file paths and checks.",
    appliesToD3: true,
    bakedBehavior: ["write 2-5 minute tasks", "name exact artifacts", "include command-level verification"],
  },
  {
    id: "executing-plans",
    source: "superpowers",
    description: "Execute approved plans in small batches with checkpoints, review, and evidence before moving on.",
    appliesToD3: true,
    bakedBehavior: ["work phase by phase", "stop on contradictory evidence", "summarize completed and next steps"],
  },
  {
    id: "red-green-refactor",
    source: "superpowers",
    description: "Prefer failing regression tests before behavior changes, then minimal implementation, then cleanup.",
    appliesToD3: true,
    bakedBehavior: ["write D3 fixture or parser tests first", "prove failures", "rerun regression suite"],
  },
  {
    id: "systematic-debugging",
    source: "superpowers",
    description: "Debug D3/API failures with reproduction, root-cause tracing, hypothesis testing, and regression guards.",
    appliesToD3: true,
    bakedBehavior: ["reproduce exact D3 command/API failure", "trace from symptom to root cause", "add a regression check"],
  },
  {
    id: "verification-before-completion",
    source: "superpowers",
    description: "Treat completion as unproven until checks directly cover the claimed D3 behavior.",
    appliesToD3: true,
    bakedBehavior: ["map claims to evidence", "run focused tests", "call out unverified live-D3 gaps"],
  },
  {
    id: "requesting-code-review",
    source: "superpowers",
    description: "Review D3 changes for correctness, risk, safety policy, and missing tests before declaring done.",
    appliesToD3: true,
    bakedBehavior: ["findings first", "rank compile/data/API risks", "block on critical issues"],
  },
  {
    id: "receiving-code-review",
    source: "superpowers",
    description: "Respond to review by verifying each issue, fixing only real defects, and rerunning targeted checks.",
    appliesToD3: true,
    bakedBehavior: ["confirm each finding", "patch narrowly", "report fixed/not-repro evidence"],
  },
  {
    id: "worktree-isolation",
    source: "superpowers",
    description: "Keep high-risk modernization work isolated from unrelated user changes when the project uses git.",
    appliesToD3: false,
    bakedBehavior: ["inspect current worktree", "avoid unrelated reverts", "use isolated branches/worktrees when requested"],
  },
  {
    id: "subagent-driven-development",
    source: "superpowers",
    description: "Delegate bounded tasks to specialized subagents and review their output.",
    appliesToD3: true,
    bakedBehavior: ["spawn audit/migration/lint research tasks", "review for D3 correctness", "merge only verified findings"],
  },
  {
    id: "dispatching-parallel-agents",
    source: "superpowers",
    description: "Split independent D3 audit, migration, QA, and research tasks across isolated subagents.",
    appliesToD3: true,
    bakedBehavior: ["fan out independent inspections", "keep subagent permissions reduced", "reconcile findings centrally"],
  },
  {
    id: "finishing-development-branch",
    source: "superpowers",
    description: "Finish work by verifying tests, summarizing changes, and preserving user control over merge/release actions.",
    appliesToD3: false,
    bakedBehavior: ["verify regression suite", "summarize changed artifacts", "leave merge/release choice explicit"],
  },
  {
    id: "writing-skills",
    source: "superpowers",
    description: "Add or refine D3 Code skills as tested product behavior, not loose prompt text.",
    appliesToD3: true,
    bakedBehavior: ["define trigger and behavior", "add mode/workflow tests", "document command surface"],
  },
  {
    id: "gsd-phases",
    source: "gsd",
    description: "Break work into goals, milestones, phases, execution steps, and verification checkpoints.",
    appliesToD3: true,
    bakedBehavior: ["track active goal", "create migration phases", "mark phase outcomes", "verify before advancing"],
  },
  {
    id: "d3-database-audit",
    source: "d3code",
    description: "Audit D3 accounts, MD, file dictionaries, item samples, indexes, locks, triggers, and compile health.",
    appliesToD3: true,
    bakedBehavior: ["discover file pointers", "validate dictionaries", "sample data shape", "flag lock/trigger risks"],
  },
  {
    id: "d3-migration-map",
    source: "d3code",
    description: "Map a D3 application into web app domains, REST resources, services, jobs, and migration risks.",
    appliesToD3: true,
    bakedBehavior: ["infer bounded contexts", "map files to resources", "map BASIC to services", "plan strangler migration"],
  },
  {
    id: "browser-qa",
    source: "gstack",
    description: "Dogfood generated web flows with screenshots, regression checks, and user-flow evidence.",
    appliesToD3: true,
    bakedBehavior: ["test web migration flows", "capture before/after evidence", "verify responsive/API behavior"],
  },
  {
    id: "web-app-dogfooding",
    source: "gstack",
    description: "Exercise migrated web UI/API flows as a user would, including responsive layout and failure evidence.",
    appliesToD3: true,
    bakedBehavior: ["navigate generated app", "test forms/dialogs/API states", "capture screenshots or output evidence"],
  },
  {
    id: "gstack-spec",
    source: "gstack",
    description: "Turn vague D3 requests into executable specs, tickets, and acceptance criteria.",
    appliesToD3: true,
    bakedBehavior: ["capture user intent", "write D3-specific acceptance criteria", "route into plan or goal workflow"],
  },
  {
    id: "gstack-review",
    source: "gstack",
    description: "Review code, generated API surfaces, and migration diffs before landing changes.",
    appliesToD3: true,
    bakedBehavior: ["inspect diff and generated artifacts", "rank D3 data/API safety findings", "require regression evidence"],
  },
  {
    id: "gstack-ship",
    source: "gstack",
    description: "Prepare verified changes for handoff with test, changelog, and rollout evidence.",
    appliesToD3: true,
    bakedBehavior: ["collect readiness evidence", "summarize rollout risk", "keep merge/deploy user-controlled"],
  },
  {
    id: "gstack-health-guard",
    source: "gstack",
    description: "Run health, guard, and careful-mode checks around risky D3 or generated-web changes.",
    appliesToD3: true,
    bakedBehavior: ["check environment health", "enforce safety gates", "slow down on destructive operations"],
  },
  {
    id: "gstack-investigate",
    source: "gstack",
    description: "Investigate unfamiliar systems by mapping evidence before changing code or data.",
    appliesToD3: true,
    bakedBehavior: ["map D3 files and programs first", "record hypotheses", "separate facts from inferred behavior"],
  },
  {
    id: "gstack-context",
    source: "gstack",
    description: "Save and restore working context across long D3 modernization sessions.",
    appliesToD3: true,
    bakedBehavior: ["persist sessions", "resume selected model/profile/mode", "keep artifacts outside model context"],
  },
  {
    id: "gstack-docs",
    source: "gstack",
    description: "Generate user-facing docs, release notes, and migration summaries from verified artifacts.",
    appliesToD3: true,
    bakedBehavior: ["write modernization briefs", "cite audit/API artifacts", "separate known gaps from completed work"],
  },
  {
    id: "gstack-design-review",
    source: "gstack",
    description: "Review migrated web UI/API design for usability, consistency, and workflow fit.",
    appliesToD3: true,
    bakedBehavior: ["evaluate D3 workflow parity", "flag confusing web states", "tie design concerns to user flows"],
  },
  {
    id: "compact-output",
    source: "rtk",
    description: "Compress noisy command output before it enters model context.",
    appliesToD3: true,
    bakedBehavior: ["summarize TCL output", "group compile failures", "truncate item samples safely"],
  },
  {
    id: "token-efficient-tooling",
    source: "rtk",
    description: "Prefer compact file/search/test output for large D3 accounts and generated web projects.",
    appliesToD3: true,
    bakedBehavior: ["use ripgrep-style search", "group repeated errors", "keep raw artifacts available outside context"],
  },
  {
    id: "rest-api-generation",
    source: "d3code",
    description: "Generate REST API contracts and adapter code from D3 files, dictionaries, and subroutines.",
    appliesToD3: true,
    bakedBehavior: ["emit OpenAPI drafts", "suggest endpoint/resource mapping", "generate service adapter skeletons"],
  },
  {
    id: "d3-release-readiness",
    source: "d3code",
    description: "Audit whether D3 Code itself has enough evidence to claim product readiness.",
    appliesToD3: true,
    bakedBehavior: ["separate static capability from live D3 proof", "require regression evidence", "name missing gates"],
  },
  {
    id: "effect-service-patterns",
    source: "opencode",
    description: "Apply OpenCode's Effect-style service discipline when generated TypeScript grows beyond simple adapters.",
    appliesToD3: true,
    bakedBehavior: ["verify current local library APIs before use", "keep HTTP handlers thin", "put D3 business rules behind typed services and schemas"],
  },
  {
    id: "architecture-deepening",
    source: "opencode",
    description: "Find D3 and generated-web modules that should become deeper, more testable interfaces.",
    appliesToD3: true,
    bakedBehavior: ["inspect domain vocabulary first", "rank shallow modules by D3 migration friction", "propose candidates before refactoring"],
  },
  {
    id: "edge-agent-platform",
    source: "opencode",
    description: "Adapt Cloudflare/Agents SDK deployment ideas for optional D3 web migration targets.",
    appliesToD3: true,
    bakedBehavior: ["treat edge deployment as optional", "verify platform docs before implementation", "map D3 long-running work to durable jobs only when needed"],
  },
  {
    id: "mvbasic-ide-parity",
    source: "rocket-mvbasic",
    description: "Use Rocket MV BASIC extension behavior as an IDE-parity checklist for D3 connections, online editing, locks, compile/catalog, hashed files, diagnostics, and debugger boundaries.",
    appliesToD3: true,
    bakedBehavior: ["treat account folders as connected workspaces", "preserve lock/conflict semantics", "separate language intelligence from live debugger proof"],
  },
]

export const modes: D3CodeMode[] = [
  {
    id: "chat",
    title: "D3 Code",
    description: "General Claude Code-style terminal chat with D3-aware tools.",
    safetyBias: "ask",
    skills: ["using-superpowers", "compact-output", "token-efficient-tooling"],
    system: "You are D3 Code. Help with Rocket D3 Unix 10.3 code, data, and modernization tasks.",
    workflow: ["Answer directly", "Use D3 tools when needed", "Keep mutation safety explicit"],
  },
  {
    id: "plan",
    title: "Plan Mode",
    description: "Spec-first, read-only design and implementation planning mode.",
    safetyBias: "plan",
    skills: ["using-superpowers", "brainstorming", "spec-first", "gstack-spec", "writing-plans", "gsd-phases", "compact-output"],
    system: "Operate read-only. Clarify intent, inspect context, and produce decision-complete plans for D3 work.",
    workflow: ["Ground in D3/project facts", "Ask only material questions", "Draft spec", "Draft implementation and test plan"],
  },
  {
    id: "gsd",
    title: "GSD Mode",
    description: "Goal/milestone/phase execution process adapted for D3 modernization.",
    safetyBias: "ask",
    skills: ["gsd-phases", "executing-plans", "red-green-refactor", "subagent-driven-development", "dispatching-parallel-agents", "gstack-review", "gstack-health-guard", "requesting-code-review", "verification-before-completion", "compact-output"],
    system: "Drive the active goal through phases, tests, implementation, review, and verification.",
    workflow: ["Define goal", "Split into phases", "Run tests first where practical", "Execute phase", "Review", "Mark outcome"],
  },
  {
    id: "migrate",
    title: "Migration Mode",
    description: "Convert a D3 application toward a web application using audit, API, and strangler-migration workflows.",
    safetyBias: "ask",
    skills: ["brainstorming", "gstack-spec", "d3-database-audit", "d3-migration-map", "rest-api-generation", "architecture-deepening", "effect-service-patterns", "edge-agent-platform", "gstack-design-review", "browser-qa", "web-app-dogfooding", "subagent-driven-development", "verification-before-completion"],
    system: "Map D3 accounts/files/programs into a web architecture. Prefer incremental strangler migration with REST APIs and testable adapters.",
    workflow: ["Audit D3 app", "Map files/dicts/programs", "Identify domains/resources", "Generate API contracts", "Plan migration phases", "Validate web flows"],
  },
  {
    id: "audit",
    title: "Audit Mode",
    description: "Audit D3 code, dictionaries, indexes, data shape, locks, triggers, and compile health.",
    safetyBias: "plan",
    skills: ["d3-database-audit", "gstack-investigate", "systematic-debugging", "compact-output", "token-efficient-tooling", "verification-before-completion"],
    system: "Perform read-only D3 audits and produce ranked findings with evidence and remediation steps.",
    workflow: ["Inventory account", "Inspect MD/file dictionaries", "Sample records", "Analyze BASIC", "Report risks"],
  },
  {
    id: "api",
    title: "REST API Mode",
    description: "Design and generate REST API surfaces for D3 files and business subroutines.",
    safetyBias: "ask",
    skills: ["rest-api-generation", "d3-migration-map", "effect-service-patterns", "edge-agent-platform", "writing-plans", "red-green-refactor", "gstack-review", "requesting-code-review"],
    system: "Turn D3 resources into RESTful API contracts, adapter skeletons, and tests.",
    workflow: ["Choose resource", "Inspect dictionary and subroutines", "Draft OpenAPI", "Generate adapter", "Add tests"],
  },
  {
    id: "modernize",
    title: "Modernization Mode",
    description: "Refactor and improve D3 BASIC/FlashBASIC safely.",
    safetyBias: "ask",
    skills: ["spec-first", "systematic-debugging", "red-green-refactor", "d3-database-audit", "architecture-deepening", "gstack-health-guard", "receiving-code-review", "verification-before-completion"],
    system: "Modernize D3 code while preserving behavior and validating compile/runtime effects.",
    workflow: ["Understand behavior", "Add regression fixture", "Refactor minimally", "Compile/catalog", "Summarize risk"],
  },
  {
    id: "qa",
    title: "QA Mode",
    description: "Regression, web-flow, API, and D3 command validation mode.",
    safetyBias: "plan",
    skills: ["browser-qa", "web-app-dogfooding", "gstack-review", "gstack-ship", "d3-release-readiness", "compact-output", "red-green-refactor", "verification-before-completion"],
    system: "Verify behavior with repeatable checks and concise evidence.",
    workflow: ["Define acceptance criteria", "Run focused checks", "Capture evidence", "Report failures first"],
  },
]

export function getMode(id: string): D3CodeMode | undefined {
  return modes.find((mode) => mode.id === id)
}

export function getSkill(id: string): D3CodeSkill | undefined {
  return skills.find((skill) => skill.id === id)
}

export function modeSystemPrompt(modeID: string): string {
  const mode = getMode(modeID) ?? getMode("chat")!
  const skillBrief = mode.skills
    .map((skillID) => getSkill(skillID))
    .filter((skill): skill is D3CodeSkill => Boolean(skill))
    .map((skill) => `- ${skill.id}: ${skill.bakedBehavior.join("; ")}`)
    .join("\n")
  return `${mode.system}\n\nBaked-in skills:\n${skillBrief}\n\nWorkflow:\n${mode.workflow.map((step, index) => `${index + 1}. ${step}`).join("\n")}`
}

export function renderSkill(id: string): string {
  const skill = getSkill(id)
  if (!skill) return `Unknown skill: ${id}. Available: ${skills.map((item) => item.id).join(", ")}`
  return [
    `# ${skill.id}`,
    "",
    `Source: ${skill.source}`,
    `D3-specific: ${skill.appliesToD3 ? "yes" : "adapted where useful"}`,
    "",
    skill.description,
    "",
    "## Baked Behavior",
    ...skill.bakedBehavior.map((behavior) => `- ${behavior}`),
    "",
  ].join("\n")
}

export function renderModeRunbook(modeID: string): string {
  const mode = getMode(modeID)
  if (!mode) return `Unknown mode: ${modeID}. Available: ${modes.map((item) => item.id).join(", ")}`
  const modeSkills = mode.skills.map((skillID) => getSkill(skillID)).filter((skill): skill is D3CodeSkill => Boolean(skill))
  return [
    `# ${mode.title} Runbook`,
    "",
    mode.description,
    "",
    `Safety: ${mode.safetyBias}`,
    "",
    "## Skill Pack",
    ...modeSkills.map((skill) => `- ${skill.id} (${skill.source}): ${skill.bakedBehavior.join("; ")}`),
    "",
    "## Operating Loop",
    ...mode.workflow.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Evidence Gate",
    "- Every audit finding needs a file/item/command reference.",
    "- Every migration artifact needs bundle, audit, OpenAPI, adapter, or QA output evidence.",
    "- Every cockpit terminal claim needs connector-strategy, profile-doctor, terminal-capture, or screen-buffer evidence.",
    "- Every modernization claim needs lint, compile/catalog, fixture, or explicit live-D3 gap evidence.",
    "",
  ].join("\n")
}
