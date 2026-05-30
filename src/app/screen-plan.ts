import { auditBasicScreen, type BasicScreenAudit } from "../d3/screen-audit.js"
import type { D3ApplicationBundle } from "./bundle.js"

export interface ScreenModernizationItem {
  program: string
  priority: "P0" | "P1" | "P2" | "P3"
  risk: BasicScreenAudit["risk"]
  operations: BasicScreenAudit["operations"]
  rationale: string
  commands: string[]
  doneWhen: string[]
}

export interface ScreenModernizationPlan {
  account: string
  profile: string
  items: ScreenModernizationItem[]
}

function priority(risk: BasicScreenAudit["risk"]): ScreenModernizationItem["priority"] {
  if (risk === "high") return "P1"
  if (risk === "medium") return "P2"
  if (risk === "low") return "P3"
  return "P3"
}

function programID(program: D3ApplicationBundle["programs"][number]): string {
  return `${program.file}/${program.item}`
}

export function createScreenModernizationPlan(bundle: D3ApplicationBundle): ScreenModernizationPlan {
  const items = bundle.programs.map((program) => {
    const audit = auditBasicScreen(program.source)
    return {
      program: programID(program),
      priority: priority(audit.risk),
      risk: audit.risk,
      operations: audit.operations,
      rationale: audit.operations.length
        ? `Program contains ${audit.operations.length} legacy screen operation(s): ${[...new Set(audit.operations.map((operation) => operation.kind))].join(", ")}.`
        : "No sampled legacy screen operation was detected.",
      commands: [
        `d3code read-item ${program.file} ${program.item} --profile <profile>`,
        "d3code screen-parse screen-transcript.txt --width 80 --height 24",
        "d3code bundle-screen-plan d3-app-bundle.json",
      ],
      doneWhen: audit.operations.length
        ? [
            "A representative terminal transcript is captured and parsed.",
            "Every INPUT operation is mapped to a UI field or explicit operator prompt.",
            "Cursor/clear behavior is represented as layout intent rather than copied terminal control.",
            "Compile/catalog proof exists after any BASIC screen refactor.",
          ]
        : ["Program remains screen-neutral or an explicit no-screen scope note exists."],
    } satisfies ScreenModernizationItem
  })

  if (items.length === 0) {
    items.push({
      program: "*",
      priority: "P2",
      risk: "none",
      operations: [],
      rationale: "No BASIC programs were captured, so screen modernization risk cannot be proven.",
      commands: ["d3code bundle-capture --profile <profile> --account <account> --program-files BP --sample-limit 5 > d3-app-bundle.json"],
      doneWhen: ["Representative screen/menu/form programs are captured or explicitly marked out of scope."],
    })
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    items: items.sort((a, b) => a.priority.localeCompare(b.priority) || a.program.localeCompare(b.program)),
  }
}

export function renderScreenModernizationPlan(plan: ScreenModernizationPlan): string {
  return [
    `# D3 Screen Modernization Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Items: ${plan.items.length}`,
    "",
    ...plan.items.flatMap((item, index) => [
      `${index + 1}. [${item.priority}] ${item.program} risk=${item.risk}`,
      `   Rationale: ${item.rationale}`,
      "   Operations:",
      ...(item.operations.length ? item.operations.map((operation) => `   - line ${operation.line} ${operation.kind}: ${operation.snippet}`) : ["   - none"]),
      "   Commands:",
      ...item.commands.map((command) => `   - \`${command}\``),
      "   Done when:",
      ...item.doneWhen.map((criterion) => `   - ${criterion}`),
      "",
    ]),
  ].join("\n")
}
