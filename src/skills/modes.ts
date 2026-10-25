export type D3CodeModeID = "chat" | "plan" | "gsd" | "migrate" | "audit" | "api" | "modernize" | "qa"

export interface D3CodeSkill {
  id: string
  source: "d3code" | "superpowers" | "gsd" | "gstack" | "rtk" | "opencode" | "rocket-mvbasic" | "hermes" | "ecc" | "jcode"
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
    id: "d3-practical",
    source: "d3code",
    description:
      "Verified Rocket D3 operator and BASIC rules learned from live D3 10.3.6 work: the ED editor, compile traps, files and indexes, AQL, prompt handling, pseudo-floppy devices, and phantom scheduling. See skills/d3-practical/SKILL.md and docs/d3-errors-and-fixes.md.",
    appliesToD3: true,
    bakedBehavior: [
      "strip ANSI and NUL before matching a D3 prompt, and accept both ':' and '>'",
      "replace existing sandbox records through the native guarded tools after a lossless read; pass the returned baseline, require approval, and never delete first or fall back to ED",
      "never start a main program with PROGRAM; SUBROUTINE must be line 1; RELEASE releases a READU item lock",
      "there is no TCL CALL - catalogue a main program to run logic from the command line",
      "prefer clear-file; after DELETE-FILE rebuild the dictionary and indexes",
      "keep AQL reserved words (TOTAL, DATE, LINES) out of dictionary item names",
      "select tape/pseudo-floppy devices by name with set-device, never set-floppy (it is density, not a device number)",
      "store backgrounds ACTIVATE.DATE as DATE() and ACTIVATE.TIME as seconds since midnight",
      "treat production accounts as read-only and develop in a scratch namespace",
    ],
  },
  {
    id: "harness-doctor",
    source: "jcode",
    description: "Adapt JCode-style doctor diagnostics into D3Code readiness checks across model, profile, RAG, references, skills, and Hermes/ECC state.",
    appliesToD3: true,
    bakedBehavior: ["aggregate readiness gates", "preserve partial evidence", "show safe next actions"],
  },
  {
    id: "event-stream-runs",
    source: "jcode",
    description: "Expose bounded D3 agent tasks as stable machine-readable start, step, result, and error events.",
    appliesToD3: true,
    bakedBehavior: ["emit NDJSON-friendly events", "keep human report as default", "include step evidence without raw secret expansion"],
  },
  {
    id: "scoped-reference-projection",
    source: "jcode",
    description: "Scout external skills and references through a D3 manual/reference scope before adopting or adapting them.",
    appliesToD3: true,
    bakedBehavior: ["classify adopt/adapt/out-of-scope/needs-review", "limit imports to D3-relevant material", "avoid silent skill ingestion"],
  },
  {
    id: "session-recovery",
    source: "jcode",
    description: "Adapt durable session and resume ideas into D3Code session summaries and crash-safe context packs.",
    appliesToD3: true,
    bakedBehavior: ["summarize resumable state", "keep profile/model/safety explicit", "preserve next commands and proof gaps"],
  },
  {
    id: "safety-reporting",
    source: "jcode",
    description: "Adapt JCode-style post-run safety reports into D3Code evidence summaries for reads, mutations, readiness, and follow-up actions.",
    appliesToD3: true,
    bakedBehavior: ["report what ran", "separate ok/action/missing gates", "tie risky actions to confirmation and rollback evidence"],
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
    id: "d3-screen-workflow",
    source: "d3code",
    description: "Audit legacy D3/BASIC, PowerTerm-style, and SB+/System Builder screens into migration-ready UI specs, field maps, actions, and proof gates.",
    appliesToD3: true,
    bakedBehavior: ["classify screen/menu/form/report workflows", "map INPUT prompts to UI fields", "plan SB+ screens without direct definition-record writes", "require terminal/screen-buffer proof before parity claims"],
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
  {
    id: "hermes-operator-memory",
    source: "hermes",
    description: "Use Hermes-style memory to retain verified D3Code lessons, local coding idioms, recurring fixes, and operator workflows without storing secrets or private data.",
    appliesToD3: true,
    bakedBehavior: ["record only verified lessons", "preserve local coding idioms", "reject private paths and secrets", "retrieve memory before repeating D3 fixes"],
  },
  {
    id: "hermes-workflow-imports",
    source: "hermes",
    description: "Convert repeated Hermes operator workflows into sanitized, D3-specific skills and recipes.",
    appliesToD3: true,
    bakedBehavior: ["strip private workspace state", "map local prompts to reusable D3 workflows", "promote repeated lessons into skill catalog entries"],
  },
  {
    id: "ecc-eval-harness",
    source: "ecc",
    description: "Adapt ECC eval-driven development into D3Code capability and regression evals.",
    appliesToD3: true,
    bakedBehavior: ["define D3 capability evals before harness changes", "track regression checks for tools and references", "measure pass/fail evidence before expanding behavior"],
  },
  {
    id: "ecc-agent-harness-construction",
    source: "ecc",
    description: "Apply ECC action-space, observation, recovery, and context-budget guidance to D3Code tools.",
    appliesToD3: true,
    bakedBehavior: ["keep D3 tools schema-first", "return recoverable observations", "make error paths name safe retries", "avoid overlapping tool semantics"],
  },
  {
    id: "ecc-iterative-retrieval",
    source: "ecc",
    description: "Use iterative retrieval across RAG, manuals, System Builder, MV BASIC, operator memory, and live D3 evidence.",
    appliesToD3: true,
    bakedBehavior: ["route to the right reference family first", "iterate when evidence is thin", "separate retrieved facts from inference"],
  },
  {
    id: "ecc-team-agent-orchestration",
    source: "ecc",
    description: "Adapt ECC team orchestration into D3 audit, BASIC review, reference research, migration, and QA subagent roles.",
    appliesToD3: true,
    bakedBehavior: ["split independent D3 tasks by evidence boundary", "summarize subagent findings", "merge only reviewed and verified outputs"],
  },
  {
    id: "ecc-agent-introspection-debugging",
    source: "ecc",
    description: "Inspect tool-routing, prompt, retrieval, and assumption failures when D3Code behaves incorrectly.",
    appliesToD3: true,
    bakedBehavior: ["name the failed layer", "inspect tool input/output", "record corrected lessons in operator memory"],
  },
  {
    id: "ecc-coding-standards",
    source: "ecc",
    description: "Adapt ECC coding standards into D3Code's local-style rule for PICK BASIC, System Builder code, and generated TypeScript.",
    appliesToD3: true,
    bakedBehavior: ["follow existing local style", "avoid unnecessary abstractions", "prefer minimal legacy edits", "verify language syntax against references"],
  },
  {
    id: "ecc-terminal-ops",
    source: "ecc",
    description: "Apply terminal operations discipline to D3 TCL, shell-backed D3 profiles, and Unix commands invoked from PICK BASIC.",
    appliesToD3: true,
    bakedBehavior: ["make command boundaries explicit", "capture stderr/stdout evidence", "avoid assuming D3 items are Unix files"],
  },
  {
    id: "ecc-token-budget-advisor",
    source: "ecc",
    description: "Use ECC token-budget discipline to keep D3 manuals, account captures, and generated artifacts outside prompt context until retrieved.",
    appliesToD3: true,
    bakedBehavior: ["use RAG before dumping manuals", "compact large TCL output", "keep raw evidence in files and cite paths"],
  },
  {
    id: "ecc-plan-orchestrate",
    source: "ecc",
    description: "Coordinate multi-phase D3Code work across audit, modernization, migration, QA, and handoff.",
    appliesToD3: true,
    bakedBehavior: ["select the next D3 phase from evidence", "keep phase boundaries explicit", "handoff with proof and remaining risk"],
  },
  {
    id: "ecc-dynamic-workflow-mode",
    source: "ecc",
    description: "Switch D3Code workflows dynamically based on risk, evidence, and user intent.",
    appliesToD3: true,
    bakedBehavior: ["route between audit, plan, modernize, migrate, api, and qa", "escalate safety when mutation risk appears", "explain workflow changes"],
  },
  {
    id: "ecc-agent-eval",
    source: "ecc",
    description: "Evaluate D3Code agent behavior, tool selection, retrieval quality, and completion claims.",
    appliesToD3: true,
    bakedBehavior: ["grade tool choice", "grade evidence grounding", "turn repeated failures into eval cases"],
  },
  {
    id: "ecc-production-audit",
    source: "ecc",
    description: "Adapt production audit to D3 live-proof, generated app readiness, rollback, and operator handoff.",
    appliesToD3: true,
    bakedBehavior: ["check live-D3 proof gates", "check generated app proof", "name rollback and canary gaps"],
  },
  {
    id: "ecc-canary-watch",
    source: "ecc",
    description: "Watch D3 and migrated app changes after rollout with explicit canary signals.",
    appliesToD3: true,
    bakedBehavior: ["define canary checks", "monitor D3/API symptoms", "trigger rollback notes on failures"],
  },
  {
    id: "ecc-gateguard",
    source: "ecc",
    description: "Gate risky D3Code actions behind proof, safety, and user-visible readiness checks.",
    appliesToD3: true,
    bakedBehavior: ["block unsupported claims", "require confirmation for mutation", "surface missing evidence before release"],
  },
  {
    id: "ecc-architecture-decision-records",
    source: "ecc",
    description: "Record D3 modernization, adapter, System Builder, and migration decisions as durable ADRs.",
    appliesToD3: true,
    bakedBehavior: ["capture context and decision", "link D3/manual evidence", "record consequences and rollback"],
  },
  {
    id: "ecc-error-handling",
    source: "ecc",
    description: "Standardize D3, TCL, curl, compile, catalog, API, and RAG failure diagnostics.",
    appliesToD3: true,
    bakedBehavior: ["preserve raw error text", "map code to likely layer", "suggest one safe next diagnostic"],
  },
  {
    id: "ecc-research-ops",
    source: "ecc",
    description: "Run structured D3 research across manuals, System Builder, MV BASIC, code, and live evidence.",
    appliesToD3: true,
    bakedBehavior: ["plan research questions", "retrieve before editing", "summarize facts versus inference"],
  },
  {
    id: "ecc-deep-research",
    source: "ecc",
    description: "Perform deeper multi-source investigations for ambiguous D3/System Builder behavior.",
    appliesToD3: true,
    bakedBehavior: ["cross-check manuals and code", "collect contradictory evidence", "produce a decision-ready brief"],
  },
  {
    id: "ecc-rules-distill",
    source: "ecc",
    description: "Distill repeated D3Code corrections into durable rules, skills, and Hermes memory.",
    appliesToD3: true,
    bakedBehavior: ["extract repeated pattern", "sanitize private details", "promote to memory or skill only after verification"],
  },
  {
    id: "ecc-prompt-optimizer",
    source: "ecc",
    description: "Improve D3Code prompts, mode prompts, and tool instructions through eval-backed changes.",
    appliesToD3: true,
    bakedBehavior: ["change prompts only with evidence", "keep D3-only boundaries", "verify with agent/eval tests"],
  },
  {
    id: "ecc-autonomous-agent-harness",
    source: "ecc",
    description: "Run bounded autonomous D3Code loops with explicit stop conditions and proof gates.",
    appliesToD3: true,
    bakedBehavior: ["bound loop scope", "stop on missing evidence or safety risk", "write handoff summaries"],
  },
  {
    id: "ecc-autonomous-loops",
    source: "ecc",
    description: "Use repeatable D3 audit, QA, and learning loops without allowing unbounded mutation.",
    appliesToD3: true,
    bakedBehavior: ["iterate read-only by default", "record each loop outcome", "escalate before mutation"],
  },
  {
    id: "ecc-cost-aware-llm-pipeline",
    source: "ecc",
    description: "Control model and context cost during large D3 modernization sessions.",
    appliesToD3: true,
    bakedBehavior: ["prefer cached RAG/indexes", "route cheap checks to tools", "reserve large models for hard synthesis"],
  },
  {
    id: "ecc-cost-tracking",
    source: "ecc",
    description: "Track model/tool usage and cost-relevant evidence in long D3Code sessions.",
    appliesToD3: true,
    bakedBehavior: ["preserve usage stats", "summarize expensive loops", "suggest cheaper retrieval/tool paths"],
  },
  {
    id: "ecc-benchmark",
    source: "ecc",
    description: "Benchmark D3Code retrieval, parsing, generated app checks, and agent loops.",
    appliesToD3: true,
    bakedBehavior: ["define benchmark fixtures", "compare before/after", "report regressions with commands"],
  },
  {
    id: "ecc-benchmark-optimization-loop",
    source: "ecc",
    description: "Optimize D3Code only against measured retrieval/tool/eval benchmarks.",
    appliesToD3: true,
    bakedBehavior: ["baseline first", "change one variable", "rerun benchmark and report delta"],
  },
  {
    id: "ecc-recursive-decision-ledger",
    source: "ecc",
    description: "Keep a traceable decision ledger for nested D3 modernization and migration choices.",
    appliesToD3: true,
    bakedBehavior: ["log decisions with evidence", "avoid re-litigating settled choices", "mark superseded decisions"],
  },
  {
    id: "ecc-workspace-surface-audit",
    source: "ecc",
    description: "Audit D3Code's tools, docs, references, skills, generated outputs, and operator surfaces.",
    appliesToD3: true,
    bakedBehavior: ["inventory surfaces", "find missing docs/tests", "rank operator friction"],
  },
  {
    id: "ecc-mcp-server-patterns",
    source: "ecc",
    description: "Use MCP-style boundaries for future D3Code tool servers and connector surfaces.",
    appliesToD3: true,
    bakedBehavior: ["keep tools schema-first", "separate resources from actions", "document safety metadata"],
  },
  {
    id: "ecc-api-connector-builder",
    source: "ecc",
    description: "Build external API connectors around D3 workflows without leaking D3 internals.",
    appliesToD3: true,
    bakedBehavior: ["wrap external APIs behind adapters", "test request/response contracts", "keep D3 identifiers mapped explicitly"],
  },
  {
    id: "ecc-hexagonal-architecture",
    source: "ecc",
    description: "Use ports/adapters around D3 so generated applications remain testable.",
    appliesToD3: true,
    bakedBehavior: ["put D3 behind ports", "keep domain logic away from transport", "mock adapters only at boundaries"],
  },
  {
    id: "ecc-backend-patterns",
    source: "ecc",
    description: "Apply backend patterns to generated D3-backed APIs and services.",
    appliesToD3: true,
    bakedBehavior: ["keep handlers thin", "validate data contracts", "isolate D3 session concerns"],
  },
  {
    id: "ecc-postgres-patterns",
    source: "ecc",
    description: "Guide D3-to-Postgres migrations while preserving multivalue semantics.",
    appliesToD3: true,
    bakedBehavior: ["map attributes/values explicitly", "avoid flattening without evidence", "test relational projections"],
  },
  {
    id: "ecc-react-patterns",
    source: "ecc",
    description: "Guide generated React UI for D3-backed operational workflows.",
    appliesToD3: true,
    bakedBehavior: ["derive UI from D3 workflow evidence", "keep data states explicit", "avoid decorative UI over workflow density"],
  },
  {
    id: "ecc-react-performance",
    source: "ecc",
    description: "Optimize generated D3-backed React applications when real workflow performance requires it.",
    appliesToD3: true,
    bakedBehavior: ["measure before optimizing", "avoid unnecessary client state", "test large operational lists"],
  },
  {
    id: "ecc-frontend-a11y",
    source: "ecc",
    description: "Apply accessibility checks to D3 web migrations and the D3Code workbench.",
    appliesToD3: true,
    bakedBehavior: ["keep forms keyboard usable", "label controls", "verify status/error announcement"],
  },
  {
    id: "ecc-dashboard-builder",
    source: "ecc",
    description: "Build D3Code and migrated operational dashboards from evidence-first workflows.",
    appliesToD3: true,
    bakedBehavior: ["prioritize scan density", "show operational states", "wire drilldowns to D3/API evidence"],
  },
  {
    id: "ecc-git-workflow",
    source: "ecc",
    description: "Use disciplined git workflow around D3Code harness, skills, and generated artifacts.",
    appliesToD3: true,
    bakedBehavior: ["avoid unrelated changes", "stage intentional files", "keep proof with commits"],
  },
]

export const modes: D3CodeMode[] = [
  {
    id: "chat",
    title: "D3 Code",
    description: "General Claude Code-style terminal chat with D3-aware tools.",
    safetyBias: "ask",
    skills: ["using-superpowers", "session-recovery", "hermes-operator-memory", "ecc-iterative-retrieval", "compact-output", "token-efficient-tooling"],
    system: "You are D3 Code. Help with Rocket D3 Unix 10.3 code, data, and modernization tasks.",
    workflow: ["Answer directly", "Use D3 tools when needed", "Keep mutation safety explicit"],
  },
  {
    id: "plan",
    title: "Plan Mode",
    description: "Spec-first, read-only design and implementation planning mode.",
    safetyBias: "plan",
    skills: ["using-superpowers", "brainstorming", "spec-first", "gstack-spec", "writing-plans", "gsd-phases", "harness-doctor", "scoped-reference-projection", "hermes-workflow-imports", "ecc-agent-harness-construction", "ecc-token-budget-advisor", "compact-output"],
    system: "Operate read-only. Clarify intent, inspect context, and produce decision-complete plans for D3 work.",
    workflow: ["Ground in D3/project facts", "Ask only material questions", "Draft spec", "Draft implementation and test plan"],
  },
  {
    id: "gsd",
    title: "GSD Mode",
    description: "Goal/milestone/phase execution process adapted for D3 modernization.",
    safetyBias: "ask",
    skills: ["gsd-phases", "executing-plans", "red-green-refactor", "event-stream-runs", "session-recovery", "subagent-driven-development", "dispatching-parallel-agents", "ecc-team-agent-orchestration", "ecc-eval-harness", "gstack-review", "gstack-health-guard", "requesting-code-review", "verification-before-completion", "compact-output"],
    system: "Drive the active goal through phases, tests, implementation, review, and verification.",
    workflow: ["Define goal", "Split into phases", "Run tests first where practical", "Execute phase", "Review", "Mark outcome"],
  },
  {
    id: "migrate",
    title: "Migration Mode",
    description: "Convert a D3 application toward a web application using audit, API, and strangler-migration workflows.",
    safetyBias: "ask",
    skills: ["brainstorming", "gstack-spec", "d3-database-audit", "d3-migration-map", "d3-screen-workflow", "rest-api-generation", "architecture-deepening", "effect-service-patterns", "edge-agent-platform", "ecc-iterative-retrieval", "ecc-eval-harness", "gstack-design-review", "browser-qa", "web-app-dogfooding", "subagent-driven-development", "verification-before-completion"],
    system: "Map D3 accounts/files/programs into a web architecture. Prefer incremental strangler migration with REST APIs and testable adapters.",
    workflow: ["Audit D3 app", "Map files/dicts/programs", "Identify domains/resources", "Generate API contracts", "Plan migration phases", "Validate web flows"],
  },
  {
    id: "audit",
    title: "Audit Mode",
    description: "Audit D3 code, dictionaries, indexes, data shape, locks, triggers, and compile health.",
    safetyBias: "plan",
    skills: ["d3-database-audit", "d3-screen-workflow", "gstack-investigate", "ecc-iterative-retrieval", "ecc-agent-introspection-debugging", "systematic-debugging", "compact-output", "token-efficient-tooling", "verification-before-completion"],
    system: "Perform read-only D3 audits and produce ranked findings with evidence and remediation steps.",
    workflow: ["Inventory account", "Inspect MD/file dictionaries", "Sample records", "Analyze BASIC", "Report risks"],
  },
  {
    id: "api",
    title: "REST API Mode",
    description: "Design and generate REST API surfaces for D3 files and business subroutines.",
    safetyBias: "ask",
    skills: ["rest-api-generation", "d3-migration-map", "effect-service-patterns", "edge-agent-platform", "ecc-agent-harness-construction", "ecc-eval-harness", "writing-plans", "red-green-refactor", "gstack-review", "requesting-code-review"],
    system: "Turn D3 resources into RESTful API contracts, adapter skeletons, and tests.",
    workflow: ["Choose resource", "Inspect dictionary and subroutines", "Draft OpenAPI", "Generate adapter", "Add tests"],
  },
  {
    id: "modernize",
    title: "Modernization Mode",
    description: "Refactor and improve D3 BASIC/FlashBASIC safely.",
    safetyBias: "ask",
    skills: ["spec-first", "systematic-debugging", "red-green-refactor", "d3-database-audit", "d3-screen-workflow", "architecture-deepening", "ecc-coding-standards", "ecc-terminal-ops", "hermes-operator-memory", "gstack-health-guard", "receiving-code-review", "verification-before-completion"],
    system: "Modernize D3 code while preserving behavior and validating compile/runtime effects.",
    workflow: ["Understand behavior", "Add regression fixture", "Refactor minimally", "Compile/catalog", "Summarize risk"],
  },
  {
    id: "qa",
    title: "QA Mode",
    description: "Regression, web-flow, API, and D3 command validation mode.",
    safetyBias: "plan",
    skills: ["browser-qa", "web-app-dogfooding", "gstack-review", "gstack-ship", "d3-release-readiness", "safety-reporting", "event-stream-runs", "ecc-eval-harness", "ecc-agent-introspection-debugging", "compact-output", "red-green-refactor", "verification-before-completion"],
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
    "- Every IDE terminal claim needs connector-strategy, profile-doctor, terminal-capture, or screen-buffer evidence.",
    "- Every modernization claim needs lint, compile/catalog, fixture, or explicit live-D3 gap evidence.",
    "",
  ].join("\n")
}
