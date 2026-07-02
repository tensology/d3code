import { auditBasicScreen, type BasicScreenOperation } from "../d3/screen-audit.js"
import { parseD3ScreenTranscript, type D3ScreenBuffer } from "../d3/screen-buffer.js"

export type D3ScreenType = "screen-neutral" | "menu" | "input-form" | "output-report" | "transaction"
export type D3ScreenMutationRisk = "none" | "display-only" | "operator-input" | "transaction"

export interface ScreenAuditField {
  name: string
  label: string
  source: "basic-input" | "screen-label"
  required: boolean
  line?: number
}

export interface ScreenAuditAction {
  key: string
  kind: "enter-submit" | "function-key" | "menu-choice" | "terminal-navigation"
  evidence: string
}

export interface ScreenUiSpec {
  title: string
  layout: "none" | "menu" | "form" | "report"
  fields: ScreenAuditField[]
  actions: ScreenAuditAction[]
  source: "basic" | "transcript" | "basic+transcript"
}

export interface ScreenAuditInput {
  name: string
  basicSource?: string
  transcript?: string
  width?: number
  height?: number
}

export interface ScreenAuditReport {
  name: string
  screenType: D3ScreenType
  mutationRisk: D3ScreenMutationRisk
  operations: BasicScreenOperation[]
  fields: ScreenAuditField[]
  actions: ScreenAuditAction[]
  screen?: D3ScreenBuffer
  uiSpec: ScreenUiSpec
  proofChecklist: string[]
  recommendations: string[]
}

function titleFromName(name: string): string {
  return name.replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function labelFromName(name: string): string {
  return name.replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function labelBeforeInput(lines: string[], index: number): string | undefined {
  for (let cursor = index; cursor >= Math.max(0, index - 3); cursor -= 1) {
    const match = lines[cursor]?.match(/['"]([^'":]{2,40}):?['"]/)?.[1]
    if (match) return match.trim()
  }
  return undefined
}

function extractBasicFields(source: string): ScreenAuditField[] {
  const lines = source.split(/\r?\n/)
  const fields: ScreenAuditField[] = []
  lines.forEach((line, index) => {
    const match = line.match(/\bINPUT\s+([A-Z0-9_.-]+)/i)
    if (!match?.[1]) return
    const name = match[1].toUpperCase()
    const nextLines = lines.slice(index, index + 4).join("\n")
    fields.push({
      name,
      label: labelBeforeInput(lines, index) ?? labelFromName(name),
      source: "basic-input",
      required: /required|= *''|= *""|null/i.test(nextLines),
      line: index + 1,
    })
  })
  return fields
}

function extractScreenLabels(screen: D3ScreenBuffer | undefined, knownFields: ScreenAuditField[]): ScreenAuditField[] {
  if (!screen) return []
  const known = new Set(knownFields.map((field) => field.label.toLowerCase()))
  const labels = screen.lines
    .flatMap((line) => [...line.matchAll(/([A-Za-z][A-Za-z0-9 ._-]{1,32}):/g)].map((match) => match[1]?.trim() ?? ""))
    .filter(Boolean)
  return [...new Set(labels)]
    .filter((label) => !known.has(label.toLowerCase()))
    .map((label) => ({
      name: label.toUpperCase().replace(/\s+/g, "."),
      label,
      source: "screen-label" as const,
      required: false,
    }))
}

function inferActions(fields: ScreenAuditField[], source: string, screen: D3ScreenBuffer | undefined): ScreenAuditAction[] {
  const actions: ScreenAuditAction[] = []
  if (fields.length > 0) actions.push({ key: "Enter", kind: "enter-submit", evidence: "BASIC INPUT fields require operator submit flow." })
  if (/\bF1\b|HELP/i.test(source)) actions.push({ key: "F1", kind: "function-key", evidence: "Help/function-key text detected in source." })
  if (/\bF3\b|ACCEPT|SAVE/i.test(source)) actions.push({ key: "F3", kind: "function-key", evidence: "Accept/save function-key text detected in source." })
  if (screen?.lines.some((line) => /\b(choice|option|selection)\b/i.test(line))) actions.push({ key: "0-9", kind: "menu-choice", evidence: "Choice/option text detected in screen transcript." })
  if (screen?.events.some((event) => event.type === "cursor" || event.type === "clear-screen")) actions.push({ key: "terminal", kind: "terminal-navigation", evidence: "Cursor or clear-screen terminal controls detected." })
  return actions
}

function inferType(fields: ScreenAuditField[], actions: ScreenAuditAction[], operations: BasicScreenOperation[], screen: D3ScreenBuffer | undefined): D3ScreenType {
  if (fields.length > 0 && /WRITE|MATWRITE|DELETE|CALL|CHAIN|PERFORM|EXECUTE/i.test(operations.map((operation) => operation.snippet).join("\n"))) return "transaction"
  if (fields.length > 0) return "input-form"
  if (actions.some((action) => action.kind === "menu-choice")) return "menu"
  if (operations.some((operation) => operation.kind === "display") || screen?.events.some((event) => event.type === "text")) return "output-report"
  return "screen-neutral"
}

function mutationRisk(type: D3ScreenType, operations: BasicScreenOperation[]): D3ScreenMutationRisk {
  if (type === "transaction") return "transaction"
  if (type === "input-form") return "transaction"
  if (operations.some((operation) => operation.kind === "input")) return "operator-input"
  if (operations.length > 0) return "display-only"
  return "none"
}

export function createScreenAudit(input: ScreenAuditInput): ScreenAuditReport {
  const basicSource = input.basicSource ?? ""
  const basicAudit = auditBasicScreen(basicSource)
  const screen = input.transcript ? parseD3ScreenTranscript(input.transcript, { width: input.width, height: input.height }) : undefined
  const basicFields = extractBasicFields(basicSource)
  const fields = [...basicFields, ...extractScreenLabels(screen, basicFields)]
  const actions = inferActions(fields, basicSource, screen)
  const screenType = inferType(fields, actions, basicAudit.operations, screen)
  const risk = mutationRisk(screenType, basicAudit.operations)
  const source = basicSource && input.transcript ? "basic+transcript" : basicSource ? "basic" : "transcript"

  return {
    name: input.name,
    screenType,
    mutationRisk: risk,
    operations: basicAudit.operations,
    fields,
    actions,
    screen,
    uiSpec: {
      title: titleFromName(input.name),
      layout: screenType === "menu" ? "menu" : screenType === "input-form" || screenType === "transaction" ? "form" : screenType === "output-report" ? "report" : "none",
      fields,
      actions,
      source,
    },
    proofChecklist: [
      "Capture terminal transcript and screen-buffer.json for representative operator flow.",
      "Map every BASIC INPUT to a named UI field with dictionary validation evidence.",
      "Map function keys, menu choices, and Enter behavior to explicit UI actions.",
      "Keep writes, compile/catalog, and account-changing behavior behind D3Code safety proof.",
      "Verify generated UI against captured D3 screen output before parity sign-off.",
    ],
    recommendations: basicAudit.recommendations,
  }
}

export function renderScreenAudit(report: ScreenAuditReport): string {
  return [
    `# D3 Screen Audit: ${report.name}`,
    "",
    `Type: ${report.screenType}`,
    `Mutation risk: ${report.mutationRisk}`,
    `Operations: ${report.operations.length}`,
    `Fields: ${report.fields.length}`,
    "",
    "Fields:",
    ...(report.fields.length ? report.fields.map((field) => `- ${field.name} (${field.label}) source=${field.source}${field.required ? " required" : ""}`) : ["- none"]),
    "",
    "Actions:",
    ...(report.actions.length ? report.actions.map((action) => `- ${action.key}: ${action.kind} - ${action.evidence}`) : ["- none"]),
    "",
    "Migration UI Spec:",
    `- title: ${report.uiSpec.title}`,
    `- layout: ${report.uiSpec.layout}`,
    `- source: ${report.uiSpec.source}`,
    "",
    "Proof checklist:",
    ...report.proofChecklist.map((item) => `- ${item}`),
  ].join("\n")
}

