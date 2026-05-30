import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createD3AccessPlan } from "./access-plan.js"
import { createDataValidationPlan } from "./data-plan.js"

export interface IdeNode {
  id: string
  label: string
  kind: "account" | "user" | "file" | "dictionary" | "program" | "subroutine" | "index" | "screen" | "data-model"
  risk: "ok" | "review" | "warning" | "blocked"
}

export interface IdeEdge {
  from: string
  to: string
  label: string
}

export interface BundleIdeReport {
  account: string
  profile: string
  nodes: IdeNode[]
  edges: IdeEdge[]
  panels: Array<{ id: string; title: string; items: string[] }>
  nextCommands: string[]
}

function riskFromCount(count: number): IdeNode["risk"] {
  if (count === 0) return "ok"
  if (count < 3) return "review"
  if (count < 6) return "warning"
  return "blocked"
}

export function createBundleIdeReport(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): BundleIdeReport {
  const accessPlan = createD3AccessPlan(bundle, artifacts)
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const nodes: IdeNode[] = [{ id: `account:${bundle.account}`, label: bundle.account, kind: "account", risk: "review" }]
  const edges: IdeEdge[] = []
  for (const user of bundle.users) {
    nodes.push({ id: `user:${user.id}`, label: user.name ? `${user.name} (${user.id})` : user.id, kind: "user", risk: user.roles.length ? "ok" : "review" })
    edges.push({ from: `user:${user.id}`, to: `account:${bundle.account}`, label: "can access" })
  }
  for (const file of bundle.files) {
    const findings = artifacts.audit.database?.files.find((entry) => entry.file === file.name)
    const riskCount = (findings?.dictionaryFindings.length ?? 0) + (findings?.shapeFindings.length ?? 0) + (findings?.indexFindings.filter((entry) => entry.severity !== "info").length ?? 0)
    nodes.push({ id: `file:${file.name}`, label: file.name, kind: "file", risk: riskFromCount(riskCount) })
    edges.push({ from: `account:${bundle.account}`, to: `file:${file.name}`, label: "contains file" })
    for (const dictionary of file.dictionary) {
      nodes.push({ id: `dict:${file.name}:${dictionary.id}`, label: dictionary.id, kind: "dictionary", risk: dictionary.attribute === undefined && dictionary.id !== "@ID" ? "review" : "ok" })
      edges.push({ from: `file:${file.name}`, to: `dict:${file.name}:${dictionary.id}`, label: "dictionary item" })
    }
    for (const index of file.observedIndexes ?? []) {
      nodes.push({ id: `index:${file.name}:${index}`, label: index, kind: "index", risk: file.expectedIndexes?.includes(index) ? "ok" : "review" })
      edges.push({ from: `file:${file.name}`, to: `index:${file.name}:${index}`, label: "has index" })
    }
  }
  for (const program of artifacts.codeMap.programs) {
    nodes.push({ id: `program:${program.program}`, label: program.program, kind: "program", risk: program.risk === "low" ? "ok" : program.risk === "medium" ? "warning" : "blocked" })
    edges.push({ from: `account:${bundle.account}`, to: `program:${program.program}`, label: "contains program" })
    for (const opened of program.symbols.opens) edges.push({ from: `program:${program.program}`, to: `file:${opened}`, label: "opens" })
    for (const call of program.symbols.calls) {
      nodes.push({ id: `subroutine:${call}`, label: call, kind: "subroutine", risk: "review" })
      edges.push({ from: `program:${program.program}`, to: `subroutine:${call}`, label: "calls" })
    }
  }
  for (const resource of artifacts.migrationPlan.resources) {
    const fields = resource.fields ?? []
    const dataRisks = dataPlan.items.filter((item) => item.file === resource.file && item.status !== "ok")
    nodes.push({ id: `model:${resource.resource}`, label: resource.resource, kind: "data-model", risk: dataRisks.length ? "review" : "ok" })
    edges.push({ from: `file:${resource.file}`, to: `model:${resource.resource}`, label: "logical D3 view" })
    nodes.push({ id: `screen:${resource.resource}`, label: resource.resource, kind: "screen", risk: "review" })
    edges.push({ from: `model:${resource.resource}`, to: `screen:${resource.resource}`, label: "drives screen" })
    for (const field of fields.filter((field) => field.multivalue)) {
      edges.push({ from: `dict:${resource.file}:${field.dictionaryId}`, to: `model:${resource.resource}`, label: "multivalue field" })
    }
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    nodes,
    edges,
    panels: [
      { id: "estate", title: "D3 Estate", items: [`users=${bundle.users.length}`, `files=${bundle.files.length}`, `dictionary-items=${bundle.files.flatMap((file) => file.dictionary).length}`, `programs=${bundle.programs.length}`, `indexes=${bundle.files.flatMap((file) => file.observedIndexes ?? []).length}`] },
      { id: "users", title: "Users", items: bundle.users.length ? bundle.users.map((user) => `${user.id}: ${user.roles.join(", ") || "roles not captured"}`) : ["Capture users during live D3/Unix profile proof."] },
      { id: "access", title: "Access Plan", items: [`grants=${accessPlan.grants.length}`, `warnings=${accessPlan.warnings.length}`, ...accessPlan.warnings.slice(0, 4)] },
      { id: "model", title: "D3 Logical Model", items: artifacts.migrationPlan.resources.map((resource) => {
        const fields = resource.fields ?? []
        return `${resource.resource}: file=${resource.file}, fields=${fields.length}, multivalue=${fields.filter((field) => field.multivalue).length}`
      }) },
      { id: "screens", title: "Generated Screens", items: artifacts.migrationPlan.resources.map((resource) => {
        const fields = resource.fields ?? []
        const layout = fields.some((field) => field.multivalue) ? "master-detail" : "table-detail"
        return `${resource.resource}: ${layout}, fields=${["id", ...fields.map((field) => field.name)].slice(0, 12).join(", ")}`
      }) },
      { id: "risks", title: "Integrity Risks", items: dataPlan.items.filter((entry) => entry.status !== "ok").slice(0, 8).map((entry) => `${entry.status} ${entry.file} ${entry.subject}`) },
    ],
    nextCommands: [
      "d3code bundle-data-plan d3-app-bundle.json",
      "d3code bundle-index-plan d3-app-bundle.json",
      "d3code bundle-access-plan d3-app-bundle.json",
      "d3code bundle-screen-plan d3-app-bundle.json",
      "d3code live-proof-init ./live-proof --profile <profile> --account <account>",
      "d3code terminal-capture --profile <profile> --out ./live-proof '<screen command>'",
      "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output",
      "d3code webapp-smoke ./migration-output --record",
    ],
  }
}

export function renderBundleIdeReport(report: BundleIdeReport): string {
  return [
    `# D3 IDE: ${report.account}`,
    "",
    `Profile: ${report.profile}`,
    `Nodes: ${report.nodes.length}`,
    `Edges: ${report.edges.length}`,
    "",
    "Panels:",
    ...report.panels.flatMap((panel) => [`- ${panel.title}`, ...(panel.items.length ? panel.items.map((item) => `  - ${item}`) : ["  - none"])]),
    "",
    "Graph:",
    ...report.edges.slice(0, 40).map((edge) => `- ${edge.from} -> ${edge.to}: ${edge.label}`),
    "",
    "Next Commands:",
    ...report.nextCommands.map((command) => `- \`${command}\``),
  ].join("\n")
}
