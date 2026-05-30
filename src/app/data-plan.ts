import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

export interface DataValidationItem {
  file: string
  status: "error" | "warning" | "review" | "ok"
  subject: string
  rationale: string
  evidence: string[]
  commands: string[]
}

export interface DataValidationPlan {
  account: string
  profile: string
  items: DataValidationItem[]
}

function rank(status: DataValidationItem["status"]): number {
  return { error: 0, warning: 1, review: 2, ok: 3 }[status]
}

function item(values: DataValidationItem): DataValidationItem {
  return values
}

export function createDataValidationPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): DataValidationPlan {
  const items: DataValidationItem[] = []
  for (const file of artifacts.audit.database?.files ?? []) {
    const bundleFile = bundle.files.find((entry) => entry.name === file.file)
    for (const finding of file.dictionaryFindings) {
      items.push(item({
        file: file.file,
        status: finding.severity === "error" ? "error" : finding.severity === "warning" ? "warning" : "review",
        subject: `dictionary:${finding.item}`,
        rationale: finding.message,
        evidence: [`severity:${finding.severity}`, `item:${finding.item}`],
        commands: [`LIST DICT ${file.file} ${finding.item === "*" ? "" : finding.item}`.trim(), "d3code audit-db database-samples.json"],
      }))
    }
    for (const finding of file.shapeFindings) {
      items.push(item({
        file: file.file,
        status: finding.severity === "error" ? "error" : finding.severity === "warning" ? "warning" : "review",
        subject: "record-shape",
        rationale: finding.message,
        evidence: [`severity:${finding.severity}`, `sampled-records:${file.recordShapes.length}`],
        commands: ["d3code shape record-samples.json", "d3code audit-db database-samples.json"],
      }))
    }
    if (file.dictionaryFindings.length === 0 && file.shapeFindings.length === 0) {
      items.push(item({
        file: file.file,
        status: "ok",
        subject: "sampled-data",
        rationale: "Sampled dictionary and record shapes have no blocking validation findings.",
        evidence: [`records:${bundleFile?.records.length ?? 0}`, `dictionary:${bundleFile?.dictionary.length ?? 0}`],
        commands: ["d3code audit-db database-samples.json"],
      }))
    }
  }

  for (const resource of artifacts.migrationPlan.resources) {
    for (const field of resource.fields ?? []) {
      if (field.multivalue) {
        items.push(item({
          file: resource.file,
          status: "review",
          subject: `api-field:${field.name}`,
          rationale: `Generated API field ${field.name} is mapped from a multivalue D3 dictionary item; confirm JSON array semantics.`,
          evidence: [`resource:${resource.resource}`, `dictionary:${field.dictionaryId}`, field.attribute !== undefined ? `attribute:${field.attribute}` : "attribute:unknown"],
          commands: [`LIST DICT ${resource.file} ${field.dictionaryId}`, "d3code openapi migration-plan.json"],
        }))
      }
      if (field.type === "number" || field.type === "boolean") {
        items.push(item({
          file: resource.file,
          status: "review",
          subject: `api-field:${field.name}`,
          rationale: `Generated API field ${field.name} has inferred type ${field.type}; validate D3 conversion and sample values before relying on it.`,
          evidence: [`resource:${resource.resource}`, `dictionary:${field.dictionaryId}`, `type:${field.type}`],
          commands: [`LIST DICT ${resource.file} ${field.dictionaryId}`, `SELECT ${resource.file} SAMPLE 5`],
        }))
      }
    }
  }

  if (items.length === 0) {
    items.push(item({
      file: "*",
      status: "review",
      subject: "bundle",
      rationale: "No D3 files were captured; data validation cannot be proven.",
      evidence: ["files:0"],
      commands: ["d3code bundle-capture --profile <profile> --account <account> --files <files>"],
    }))
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    items: items.sort((a, b) => rank(a.status) - rank(b.status) || a.file.localeCompare(b.file) || a.subject.localeCompare(b.subject)),
  }
}

export function renderDataValidationPlan(plan: DataValidationPlan): string {
  return [
    `# D3 Data Validation Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Items: ${plan.items.length}`,
    "",
    ...plan.items.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.file} ${entry.subject}`,
      `   Rationale: ${entry.rationale}`,
      "   Evidence:",
      ...entry.evidence.map((evidence) => `   - ${evidence}`),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "",
    ]),
  ].join("\n")
}
