import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { WebAppSmokeReport } from "../migration/webapp-check.js"

export interface MigrationQaEvidenceCheck {
  id: string
  status: "ok" | "failed" | "missing"
  message: string
  evidence: string[]
}

export interface MigrationQaEvidenceReport {
  ready: boolean
  source: string
  checks: MigrationQaEvidenceCheck[]
}

export function createQaEvidenceFromWebAppSmoke(report: WebAppSmokeReport): MigrationQaEvidenceReport {
  const checks: MigrationQaEvidenceCheck[] = report.steps.map((step) => ({
    id: step.id,
    status: step.status,
    message: step.message,
    evidence: [`root:${report.root}`, `step:${step.id}:${step.status}`],
  }))
  return {
    ready: report.ready && checks.length > 0 && checks.every((check) => check.status === "ok"),
    source: "webapp-smoke",
    checks,
  }
}

export async function writeQaEvidence(root: string, report: MigrationQaEvidenceReport): Promise<string[]> {
  const jsonPath = join(root, "qa-evidence.json")
  const markdownPath = join(root, "qa-evidence.md")
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(markdownPath, renderQaEvidenceReport(report))
  return [jsonPath, markdownPath]
}

export async function readQaEvidence(root: string): Promise<MigrationQaEvidenceReport | undefined> {
  try {
    return JSON.parse(await readFile(join(root, "qa-evidence.json"), "utf8")) as MigrationQaEvidenceReport
  } catch {
    return undefined
  }
}

export function renderQaEvidenceReport(report: MigrationQaEvidenceReport): string {
  return [
    "# D3 Migration QA Evidence",
    "",
    `Source: ${report.source}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.checks.map((check) => `- [${check.status}] ${check.id}: ${check.message}`),
    "",
  ].join("\n")
}
