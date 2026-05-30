import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

export type BacklogPriority = "P0" | "P1" | "P2" | "P3"
export type BacklogCategory = "audit" | "data" | "code" | "api" | "qa" | "migration"

export interface ModernizationBacklogItem {
  id: string
  priority: BacklogPriority
  category: BacklogCategory
  title: string
  rationale: string
  evidence: string[]
  commands: string[]
  doneWhen: string[]
}

export interface ModernizationBacklog {
  account: string
  profile: string
  items: ModernizationBacklogItem[]
}

const priorityRank: Record<BacklogPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item"
}

function findingPriority(severity: string): BacklogPriority {
  if (severity === "error") return "P0"
  if (severity === "warning") return "P1"
  return "P3"
}

function item(id: string, values: Omit<ModernizationBacklogItem, "id">): ModernizationBacklogItem {
  return { id, ...values }
}

export function createModernizationBacklog(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): ModernizationBacklog {
  const items: ModernizationBacklogItem[] = []

  for (const file of artifacts.audit.database?.files ?? []) {
    for (const finding of file.dictionaryFindings) {
      items.push(item(`data-${slug(file.file)}-${slug(finding.message)}`, {
        priority: findingPriority(finding.severity),
        category: "data",
        title: `Fix dictionary issue in ${file.file}`,
        rationale: finding.message,
        evidence: [`file:${file.file}`, `severity:${finding.severity}`],
        commands: ["d3code audit-db database-samples.json"],
        doneWhen: ["Dictionary metadata is corrected or documented as an intentional D3 convention."],
      }))
    }
    for (const finding of file.shapeFindings) {
      items.push(item(`shape-${slug(file.file)}-${slug(finding.message)}`, {
        priority: findingPriority(finding.severity),
        category: "data",
        title: `Resolve sampled record shape drift in ${file.file}`,
        rationale: finding.message,
        evidence: [`file:${file.file}`, `severity:${finding.severity}`],
        commands: ["d3code shape record-samples.json", "d3code audit-db database-samples.json"],
        doneWhen: ["Representative samples have stable attribute, multivalue, and subvalue expectations."],
      }))
    }
    for (const finding of file.indexFindings) {
      items.push(item(`index-${slug(file.file)}-${slug(finding.message)}`, {
        priority: findingPriority(finding.severity),
        category: "data",
        title: `Validate D3 indexes for ${file.file}`,
        rationale: finding.message,
        evidence: [`file:${file.file}`, `severity:${finding.severity}`],
        commands: ["d3code bundle-capture --profile <profile> --account <account> --files <file> --sample-limit 5", "d3code audit-db database-samples.json"],
        doneWhen: ["Expected and observed indexes are reconciled with dictionary items and AQL access paths."],
      }))
    }
  }

  for (const finding of artifacts.audit.dictionaryFindings) {
    items.push(item(`dict-${slug(finding.file)}-${slug(finding.message)}`, {
      priority: findingPriority(finding.severity),
      category: "audit",
      title: `Review dictionary sample for ${finding.file}`,
      rationale: finding.message,
      evidence: [`file:${finding.file}`, `severity:${finding.severity}`],
      commands: ["d3code bundle-audit d3-app-bundle.json"],
      doneWhen: ["Dictionary sample is complete enough to support API schema and data-shape decisions."],
    }))
  }

  for (const program of artifacts.codeMap.programs) {
    if (program.risk === "high" || program.risk === "medium") {
      items.push(item(`code-${slug(program.program)}-${program.risk}`, {
        priority: program.risk === "high" ? "P1" : "P2",
        category: "code",
        title: `Modernize risky BASIC program ${program.program}`,
        rationale: program.recommendations.join(" "),
        evidence: [`program:${program.program}`, `risk:${program.risk}`, `findings:${program.findings.length}`],
        commands: ["d3code bundle-code-map d3-app-bundle.json", "d3code basic-lint BP_ITEM.txt", "d3code compile-errors compile-output.txt"],
        doneWhen: ["Lock/write/EXECUTE risks are resolved or explicitly wrapped behind a tested adapter boundary."],
      }))
    }
  }

  for (const unresolved of artifacts.codeMap.unresolvedCalls) {
    items.push(item(`call-${slug(unresolved.from)}-${slug(unresolved.call)}`, {
      priority: "P1",
      category: "code",
      title: `Resolve external CALL target ${unresolved.call}`,
      rationale: "Hidden subroutine dependencies can break migration slices and service extraction.",
      evidence: [`from:${unresolved.from}`, `call:${unresolved.call}`],
      commands: ["d3code bundle-code-map d3-app-bundle.json"],
      doneWhen: ["CALL target is captured, mapped to a service dependency, or documented as external runtime behavior."],
    }))
  }

  for (const execute of artifacts.codeMap.executes) {
    items.push(item(`execute-${slug(execute.program)}-${slug(execute.command)}`, {
      priority: "P1",
      category: "code",
      title: `Isolate TCL EXECUTE behavior in ${execute.program}`,
      rationale: "EXECUTE commands may hide account-level, reporting, delete, or shell-like side effects.",
      evidence: [`program:${execute.program}`, `command:${execute.command}`],
      commands: ["d3code bundle-code-map d3-app-bundle.json", "d3code permission ask <command>"],
      doneWhen: ["EXECUTE behavior is classified, tested, and wrapped in a typed service or explicitly excluded."],
    }))
  }

  for (const resource of artifacts.migrationPlan.resources) {
    items.push(item(`api-${slug(resource.resource)}`, {
      priority: "P2",
      category: "api",
      title: `Build REST resource ${resource.resource}`,
      rationale: `Expose D3 file ${resource.file} through a generated API boundary with D3 metadata preserved.`,
      evidence: [`file:${resource.file}`, `resource:${resource.resource}`, `fields:${resource.fields?.length ?? 0}`],
      commands: ["d3code bundle-migration d3-app-bundle.json", "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output"],
      doneWhen: ["OpenAPI paths, schemas, adapter files, and tests exist for this resource."],
    }))
  }

  if (bundle.programs.length > 0 || bundle.files.length > 0) {
    items.push(item("qa-regression-proof", {
      priority: "P1",
      category: "qa",
      title: "Collect regression and live-D3 proof before claiming migration readiness",
      rationale: "D3 modernization claims need test output plus explicit live account or compile/catalog evidence.",
      evidence: [`files:${bundle.files.length}`, `programs:${bundle.programs.length}`],
      commands: ["npm run regression", "d3code profile-doctor --profile <profile>", "d3code goal-verify <goal-id>"],
      doneWhen: ["Regression output, profile doctor output, and any live-D3 gaps are recorded as goal evidence."],
    }))
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    items: items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.category.localeCompare(b.category) || a.id.localeCompare(b.id)),
  }
}

export function renderModernizationBacklog(backlog: ModernizationBacklog): string {
  return [
    `# D3 Modernization Backlog: ${backlog.account}`,
    "",
    `Profile: ${backlog.profile}`,
    `Items: ${backlog.items.length}`,
    "",
    ...backlog.items.flatMap((entry, index) => [
      `${index + 1}. [${entry.priority}] ${entry.title}`,
      `   Category: ${entry.category}`,
      `   Rationale: ${entry.rationale}`,
      "   Evidence:",
      ...entry.evidence.map((evidence) => `   - ${evidence}`),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "   Done when:",
      ...entry.doneWhen.map((done) => `   - ${done}`),
      "",
    ]),
  ].join("\n")
}
