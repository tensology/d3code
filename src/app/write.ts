import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createD3AccessPlan, renderD3AccessPlan } from "./access-plan.js"
import type { BundleArtifacts } from "./bundle.js"
import type { D3ApplicationBundle } from "./bundle.js"
import { createModernizationBacklog, renderModernizationBacklog } from "./backlog.js"
import { createModernizationBrief } from "./brief.js"
import { createCodeModernizationPlan, renderCodeModernizationPlan } from "./code-plan.js"
import { createCompletionAuditReport, renderCompletionAuditReport } from "./completion-audit.js"
import { createBundleIdeReport } from "./ide-report.js"
import { renderIdeHtml } from "./ide-html.js"
import { createDataValidationPlan, renderDataValidationPlan } from "./data-plan.js"
import { createBundleEvidenceReport, renderBundleEvidenceReport } from "./evidence.js"
import { createIndexValidationPlan, renderIndexValidationPlan } from "./index-plan.js"
import { createLiveOperatorRunbook, createLiveProofDefaults, renderLiveOperatorRunbook } from "./live-runbook.js"
import { createMigrationQaPlan, renderMigrationQaPlan } from "./qa-plan.js"
import { readQaEvidence } from "./qa-evidence.js"
import { createMigrationReadinessReport, renderMigrationReadinessReport } from "./readiness.js"
import { createBundleReleaseReport, renderBundleReleaseReport } from "./release-report.js"
import { createD3ReconciliationPlan, renderD3ReconciliationPlan } from "./reconciliation-plan.js"
import { createScreenModernizationPlan, renderScreenModernizationPlan } from "./screen-plan.js"
import { createBundleSkillManifest, createBundleSkillPack, renderBundleSkillPack } from "./skill-pack.js"
import { createBundleSubagentPlan, createBundleSubagentPromptPack, renderBundleSubagentPlan, renderBundleSubagentPromptPack } from "./subagents.js"
import { createWebUiPlan, renderWebUiPlan } from "./ui-plan.js"
import { createIdeTerminalContract, renderIdeTerminalContract } from "../d3/ide-terminal.js"
import { createD3ConnectorStrategy, renderD3ConnectorStrategy } from "../d3/connector-strategy.js"
import { writeLiveProofScaffold } from "../d3/live-proof-artifacts.js"
import { checkGeneratedWebApp } from "../migration/webapp-check.js"
import { writeAdapterFiles } from "../migration/write.js"
import { generateWebAppScaffold } from "../migration/webapp.js"
import { auditReferenceSkillInventory, renderReferenceSkillAudit, type ReferenceSkillAuditReport } from "../skills/reference-audit.js"
import { referenceSkillCoverageReady, referenceSkillFamilies } from "../skills/reference-map.js"
import { defaultReferenceDir } from "../config/paths.js"

export interface BundleWriteResult {
  written: string[]
}

function fallbackReferenceSkillAudit(): ReferenceSkillAuditReport {
  return {
    root: "embedded-reference-skill-map",
    ready: referenceSkillCoverageReady(),
    total: referenceSkillFamilies.length,
    items: referenceSkillFamilies.map((family) => ({
      path: `${family.source}:${family.reference}`,
      status: family.status,
      productSkills: family.productSkills,
      rationale: family.rationale,
    })),
  }
}

async function createReferenceSkillAudit(): Promise<ReferenceSkillAuditReport> {
  return existsSync(defaultReferenceDir) ? auditReferenceSkillInventory(defaultReferenceDir) : fallbackReferenceSkillAudit()
}

export async function refreshBundleProofArtifacts(outDir: string, artifacts: BundleArtifacts, bundle: D3ApplicationBundle): Promise<BundleWriteResult> {
  await mkdir(outDir, { recursive: true })
  const written: string[] = []
  const webapp = await checkGeneratedWebApp(outDir)
  const qaEvidence = await readQaEvidence(outDir)

  const completionAudit = createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)
  const completionAuditJsonPath = join(outDir, "completion-audit.json")
  await writeFile(completionAuditJsonPath, `${JSON.stringify(completionAudit, null, 2)}\n`)
  written.push(completionAuditJsonPath)
  const completionAuditMarkdownPath = join(outDir, "completion-audit.md")
  await writeFile(completionAuditMarkdownPath, renderCompletionAuditReport(completionAudit))
  written.push(completionAuditMarkdownPath)

  const evidenceReport = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
  const evidenceReportJsonPath = join(outDir, "goal-evidence.json")
  await writeFile(evidenceReportJsonPath, `${JSON.stringify(evidenceReport, null, 2)}\n`)
  written.push(evidenceReportJsonPath)
  const evidenceReportMarkdownPath = join(outDir, "goal-evidence.md")
  await writeFile(evidenceReportMarkdownPath, renderBundleEvidenceReport(evidenceReport))
  written.push(evidenceReportMarkdownPath)

  const readiness = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  const readinessJsonPath = join(outDir, "migration-readiness.json")
  await writeFile(readinessJsonPath, `${JSON.stringify(readiness, null, 2)}\n`)
  written.push(readinessJsonPath)
  const readinessMarkdownPath = join(outDir, "migration-readiness.md")
  await writeFile(readinessMarkdownPath, renderMigrationReadinessReport(readiness))
  written.push(readinessMarkdownPath)

  const releaseReport = createBundleReleaseReport(bundle, artifacts, webapp, qaEvidence)
  const releaseReportJsonPath = join(outDir, "release-report.json")
  await writeFile(releaseReportJsonPath, `${JSON.stringify(releaseReport, null, 2)}\n`)
  written.push(releaseReportJsonPath)
  const releaseReportMarkdownPath = join(outDir, "release-report.md")
  await writeFile(releaseReportMarkdownPath, renderBundleReleaseReport(releaseReport))
  written.push(releaseReportMarkdownPath)

  const proofData = {
    account: bundle.account,
    profile: bundle.profile,
    readiness: {
      ready: readiness.ready,
      gates: readiness.gates.map((gate) => ({ id: gate.id, status: gate.status, title: gate.title })),
    },
    completion: {
      complete: completionAudit.complete,
      requirements: completionAudit.requirements.map((requirement) => ({ id: requirement.id, status: requirement.status, requirement: requirement.requirement })),
    },
    release: {
      decision: releaseReport.decision,
      blockers: releaseReport.blockers,
      canaryScope: releaseReport.canaryScope,
      rollback: releaseReport.rollback,
    },
    qaEvidence: qaEvidence ? {
      ready: qaEvidence.ready,
      source: qaEvidence.source,
      checks: qaEvidence.checks.map((check) => ({ id: check.id, status: check.status, message: check.message })),
    } : null,
  }
  const proofDataJsonPath = join(outDir, "proof-data.json")
  await writeFile(proofDataJsonPath, `${JSON.stringify(proofData, null, 2)}\n`)
  written.push(proofDataJsonPath)
  await mkdir(join(outDir, "public"), { recursive: true })
  const publicProofDataJsonPath = join(outDir, "public", "proof-data.json")
  await writeFile(publicProofDataJsonPath, `${JSON.stringify(proofData, null, 2)}\n`)
  written.push(publicProofDataJsonPath)

  return { written }
}

export async function writeBundleArtifacts(outDir: string, artifacts: BundleArtifacts, bundle?: D3ApplicationBundle): Promise<BundleWriteResult> {
  await mkdir(outDir, { recursive: true })
  const written: string[] = []
  const files = [
    ["audit.json", artifacts.audit],
    ["code-map.json", artifacts.codeMap],
    ["migration-plan.json", artifacts.migrationPlan],
    ["openapi.json", artifacts.openapi],
    ["index.json", { documents: artifacts.index }],
  ] as const
  for (const [name, content] of files) {
    const target = join(outDir, name)
    await writeFile(target, `${JSON.stringify(content, null, 2)}\n`)
    written.push(target)
  }
  if (bundle) {
    const mockDataPath = join(outDir, "mock-data.json")
    await writeFile(mockDataPath, `${JSON.stringify(Object.fromEntries(bundle.files.map((file) => [file.name, file.records])), null, 2)}\n`)
    written.push(mockDataPath)
    const briefPath = join(outDir, "modernization-brief.md")
    await writeFile(briefPath, createModernizationBrief(bundle, artifacts))
    written.push(briefPath)
    const backlog = createModernizationBacklog(bundle, artifacts)
    const backlogJsonPath = join(outDir, "modernization-backlog.json")
    await writeFile(backlogJsonPath, `${JSON.stringify(backlog, null, 2)}\n`)
    written.push(backlogJsonPath)
    const backlogMarkdownPath = join(outDir, "modernization-backlog.md")
    await writeFile(backlogMarkdownPath, renderModernizationBacklog(backlog))
    written.push(backlogMarkdownPath)
    const qaPlan = createMigrationQaPlan(bundle, artifacts)
    const qaJsonPath = join(outDir, "migration-qa-plan.json")
    await writeFile(qaJsonPath, `${JSON.stringify(qaPlan, null, 2)}\n`)
    written.push(qaJsonPath)
    const qaMarkdownPath = join(outDir, "migration-qa-plan.md")
    await writeFile(qaMarkdownPath, renderMigrationQaPlan(qaPlan))
    written.push(qaMarkdownPath)
    const liveRunbook = createLiveOperatorRunbook(bundle, artifacts)
    const liveRunbookJsonPath = join(outDir, "live-operator-runbook.json")
    await writeFile(liveRunbookJsonPath, `${JSON.stringify(liveRunbook, null, 2)}\n`)
    written.push(liveRunbookJsonPath)
    await mkdir(join(outDir, "public"), { recursive: true })
    const publicLiveRunbookJsonPath = join(outDir, "public", "live-operator-runbook.json")
    await writeFile(publicLiveRunbookJsonPath, `${JSON.stringify(liveRunbook, null, 2)}\n`)
    written.push(publicLiveRunbookJsonPath)
    const liveRunbookMarkdownPath = join(outDir, "live-operator-runbook.md")
    await writeFile(liveRunbookMarkdownPath, renderLiveOperatorRunbook(liveRunbook))
    written.push(liveRunbookMarkdownPath)
    const liveProofDefaults = createLiveProofDefaults(bundle, artifacts)
    const liveProofScaffold = await writeLiveProofScaffold(join(outDir, "live-proof"), {
      profile: bundle.profile,
      account: bundle.account,
      screenCommand: liveProofDefaults.screenCommand,
      basicFile: liveProofDefaults.basicFile,
      basicItem: liveProofDefaults.basicItem,
    })
    written.push(...liveProofScaffold.written)
    const indexPlan = createIndexValidationPlan(bundle, artifacts)
    const indexPlanJsonPath = join(outDir, "index-validation-plan.json")
    await writeFile(indexPlanJsonPath, `${JSON.stringify(indexPlan, null, 2)}\n`)
    written.push(indexPlanJsonPath)
    const publicIndexPlanJsonPath = join(outDir, "public", "index-validation-plan.json")
    await mkdir(join(outDir, "public"), { recursive: true })
    await writeFile(publicIndexPlanJsonPath, `${JSON.stringify(indexPlan, null, 2)}\n`)
    written.push(publicIndexPlanJsonPath)
    const indexPlanMarkdownPath = join(outDir, "index-validation-plan.md")
    await writeFile(indexPlanMarkdownPath, renderIndexValidationPlan(indexPlan))
    written.push(indexPlanMarkdownPath)
    const dataPlan = createDataValidationPlan(bundle, artifacts)
    const dataPlanJsonPath = join(outDir, "data-validation-plan.json")
    await writeFile(dataPlanJsonPath, `${JSON.stringify(dataPlan, null, 2)}\n`)
    written.push(dataPlanJsonPath)
    const publicDataPlanJsonPath = join(outDir, "public", "data-validation-plan.json")
    await writeFile(publicDataPlanJsonPath, `${JSON.stringify(dataPlan, null, 2)}\n`)
    written.push(publicDataPlanJsonPath)
    const dataPlanMarkdownPath = join(outDir, "data-validation-plan.md")
    await writeFile(dataPlanMarkdownPath, renderDataValidationPlan(dataPlan))
    written.push(dataPlanMarkdownPath)
    const accessPlan = createD3AccessPlan(bundle, artifacts)
    const accessPlanJsonPath = join(outDir, "access-plan.json")
    await writeFile(accessPlanJsonPath, `${JSON.stringify(accessPlan, null, 2)}\n`)
    written.push(accessPlanJsonPath)
    const accessPlanMarkdownPath = join(outDir, "access-plan.md")
    await writeFile(accessPlanMarkdownPath, renderD3AccessPlan(accessPlan))
    written.push(accessPlanMarkdownPath)
    const ideHtmlPath = join(outDir, "ide.html")
    const ideReport = createBundleIdeReport(bundle, artifacts)
    await writeFile(ideHtmlPath, renderIdeHtml(ideReport))
    written.push(ideHtmlPath)
    const publicIdeDataPath = join(outDir, "public", "ide-data.json")
    await mkdir(join(outDir, "public"), { recursive: true })
    await writeFile(publicIdeDataPath, `${JSON.stringify(ideReport, null, 2)}\n`)
    written.push(publicIdeDataPath)
    const terminalContract = createIdeTerminalContract({ name: bundle.profile, type: "local", account: bundle.account })
    const terminalContractJsonPath = join(outDir, "ide-terminal.json")
    await writeFile(terminalContractJsonPath, `${JSON.stringify(terminalContract, null, 2)}\n`)
    written.push(terminalContractJsonPath)
    const publicTerminalContractJsonPath = join(outDir, "public", "ide-terminal.json")
    await writeFile(publicTerminalContractJsonPath, `${JSON.stringify(terminalContract, null, 2)}\n`)
    written.push(publicTerminalContractJsonPath)
    const terminalContractMarkdownPath = join(outDir, "ide-terminal.md")
    await writeFile(terminalContractMarkdownPath, renderIdeTerminalContract(terminalContract))
    written.push(terminalContractMarkdownPath)
    const connectorStrategy = createD3ConnectorStrategy({ name: bundle.profile, type: "local", account: bundle.account })
    const connectorStrategyJsonPath = join(outDir, "d3-connector-strategy.json")
    await writeFile(connectorStrategyJsonPath, `${JSON.stringify(connectorStrategy, null, 2)}\n`)
    written.push(connectorStrategyJsonPath)
    const connectorStrategyMarkdownPath = join(outDir, "d3-connector-strategy.md")
    await writeFile(connectorStrategyMarkdownPath, renderD3ConnectorStrategy(connectorStrategy))
    written.push(connectorStrategyMarkdownPath)
    const codePlan = createCodeModernizationPlan(bundle, artifacts)
    const codePlanJsonPath = join(outDir, "code-modernization-plan.json")
    await writeFile(codePlanJsonPath, `${JSON.stringify(codePlan, null, 2)}\n`)
    written.push(codePlanJsonPath)
    const publicCodePlanJsonPath = join(outDir, "public", "code-modernization-plan.json")
    await writeFile(publicCodePlanJsonPath, `${JSON.stringify(codePlan, null, 2)}\n`)
    written.push(publicCodePlanJsonPath)
    const codePlanMarkdownPath = join(outDir, "code-modernization-plan.md")
    await writeFile(codePlanMarkdownPath, renderCodeModernizationPlan(codePlan))
    written.push(codePlanMarkdownPath)
    const screenPlan = createScreenModernizationPlan(bundle)
    const screenPlanJsonPath = join(outDir, "screen-modernization-plan.json")
    await writeFile(screenPlanJsonPath, `${JSON.stringify(screenPlan, null, 2)}\n`)
    written.push(screenPlanJsonPath)
    const publicScreenPlanJsonPath = join(outDir, "public", "screen-modernization-plan.json")
    await writeFile(publicScreenPlanJsonPath, `${JSON.stringify(screenPlan, null, 2)}\n`)
    written.push(publicScreenPlanJsonPath)
    const screenPlanMarkdownPath = join(outDir, "screen-modernization-plan.md")
    await writeFile(screenPlanMarkdownPath, renderScreenModernizationPlan(screenPlan))
    written.push(screenPlanMarkdownPath)
    const uiPlan = createWebUiPlan(bundle, artifacts)
    const uiPlanJsonPath = join(outDir, "web-ui-plan.json")
    await writeFile(uiPlanJsonPath, `${JSON.stringify(uiPlan, null, 2)}\n`)
    written.push(uiPlanJsonPath)
    const uiPlanMarkdownPath = join(outDir, "web-ui-plan.md")
    await writeFile(uiPlanMarkdownPath, renderWebUiPlan(uiPlan))
    written.push(uiPlanMarkdownPath)
    const publicUiPlanJsonPath = join(outDir, "public", "ui-plan.json")
    await mkdir(join(outDir, "public"), { recursive: true })
    await writeFile(publicUiPlanJsonPath, `${JSON.stringify(uiPlan, null, 2)}\n`)
    written.push(publicUiPlanJsonPath)
    const reconciliationPlan = createD3ReconciliationPlan(bundle, artifacts)
    const reconciliationPlanJsonPath = join(outDir, "reconciliation-plan.json")
    await writeFile(reconciliationPlanJsonPath, `${JSON.stringify(reconciliationPlan, null, 2)}\n`)
    written.push(reconciliationPlanJsonPath)
    const reconciliationPlanMarkdownPath = join(outDir, "reconciliation-plan.md")
    await writeFile(reconciliationPlanMarkdownPath, renderD3ReconciliationPlan(reconciliationPlan))
    written.push(reconciliationPlanMarkdownPath)
    const subagentPlan = createBundleSubagentPlan(bundle, artifacts)
    const subagentPlanJsonPath = join(outDir, "subagent-plan.json")
    await writeFile(subagentPlanJsonPath, `${JSON.stringify(subagentPlan, null, 2)}\n`)
    written.push(subagentPlanJsonPath)
    const subagentPlanMarkdownPath = join(outDir, "subagent-plan.md")
    await writeFile(subagentPlanMarkdownPath, renderBundleSubagentPlan(subagentPlan))
    written.push(subagentPlanMarkdownPath)
    const subagentPrompts = createBundleSubagentPromptPack(subagentPlan)
    const subagentPromptsJsonPath = join(outDir, "subagent-prompts.json")
    await writeFile(subagentPromptsJsonPath, `${JSON.stringify(subagentPrompts, null, 2)}\n`)
    written.push(subagentPromptsJsonPath)
    const publicSubagentPromptsJsonPath = join(outDir, "public", "subagent-prompts.json")
    await writeFile(publicSubagentPromptsJsonPath, `${JSON.stringify(subagentPrompts, null, 2)}\n`)
    written.push(publicSubagentPromptsJsonPath)
    const subagentPromptsMarkdownPath = join(outDir, "subagent-prompts.md")
    await writeFile(subagentPromptsMarkdownPath, renderBundleSubagentPromptPack(subagentPrompts))
    written.push(subagentPromptsMarkdownPath)
    const skillPack = createBundleSkillPack(bundle, artifacts)
    const skillPackJsonPath = join(outDir, "d3code-skill-pack.json")
    await writeFile(skillPackJsonPath, `${JSON.stringify(skillPack, null, 2)}\n`)
    written.push(skillPackJsonPath)
    const skillPackMarkdownPath = join(outDir, "d3code-skill-pack.md")
    await writeFile(skillPackMarkdownPath, renderBundleSkillPack(skillPack))
    written.push(skillPackMarkdownPath)
    const skillManifest = createBundleSkillManifest(bundle, artifacts)
    const skillManifestJsonPath = join(outDir, "d3code-skill-manifest.json")
    await writeFile(skillManifestJsonPath, `${JSON.stringify(skillManifest, null, 2)}\n`)
    written.push(skillManifestJsonPath)
    const publicSkillManifestJsonPath = join(outDir, "public", "skill-manifest.json")
    await mkdir(join(outDir, "public"), { recursive: true })
    await writeFile(publicSkillManifestJsonPath, `${JSON.stringify(skillManifest, null, 2)}\n`)
    written.push(publicSkillManifestJsonPath)
    const referenceSkillAudit = await createReferenceSkillAudit()
    const referenceSkillAuditJsonPath = join(outDir, "d3code-reference-skill-audit.json")
    await writeFile(referenceSkillAuditJsonPath, `${JSON.stringify(referenceSkillAudit, null, 2)}\n`)
    written.push(referenceSkillAuditJsonPath)
    const referenceSkillAuditMarkdownPath = join(outDir, "d3code-reference-skill-audit.md")
    await writeFile(referenceSkillAuditMarkdownPath, renderReferenceSkillAudit(referenceSkillAudit))
    written.push(referenceSkillAuditMarkdownPath)
    const publicReferenceSkillAuditJsonPath = join(outDir, "public", "reference-skill-audit.json")
    await writeFile(publicReferenceSkillAuditJsonPath, `${JSON.stringify(referenceSkillAudit, null, 2)}\n`)
    written.push(publicReferenceSkillAuditJsonPath)
  }
  const adapterResult = await writeAdapterFiles(outDir, [
    ...generateWebAppScaffold(artifacts.migrationPlan),
    ...artifacts.adapters,
  ])
  written.push(...adapterResult.written)
  if (bundle) {
    written.push(...(await refreshBundleProofArtifacts(outDir, artifacts, bundle)).written)
  }
  return { written }
}
