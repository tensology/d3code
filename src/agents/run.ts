import { readFile } from "node:fs/promises"
import { effectiveSafety, type D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { lintBasic, parseCompileErrors } from "../d3/basic.js"
import { parseCtItem, parseDictionaryItem, parseIndexNames, parseListOutputIds } from "../capture/parsers.js"
import { runToolByName } from "../tools/runner.js"
import { createBundleArtifacts, parseBundle } from "../app/bundle.js"
import { refreshBundleProofArtifacts, writeBundleArtifacts } from "../app/write.js"
import { createQaEvidenceFromWebAppSmoke, writeQaEvidence } from "../app/qa-evidence.js"
import { checkGeneratedWebApp, runGeneratedWebAppSmoke } from "../migration/webapp-check.js"
import { analyzeD3Record, validateShapeConsistency } from "../d3/shape.js"
import { validateDictionary, type DictionaryItem } from "../audit/dictionary.js"

export interface AgentRunRequest {
  task: "basic-check" | "file-audit" | "migration-slice"
  file: string
  item?: string
  outDir?: string
  profile?: string
  safety?: SafetyMode
  compile?: boolean
  catalog?: boolean
  global?: boolean
  confirm?: boolean
  sampleLimit?: number
}

export interface AgentRunStep {
  id: string
  status: "ok" | "blocked" | "skipped" | "warning"
  evidence: string[]
}

export interface AgentRunReport {
  task: string
  agent: string
  profile?: string
  target: string
  ready: boolean
  steps: AgentRunStep[]
}

function commandOutput(raw: unknown): string {
  if (raw && typeof raw === "object" && "stdout" in raw && typeof (raw as { stdout?: unknown }).stdout === "string") return (raw as { stdout: string }).stdout
  return typeof raw === "string" ? raw : JSON.stringify(raw)
}

function summarizeOutput(output: string): string {
  return output.replace(/\s+/g, " ").trim().slice(0, 180) || "(no output)"
}

function validateObservedIndexes(indexes: string[], dictionaryIds: string[]): string[] {
  const dictionary = new Set(dictionaryIds.map((id) => id.toUpperCase()))
  return indexes
    .filter((index) => !dictionary.has(index.toUpperCase()))
    .map((index) => `warning:${index}:Observed index has no sampled dictionary item.`)
}

export async function runAgentTask(config: D3CodeConfig, request: AgentRunRequest): Promise<AgentRunReport> {
  const selectedProfile = request.profile ?? config.defaultProfile ?? config.profiles[0]?.name
  const profile = config.profiles.find((item) => item.name === selectedProfile)
  const safety = effectiveSafety(config, request.safety, profile)
  const steps: AgentRunStep[] = []
  if (request.task === "migration-slice") return runMigrationSlice(request)
  if (request.task === "file-audit") return runFileAudit(config, request, selectedProfile, safety)
  return runBasicCheck(config, request, selectedProfile, safety)
}

async function runBasicCheck(config: D3CodeConfig, request: AgentRunRequest, selectedProfile: string | undefined, safety: SafetyMode): Promise<AgentRunReport> {
  if (!request.item) throw new Error("basic-check requires <file> and <item>")
  const steps: AgentRunStep[] = []
  const target = `${request.file}/${request.item}`

  let source = ""
  try {
    const read = await runToolByName(config, { name: "d3_read_item", input: { file: request.file, item: request.item }, safety, profile: selectedProfile, compact: false })
    source = parseCtItem(commandOutput(read.raw))
    steps.push({ id: "read-item", status: "ok", evidence: [`read ${target}`, `${source.split(/\r?\n/).length} source lines`] })
  } catch (error) {
    steps.push({ id: "read-item", status: "blocked", evidence: [(error as Error).message] })
    return { task: request.task, agent: "d3-operator", profile: selectedProfile, target, ready: false, steps }
  }

  const lintFindings = lintBasic(source)
  steps.push({
    id: "lint-basic",
    status: lintFindings.some((finding) => finding.severity === "error") ? "warning" : "ok",
    evidence: lintFindings.length === 0
      ? ["no local D3 BASIC lint findings"]
      : lintFindings.map((finding) => `${finding.severity}:${finding.code}:line ${finding.line}:${finding.message}`),
  })

  let compileOk = !request.compile
  if (request.compile) {
    try {
      const compile = await runToolByName(config, {
        name: "d3_compile_basic",
        input: { file: request.file, item: request.item, confirmed: request.confirm || safety === "trust" },
        safety,
        profile: selectedProfile,
        compact: false,
      })
      const output = commandOutput(compile.raw)
      const compileFindings = parseCompileErrors(output)
      compileOk = compileFindings.every((finding) => finding.severity !== "error")
      steps.push({
        id: "compile-basic",
        status: compileOk ? "ok" : "warning",
        evidence: compileFindings.length > 0 ? compileFindings.map((finding) => `${finding.severity}:line ${finding.line}:${finding.message}`) : [summarizeOutput(output)],
      })
    } catch (error) {
      compileOk = false
      steps.push({ id: "compile-basic", status: "blocked", evidence: [(error as Error).message] })
    }
  } else {
    steps.push({ id: "compile-basic", status: "skipped", evidence: ["compile not requested"] })
  }

  if (request.catalog) {
    if (!compileOk) {
      steps.push({ id: "catalog-basic", status: "skipped", evidence: ["catalog skipped because compile was not proven clean"] })
    } else {
      try {
        const catalog = await runToolByName(config, {
          name: "d3_catalog",
          input: { file: request.file, item: request.item, global: request.global, confirmed: request.confirm || safety === "trust" },
          safety,
          profile: selectedProfile,
          compact: false,
        })
        steps.push({ id: "catalog-basic", status: "ok", evidence: [summarizeOutput(commandOutput(catalog.raw))] })
      } catch (error) {
        steps.push({ id: "catalog-basic", status: "blocked", evidence: [(error as Error).message] })
      }
    }
  } else {
    steps.push({ id: "catalog-basic", status: "skipped", evidence: ["catalog not requested"] })
  }

  const ready = steps.every((step) => step.status === "ok" || step.status === "skipped")
  return { task: request.task, agent: "d3-operator", profile: selectedProfile, target, ready, steps }
}

async function readTcl(config: D3CodeConfig, selectedProfile: string | undefined, safety: SafetyMode, command: string): Promise<string> {
  const result = await runToolByName(config, { name: "d3_tcl", input: { command, confirmed: true }, safety, profile: selectedProfile, compact: false })
  return commandOutput(result.raw)
}

async function runFileAudit(config: D3CodeConfig, request: AgentRunRequest, selectedProfile: string | undefined, safety: SafetyMode): Promise<AgentRunReport> {
  const steps: AgentRunStep[] = []
  const target = request.file
  const sampleLimit = Math.max(0, request.sampleLimit ?? 3)

  let dictionaryIds: string[] = []
  try {
    dictionaryIds = parseListOutputIds(await readTcl(config, selectedProfile, safety, `LIST DICT ${request.file} (N`))
    steps.push({
      id: "dictionary-inventory",
      status: dictionaryIds.length > 0 ? "ok" : "warning",
      evidence: dictionaryIds.length > 0 ? [`dictionary items:${dictionaryIds.length}`, `sample:${dictionaryIds.slice(0, 8).join(", ")}`] : ["no dictionary items captured"],
    })
  } catch (error) {
    steps.push({ id: "dictionary-inventory", status: "blocked", evidence: [(error as Error).message] })
  }

  if (dictionaryIds.length === 0) {
    steps.push({ id: "dictionary-validation", status: "skipped", evidence: ["no dictionary items captured"] })
  } else {
    const dictionaryItems: DictionaryItem[] = []
    for (const id of dictionaryIds.slice(0, 8)) {
      try {
        dictionaryItems.push(parseDictionaryItem(id, await readTcl(config, selectedProfile, safety, `CT DICT ${request.file} ${id}`)))
      } catch {
        dictionaryItems.push({ id })
      }
    }
    const findings = validateDictionary(request.file, dictionaryItems)
    steps.push({
      id: "dictionary-validation",
      status: findings.some((finding) => finding.severity === "error" || finding.severity === "warning") ? "warning" : "ok",
      evidence: findings.length === 0
        ? [`validated dictionary items:${dictionaryItems.length}`]
        : findings.map((finding) => `${finding.severity}:${finding.item}:${finding.message}`),
    })
  }

  let indexes: string[] = []
  try {
    indexes = parseIndexNames(await readTcl(config, selectedProfile, safety, `LIST-INDEX ${request.file}`))
    steps.push({
      id: "index-inventory",
      status: indexes.length > 0 ? "ok" : "warning",
      evidence: indexes.length > 0 ? [`observed indexes:${indexes.join(", ")}`] : ["no observed indexes captured"],
    })
  } catch (error) {
    steps.push({ id: "index-inventory", status: "warning", evidence: [`index capture unavailable:${(error as Error).message}`] })
  }

  const indexFindings = validateObservedIndexes(indexes, dictionaryIds)
  steps.push({
    id: "index-validation",
    status: indexes.length === 0 ? "skipped" : indexFindings.length > 0 ? "warning" : "ok",
    evidence: indexes.length === 0
      ? ["no observed indexes to validate"]
      : indexFindings.length > 0
        ? indexFindings
        : [`validated indexes:${indexes.length}`, "all observed indexes have sampled dictionary items"],
  })

  if (sampleLimit === 0) {
    steps.push({ id: "sample-records", status: "skipped", evidence: ["sample limit is 0"] })
    steps.push({ id: "data-shape-validation", status: "skipped", evidence: ["sample limit is 0"] })
  } else {
    const sampledRecords: Array<{ id: string; raw: string }> = []
    try {
      const ids = parseListOutputIds(await readTcl(config, selectedProfile, safety, `SELECT ${request.file} SAMPLE ${sampleLimit}`)).slice(0, sampleLimit)
      const sampleEvidence: string[] = [`sample ids:${ids.join(", ") || "none"}`]
      for (const id of ids) {
        const raw = parseCtItem(await readTcl(config, selectedProfile, safety, `CT ${request.file} ${id}`))
        sampledRecords.push({ id, raw })
        sampleEvidence.push(`${id}:attrs=${raw.split("\u00fe").length};chars=${raw.length}`)
      }
      steps.push({ id: "sample-records", status: ids.length > 0 ? "ok" : "warning", evidence: sampleEvidence })
    } catch (error) {
      steps.push({ id: "sample-records", status: "blocked", evidence: [(error as Error).message] })
    }
    const shapes = sampledRecords.map((record) => analyzeD3Record(record.id, record.raw))
    const shapeFindings = validateShapeConsistency(shapes)
    const shapeStatus = shapeFindings.some((finding) => finding.severity === "error" || finding.severity === "warning") ? "warning" : "ok"
    steps.push({
      id: "data-shape-validation",
      status: sampledRecords.length === 0 ? "warning" : shapeStatus,
      evidence: [
        `records:${sampledRecords.length}`,
        ...shapes.map((shape) => `${shape.id}:attrs=${shape.attributeCount};mv=${shape.multivalueAttributes.join(",") || "none"};sv=${shape.subvalueAttributes.join(",") || "none"}`),
        ...(shapeFindings.length > 0 ? shapeFindings.map((finding) => `${finding.severity}:${finding.message}`) : ["shape consistency ok"]),
      ],
    })
  }

  const ready = steps.every((step) => step.status === "ok" || step.status === "skipped")
  return { task: request.task, agent: "d3-data-mapper", profile: selectedProfile, target, ready, steps }
}

async function runMigrationSlice(request: AgentRunRequest): Promise<AgentRunReport> {
  const steps: AgentRunStep[] = []
  const target = request.file
  const outDir = request.outDir
  if (!outDir) throw new Error("migration-slice requires --out <dir>")

  try {
    const bundle = parseBundle(JSON.parse(await readFile(request.file, "utf8")))
    const artifacts = createBundleArtifacts(bundle)
    steps.push({
      id: "parse-bundle",
      status: "ok",
      evidence: [`account:${bundle.account}`, `files:${bundle.files.length}`, `programs:${bundle.programs.length}`, `resources:${artifacts.migrationPlan.resources.length}`],
    })
    const written = await writeBundleArtifacts(outDir, artifacts, bundle)
    steps.push({ id: "write-artifacts", status: "ok", evidence: [`out:${outDir}`, `written:${written.written.length}`] })
    const webapp = await checkGeneratedWebApp(outDir)
    steps.push({
      id: "webapp-check",
      status: webapp.ready ? "ok" : "blocked",
      evidence: [`ready:${webapp.ready ? "yes" : "no"}`, `items:${webapp.items.length}`, ...webapp.items.filter((item) => item.status === "missing").slice(0, 5).map((item) => `missing:${item.id}`)],
    })
    const smoke = await runGeneratedWebAppSmoke(outDir)
    steps.push({
      id: "webapp-smoke",
      status: smoke.ready ? "ok" : "blocked",
      evidence: smoke.steps.map((step) => `${step.id}:${step.status}:${step.message}`),
    })
    const qaEvidence = createQaEvidenceFromWebAppSmoke(smoke)
    const qaFiles = await writeQaEvidence(outDir, qaEvidence)
    steps.push({
      id: "qa-evidence",
      status: qaEvidence.ready ? "ok" : "blocked",
      evidence: [`ready:${qaEvidence.ready ? "yes" : "no"}`, ...qaFiles.map((file) => `written:${file}`)],
    })
    const refreshed = await refreshBundleProofArtifacts(outDir, artifacts, bundle)
    steps.push({
      id: "refresh-proof",
      status: refreshed.written.length > 0 ? "ok" : "blocked",
      evidence: refreshed.written.map((file) => `written:${file}`),
    })
  } catch (error) {
    steps.push({ id: steps.length === 0 ? "parse-bundle" : "migration-slice", status: "blocked", evidence: [(error as Error).message] })
  }

  const ready = steps.every((step) => step.status === "ok" || step.status === "skipped")
  return { task: request.task, agent: "d3-architect", target, ready, steps }
}

export function renderAgentRunReport(report: AgentRunReport): string {
  return [
    `# D3 Agent Run: ${report.task}`,
    "",
    `Agent: ${report.agent}`,
    `Profile: ${report.profile ?? "none"}`,
    `Target: ${report.target}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.steps.flatMap((step) => [
      `- [${step.status}] ${step.id}`,
      ...step.evidence.map((evidence) => `  evidence: ${evidence}`),
    ]),
    "",
  ].join("\n")
}
