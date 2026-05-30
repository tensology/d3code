import type { D3CodeMap, D3ProgramMapEntry } from "../audit/code-map.js"
import type { LintFinding } from "../d3/basic.js"
import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

export interface CodeModernizationItem {
  program: string
  priority: "P0" | "P1" | "P2" | "P3"
  subject: string
  rationale: string
  evidence: string[]
  commands: string[]
  doneWhen: string[]
}

export interface CodeModernizationPlan {
  account: string
  profile: string
  items: CodeModernizationItem[]
}

function riskPriority(risk: D3ProgramMapEntry["risk"]): CodeModernizationItem["priority"] {
  return risk === "high" ? "P1" : risk === "medium" ? "P2" : "P3"
}

function findingPriority(finding: LintFinding): CodeModernizationItem["priority"] {
  return finding.severity === "error" ? "P0" : finding.severity === "warning" ? "P1" : "P3"
}

function rank(priority: CodeModernizationItem["priority"]): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority]
}

function item(values: CodeModernizationItem): CodeModernizationItem {
  return values
}

function compileCommands(program: string): string[] {
  const [, itemName] = program.split("/")
  const sourceName = itemName ? `${itemName}.txt` : "BP_ITEM.txt"
  return ["d3code basic-lint " + sourceName, "d3code compile-errors compile-output.txt", `d3code modernization-proof --before ${sourceName}.before --after ${sourceName} --compile-output compile-output.txt`]
}

function resolvedWriteEvidence(codeMap: D3CodeMap, program: string, fallback: string[]): string[] {
  const resolved = codeMap.fileUsage.filter((entry) => entry.writers.includes(program)).map((entry) => entry.file)
  return (resolved.length > 0 ? resolved : fallback).map((file) => `writes:${file}`)
}

function programItems(codeMap: D3CodeMap): CodeModernizationItem[] {
  const items: CodeModernizationItem[] = []
  for (const program of codeMap.programs) {
    if (program.risk !== "low") {
      items.push(item({
        program: program.program,
        priority: riskPriority(program.risk),
        subject: "risk-review",
        rationale: `Program is ranked ${program.risk} risk by D3 code-map analysis.`,
        evidence: [
          `risk:${program.risk}`,
          `findings:${program.findings.length}`,
          `writes:${program.symbols.writes.length}`,
          `executes:${program.symbols.executes.length}`,
          ...program.recommendations.map((recommendation) => `recommendation:${recommendation}`),
        ],
        commands: ["d3code bundle-code-map d3-app-bundle.json", ...compileCommands(program.program)],
        doneWhen: ["All warning/error findings are triaged.", "Compile output is captured after the change.", "Rollback notes exist for any D3 item mutation."],
      }))
    }

    for (const finding of program.findings) {
      items.push(item({
        program: program.program,
        priority: findingPriority(finding),
        subject: `lint:${finding.code}`,
        rationale: finding.message,
        evidence: [`severity:${finding.severity}`, `line:${finding.line}`],
        commands: compileCommands(program.program),
        doneWhen: ["The finding is fixed or explicitly accepted with a D3-specific reason.", "A fresh compile/lint transcript is attached to the goal evidence."],
      }))
    }

    if (program.symbols.writes.length > 0) {
      items.push(item({
        program: program.program,
        priority: "P1",
        subject: "write-policy",
        rationale: "Program writes D3 items; migration needs explicit lock, validation, and rollback behavior before exposing mutations.",
        evidence: resolvedWriteEvidence(codeMap, program.program, program.symbols.writes),
        commands: ["d3code permission ask \"WRITE <item> ON <file>,<id>\"", ...compileCommands(program.program)],
        doneWhen: ["Each write target has lock/error behavior documented.", "REST/API mutations remain disabled until rollback behavior is proven.", "Changed item IDs are captured in session evidence."],
      }))
    }

    items.push(item({
      program: program.program,
      priority: program.risk === "low" ? "P3" : "P2",
      subject: "compile-catalog-proof",
      rationale: "Every BASIC modernization slice must end with compile/catalog evidence, even when static linting is clean.",
      evidence: [`subroutine:${program.subroutine ?? "unknown"}`, `risk:${program.risk}`],
      commands: [...compileCommands(program.program), "d3code tool d3_compile_basic", "d3code tool d3_catalog"],
      doneWhen: ["Compile output has no new errors.", "Catalog step is recorded when the program is meant to run from catalog.", "Session transcript names the D3 account and item changed."],
    }))
  }
  return items
}

function relationshipItems(codeMap: D3CodeMap): CodeModernizationItem[] {
  const items: CodeModernizationItem[] = []
  for (const execute of codeMap.executes) {
    items.push(item({
      program: execute.program,
      priority: "P1",
      subject: "execute-isolation",
      rationale: "EXECUTE/TCL behavior can hide account-level side effects and needs a typed, permission-checked boundary.",
      evidence: [`command:${execute.command}`],
      commands: ["d3code permission ask " + JSON.stringify(execute.command), "d3code bundle-code-map d3-app-bundle.json"],
      doneWhen: ["The command is classified as read, mutation, or destructive.", "Destructive or broad account behavior has an explicit confirmation gate.", "The migrated service does not execute raw TCL without a typed wrapper."],
    }))
  }

  for (const call of codeMap.unresolvedCalls) {
    items.push(item({
      program: call.from,
      priority: "P1",
      subject: `unresolved-call:${call.call}`,
      rationale: "External CALL target is not present in the captured program set; extraction can miss hidden dependencies.",
      evidence: [`from:${call.from}`, `call:${call.call}`],
      commands: ["d3code bundle-capture --profile <profile> --account <account> --program-files BP --sample-limit 5 > d3-app-bundle.json", "d3code bundle-code-map d3-app-bundle.json"],
      doneWhen: ["The called subroutine source is captured or marked external with owner/system notes.", "Call contract inputs, outputs, COMMON usage, and side effects are documented."],
    }))
  }

  for (const file of codeMap.fileUsage.filter((entry) => entry.writers.length > 0)) {
    for (const writer of file.writers) {
      items.push(item({
        program: writer,
        priority: "P1",
        subject: `mutation-boundary:${file.file}`,
        rationale: `Program writes D3 file ${file.file}; generated API/resources need a deliberate mutation boundary.`,
        evidence: [`file:${file.file}`, `writers:${file.writers.join(",")}`, `readers:${file.readers.join(",") || "none"}`],
        commands: ["d3code bundle-data-plan d3-app-bundle.json", "d3code bundle-index-plan d3-app-bundle.json", "d3code bundle-backlog d3-app-bundle.json"],
        doneWhen: ["Reader and writer programs for the file are mapped into one migration slice.", "Validation/index assumptions for the file are reviewed before mutation endpoints ship."],
      }))
    }
  }
  return items
}

export function createCodeModernizationPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): CodeModernizationPlan {
  const items = [
    ...programItems(artifacts.codeMap),
    ...relationshipItems(artifacts.codeMap),
  ]

  if (items.length === 0) {
    items.push(item({
      program: "*",
      priority: "P2",
      subject: "capture-programs",
      rationale: "No BASIC programs were captured, so modernization risk cannot be proven.",
      evidence: ["programs:0"],
      commands: ["d3code bundle-capture --profile <profile> --account <account> --program-files BP --sample-limit 5 > d3-app-bundle.json"],
      doneWhen: ["Representative program files are captured.", "The bundle code map has at least one reviewed program or an explicit no-code scope note."],
    }))
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    items: items.sort((a, b) => rank(a.priority) - rank(b.priority) || a.program.localeCompare(b.program) || a.subject.localeCompare(b.subject)),
  }
}

export function renderCodeModernizationPlan(plan: CodeModernizationPlan): string {
  return [
    `# D3 BASIC Modernization Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Items: ${plan.items.length}`,
    "",
    ...plan.items.flatMap((entry, index) => [
      `${index + 1}. [${entry.priority}] ${entry.program} ${entry.subject}`,
      `   Rationale: ${entry.rationale}`,
      "   Evidence:",
      ...entry.evidence.map((evidence) => `   - ${evidence}`),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "   Done when:",
      ...entry.doneWhen.map((criterion) => `   - ${criterion}`),
      "",
    ]),
  ].join("\n")
}
