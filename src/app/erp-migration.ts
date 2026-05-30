import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createDataValidationPlan } from "./data-plan.js"

export interface TargetColumnPlan {
  name: string
  sourceDictionary: string
  sourceAttribute?: number
  type: "text" | "numeric" | "boolean" | "jsonb"
  notes: string[]
}

export interface TargetRelationshipPlan {
  fromTable: string
  toTable: string
  source: string
  kind: "foreign-key-candidate" | "multivalue-child-table" | "service-dependency"
  confidence: "high" | "medium" | "low"
  notes: string[]
}

export interface ScreenPlan {
  id: string
  title: string
  resource: string
  layout: "master-detail" | "table-detail" | "workflow"
  fields: string[]
  actions: string[]
  evidence: string[]
}

export interface ErpMigrationBlueprint {
  account: string
  profile: string
  targetDatabase: string
  stages: Array<{ id: string; title: string; doneWhen: string[] }>
  tables: Array<{ table: string; d3File: string; columns: TargetColumnPlan[]; childTables: string[]; integrityRisks: string[] }>
  relationships: TargetRelationshipPlan[]
  screens: ScreenPlan[]
  integrityWork: Array<{ priority: "P0" | "P1" | "P2"; subject: string; rationale: string; command: string }>
}

function tableName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "d3_table"
}

function targetType(type: string, multivalue: boolean): TargetColumnPlan["type"] {
  if (multivalue) return "jsonb"
  if (type === "number") return "numeric"
  if (type === "boolean") return "boolean"
  if (type === "object" || type === "array") return "jsonb"
  return "text"
}

function duplicateColumnGroups(columns: TargetColumnPlan[]): string[] {
  const groups = new Map<string, string[]>()
  for (const column of columns) {
    const key = column.name.replace(/(_?copy|_?dup|_?\d+)$/i, "").replace(/phone|tel/i, "phone").replace(/name/i, "name")
    groups.set(key, [...(groups.get(key) ?? []), column.name])
  }
  return [...groups.values()].filter((group) => group.length > 1).map((group) => group.join(", "))
}

export function createErpMigrationBlueprint(bundle: D3ApplicationBundle, artifacts: BundleArtifacts, targetDatabase = "target database"): ErpMigrationBlueprint {
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const tables = artifacts.migrationPlan.resources.map((resource) => {
    const table = tableName(resource.resource)
    const columns = (resource.fields ?? []).map((field) => ({
      name: tableName(field.name),
      sourceDictionary: field.dictionaryId,
      sourceAttribute: field.attribute,
      type: targetType(field.type, field.multivalue),
      notes: [
        field.multivalue ? "Normalize as a child table when row-level querying matters; otherwise preserve ordered multivalue structure during first cutover." : "Scalar projection from D3 attribute.",
        field.type === "number" || field.type === "boolean" ? "Validate conversion against sampled D3 values before enforcing type constraints." : "",
      ].filter(Boolean),
    }))
    const duplicateGroups = duplicateColumnGroups(columns)
    return {
      table,
      d3File: resource.file,
      columns,
      childTables: columns.filter((column) => column.type === "jsonb").map((column) => `${table}_${column.name}`),
      integrityRisks: [
        ...duplicateGroups.map((group) => `Potential copied/duplicate columns to collapse: ${group}.`),
        ...dataPlan.items.filter((item) => item.file === resource.file && item.status !== "ok").map((item) => item.rationale),
      ],
    }
  })

  const relationships: TargetRelationshipPlan[] = []
  for (const table of tables) {
    for (const child of table.childTables) {
      relationships.push({
        fromTable: child,
        toTable: table.table,
        source: `${table.d3File} multivalue`,
        kind: "multivalue-child-table",
        confidence: "high",
        notes: ["Preserve D3 value/subvalue order with ordinal columns during migration."],
      })
    }
  }
  for (const service of artifacts.migrationPlan.services) {
    for (const opened of service.opens) {
      const target = tables.find((table) => table.d3File.toUpperCase() === opened.toUpperCase())
      if (target) {
        relationships.push({
          fromTable: tableName(service.suggestedService),
          toTable: target.table,
          source: service.program,
          kind: "service-dependency",
          confidence: "medium",
          notes: [`Program opens D3 file ${opened}; review READ/WRITE/CALL behavior before extracting service logic.`],
        })
      }
    }
  }
  for (const table of tables) {
    for (const column of table.columns.filter((column) => /(^|_)id$|_no$|_num$|customer|vendor|account/i.test(column.name))) {
      const target = tables.find((candidate) => candidate.table !== table.table && column.name.includes(candidate.table.replace(/s$/, "")))
      if (target) {
        relationships.push({
          fromTable: table.table,
          toTable: target.table,
          source: `${table.d3File}.${column.sourceDictionary}`,
          kind: "foreign-key-candidate",
          confidence: "low",
          notes: ["Inferred from dictionary name only; validate with sampled data and D3 business rules."],
        })
      }
    }
  }

  const screens = artifacts.migrationPlan.resources.map((resource) => ({
    id: tableName(resource.resource),
    title: resource.resource.split(/[-_]/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "),
    resource: resource.resource,
    layout: (resource.fields ?? []).some((field) => field.multivalue) ? "master-detail" as const : "table-detail" as const,
    fields: ["id", ...(resource.fields ?? []).map((field) => field.name)].slice(0, 12),
    actions: ["search", "view", "compare D3 source", "export migration row", ...(resource.endpoints.some((endpoint) => endpoint.startsWith("PATCH")) ? ["guarded edit"] : [])],
    evidence: [`d3-file:${resource.file}`, `fields:${resource.fields?.length ?? 0}`],
  }))

  return {
    account: bundle.account,
    profile: bundle.profile,
    targetDatabase,
    stages: [
      { id: "audit", title: "Full D3 estate audit", doneWhen: ["All files, dictionaries, programs, indexes, phantoms/triggers, and sampled records are captured or explicitly out of scope."] },
      { id: "model", title: "Target data model reconstruction", doneWhen: ["Scalar fields, multivalue child collections/tables, duplicate column collapses, and inferred relationships are reviewed for the chosen target database."] },
      { id: "api", title: "Guarded REST/API adapter", doneWhen: ["Read endpoints pass against captured samples; writes stay behind lock/rollback policy."] },
      { id: "screens", title: "ERP screen generation", doneWhen: ["Generated screens expose resource list/detail, relationship navigation, and data-integrity warnings."] },
      { id: "cutover", title: "Stepwise migration and reconciliation", doneWhen: ["D3/target row counts, sampled values, multivalue ordering, and API smoke tests match."] },
    ],
    tables,
    relationships,
    screens,
    integrityWork: dataPlan.items.filter((item) => item.status !== "ok").map((item) => ({
      priority: item.status === "error" ? "P0" : item.status === "warning" ? "P1" : "P2",
      subject: `${item.file} ${item.subject}`,
      rationale: item.rationale,
      command: item.commands[0] ?? "d3code bundle-data-plan d3-app-bundle.json",
    })),
  }
}

export function renderErpMigrationBlueprint(plan: ErpMigrationBlueprint): string {
  return [
    `# D3 ERP Migration Blueprint: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Target database: ${plan.targetDatabase}`,
    "",
    "Stages:",
    ...plan.stages.map((stage) => `- ${stage.id}: ${stage.title} (${stage.doneWhen.join("; ")})`),
    "",
    "Target Data Model:",
    ...plan.tables.flatMap((table) => [
      `- ${table.table} <- ${table.d3File}`,
      `  columns: ${table.columns.map((column) => `${column.name}:${column.type}`).join(", ") || "none"}`,
      `  child tables: ${table.childTables.join(", ") || "none"}`,
      `  integrity risks: ${table.integrityRisks.join(" | ") || "none"}`,
    ]),
    "",
    "Relationships:",
    ...(plan.relationships.length ? plan.relationships.map((rel) => `- [${rel.confidence}] ${rel.kind}: ${rel.fromTable} -> ${rel.toTable} (${rel.source})`) : ["- none inferred yet"]),
    "",
    "Screens:",
    ...plan.screens.map((screen) => `- ${screen.title} (${screen.layout}): ${screen.fields.join(", ")}; actions=${screen.actions.join(", ")}`),
    "",
    "Integrity Work:",
    ...(plan.integrityWork.length ? plan.integrityWork.map((work) => `- [${work.priority}] ${work.subject}: ${work.rationale} -> \`${work.command}\``) : ["- none from sampled evidence"]),
  ].join("\n")
}
