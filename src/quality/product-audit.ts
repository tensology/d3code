import { access } from "node:fs/promises"
import type { D3CodeConfig } from "../config/config.js"
import { defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir, defaultRocketMvBasicDir } from "../config/paths.js"
import { readManualText, scopeManual } from "../d3/manual.js"
import { checkLiveProofArtifacts, type LiveProofArtifactReport } from "../d3/live-proof-artifacts.js"
import type { SecretStore } from "../security/secrets.js"
import { getMode } from "../skills/modes.js"
import { auditReferenceSkillInventory } from "../skills/reference-audit.js"
import { skillCoverageReport } from "../skills/coverage.js"
import { auditMvBasicReference } from "../skills/mvbasic-reference.js"
import type { AcceptanceReport } from "./acceptance.js"
import type { InstallProofReport } from "./install-proof.js"
import { createReadinessReport } from "./readiness.js"

export type ProductAuditStatus = "proven" | "partial" | "missing"

export interface ProductAuditRequirement {
  id: string
  status: ProductAuditStatus
  requirement: string
  proof: string[]
  gaps: string[]
  commands: string[]
}

export interface ProductCompletionAuditReport {
  complete: boolean
  requirements: ProductAuditRequirement[]
}

export interface ProductCompletionAuditOptions {
  referenceDir?: string
  manualPath?: string
  userGuidePath?: string
  manualPaths?: string[]
  installProof?: InstallProofReport
  acceptance?: AcceptanceReport
  liveProofDir?: string
  liveProofArtifacts?: LiveProofArtifactReport
}

function requirement(values: ProductAuditRequirement): ProductAuditRequirement {
  return values
}

function rank(status: ProductAuditStatus): number {
  return { missing: 0, partial: 1, proven: 2 }[status]
}

async function pathExists(path: string | undefined): Promise<boolean> {
  if (!path) return false
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function covered(source: string, expectedIncludes: string): boolean {
  return skillCoverageReport().items.some((item) => item.source === source && item.expected.includes(expectedIncludes) && item.covered)
}

export async function createProductCompletionAudit(config: D3CodeConfig, secrets?: SecretStore, options: ProductCompletionAuditOptions = {}): Promise<ProductCompletionAuditReport> {
  const coverage = skillCoverageReport()
  const readiness = await createReadinessReport(config, secrets)
  const referenceDir = options.referenceDir ?? defaultReferenceDir
  const manualPaths = options.manualPaths ?? [options.manualPath ?? defaultD3ReferenceManual, options.userGuidePath ?? defaultD3UserGuide]
  const referenceAudit = await pathExists(referenceDir)
    ? await auditReferenceSkillInventory(referenceDir)
    : undefined
  const rocketMvBasicDir = options.referenceDir ? `${referenceDir}/rocket-mvbasic` : defaultRocketMvBasicDir
  const mvBasicAudit = await pathExists(rocketMvBasicDir)
    ? await auditMvBasicReference(rocketMvBasicDir)
    : undefined
  const existingManualPaths = []
  for (const manualPath of manualPaths) {
    if (await pathExists(manualPath)) existingManualPaths.push(manualPath)
  }
  const manualText = existingManualPaths.length > 0 ? (await Promise.all(existingManualPaths.map((manualPath) => readManualText(manualPath)))).join("\n") : undefined
  const manualScope = manualText ? scopeManual(manualText) : undefined
  const installProof = options.installProof
  const acceptance = options.acceptance
  const liveProofArtifacts = options.liveProofArtifacts ?? (options.liveProofDir && await pathExists(options.liveProofDir) ? await checkLiveProofArtifacts(options.liveProofDir) : undefined)
  const readinessGate = (id: string) => readiness.gates.find((gate) => gate.id === id)
  const acceptanceStep = (id: string) => acceptance?.steps.find((step) => step.id === id)
  const installCheck = (id: string) => installProof?.checks.find((check) => check.id === id)
  const interactiveLaunchReady = installCheck("interactive-default-launch")?.status === "ok"
  const installReady = Boolean(installProof?.ready && interactiveLaunchReady)
  const manualOk = manualScope?.topics.every((topic) => topic.status === "ok") ?? false
  const capabilityRows = manualScope?.capabilities ?? []
  const rawTclCapabilities = capabilityRows.filter((capability) => capability.surface === "raw-tcl-only")
  const liveGate = readinessGate("live-d3-proof")

  const requirements: ProductAuditRequirement[] = [
    requirement({
      id: "reference-skills-baked",
      status: coverage.ready && referenceAudit?.ready ? "proven" : coverage.ready ? "partial" : "missing",
      requirement: "All reference skills are baked, adapted, or explicitly out of scope for D3 Code.",
      proof: [
        `coverage:${coverage.items.filter((item) => item.covered).length}/${coverage.items.length}`,
        `reference-audit:${referenceAudit ? referenceAudit.ready ? "ready" : "not-ready" : "not-run"}`,
        ...(referenceAudit ? [`reference-skill-files:${referenceAudit.total}`] : []),
      ],
      gaps: referenceAudit ? referenceAudit.items.filter((item) => item.status === "unmapped").map((item) => item.path) : ["reference audit has not been run in this product audit"],
      commands: ["d3code skill-coverage", `d3code reference-audit ${defaultReferenceDir}`],
    }),
    requirement({
      id: "gsd-plan-mode",
      status: getMode("plan") && getMode("gsd") && covered("gsd", "goal, phase") ? "proven" : "missing",
      requirement: "A GSD-style plan/goal process exists for D3 work with phases, evidence, verification, and next actions.",
      proof: ["mode:plan", "mode:gsd", "goal commands", "bundle execution plan", "goal verification"],
      gaps: [],
      commands: ["d3code runbook gsd", "d3code goal --mode migrate <title>", "d3code goal-verify <goal-id>"],
    }),
    requirement({
      id: "migration-mode-webapp",
      status: covered("d3code", "D3 migration and REST API generation") && acceptanceStep("agent-migration-slice")?.ok ? "proven" : covered("d3code", "D3 migration and REST API generation") ? "partial" : "missing",
      requirement: "Migration mode can convert captured D3 application evidence into web/API artifacts and smoke-test them offline.",
      proof: ["mode:migrate", "bundle-artifacts", "webapp-check", "webapp-smoke", ...(acceptanceStep("agent-migration-slice")?.evidence ?? ["acceptance:not-run"])],
      gaps: acceptanceStep("agent-migration-slice")?.ok ? [] : ["mock acceptance migration-slice proof was not supplied to this audit"],
      commands: ["d3code agent-run migration-slice d3-app-bundle.json --out ./migration-output", "d3code webapp-check ./migration-output", "d3code webapp-smoke ./migration-output --record", "d3code acceptance"],
    }),
    requirement({
      id: "d3-code-database-audit",
      status: covered("d3code", "D3 database/code audit") && acceptanceStep("agent-file-audit")?.ok && acceptanceStep("agent-basic-check")?.ok ? "proven" : covered("d3code", "D3 database/code audit") ? "partial" : "missing",
      requirement: "D3 Code can audit D3 BASIC code, files, dictionaries, indexes, record shapes, and data validation risks.",
      proof: ["bundle-audit", "bundle-code-plan", "bundle-index-plan", "bundle-data-plan", ...(acceptanceStep("agent-file-audit")?.evidence ?? ["agent-file-audit:not-run"]), ...(acceptanceStep("agent-basic-check")?.evidence ?? ["agent-basic-check:not-run"])],
      gaps: acceptanceStep("agent-file-audit")?.ok && acceptanceStep("agent-basic-check")?.ok ? [] : ["offline agent audit proof was not supplied to this audit"],
      commands: ["d3code agent-run file-audit <file> --profile <profile>", "d3code agent-run basic-check <file> <item> --profile <profile>", "d3code bundle-code-plan d3-app-bundle.json"],
    }),
    requirement({
      id: "modernization-rest-subagents",
      status: covered("d3code", "D3 BASIC modernization") && covered("superpowers", "subagent-driven") && covered("d3code", "D3 migration and REST API generation") ? "proven" : "partial",
      requirement: "Modernization includes BASIC lint/proof, REST API generation, and subagent delegation surfaces.",
      proof: ["modernize mode", "modernization-proof", "openapi/adapter generation", "delegate-prompts", "bundle-delegate"],
      gaps: [],
      commands: ["d3code modernization-proof before.bas after.bas --compile-output compile.txt", "d3code bundle-delegate d3-app-bundle.json", "d3code openapi migration-plan.json"],
    }),
    requirement({
      id: "mvbasic-ide-parity",
      status: covered("rocket-mvbasic", "IDE parity") && mvBasicAudit?.ready ? "proven" : covered("rocket-mvbasic", "IDE parity") ? "partial" : "missing",
      requirement: "Rocket MV BASIC extension behavior is audited as an IDE-parity reference for connection profiles, online editing locks, hashed-file browsing, compile/catalog, diagnostics, references, completion, and debugger boundaries.",
      proof: [
        `skill:mvbasic-ide-parity:${covered("rocket-mvbasic", "IDE parity") ? "covered" : "missing"}`,
        `mvbasic-reference:${mvBasicAudit ? mvBasicAudit.ready ? "ready" : "not-ready" : "not-run"}`,
        ...(mvBasicAudit?.checks.map((item) => `${item.id}:${item.status}`) ?? []),
      ],
      gaps: mvBasicAudit?.ready ? [] : mvBasicAudit ? mvBasicAudit.checks.filter((item) => item.status !== "ok").map((item) => `${item.id}:${item.status}`) : ["reference/rocket-mvbasic has not been audited"],
      commands: [`d3code mvbasic-reference-audit ${defaultRocketMvBasicDir}`, "d3code ide-terminal", "d3code bundle-code-plan d3-app-bundle.json"],
    }),
    requirement({
      id: "model-and-install-readiness",
      status: readinessGate("model-selection")?.status === "ok" && installReady ? "proven" : readinessGate("model-selection")?.status === "ok" ? "partial" : "missing",
      requirement: "The installed `d3code` CLI can start the Ink terminal app with first-run setup, resume support, and a proven model/provider configuration.",
      proof: [
        `model-selection:${readinessGate("model-selection")?.status ?? "missing"}`,
        `install-proof:${installProof ? installProof.ready ? "ready" : "not-ready" : "not-run"}`,
        ...(installProof?.checks.map((check) => `${check.id}:${check.status}:${check.evidence.join("|")}`) ?? []),
      ],
      gaps: [
        ...(readinessGate("model-selection")?.status === "ok" ? [] : ["model-proof is not ready"]),
        ...(installProof?.ready ? [] : ["install proof was not supplied to this audit"]),
        ...(interactiveLaunchReady ? [] : ["interactive default `d3code` launch path is not proven"]),
      ],
      commands: ["d3code model-proof", "d3code install-proof", "d3code readiness"],
    }),
    requirement({
      id: "d3-manual-scope",
      status: manualOk ? "proven" : manualScope ? "partial" : "missing",
      requirement: "The Rocket D3 10.3 manual is scoped for AQL, BASIC, TCL, accounts, files, locks, phantoms, diagnostics, and legacy terminal screens.",
      proof: manualScope ? [`manual-files:${existingManualPaths.join(",")}`, `manual-lines:${manualScope.totalLines}`, ...manualScope.topics.map((topic) => `${topic.id}:${topic.status}:${topic.hits}`)] : ["manual-scope:not-run"],
      gaps: manualScope ? manualScope.topics.filter((topic) => topic.status !== "ok").map((topic) => `${topic.id}:${topic.status}`) : ["manual text was not supplied to this audit"],
      commands: [`d3code manual-scope ${defaultD3ReferenceManual}`, `d3code manual-scope ${defaultD3UserGuide}`],
    }),
    requirement({
      id: "d3-command-capability-matrix",
      status: capabilityRows.length > 0 && capabilityRows.every((capability) => capability.manualStatus === "ok") ? rawTclCapabilities.length > 0 ? "partial" : "proven" : "missing",
      requirement: "Manual-backed D3 command families are mapped to typed CLI support, explicit raw TCL fallback, mock proof, and live-proof requirements.",
      proof: capabilityRows.length > 0 ? [
        "known-command-support:manual-taxonomy",
        `raw-tcl-fallback:${rawTclCapabilities.map((capability) => capability.category).join(",") || "none"}`,
        `mock-proven:${acceptance?.ready ? "yes" : "not-supplied"}`,
        "live-proof-required:yes-for-real-D3-writes-compile-catalog-backup-restore-screen-parity",
        ...capabilityRows.map((capability) => `${capability.id}:manual:${capability.manualStatus}:surface:${capability.surface}:hits:${capability.hits}:cli:${capability.cli.join("|")}`),
      ] : ["manual-command-capability:not-run"],
      gaps: capabilityRows.length > 0 ? [
        ...capabilityRows.filter((capability) => capability.manualStatus !== "ok").map((capability) => `${capability.id}:manual-${capability.manualStatus}`),
        ...rawTclCapabilities.map((capability) => `${capability.id}:raw-tcl-only:${capability.notes}`),
      ] : ["manual command capability matrix was not built"],
      commands: [`d3code manual-scope ${defaultD3ReferenceManual}`, "d3code tools", "d3code safety-guard --command '<D3 command>'"],
    }),
    requirement({
      id: "offline-regression-acceptance",
      status: acceptance?.ready ? "proven" : "partial",
      requirement: "Offline regression/acceptance proves the mock-D3 path, generated artifacts, QA evidence, agent loops, readiness gates, and completion audit.",
      proof: acceptance ? acceptance.steps.map((step) => `${step.id}:${step.ok ? "ok" : "fail"}`) : ["acceptance:not-run"],
      gaps: acceptance?.ready ? [] : ["mock acceptance was not supplied to this audit"],
      commands: ["npm run regression", "d3code acceptance"],
    }),
    requirement({
      id: "live-d3-proof",
      status: liveGate?.status === "ok" || liveProofArtifacts?.ready ? "proven" : liveGate?.status === "missing" ? "missing" : "partial",
      requirement: "A real D3 account proves login, read-only smoke, terminal capture, screen-buffer parity, guarded writes, compile/catalog, and rollback evidence.",
      proof: [
        `live-d3-proof:${liveGate?.status ?? "missing"}`,
        `profiles:${config.profiles.length}`,
        `default-profile:${config.defaultProfile ?? "none"}`,
        ...(liveProofArtifacts ? [`live-proof-artifacts:${liveProofArtifacts.ready ? "ready" : "not-ready"}`, ...liveProofArtifacts.checks.map((item) => `${item.id}:${item.status}`)] : ["live-proof-artifacts:not-run"]),
      ],
      gaps: liveGate?.status === "ok" || liveProofArtifacts?.ready ? [] : [
        "no real D3 profile/account proof is recorded in this environment",
        ...(liveProofArtifacts ? liveProofArtifacts.checks.filter((item) => item.status !== "ok").map((item) => `${item.id}:${item.status}`) : ["live proof artifact directory has not been checked"]),
      ],
      commands: ["d3code profile-doctor --profile <profile> --json > live-proof/profile-doctor.json", "d3code live-proof-check live-proof", "d3code terminal-capture --profile <profile> --out live-proof '<screen command>'"],
    }),
  ]

  const sorted = requirements.sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id))
  return {
    complete: sorted.every((item) => item.status === "proven"),
    requirements: sorted,
  }
}

export function renderProductCompletionAudit(report: ProductCompletionAuditReport): string {
  return [
    "# D3 Code Product Completion Audit",
    "",
    `Complete: ${report.complete ? "yes" : "no"}`,
    "",
    ...report.requirements.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.id}`,
      `   Requirement: ${entry.requirement}`,
      "   Proof:",
      ...entry.proof.map((proof) => `   - ${proof}`),
      "   Gaps:",
      ...(entry.gaps.length > 0 ? entry.gaps.map((gap) => `   - ${gap}`) : ["   - none"]),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "",
    ]),
  ].join("\n")
}
