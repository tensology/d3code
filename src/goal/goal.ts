export interface GoalPhase {
  id: string
  title: string
  status: "pending" | "active" | "done" | "blocked"
  checklist?: string[]
  deliverables?: string[]
  commands?: string[]
  verification: string[]
  evidence?: string[]
  notes?: string[]
}

export interface D3Goal {
  id: string
  title: string
  mode: string
  outcome: string
  createdAt: string
  updatedAt: string
  phases: GoalPhase[]
}

export interface GoalPhaseVerification {
  phase: string
  status: GoalPhase["status"]
  ready: boolean
  evidenceCount: number
  missingEvidence: string[]
  notes: string[]
}

export interface GoalVerificationReport {
  goal: string
  ready: boolean
  summary: string
  phases: GoalPhaseVerification[]
}

function phasesForMode(mode: string): GoalPhase[] {
  if (mode === "migrate") {
    return [
      {
        id: "capture",
        title: "Capture D3 application bundle",
        status: "active",
        checklist: ["select profile/account", "capture dictionaries and representative records", "capture BASIC program files"],
        deliverables: ["d3-app-bundle.json"],
        commands: ["d3code bundle-capture --profile <profile> --account <account> --files <files> --program-files BP --sample-limit 5 > d3-app-bundle.json"],
        verification: ["bundle parses successfully", "captured files/programs match intended scope"],
      },
      {
        id: "audit",
        title: "Audit D3 database and code",
        status: "pending",
        checklist: ["validate dictionaries", "sample data shapes", "extract BASIC symbols/call graph", "rank lock/write/EXECUTE risks"],
        deliverables: ["audit.json", "index.json", "index-validation-plan.json", "data-validation-plan.json", "code-modernization-plan.json"],
        commands: ["d3code agent-run file-audit <file> --profile <profile> --sample-limit 5", "d3code agent-run basic-check BP <program> --profile <profile> --compile --confirm", "d3code bundle-audit d3-app-bundle.json", "d3code bundle-index d3-app-bundle.json", "d3code bundle-index-plan d3-app-bundle.json", "d3code bundle-data-plan d3-app-bundle.json", "d3code bundle-code-plan d3-app-bundle.json", "d3code bundle-backlog d3-app-bundle.json"],
        verification: ["audit findings are evidence-linked", "high-risk findings have remediation notes"],
      },
      {
        id: "map",
        title: "Map D3 domains to web resources",
        status: "pending",
        checklist: ["map files to REST resources", "map subroutines to services", "identify jobs/phantoms/triggers", "choose strangler boundaries"],
        deliverables: ["migration-plan.json"],
        commands: ["d3code bundle-migration d3-app-bundle.json > migration-plan.json"],
        verification: ["resource map covers target files", "service map names D3 side effects"],
      },
      {
        id: "api",
        title: "Generate API contract and adapter slice",
        status: "pending",
        checklist: ["generate OpenAPI", "generate adapter skeleton", "review D3 command isolation", "add contract fixtures"],
        deliverables: ["openapi.json", "generated adapter files"],
        commands: ["d3code agent-run migration-slice d3-app-bundle.json --out ./migration-output", "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record"],
        verification: ["OpenAPI validates structurally", "adapter files are generated for mapped resources", "generated API smoke tests pass in mock mode"],
      },
      {
        id: "verify",
        title: "Verify migrated slice",
        status: "pending",
        checklist: ["run regression suite", "exercise API/web flow", "record live-D3 gaps or compile evidence"],
        deliverables: ["test output", "QA evidence", "modernization backlog review", "BASIC modernization proof plan", "migration QA plan", "cutover reconciliation plan", "migration readiness report", "completion audit"],
        commands: ["d3code agent-run migration-slice d3-app-bundle.json --out ./migration-output", "d3code bundle-backlog d3-app-bundle.json", "d3code bundle-code-plan d3-app-bundle.json", "d3code bundle-qa-plan d3-app-bundle.json", "d3code bundle-reconciliation-plan d3-app-bundle.json", "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output", "d3code bundle-delegate d3-app-bundle.json", "d3code bundle-completion-audit d3-app-bundle.json --artifacts-dir ./migration-output", "d3code bundle-evidence d3-app-bundle.json", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record", "npm run regression"],
        verification: ["tests pass", "generated API smoke tests pass", "reconciliation checks name count/sample/multivalue/canary/rollback proof", "completion audit proves every requirement or names carried gaps", "readiness blockers are resolved or explicitly carried", "unverified live-D3 assumptions are explicit"],
      },
    ]
  }

  if (mode === "audit") {
    return [
      {
        id: "inventory",
        title: "Inventory D3 account",
        status: "active",
        checklist: ["confirm profile/account", "list MD/file pointers", "capture dictionary names"],
        deliverables: ["account index"],
        commands: ["d3code index-account --profile <profile>", "d3code agent-run file-audit <file> --profile <profile> --sample-limit 5", "d3code bundle-capture --profile <profile> --account <account> --files <files> --program-files BP > d3-app-bundle.json"],
        verification: ["inventory covers requested scope", "no mutation tools were required"],
      },
      {
        id: "database",
        title: "Validate database files",
        status: "pending",
        checklist: ["inspect dictionaries", "sample records", "validate multivalue/subvalue shape", "compare expected indexes"],
        deliverables: ["database audit findings"],
        commands: ["d3code agent-run file-audit <file> --profile <profile> --sample-limit 5", "d3code audit-db database-samples.json", "d3code shape record-samples.json"],
        verification: ["shape/index findings are tied to file and item samples"],
      },
      {
        id: "code",
        title: "Audit D3 BASIC code",
        status: "pending",
        checklist: ["extract symbols", "lint for writes/locks/EXECUTE", "parse compile output"],
        deliverables: ["code audit findings"],
        commands: ["d3code agent-run basic-check BP <program> --profile <profile> --compile --confirm", "d3code audit-json code-samples.json", "d3code basic-lint BP_ITEM.txt", "d3code compile-errors compile-output.txt"],
        verification: ["code findings name program/file/item evidence"],
      },
      {
        id: "report",
        title: "Rank findings and remediation",
        status: "pending",
        checklist: ["rank severity", "separate confirmed from suspected", "name next commands"],
        deliverables: ["audit report"],
        verification: ["every high severity item has evidence and next step"],
      },
    ]
  }

  if (mode === "api") {
    return [
      {
        id: "resource",
        title: "Define D3 resource boundary",
        status: "active",
        checklist: ["choose file/resource", "inspect dictionary", "identify ID semantics and shape"],
        deliverables: ["resource map"],
        commands: ["d3code bundle-capture --profile <profile> --files <file> --program-files BP > d3-app-bundle.json"],
        verification: ["resource has dictionary/sample evidence"],
      },
      {
        id: "contract",
        title: "Generate REST contract",
        status: "pending",
        checklist: ["generate migration plan", "generate OpenAPI", "review paths and schemas"],
        deliverables: ["openapi.json"],
        commands: ["d3code bundle-migration d3-app-bundle.json > migration-plan.json", "d3code openapi migration-plan.json > openapi.json"],
        verification: ["OpenAPI includes target resource paths"],
      },
      {
        id: "adapter",
        title: "Generate and verify adapter code",
        status: "pending",
        checklist: ["write adapter skeleton", "isolate D3 commands", "add tests/fixtures"],
        deliverables: ["adapter files", "test output"],
        commands: ["d3code agent-run migration-slice d3-app-bundle.json --out ./generated", "d3code adapter-write migration-plan.json --out ./generated", "d3code webapp-check ./generated", "d3code webapp-smoke ./generated --record", "d3code bundle-refresh-evidence d3-app-bundle.json --artifacts-dir ./generated", "npm test"],
        verification: ["generated files exist", "generated API smoke tests pass or failures are documented", "tests pass or failures are documented"],
      },
    ]
  }

  if (mode === "modernize") {
    return [
      {
        id: "understand",
        title: "Understand current D3 BASIC behavior",
        status: "active",
        checklist: ["extract symbols", "identify OPEN/READ/WRITE/EXECUTE/CALL usage", "capture representative inputs"],
        deliverables: ["behavior notes"],
        commands: ["d3code agent-run basic-check BP <program> --profile <profile>", "d3code basic-symbols BP_ITEM.txt", "d3code basic-lint BP_ITEM.txt"],
        verification: ["behavior-impacting files/subroutines are identified"],
      },
      {
        id: "fixture",
        title: "Create regression fixture",
        status: "pending",
        checklist: ["write local parser/test fixture", "capture compile output or expected data behavior"],
        deliverables: ["fixture/test file"],
        commands: ["npm test"],
        verification: ["fixture fails before behavior fix when possible"],
      },
      {
        id: "change",
        title: "Modernize safely",
        status: "pending",
        checklist: ["make narrow refactor", "preserve D3 semantics", "record rollback instructions"],
        deliverables: ["changed BASIC item or adapter change"],
        verification: ["lint output reviewed", "compile/catalog evidence recorded or live-D3 gap stated"],
      },
      {
        id: "verify",
        title: "Verify modernization",
        status: "pending",
        checklist: ["run regression tests", "parse compile errors", "catalog if applicable"],
        deliverables: ["verification evidence"],
        commands: ["d3code agent-run basic-check BP <program> --profile <profile> --compile --catalog --confirm", "d3code compile-errors compile-output.txt", "npm run regression"],
        verification: ["tests pass", "compile/catalog output has no unaddressed errors"],
      },
    ]
  }

  return [
    { id: "audit", title: "Audit current D3 account/application", status: "active", checklist: ["capture current state", "identify risks"], deliverables: ["risk report"], verification: ["account inventory captured", "risk report produced"] },
    { id: "map", title: "Map data/code architecture", status: "pending", checklist: ["map files/dictionaries", "map programs/calls"], deliverables: ["architecture map"], verification: ["file/dictionary map exists", "program call graph exists"] },
    { id: "plan", title: "Plan implementation or migration phases", status: "pending", checklist: ["split phases", "define tests"], deliverables: ["phase plan"], verification: ["phase plan accepted", "tests identified"] },
    { id: "execute", title: "Execute with regression checks", status: "pending", checklist: ["run tests", "apply changes", "review outputs"], deliverables: ["changed artifacts"], verification: ["tests pass", "compile/catalog output reviewed"] },
    { id: "review", title: "Review and document outcome", status: "pending", checklist: ["review findings", "document next risks"], deliverables: ["outcome summary"], verification: ["findings resolved", "next risks documented"] },
  ]
}

export function createModernizationGoal(title: string, outcome: string, mode = "gsd"): D3Goal {
  const now = new Date().toISOString()
  return {
    id: `goal_${Date.now().toString(36)}`,
    title,
    mode,
    outcome,
    createdAt: now,
    updatedAt: now,
    phases: phasesForMode(mode),
  }
}

export function activePhase(goal: D3Goal): GoalPhase | undefined {
  return goal.phases.find((phase) => phase.status === "active") ?? goal.phases.find((phase) => phase.status === "pending")
}

export function advanceGoal(goal: D3Goal, note?: string): D3Goal {
  const next: D3Goal = structuredClone(goal)
  const index = next.phases.findIndex((phase) => phase.status === "active")
  if (index === -1) {
    const pending = next.phases.findIndex((phase) => phase.status === "pending")
    if (pending !== -1) next.phases[pending]!.status = "active"
    next.updatedAt = new Date().toISOString()
    return next
  }
  const current = next.phases[index]!
  current.status = "done"
  if (note) current.notes = [...(current.notes ?? []), note]
  const following = next.phases.slice(index + 1).find((phase) => phase.status === "pending")
  if (following) following.status = "active"
  next.updatedAt = new Date().toISOString()
  return next
}

export function blockGoal(goal: D3Goal, reason: string): D3Goal {
  const next: D3Goal = structuredClone(goal)
  const phase = activePhase(next)
  if (!phase) throw new Error("No active or pending phase to block")
  phase.status = "blocked"
  phase.notes = [...(phase.notes ?? []), reason]
  next.updatedAt = new Date().toISOString()
  return next
}

export function recordGoalEvidence(goal: D3Goal, evidence: string, phaseID?: string): D3Goal {
  const next: D3Goal = structuredClone(goal)
  const phase = phaseID ? next.phases.find((item) => item.id === phaseID) : activePhase(next)
  if (!phase) throw new Error(`No phase found${phaseID ? `: ${phaseID}` : ""}`)
  phase.evidence = [...(phase.evidence ?? []), evidence]
  next.updatedAt = new Date().toISOString()
  return next
}

export function goalSummary(goal: D3Goal): string {
  const phase = activePhase(goal)
  return [
    `${goal.id}\t${goal.mode}\t${goal.title}`,
    `Outcome: ${goal.outcome}`,
    `Active: ${phase ? `${phase.id} - ${phase.title} (${phase.status})` : "none"}`,
    ...goal.phases.map((item) => `- [${item.status}] ${item.id}: ${item.title}`),
  ].join("\n")
}

export function goalPlan(goal: D3Goal): string {
  return [
    `# ${goal.title}`,
    "",
    `Goal: ${goal.id}`,
    `Mode: ${goal.mode}`,
    `Outcome: ${goal.outcome}`,
    "",
    "## Phases",
    ...goal.phases.flatMap((phase, index) => [
      "",
      `${index + 1}. [${phase.status}] ${phase.id}: ${phase.title}`,
      ...(phase.checklist?.length ? ["   Checklist:", ...phase.checklist.map((item) => `   - ${item}`)] : []),
      ...(phase.deliverables?.length ? ["   Deliverables:", ...phase.deliverables.map((item) => `   - ${item}`)] : []),
      ...(phase.commands?.length ? ["   Commands:", ...phase.commands.map((item) => `   - \`${item}\``)] : []),
      "   Evidence gate:",
      ...phase.verification.map((item) => `   - ${item}`),
      ...(phase.evidence?.length ? ["   Recorded evidence:", ...phase.evidence.map((item) => `   - ${item}`)] : []),
      ...(phase.notes?.length ? ["   Notes:", ...phase.notes.map((item) => `   - ${item}`)] : []),
    ]),
    "",
  ].join("\n")
}

export function verifyGoal(goal: D3Goal): GoalVerificationReport {
  const phases = goal.phases.map((phase) => {
    const evidenceCount = phase.evidence?.length ?? 0
    const missingEvidence = evidenceCount === 0 && phase.status !== "pending" ? phase.verification : []
    const ready = phase.status === "done" && evidenceCount > 0
    return {
      phase: phase.id,
      status: phase.status,
      ready,
      evidenceCount,
      missingEvidence,
      notes: phase.notes ?? [],
    }
  })
  const blocked = phases.filter((phase) => phase.status === "blocked")
  const activeMissing = phases.filter((phase) => phase.status === "active" && phase.evidenceCount === 0)
  const doneMissing = phases.filter((phase) => phase.status === "done" && phase.evidenceCount === 0)
  const ready = phases.every((phase) => phase.status === "done" && phase.evidenceCount > 0)
  const summary = ready
    ? "All phases are done and have recorded evidence."
    : [
      blocked.length ? `${blocked.length} phase(s) blocked` : "",
      activeMissing.length ? `${activeMissing.length} active phase(s) missing evidence` : "",
      doneMissing.length ? `${doneMissing.length} done phase(s) missing evidence` : "",
      phases.some((phase) => phase.status === "pending") ? "pending phases remain" : "",
    ].filter(Boolean).join("; ") || "Goal is not ready."
  return { goal: goal.id, ready, summary, phases }
}

export function renderGoalVerification(goal: D3Goal): string {
  const report = verifyGoal(goal)
  return [
    `# Verification: ${goal.title}`,
    "",
    `Goal: ${goal.id}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Summary: ${report.summary}`,
    "",
    "## Phase Evidence",
    ...report.phases.flatMap((phase) => [
      `- [${phase.ready ? "ready" : "not ready"}] ${phase.phase} (${phase.status}) evidence=${phase.evidenceCount}`,
      ...(phase.missingEvidence.length ? phase.missingEvidence.map((item) => `  missing: ${item}`) : []),
      ...(phase.notes.length ? phase.notes.map((item) => `  note: ${item}`) : []),
    ]),
    "",
  ].join("\n")
}
