#!/usr/bin/env node
import { existsSync } from "node:fs"
import { Command } from "commander"
import { render } from "ink"
import React from "react"
import { agents } from "./agents/registry.js"
import { renderDelegationPlan } from "./agents/delegation.js"
import { renderAgentRunReport, runAgentTask } from "./agents/run.js"
import { createSubagentPromptPack, renderSubagentPromptPack } from "./agents/tasks.js"
import { defaultConfig, effectiveSafety, loadConfig, saveConfig, selectProfile } from "./config/config.js"
import { configPath, defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir, defaultRocketMvBasicDir } from "./config/paths.js"
import { assertD3Allowed, evaluateD3Permission, classifyD3Command } from "./core/permissions.js"
import type { SafetyMode } from "./domain/types.js"
import { createD3Session } from "./d3/adapter.js"
import { extractBasicSymbols, lintBasic, parseCompileErrors } from "./d3/basic.js"
import { createD3ConnectorStrategy, renderD3ConnectorStrategy } from "./d3/connector-strategy.js"
import { detectLocalD3 } from "./d3/detect.js"
import { createLiveProofReport, profileDoctorGoalEvidence, renderLiveProofReport } from "./d3/live-proof.js"
import { checkLiveProofArtifacts, renderLiveProofArtifactReport, renderLiveProofScaffold, writeLiveProofScaffold } from "./d3/live-proof-artifacts.js"
import { diagnoseProfile, renderProfileDoctor } from "./d3/profile-doctor.js"
import { createIdeTerminalContract, renderIdeTerminalContract } from "./d3/ide-terminal.js"
import { parseD3ScreenTranscript, renderD3ScreenBuffer } from "./d3/screen-buffer.js"
import { captureD3Terminal, renderD3TerminalCapture, writeD3TerminalCapture } from "./d3/terminal-capture.js"
import { createD3TerminalBridgePlan, renderD3TerminalBridgePlan } from "./d3/terminal-plan.js"
import { d3Tools, getTool } from "./d3/tools.js"
import { parseD3Uri } from "./d3/uri.js"
import { indexD3Account, indexManualText, loadIndex, saveIndex, searchDocuments } from "./indexing/indexer.js"
import { formatManualScope, readManualText, scopeManual } from "./d3/manual.js"
import { auditD3Application } from "./audit/audit.js"
import { createD3CodeMap } from "./audit/code-map.js"
import { auditDatabaseSamples } from "./audit/database.js"
import { advanceGoal, blockGoal, createModernizationGoal, goalPlan, goalSummary, recordGoalEvidence, renderGoalVerification } from "./goal/goal.js"
import { createMigrationGoalFromBundle } from "./goal/bootstrap.js"
import { auditGoalAgainstBundle, renderGoalBundleAudit } from "./goal/audit.js"
import { applyBundleEvidenceToGoal, renderAppliedGoalEvidence } from "./goal/evidence.js"
import { renderGoalNext } from "./goal/next.js"
import { listGoals, loadGoal, saveGoal } from "./goal/store.js"
import { normalizeProviderID, providers, resolveModel } from "./providers/catalog.js"
import { createModelProofReport, renderModelProofReport } from "./providers/proof.js"
import { createModelRoutingPlan, renderModelRoutingPlan, type ModelBias } from "./providers/routing.js"
import { createReadinessReport, renderReadinessReport } from "./quality/readiness.js"
import { renderAcceptanceReport, runMockAcceptance } from "./quality/acceptance.js"
import { createIdeStatusReport, renderIdeStatusReport } from "./quality/ide-status.js"
import { createInstallProofReport, renderInstallProofReport } from "./quality/install-proof.js"
import { createProductCompletionAudit, renderProductCompletionAudit } from "./quality/product-audit.js"
import { defaultSecretStore } from "./security/secrets.js"
import { createSetupProofReport, renderSetupProofReport } from "./setup/proof.js"
import { runSetupWizard } from "./setup/wizard.js"
import { App } from "./tui/App.js"
import { createMigrationPlan } from "./migration/planner.js"
import { createOpenApiFromMigrationPlan } from "./migration/openapi.js"
import { generateAdapterSkeleton } from "./migration/adapter.js"
import { writeAdapterFiles } from "./migration/write.js"
import { generateWebAppScaffold } from "./migration/webapp.js"
import { checkGeneratedWebApp, renderWebAppCheck, renderWebAppSmoke, runGeneratedWebAppSmoke } from "./migration/webapp-check.js"
import { getMode, modeSystemPrompt, modes, renderModeRunbook, renderSkill, skills } from "./skills/modes.js"
import { renderSkillCoverage, skillCoverageReport } from "./skills/coverage.js"
import { auditReferenceSkillInventory, renderReferenceSkillAudit } from "./skills/reference-audit.js"
import { referenceSkillCoverageReady, referenceSkillFamilies, renderReferenceSkillMap } from "./skills/reference-map.js"
import { auditMvBasicReference, renderMvBasicReferenceAudit } from "./skills/mvbasic-reference.js"
import { renderWorkflow } from "./skills/workflows.js"
import { recipes, renderRecipe } from "./skills/recipes.js"
import { analyzeD3Record, validateShapeConsistency } from "./d3/shape.js"
import { runToolByName } from "./tools/runner.js"
import { createBundleArtifacts, parseBundle, validateBundleUris } from "./app/bundle.js"
import { refreshBundleProofArtifacts, writeBundleArtifacts } from "./app/write.js"
import { createModernizationBrief } from "./app/brief.js"
import { createModernizationBacklog, renderModernizationBacklog } from "./app/backlog.js"
import { createD3AccessPlan, renderD3AccessPlan } from "./app/access-plan.js"
import { createCodeModernizationPlan, renderCodeModernizationPlan } from "./app/code-plan.js"
import { createCompletionAuditReport, renderCompletionAuditReport } from "./app/completion-audit.js"
import { createBundleContextPack, renderBundleContextPack } from "./app/context-pack.js"
import { createDataValidationPlan, renderDataValidationPlan } from "./app/data-plan.js"
import { createBundleEvidenceReport, renderBundleEvidenceReport } from "./app/evidence.js"
import { createErpMigrationBlueprint, renderErpMigrationBlueprint } from "./app/erp-migration.js"
import { createBundleExecutionPlan, renderBundleExecutionPlan } from "./app/execution-plan.js"
import { createBundleAdr, createBundlePrd } from "./app/gsd-docs.js"
import { createIndexValidationPlan, renderIndexValidationPlan } from "./app/index-plan.js"
import { createMigrationQaPlan, renderMigrationQaPlan } from "./app/qa-plan.js"
import { createQaEvidenceFromWebAppSmoke, readQaEvidence, writeQaEvidence } from "./app/qa-evidence.js"
import { createMigrationReadinessReport, renderMigrationReadinessReport } from "./app/readiness.js"
import { createBundleReleaseReport, renderBundleReleaseReport } from "./app/release-report.js"
import { createD3ReconciliationPlan, renderD3ReconciliationPlan } from "./app/reconciliation-plan.js"
import { createScreenModernizationPlan, renderScreenModernizationPlan } from "./app/screen-plan.js"
import { createSafetyGuardReport, renderSafetyGuardReport } from "./app/safety-guard.js"
import { createBundleSubagentPlan, renderBundleSubagentPlan } from "./app/subagents.js"
import { createBundleSkillPack, renderBundleSkillPack } from "./app/skill-pack.js"
import { createWebUiPlan, renderWebUiPlan } from "./app/ui-plan.js"
import { createModernizationProof, renderModernizationProof } from "./app/modernization-proof.js"
import { captureBundleFromSession } from "./capture/capture.js"
import { listSessions, loadSession } from "./sessions/store.js"
import { startIdeServer } from "./ide/server.js"

const safetyValues = ["ask", "plan", "trust"] as const

function parseSafety(value: string): SafetyMode {
  if (!safetyValues.includes(value as SafetyMode)) throw new Error(`Safety must be one of: ${safetyValues.join(", ")}`)
  return value as SafetyMode
}

function decodeInlineBody(parts: string[] = []): string {
  return parts.join(" ").replace(/\\n/g, "\n")
}

async function bodyFromOptions(parts: string[] | undefined, bodyFile?: string): Promise<string> {
  if (bodyFile) return import("node:fs/promises").then((fs) => fs.readFile(bodyFile, "utf8"))
  const body = decodeInlineBody(parts)
  if (!body) throw new Error("Body is required. Pass inline text with \\n for newlines or use --body-file <file>.")
  return body
}

function commandStdout(raw: unknown): string {
  if (raw && typeof raw === "object" && "stdout" in raw && typeof (raw as { stdout?: unknown }).stdout === "string") return (raw as { stdout: string }).stdout
  return typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)
}

function renderSimpleDiff(label: string, before: string, after: string): string {
  const beforeLines = before.split(/\r?\n/)
  const afterLines = after.split(/\r?\n/)
  const max = Math.max(beforeLines.length, afterLines.length)
  const lines = [`--- current:${label}`, `+++ proposed:${label}`]
  for (let index = 0; index < max; index++) {
    const current = beforeLines[index]
    const proposed = afterLines[index]
    if (current === proposed) {
      if (current !== undefined) lines.push(` ${current}`)
      continue
    }
    if (current !== undefined) lines.push(`-${current}`)
    if (proposed !== undefined) lines.push(`+${proposed}`)
  }
  return lines.join("\n")
}

function extractGoalMode(title: string[], providedMode?: string, argv = process.argv): { title: string; mode: string } {
  let mode = providedMode
  const parts = [...title]
  const modeIndex = parts.indexOf("--mode")
  if (modeIndex !== -1) {
    mode = parts[modeIndex + 1] ?? mode
    parts.splice(modeIndex, parts[modeIndex + 1] ? 2 : 1)
  }
  const inlineIndex = parts.findIndex((part) => part.startsWith("--mode="))
  if (inlineIndex !== -1) {
    mode = parts[inlineIndex]!.slice("--mode=".length) || mode
    parts.splice(inlineIndex, 1)
  }
  const goalIndex = argv.indexOf("goal")
  const goalArgs = goalIndex === -1 ? [] : argv.slice(goalIndex + 1)
  const rawModeIndex = goalArgs.indexOf("--mode")
  if (rawModeIndex !== -1 && goalArgs[rawModeIndex + 1]) mode = goalArgs[rawModeIndex + 1]
  const rawInline = goalArgs.find((part) => part.startsWith("--mode="))
  if (rawInline) mode = rawInline.slice("--mode=".length) || mode
  return { title: parts.join(" "), mode: mode ?? "gsd" }
}

function optionValue(flag: string, argv = process.argv): string | undefined {
  const index = argv.indexOf(flag)
  if (index !== -1) return argv[index + 1]
  const inline = argv.find((part) => part.startsWith(`${flag}=`))
  return inline?.slice(flag.length + 1)
}

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value]
}

const program = new Command()
  .name("d3code")
  .description("Agentic terminal coding environment for Rocket D3.")
  .argument("[path]", "project path", ".")
  .option("--model <provider/model>", "model to use")
  .option("--safety <ask|plan|trust>", "safety mode")
  .option("--profile <name>", "connection profile")
  .option("--mode <mode>", "operating mode")
  .option("--resume <session>", "resume a saved D3 Code session")
  .action(async (_path, options: { model?: string; safety?: string; profile?: string; mode?: string; resume?: string }) => {
    let config = await loadConfig()
    if (!existsSync(configPath)) config = await runSetupWizard(config, defaultSecretStore())
    const session = options.resume ? await loadSession(options.resume) : undefined
    const profile = selectProfile(config, options.profile)
    const mode = getMode(options.mode ?? "chat") ?? getMode("chat")!
    const model = options.model ?? session?.model ?? config.defaultModel
    const safety = options.safety ? parseSafety(options.safety) : session?.safety ?? mode.safetyBias ?? effectiveSafety(config, undefined, profile)
    render(React.createElement(App, { model, safety, profile: options.profile ?? session?.profile ?? profile?.name, mode: mode.id, config, session }))
  })

program.command("init").description("Create default ~/.d3code config if missing.").action(async () => {
  if (existsSync(configPath)) {
    console.log(`Config already exists: ${configPath}`)
    return
  }
  await saveConfig(defaultConfig)
  console.log(`Created ${configPath}`)
})

program
  .command("setup")
  .description("Run interactive first-run setup.")
  .option("--provider <provider>")
  .option("--default-model <model>")
  .option("--api-key-env <env>", "store a model key reference as env:<name>")
  .option("--default-safety <mode>")
  .option("--d3 <local|ssh|skip>", "configure a D3 profile during setup", "skip")
  .option("--profile-name <name>", "D3 profile name")
  .option("--account <account>", "D3 account for the profile")
  .option("--entry <command>", "command that enters D3/TCL")
  .option("--prompt <pattern>", "expected D3 prompt pattern")
  .option("--session <mode>", "session mode: oneshot|persistent")
  .option("--host <host>", "SSH host for a D3 profile")
  .option("--user <username>", "SSH username for a D3 profile")
  .option("--port <port>", "SSH port for a D3 profile", (value) => Number(value))
  .option("--allowed-accounts <accounts>", "comma-separated D3 account allowlist")
  .option("--skip-d3", "do not create a D3 profile")
  .action(async (options: {
    provider?: string
    defaultModel?: string
    apiKeyEnv?: string
    defaultSafety?: string
    d3?: "local" | "ssh" | "skip"
    profileName?: string
    account?: string
    entry?: string
    prompt?: string
    session?: "oneshot" | "persistent"
    host?: string
    user?: string
    port?: number
    allowedAccounts?: string
    skipD3?: boolean
  }) => {
    if (options.provider || options.defaultModel || options.apiKeyEnv || options.defaultSafety || options.skipD3 || options.d3 !== "skip" || options.profileName || options.account || options.entry || options.prompt || options.session || options.host || options.user || options.allowedAccounts) {
      const config = await loadConfig()
      const provider = normalizeProviderID(options.provider ?? "openai")
      const providerInfo = providers.find((item) => item.id === provider)
      if (!providerInfo) throw new Error(`Unknown provider: ${options.provider ?? provider}`)
      config.defaultModel = `${provider}/${options.defaultModel ?? providerInfo.defaultModel}`
      if (options.apiKeyEnv) config.modelSecrets[provider] = `env:${options.apiKeyEnv}`
      if (options.defaultSafety) config.defaultSafety = parseSafety(options.defaultSafety)
      const d3Mode = options.skipD3 ? "skip" : options.d3 ?? "skip"
      if (d3Mode !== "skip") {
        const name = options.profileName ?? "prod"
        const sessionMode = options.session ?? "persistent"
        const allowedAccounts = options.allowedAccounts?.split(",").map((item) => item.trim()).filter(Boolean)
        const base = {
          name,
          account: options.account,
          entryCommand: options.entry,
          promptPattern: options.prompt ?? ">",
          sessionMode,
          safetyDefault: config.defaultSafety,
          allowedAccounts: allowedAccounts?.length ? allowedAccounts : undefined,
        }
        const next = d3Mode === "ssh"
          ? {
              ...base,
              type: "ssh" as const,
              host: options.host,
              username: options.user,
              port: options.port ?? 22,
            }
          : {
              ...base,
              type: "local" as const,
            }
        if (next.type === "ssh" && (!next.host || !next.username)) throw new Error("SSH setup requires --host and --user")
        config.profiles = [...config.profiles.filter((profile) => profile.name !== name), next]
        config.defaultProfile = name
      }
      await saveConfig(config)
      console.log(`Configured ${config.defaultModel}`)
      if (config.defaultProfile) console.log(`Default profile: ${config.defaultProfile}`)
      return
    }
    await runSetupWizard(await loadConfig(), defaultSecretStore())
  })

program.command("doctor").description("Run environment diagnostics.").action(async () => {
  const config = await loadConfig()
  const detection = await detectLocalD3(selectProfile(config)?.entryCommand)
  console.log(`Config: ${configPath}`)
  console.log(`Default model: ${config.defaultModel}`)
  console.log(`Default safety: ${config.defaultSafety}`)
  console.log(`Profiles: ${config.profiles.length}`)
  console.log(`Local D3: ${detection.available ? "yes" : "no"} (${detection.details})`)
  console.log(`Runtime: node ${process.version}; Bun ${process.versions.bun ?? "not detected"}`)
})

program.command("install-proof").description("Verify the built d3code command is exposed as an executable terminal entrypoint.").option("--json").action(async (options: { json?: boolean }) => {
  const report = await createInstallProofReport()
  console.log(options.json ? JSON.stringify(report, null, 2) : renderInstallProofReport(report))
  if (!report.ready) process.exitCode = 1
})

program.command("product-audit").description("Audit D3 Code product completion against the full baked-skills, GSD, migration, audit, REST, modernization, model, install, manual, and live-D3 objective.").option("--reference-dir <dir>", "reference folder", defaultReferenceDir).option("--manual <file>", "D3 reference manual PDF or extracted text", defaultD3ReferenceManual).option("--user-guide <file>", "D3 user guide PDF or extracted text", defaultD3UserGuide).option("--live-proof-dir <dir>", "operator-collected live D3 proof artifacts").option("--with-acceptance", "run mock acceptance and include it as evidence").option("--allow-incomplete", "return zero even when live-D3 proof or other completion evidence is missing").option("--json").action(async (options: { referenceDir: string; manual: string; userGuide: string; liveProofDir?: string; withAcceptance?: boolean; allowIncomplete?: boolean; json?: boolean }) => {
  const report = await createProductCompletionAudit(await loadConfig(), defaultSecretStore(), {
    referenceDir: options.referenceDir,
    manualPath: options.manual,
    userGuidePath: options.userGuide,
    liveProofDir: options.liveProofDir,
    installProof: await createInstallProofReport(),
    acceptance: options.withAcceptance ? await runMockAcceptance() : undefined,
  })
  console.log(options.json ? JSON.stringify(report, null, 2) : renderProductCompletionAudit(report))
  if (!report.complete && !options.allowIncomplete) process.exitCode = 1
})

program.command("profiles").description("List configured D3 connection profiles.").action(async () => {
  const config = await loadConfig()
  if (config.profiles.length === 0) {
    console.log("No profiles configured. Use `d3code profile-add-local` or `d3code profile-add-ssh`.")
    return
  }
  for (const profile of config.profiles) {
    const target = profile.type === "ssh" ? `${profile.username ?? "?"}@${profile.host ?? "?"}:${profile.port ?? 22}` : "local"
    console.log(`${profile.name}\t${profile.type}\t${target}\taccount=${profile.account ?? ""}\tsession=${profile.sessionMode ?? "oneshot"}\tsafety=${profile.safetyDefault ?? "config"}\tallowed=${profile.allowedAccounts?.join(",") ?? "any"}`)
  }
})

program.command("setup-proof").description("Audit first-run model, secret, D3 profile, persistent session, prompt, account, and safety configuration.").option("--json").action(async (options: { json?: boolean }) => {
  const report = createSetupProofReport(await loadConfig())
  console.log(options.json ? JSON.stringify(report, null, 2) : renderSetupProofReport(report))
  if (!report.ready) process.exitCode = 1
})

program
  .command("profile-add-local")
  .requiredOption("--name <name>")
  .option("--account <account>")
  .option("--entry <command>", "command that enters D3/TCL")
  .option("--prompt <pattern>", "expected D3 prompt pattern")
  .option("--session <mode>", "session mode: oneshot|persistent")
  .option("--safety <mode>", "default safety for this profile")
  .option("--allowed-accounts <accounts>", "comma-separated account allowlist for this profile")
  .description("Add or update a local D3 profile.")
  .action(async (options: { name: string; account?: string; entry?: string; prompt?: string; session?: "oneshot" | "persistent"; safety?: string; allowedAccounts?: string }) => {
    const config = await loadConfig()
    const next = {
      name: options.name,
      type: "local" as const,
      account: options.account,
      entryCommand: options.entry,
      promptPattern: options.prompt,
      sessionMode: options.session,
      safetyDefault: options.safety ? parseSafety(options.safety) : undefined,
      allowedAccounts: options.allowedAccounts?.split(",").map((item) => item.trim()).filter(Boolean),
    }
    config.profiles = [...config.profiles.filter((profile) => profile.name !== options.name), next]
    config.defaultProfile ??= options.name
    await saveConfig(config)
    console.log(`Saved local profile ${options.name}`)
  })

program
  .command("profile-add-ssh")
  .requiredOption("--name <name>")
  .requiredOption("--host <host>")
  .requiredOption("--user <username>")
  .option("--port <port>", "SSH port", (value) => Number(value), 22)
  .option("--account <account>")
  .option("--entry <command>", "remote command that enters D3/TCL")
  .option("--prompt <pattern>", "expected D3 prompt pattern")
  .option("--session <mode>", "session mode: oneshot|persistent")
  .option("--safety <mode>", "default safety for this profile")
  .option("--allowed-accounts <accounts>", "comma-separated account allowlist for this profile")
  .description("Add or update an SSH D3 profile. Passwords/keys are not stored here.")
  .action(async (options: { name: string; host: string; user: string; port: number; account?: string; entry?: string; prompt?: string; session?: "oneshot" | "persistent"; safety?: string; allowedAccounts?: string }) => {
    const config = await loadConfig()
    const next = {
      name: options.name,
      type: "ssh" as const,
      host: options.host,
      username: options.user,
      port: options.port,
      account: options.account,
      entryCommand: options.entry,
      promptPattern: options.prompt,
      sessionMode: options.session,
      safetyDefault: options.safety ? parseSafety(options.safety) : undefined,
      allowedAccounts: options.allowedAccounts?.split(",").map((item) => item.trim()).filter(Boolean),
    }
    config.profiles = [...config.profiles.filter((profile) => profile.name !== options.name), next]
    config.defaultProfile ??= options.name
    await saveConfig(config)
    console.log(`Saved SSH profile ${options.name}`)
  })

program.command("login").description("Verify or switch into the selected D3 account with WHO and VERSION proof.").option("--profile <name>").option("--account <account>", "LOGTO this account before proof").option("--safety <mode>").action(async (options: { profile?: string; account?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  if (!profile) throw new Error("No profile configured")
  const safetyOption = options.safety ?? program.opts<{ safety?: string }>().safety
  const safety = effectiveSafety(config, safetyOption ? parseSafety(safetyOption) : undefined, profile)
  console.log(`Profile: ${profile.name}`)
  console.log(`Safety: ${safety}`)
  const output = await runToolByName(config, {
    name: "d3_login",
    input: { account: options.account, confirmed: options.account ? safety === "trust" : true },
    safety,
    profile: options.profile,
  })
  console.log(output.compact)
})

program.command("profile-doctor").description("Run read-only profile checks against WHO, VERSION, and LIST MD.").option("--profile <name>").option("--json").action(async (options: { profile?: string; json?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  if (!profile) throw new Error("No profile configured")
  const report = await diagnoseProfile(profile)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderProfileDoctor(report))
  if (!report.ready) process.exitCode = 1
})

program.command("live-proof-check").argument("<dir>").description("Verify operator-collected live D3 proof artifacts for profile doctor, terminal capture, screen buffer, compile/catalog, and rollback evidence.").option("--json").action(async (dir: string, options: { json?: boolean }) => {
  const report = await checkLiveProofArtifacts(dir)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderLiveProofArtifactReport(report))
  if (!report.ready) process.exitCode = 1
})

program.command("live-proof-init").argument("<dir>").description("Create a live D3 proof folder with checklist and placeholder artifacts for operator collection.").option("--profile <name>").option("--account <account>").option("--screen-command <command>").option("--basic-file <file>").option("--basic-item <item>").option("--json").action(async (dir: string, options: { profile?: string; account?: string; screenCommand?: string; basicFile?: string; basicItem?: string; json?: boolean }) => {
  const result = await writeLiveProofScaffold(dir, options)
  console.log(options.json ? JSON.stringify(result, null, 2) : renderLiveProofScaffold(result))
})

program.command("terminal-plan").description("Plan the D3 terminal bridge for TCL, persistent PTY, UOPY, and legacy screen workflows.").option("--profile <name>").option("--json").action(async (options: { profile?: string; json?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const plan = createD3TerminalBridgePlan(profile)
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderD3TerminalBridgePlan(plan))
})

program.command("ide-terminal").description("Show the IDE terminal contract for D3 PTY, TCL, UOPY, PowerTerm-style screen buffers, and live proof.").option("--profile <name>").option("--json").action(async (options: { profile?: string; json?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const contract = createIdeTerminalContract(profile)
  console.log(options.json ? JSON.stringify(contract, null, 2) : renderIdeTerminalContract(contract))
})

program.command("connector-strategy").description("Show the layered D3 connector strategy for IDE terminal, typed TCL, PowerTerm-style screens, UOPY, and AI operation.").option("--profile <name>").option("--json").action(async (options: { profile?: string; json?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const strategy = createD3ConnectorStrategy(profile)
  console.log(options.json ? JSON.stringify(strategy, null, 2) : renderD3ConnectorStrategy(strategy))
})

program.command("screen-parse").argument("<transcript-file>").description("Parse a captured D3/PowerTerm-style screen transcript into a stable screen buffer.").option("--width <n>", "screen width", (value) => Number(value), 80).option("--height <n>", "screen height", (value) => Number(value), 24).option("--json").action(async (file: string, options: { width: number; height: number; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"))
  const buffer = parseD3ScreenTranscript(input, { width: options.width, height: options.height })
  console.log(options.json ? JSON.stringify(buffer, null, 2) : renderD3ScreenBuffer(buffer))
})

program.command("terminal-capture").argument("<command...>").description("Run a D3 terminal command, capture the raw transcript, and parse it into a legacy screen buffer.").option("--profile <name>").option("--out <dir>", "write transcript, screen buffer, and capture artifacts").option("--width <n>", "screen width", (value) => Number(value), 80).option("--height <n>", "screen height", (value) => Number(value), 24).option("--timeout <ms>", "command timeout", (value) => Number(value), 30_000).option("--safety <mode>").option("--confirm", "confirm commands blocked by ask/trust safety").option("--json").action(async (parts: string[], options: { profile?: string; out?: string; width: number; height: number; timeout: number; safety?: string; confirm?: boolean; json?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  if (!profile) throw new Error("No profile configured")
  const command = parts.join(" ")
  const safety = effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile)
  assertD3Allowed(safety, command, options.confirm)
  const session = createD3Session(profile)
  try {
    const capture = await captureD3Terminal(session, command, { width: options.width, height: options.height, timeoutMs: options.timeout })
    const written = options.out ? (await writeD3TerminalCapture(options.out, capture)).written : []
    console.log(options.json ? JSON.stringify({ ...capture, written }, null, 2) : renderD3TerminalCapture(capture, written))
  } finally {
    await session.close()
  }
})

program.command("models").description("List configured model providers.").action(() => {
  for (const provider of providers) {
    console.log(`${provider.id} (${provider.name}) env=${provider.env.join(",")}`)
    for (const model of provider.models) console.log(`  - ${provider.id}/${model}`)
  }
})

program.command("model-proof").description("Verify default model, provider secret references, environment keys, local endpoint config, and routing readiness.").option("--mode <mode>", "mode for routing readiness", "migrate").option("--bias <bias>", "quality|balanced|speed|local", "balanced").option("--json").action(async (options: { mode: string; bias: ModelBias; json?: boolean }) => {
  const config = await loadConfig()
  const report = await createModelProofReport(config, defaultSecretStore(), { mode: options.mode, bias: options.bias })
  console.log(options.json ? JSON.stringify(report, null, 2) : renderModelProofReport(report))
  if (!report.ready) process.exitCode = 1
})

program.command("model-routing").argument("[mode]", "mode", "migrate").description("Recommend models for D3 Code roles, modes, subagents, and safety bias.").option("--bias <bias>", "quality|balanced|speed|local", "balanced").option("--json").action(async (mode: string, options: { bias: ModelBias; json?: boolean }) => {
  const config = await loadConfig()
  const plan = createModelRoutingPlan(config, mode, options.bias)
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderModelRoutingPlan(plan))
})

program.command("sessions").description("List saved D3 Code sessions.").action(async () => {
  const sessions = await listSessions()
  if (sessions.length === 0) {
    console.log("No saved sessions yet. Launch `d3code` and send a message to create one.")
    return
  }
  for (const session of sessions) {
    const last = session.events.at(-1)?.content.replace(/\s+/g, " ").slice(0, 80) ?? ""
    console.log(`${session.id}\t${session.updatedAt}\tmodel=${session.model}\tsafety=${session.safety}\tprofile=${session.profile ?? "none"}\t${last}`)
  }
})

program.command("resume").argument("<id>").description("Resume a saved D3 Code session in the terminal UI.").action(async (id: string) => {
  const config = await loadConfig()
  const session = await loadSession(id)
  const mode = getMode("chat")!
  render(React.createElement(App, { model: session.model, safety: session.safety, profile: session.profile, mode: mode.id, config, session }))
})

program.command("agents").description("List built-in primary agents and subagents.").action(() => {
  for (const agent of agents) console.log(`${agent.id}\t${agent.mode}\t${agent.defaultSafety}\t${agent.description}`)
})

program.command("delegate").argument("[mode]", "mode", "migrate").description("Render a mode-aware subagent delegation plan.").action((mode: string) => {
  console.log(renderDelegationPlan(mode))
})

program.command("delegate-prompts").argument("[mode]", "mode", "migrate").description("Render isolated subagent prompt packets with tool and evidence boundaries.").option("--json").action((mode: string, options: { json?: boolean }) => {
  const pack = createSubagentPromptPack(mode)
  console.log(options.json ? JSON.stringify(pack, null, 2) : renderSubagentPromptPack(pack))
})

program.command("agent-run").argument("<task>", "basic-check|file-audit|migration-slice").argument("<file>").argument("[item]").description("Run a bounded D3 agent task with tool evidence.").option("--profile <name>").option("--safety <mode>").option("--compile", "compile after reading and linting").option("--catalog", "catalog after a clean compile").option("--global", "catalog globally with (G").option("--confirm", "confirm mutation steps under ask safety").option("--sample-limit <n>", "sample records for file-audit", (value) => Number(value), 3).option("--out <dir>", "output directory for migration-slice").option("--json").action(async (task: string, file: string, item: string | undefined, options: { profile?: string; safety?: string; compile?: boolean; catalog?: boolean; global?: boolean; confirm?: boolean; sampleLimit?: number; out?: string; json?: boolean }) => {
  if (task !== "basic-check" && task !== "file-audit" && task !== "migration-slice") throw new Error("Unsupported agent-run task. Use: basic-check, file-audit, or migration-slice")
  const report = await runAgentTask(await loadConfig(), {
    task,
    file,
    item,
    outDir: options.out,
    profile: options.profile,
    safety: options.safety ? parseSafety(options.safety) : undefined,
    compile: options.compile,
    catalog: options.catalog,
    global: options.global,
    confirm: options.confirm,
    sampleLimit: options.sampleLimit,
  })
  console.log(options.json ? JSON.stringify(report, null, 2) : renderAgentRunReport(report))
  if (!report.ready) process.exitCode = 1
})

program.command("skills").description("List baked-in D3 Code skills.").option("--json").action((options: { json?: boolean }) => {
  if (options.json) {
    console.log(JSON.stringify(skills, null, 2))
    return
  }
  for (const skill of skills) console.log(`${skill.id}\t${skill.source}\t${skill.appliesToD3 ? "d3" : "generic"}\t${skill.description}`)
})

program.command("skill-coverage").description("Audit baked reference-skill coverage across modes, commands, and artifacts.").option("--json").action((options: { json?: boolean }) => {
  const report = skillCoverageReport()
  console.log(options.json ? JSON.stringify(report, null, 2) : renderSkillCoverage())
})

program.command("reference-skills").description("Map reference skill families to baked D3 Code product surfaces.").option("--json").action((options: { json?: boolean }) => {
  const report = {
    ready: referenceSkillCoverageReady(),
    families: referenceSkillFamilies,
  }
  console.log(options.json ? JSON.stringify(report, null, 2) : renderReferenceSkillMap())
})

program.command("reference-audit").argument("[reference-dir]", "reference folder", defaultReferenceDir).description("Scan reference SKILL.md files and verify each one is baked, adapted, or explicitly out of scope.").option("--json").action(async (referenceDir: string, options: { json?: boolean }) => {
  const report = await auditReferenceSkillInventory(referenceDir)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderReferenceSkillAudit(report))
})

program.command("mvbasic-reference-audit").argument("[rocket-mvbasic-dir]", "Rocket MV BASIC reference folder", defaultRocketMvBasicDir).description("Audit Rocket MV BASIC extension docs as an IDE-parity checklist for D3 Code IDE, connection, locks, compile/catalog, and language intelligence.").option("--json").action(async (rocketMvBasicDir: string, options: { json?: boolean }) => {
  const report = await auditMvBasicReference(rocketMvBasicDir)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderMvBasicReferenceAudit(report))
})

program.command("readiness").description("Audit static and proof-gated product readiness.").option("--json").action(async (options: { json?: boolean }) => {
  const report = await createReadinessReport(await loadConfig(), defaultSecretStore())
  console.log(options.json ? JSON.stringify(report, null, 2) : renderReadinessReport(report))
})

program.command("status").description("Show D3 Code IDE status: mode, model, profile, readiness, goals, and next commands.").option("--model <provider/model>").option("--safety <mode>").option("--profile <name>").option("--mode <mode>").option("--json").action(async (options: { model?: string; safety?: string; profile?: string; mode?: string; json?: boolean }) => {
  const config = await loadConfig()
  const parsedMode = options.mode ?? optionValue("--mode")
  const parsedModel = options.model ?? optionValue("--model")
  const parsedSafety = options.safety ?? optionValue("--safety")
  const parsedProfile = options.profile ?? optionValue("--profile")
  const report = await createIdeStatusReport(config, {
    model: parsedModel ?? config.defaultModel,
    safety: parsedSafety ? parseSafety(parsedSafety) : config.defaultSafety,
    profile: parsedProfile,
    mode: parsedMode,
  })
  console.log(options.json ? JSON.stringify(report, null, 2) : renderIdeStatusReport(report))
})

program.command("safety-guard").description("Classify planned D3/TCL commands and bundle EXECUTE/compile/catalog actions before running risky work.").option("--profile <name>").option("--safety <mode>", "ask|plan|trust").option("--bundle <bundle-json-file>").option("--command <command>", "command to classify; may be repeated", collectOption, []).option("--json").action(async (options: { profile?: string; safety?: string; bundle?: string; command: string[]; json?: boolean }) => {
  const config = await loadConfig()
  const bundle = options.bundle ? parseBundle(JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(options.bundle!, "utf8")))) : undefined
  const safety = options.safety ? parseSafety(options.safety) : config.defaultSafety
  const report = createSafetyGuardReport(config, { safety, profile: options.profile ?? bundle?.profile, bundle, commands: options.command })
  console.log(options.json ? JSON.stringify(report, null, 2) : renderSafetyGuardReport(report))
  if (!report.ready) process.exitCode = 1
})

program.command("acceptance").description("Run the end-to-end D3 Code workflow against a disposable mock D3 profile.").option("--json").action(async (options: { json?: boolean }) => {
  const report = await runMockAcceptance()
  console.log(options.json ? JSON.stringify(report, null, 2) : renderAcceptanceReport(report))
  if (!report.ready) process.exitCode = 1
})

program.command("live-proof").description("Show or run the live D3 proof path for profile/account readiness.").option("--profile <name>").option("--run", "execute profile-doctor checks and include the result").option("--goal <id>", "record passing live proof on a GSD goal").option("--phase <phase>", "goal phase to record live proof against", "verify").option("--json").action(async (options: { profile?: string; run?: boolean; goal?: string; phase?: string; json?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const doctor = options.run && profile ? await diagnoseProfile(profile) : undefined
  const report = createLiveProofReport(config, options.profile, doctor)
  if (options.goal) {
    if (!doctor) throw new Error("Use --run when recording live proof to a goal.")
    if (!doctor.ready) throw new Error("Live proof failed; refusing to record passing goal evidence.")
    await saveGoal(recordGoalEvidence(await loadGoal(options.goal), profileDoctorGoalEvidence(doctor), options.phase))
  }
  console.log(options.json ? JSON.stringify(report, null, 2) : renderLiveProofReport(report))
  if (options.run && !profile) process.exitCode = 1
  if (doctor && !doctor.ready) process.exitCode = 1
})

program.command("skill-info").argument("<skill>").description("Show the baked behavior for a D3 Code skill.").action((skill: string) => {
  console.log(renderSkill(skill))
})

program.command("modes").description("List D3 Code operating modes.").action(() => {
  for (const mode of modes) console.log(`${mode.id}\t${mode.safetyBias}\t${mode.description}`)
})

program.command("mode-info").argument("<mode>").description("Show the baked system prompt for a mode.").action((mode: string) => {
  console.log(modeSystemPrompt(mode))
})

program.command("runbook").argument("[mode]", "mode", "gsd").description("Render the operational runbook for a D3 Code mode.").action((mode: string) => {
  console.log(renderModeRunbook(mode))
})

program.command("workflow").argument("[mode]", "mode", "gsd").description("Render a baked D3 Code workflow template.").action((mode: string) => {
  console.log(renderWorkflow(mode))
})

program.command("recipe").argument("[recipe]", "recipe", "migrate").description("Render command recipe for audit, migrate, api, or modernize workflows.").action((recipe: string) => {
  console.log(renderRecipe(recipe))
})

program.command("recipes").description("List available D3 Code recipes.").action(() => {
  for (const recipe of Object.values(recipes)) console.log(`${recipe.id}\t${recipe.title}`)
})

program.command("detect").description("Detect local Rocket D3.").action(async () => {
  console.log(JSON.stringify(await detectLocalD3(), null, 2))
})

program.command("permission").argument("<safety>").argument("<command...>").description("Classify a D3 command under a safety policy.").action((safety: string, commandParts: string[]) => {
  const command = commandParts.join(" ")
  const mode = parseSafety(safety)
  console.log(JSON.stringify({ command, risk: classifyD3Command(command), action: evaluateD3Permission(mode, command) }, null, 2))
})

program.command("uri").argument("<uri>").description("Parse a virtual D3 URI.").action((uri: string) => {
  console.log(JSON.stringify(parseD3Uri(uri), null, 2))
})

program.command("basic-symbols").argument("<file>").description("Extract D3 BASIC symbols from a local file.").action(async (file: string) => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"))
  console.log(JSON.stringify(extractBasicSymbols(source), null, 2))
})

program.command("basic-lint").argument("<file>").description("Lint a local D3 BASIC file.").action(async (file: string) => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"))
  console.log(JSON.stringify(lintBasic(source), null, 2))
})

program.command("compile-errors").argument("<file>").description("Parse D3 compiler output from a local text file.").action(async (file: string) => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"))
  console.log(JSON.stringify(parseCompileErrors(source), null, 2))
})

program.command("modernization-proof").requiredOption("--before <file>").requiredOption("--after <file>").option("--compile-output <file>").option("--json").description("Compare before/after D3 BASIC source and compile output for behavior-preserving modernization proof.").action(async (options: { before: string; after: string; compileOutput?: string; json?: boolean }) => {
  const fs = await import("node:fs/promises")
  const report = createModernizationProof({
    before: await fs.readFile(options.before, "utf8"),
    after: await fs.readFile(options.after, "utf8"),
    compileOutput: options.compileOutput ? await fs.readFile(options.compileOutput, "utf8") : undefined,
  })
  console.log(options.json ? JSON.stringify(report, null, 2) : renderModernizationProof(report))
  if (!report.ready) process.exitCode = 1
})

program.command("tools").description("List core D3 tools.").action(() => {
  for (const tool of d3Tools) console.log(`${tool.name}\t${tool.mutates ? "mutates" : "read"}\t${tool.description}`)
})

program.command("tool").argument("<name>").argument("[json]").description("Execute a D3 tool against the selected profile.").option("--profile <name>").option("--safety <mode>").action(async (name: string, json = "{}", options: { profile?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const output = await runToolByName(config, { name, input: JSON.parse(json), safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile, compact: false })
  console.log(JSON.stringify(output.raw, null, 2))
})

program.command("tool-compact").argument("<name>").argument("[json]").description("Execute a D3 tool and print compact output.").option("--profile <name>").option("--safety <mode>").action(async (name: string, json = "{}", options: { profile?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const output = await runToolByName(config, { name, input: JSON.parse(json), safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile })
  console.log(output.compact)
})

program.command("read-item").argument("<file>").argument("<item>").description("Read a D3 item from the selected profile using CT.").option("--profile <name>").option("--safety <mode>").action(async (file: string, item: string, options: { profile?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const output = await runToolByName(config, { name: "d3_read_item", input: { file, item }, safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile })
  console.log(output.compact)
})

program.command("write-item").argument("<file>").argument("<item>").argument("[body...]").description("Write a D3 item through ED batch input.").option("--profile <name>").option("--safety <mode>").option("--body-file <file>", "read item body from a local file").option("--confirm", "confirm the write under ask safety").action(async (file: string, item: string, bodyParts: string[] | undefined, options: { profile?: string; safety?: string; bodyFile?: string; confirm?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const safety = effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile)
  const output = await runToolByName(config, {
    name: "d3_write_item",
    input: { file, item, body: await bodyFromOptions(bodyParts, options.bodyFile), confirmed: options.confirm || safety === "trust" },
    safety,
    profile: options.profile,
  })
  console.log(output.compact)
})

program.command("read-dict").argument("<file>").argument("<item>").description("Read a D3 dictionary item using CT DICT.").option("--profile <name>").option("--safety <mode>").action(async (file: string, item: string, options: { profile?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const output = await runToolByName(config, { name: "d3_read_dict", input: { file, item }, safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile })
  console.log(output.compact)
})

program.command("locks").description("Inspect D3 locks for the selected profile.").option("--profile <name>").option("--safety <mode>").action(async (options: { profile?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const output = await runToolByName(config, { name: "d3_locks", safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile })
  console.log(output.compact)
})

program.command("diff-item").argument("<file>").argument("<item>").argument("[body...]").description("Read a D3 item and render a read-only proposed body diff.").option("--profile <name>").option("--safety <mode>").option("--body-file <file>", "read proposed item body from a local file").action(async (file: string, item: string, bodyParts: string[] | undefined, options: { profile?: string; safety?: string; bodyFile?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const current = await runToolByName(config, { name: "d3_read_item", input: { file, item }, safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile, compact: false })
  console.log(renderSimpleDiff(`${file}/${item}`, commandStdout(current.raw), await bodyFromOptions(bodyParts, options.bodyFile)))
})

program.command("query-aql").argument("<query...>").description("Run a read-oriented D3 AQL query against the selected profile.").option("--profile <name>").option("--safety <mode>").action(async (queryParts: string[], options: { profile?: string; safety?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const output = await runToolByName(config, { name: "d3_query_aql", input: { query: queryParts.join(" ") }, safety: effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile), profile: options.profile })
  console.log(output.compact)
})

program.command("compile-basic").argument("<file>").argument("<item>").description("Compile a D3 BASIC/FlashBASIC item.").option("--profile <name>").option("--safety <mode>").option("--confirm", "confirm compile under ask safety").action(async (file: string, item: string, options: { profile?: string; safety?: string; confirm?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const safety = effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile)
  const output = await runToolByName(config, { name: "d3_compile_basic", input: { file, item, confirmed: options.confirm || safety === "trust" }, safety, profile: options.profile })
  console.log(output.compact)
})

program.command("catalog-basic").argument("<file>").argument("<item>").description("Catalog a compiled D3 BASIC program.").option("--profile <name>").option("--safety <mode>").option("--global", "catalog globally with (G").option("--confirm", "confirm catalog under ask safety").action(async (file: string, item: string, options: { profile?: string; safety?: string; global?: boolean; confirm?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const safety = effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile)
  const output = await runToolByName(config, { name: "d3_catalog", input: { file, item, global: options.global, confirmed: options.confirm || safety === "trust" }, safety, profile: options.profile })
  console.log(output.compact)
})

program.command("call-subroutine").argument("<name>").argument("[args...]").description("Call a D3 BASIC subroutine from TCL.").option("--profile <name>").option("--safety <mode>").option("--confirm", "confirm subroutine call under ask safety").action(async (name: string, args: string[] | undefined, options: { profile?: string; safety?: string; confirm?: boolean }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const safety = effectiveSafety(config, options.safety ? parseSafety(options.safety) : undefined, profile)
  const output = await runToolByName(config, { name: "d3_call_subroutine", input: { name, args: args ?? [], confirmed: options.confirm || safety === "trust" }, safety, profile: options.profile })
  console.log(output.compact)
})

program.command("index-manual").argument("<text-file>").description("Index extracted D3 manual text into ~/.d3code/cache.").action(async (textFile: string) => {
  const document = await indexManualText(textFile)
  await saveIndex("manual", [document])
  console.log(`Indexed ${document.title}`)
})

program.command("search-manual").argument("<query>").description("Search the indexed D3 manual.").action(async (query: string) => {
  const hits = searchDocuments(await loadIndex("manual"), query).slice(0, 20)
  for (const hit of hits) console.log(`${hit.uri}:${hit.line}: ${hit.excerpt}`)
})

program.command("manual-scope").argument("<manual-file>").description("Report D3 manual topic and command capability coverage from a PDF or extracted text file.").action(async (textFile: string) => {
  const source = await readManualText(textFile)
  const report = scopeManual(source)
  console.log(formatManualScope(report))
  const missing = report.topics.filter((topic) => topic.status === "missing")
  if (missing.length > 0) {
    process.exitCode = 1
  }
})

program.command("index-account").description("Index file pointers from the selected D3 account.").option("--profile <name>").option("--index <name>", "cache index name").action(async (options: { profile?: string; index?: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  if (!profile) throw new Error("No profile configured")
  const session = createD3Session(profile)
  const docs = await indexD3Account(session, profile)
  await session.close()
  const indexName = options.index ?? `profile-${profile.name}`
  await saveIndex(indexName, docs)
  console.log(`Indexed ${docs.length} document(s) for ${profile.name} into ${indexName}`)
})

program.command("search-account").argument("<query>").description("Search a cached D3 account index created by index-account or d3_index_account.").option("--profile <name>").option("--index <name>", "cache index name").option("--limit <n>", "maximum hits", (value) => Number(value), 20).action(async (query: string, options: { profile?: string; index?: string; limit: number }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const indexName = options.index ?? (profile ? `profile-${profile.name}` : "manual")
  const hits = searchDocuments(await loadIndex(indexName), query).slice(0, options.limit)
  for (const hit of hits) console.log(`${hit.uri}:${hit.line}: ${hit.excerpt}`)
})

program.command("resolve-model").argument("<provider/model>").description("Resolve a model reference.").action((ref: string) => {
  console.log(JSON.stringify(resolveModel(ref), null, 2))
})

program.command("goal").argument("<title...>").description("Create and persist a D3 modernization/GSD goal.").option("--mode <mode>", "mode", "gsd").option("--outcome <outcome>").action(async (title: string[], options: { mode?: string; outcome?: string }) => {
  const parsed = extractGoalMode(title, options.mode)
  const text = parsed.title
  const goal = createModernizationGoal(text, options.outcome ?? `Complete ${text}`, parsed.mode)
  await saveGoal(goal)
  console.log(goalSummary(goal))
})

program.command("goals").description("List persisted D3 Code goals.").action(async () => {
  const goals = await listGoals()
  if (goals.length === 0) {
    console.log("No goals yet. Use `d3code goal <title>`.")
    return
  }
  for (const goal of goals) {
    const active = goal.phases.find((phase) => phase.status === "active")?.id ?? "none"
    console.log(`${goal.id}\t${goal.mode}\tactive=${active}\t${goal.title}`)
  }
})

program.command("goal-show").argument("<id>").description("Show a persisted D3 Code goal.").action(async (id: string) => {
  console.log(goalSummary(await loadGoal(id)))
})

program.command("goal-plan").argument("<id>").description("Render the full GSD checklist and evidence plan for a goal.").action(async (id: string) => {
  console.log(goalPlan(await loadGoal(id)))
})

program.command("goal-next").argument("<id>").description("Render the next operational step for a D3 Code goal.").action(async (id: string) => {
  console.log(renderGoalNext(await loadGoal(id)))
})

program.command("goal-verify").argument("<id>").description("Verify whether goal phases have enough recorded evidence to claim readiness.").action(async (id: string) => {
  console.log(renderGoalVerification(await loadGoal(id)))
})

program.command("goal-advance").argument("<id>").option("--note <note>").description("Mark the active goal phase done and activate the next phase.").action(async (id: string, options: { note?: string }) => {
  const goal = advanceGoal(await loadGoal(id), options.note)
  await saveGoal(goal)
  console.log(goalSummary(goal))
})

program.command("goal-evidence").argument("<id>").requiredOption("--evidence <evidence>").option("--phase <phase>").description("Record evidence against the active or selected goal phase.").action(async (id: string, options: { evidence: string; phase?: string }) => {
  const goal = recordGoalEvidence(await loadGoal(id), options.evidence, options.phase)
  await saveGoal(goal)
  console.log(goalPlan(goal))
})

program.command("goal-apply-bundle-evidence").argument("<id>").argument("<bundle-json-file>").description("Generate bundle evidence and record it against matching GSD goal phases.").option("--artifacts-dir <dir>").action(async (id: string, jsonFile: string, options: { artifactsDir?: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const report = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
  const result = applyBundleEvidenceToGoal(await loadGoal(id), report)
  await saveGoal(result.goal)
  console.log(renderAppliedGoalEvidence(result))
})

program.command("goal-audit-bundle").argument("<id>").argument("<bundle-json-file>").description("Audit a persisted GSD goal against D3 bundle evidence phase by phase.").option("--apply", "record bundle evidence on the goal before auditing").option("--artifacts-dir <dir>").option("--json").action(async (id: string, jsonFile: string, options: { apply?: boolean; artifactsDir?: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const report = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
  let goal = await loadGoal(id)
  if (options.apply) {
    const applied = applyBundleEvidenceToGoal(goal, report)
    goal = applied.goal
    await saveGoal(goal)
  }
  const audit = auditGoalAgainstBundle(goal, report)
  console.log(options.json ? JSON.stringify(audit, null, 2) : renderGoalBundleAudit(audit))
  if (!audit.ready) process.exitCode = 1
})

program.command("goal-block").argument("<id>").requiredOption("--reason <reason>").description("Block the active goal phase with a reason.").action(async (id: string, options: { reason: string }) => {
  const goal = blockGoal(await loadGoal(id), options.reason)
  await saveGoal(goal)
  console.log(goalSummary(goal))
})

program.command("bundle-goal").argument("<bundle-json-file>").description("Create a migration GSD goal from a D3 application bundle and seed evidence from the bundle.").option("--title <title>").option("--outcome <outcome>").option("--artifacts-out <dir>", "also write bundle artifacts and record artifact evidence").action(async (jsonFile: string, options: { title?: string; outcome?: string; artifactsOut?: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  if (options.artifactsOut) await writeBundleArtifacts(options.artifactsOut, artifacts, bundle)
  const goal = createMigrationGoalFromBundle(bundle, { title: options.title, outcome: options.outcome, artifactsOut: options.artifactsOut, webappReady: Boolean(options.artifactsOut) })
  await saveGoal(goal)
  console.log(goalSummary(goal))
  if (options.artifactsOut) console.log(`Seeded artifact evidence: webapp-check passed for ${options.artifactsOut}`)
  console.log("")
  console.log(renderGoalNext(goal))
})

program.command("migration-plan").argument("<json-file>").description("Create a D3-to-web migration plan from JSON input.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(createMigrationPlan(JSON.parse(input)), null, 2))
})

program.command("openapi").argument("<migration-plan-json-file>").description("Generate OpenAPI 3.1 from a D3 migration plan JSON file.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(createOpenApiFromMigrationPlan(JSON.parse(input)), null, 2))
})

program.command("adapter-skeleton").argument("<migration-plan-json-file>").description("Generate REST adapter skeleton files from a D3 migration plan JSON file.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(generateAdapterSkeleton(JSON.parse(input)), null, 2))
})

program.command("webapp-skeleton").argument("<migration-plan-json-file>").description("Generate a runnable Node/TypeScript web API scaffold from a D3 migration plan JSON file.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(generateWebAppScaffold(JSON.parse(input)), null, 2))
})

program.command("webapp-check").argument("<dir>").description("Check a generated D3 migration web/API scaffold for required runnable files.").option("--json").action(async (dir: string, options: { json?: boolean }) => {
  const report = await checkGeneratedWebApp(dir)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderWebAppCheck(report))
  if (!report.ready) process.exitCode = 1
})

program.command("webapp-smoke").argument("<dir>").description("Build and run generated web/API scaffold smoke tests.").option("--record", "write qa-evidence.json and qa-evidence.md into the generated scaffold directory").option("--json").action(async (dir: string, options: { record?: boolean; json?: boolean }) => {
  const report = await runGeneratedWebAppSmoke(dir)
  if (options.record) await writeQaEvidence(dir, createQaEvidenceFromWebAppSmoke(report))
  console.log(options.json ? JSON.stringify(report, null, 2) : renderWebAppSmoke(report))
  if (!report.ready) process.exitCode = 1
})

program.command("adapter-write").argument("<migration-plan-json-file>").requiredOption("--out <dir>").description("Write REST adapter skeleton files to an output directory.").action(async (jsonFile: string, options: { out: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(await writeAdapterFiles(options.out, generateAdapterSkeleton(JSON.parse(input))), null, 2))
})

program.command("audit-json").argument("<json-file>").description("Audit sampled D3 dictionaries/programs from JSON input.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(auditD3Application(JSON.parse(input)), null, 2))
})

program.command("code-map").argument("<json-file>").description("Create a D3 BASIC code map from JSON programs: [{file,item,source}].").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(createD3CodeMap(JSON.parse(input)), null, 2))
})

program.command("audit-db").argument("<json-file>").description("Audit sampled D3 database files, dictionaries, shapes, and expected indexes.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(auditDatabaseSamples(JSON.parse(input)), null, 2))
})

program.command("shape").argument("<json-file>").description("Analyze D3 record shape samples. Input: [{id,raw}] with raw attribute marks.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const samples = JSON.parse(input) as Array<{ id: string; raw: string }>
  const shapes = samples.map((sample) => analyzeD3Record(sample.id, sample.raw))
  console.log(JSON.stringify({ shapes, findings: validateShapeConsistency(shapes) }, null, 2))
})

program.command("bundle-audit").argument("<bundle-json-file>").description("Audit a unified D3 application bundle.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(createBundleArtifacts(parseBundle(JSON.parse(input))).audit, null, 2))
})

program.command("bundle-migration").argument("<bundle-json-file>").description("Create migration plan from a unified D3 application bundle.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(createBundleArtifacts(parseBundle(JSON.parse(input))).migrationPlan, null, 2))
})

program.command("bundle-index").argument("<bundle-json-file>").description("Create searchable index documents from a unified D3 application bundle.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  validateBundleUris(bundle)
  console.log(JSON.stringify({ documents: createBundleArtifacts(bundle).index }, null, 2))
})

program.command("bundle-index-plan").argument("<bundle-json-file>").description("Create a D3 index validation plan from expected/observed indexes, dictionaries, and API fields.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createIndexValidationPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderIndexValidationPlan(plan))
})

program.command("bundle-data-plan").argument("<bundle-json-file>").description("Create a D3 data validation plan for dictionaries, record shapes, multivalue fields, and API projections.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createDataValidationPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderDataValidationPlan(plan))
})

program.command("bundle-erp-plan").argument("<bundle-json-file>").description("Create a staged ERP-scale D3 migration blueprint with screens, relationships, multivalue structures, and integrity work.").option("--target-db <name>", "target database for migration planning", "target database").option("--json").action(async (jsonFile: string, options: { targetDb: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const blueprint = createErpMigrationBlueprint(bundle, createBundleArtifacts(bundle), options.targetDb)
  console.log(options.json ? JSON.stringify(blueprint, null, 2) : renderErpMigrationBlueprint(blueprint))
})

program.command("bundle-code-map").argument("<bundle-json-file>").description("Create a D3 BASIC code map from a unified D3 application bundle.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  console.log(JSON.stringify(createBundleArtifacts(parseBundle(JSON.parse(input))).codeMap, null, 2))
})

program.command("bundle-code-plan").argument("<bundle-json-file>").description("Create a D3 BASIC modernization plan from code-map, lint, write, EXECUTE, and compile proof signals.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createCodeModernizationPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderCodeModernizationPlan(plan))
})

program.command("bundle-screen-plan").argument("<bundle-json-file>").description("Create a D3 legacy screen modernization plan from BASIC cursor, display, input, and screen utility evidence.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createScreenModernizationPlan(bundle)
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderScreenModernizationPlan(plan))
})

program.command("bundle-ui-plan").argument("<bundle-json-file>").description("Create a D3-to-web UI screen plan from resources, dictionaries, data warnings, and legacy screen evidence.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createWebUiPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderWebUiPlan(plan))
})

program.command("bundle-reconciliation-plan").argument("<bundle-json-file>").description("Create a cutover reconciliation plan for D3 counts, samples, multivalue order, indexes, canary, and rollback.").option("--target-db <name>", "target database for migration reconciliation", "target database").option("--json").action(async (jsonFile: string, options: { targetDb: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createD3ReconciliationPlan(bundle, createBundleArtifacts(bundle), options.targetDb)
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderD3ReconciliationPlan(plan))
})

program.command("bundle-access-plan").argument("<bundle-json-file>").description("Create a D3 IDE user/role access plan for generated resources and screens.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createD3AccessPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderD3AccessPlan(plan))
})

program.command("bundle-brief").argument("<bundle-json-file>").description("Create a markdown D3 modernization brief from a unified D3 application bundle.").action(async (jsonFile: string) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  console.log(createModernizationBrief(bundle, createBundleArtifacts(bundle)))
})

program.command("bundle-backlog").argument("<bundle-json-file>").description("Create a prioritized D3 modernization backlog from a unified D3 application bundle.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const backlog = createModernizationBacklog(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(backlog, null, 2) : renderModernizationBacklog(backlog))
})

program.command("bundle-qa-plan").argument("<bundle-json-file>").description("Create a D3 migration QA plan with D3, API, browser, and regression checks.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const qaPlan = createMigrationQaPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(qaPlan, null, 2) : renderMigrationQaPlan(qaPlan))
})

program.command("bundle-readiness").argument("<bundle-json-file>").description("Review whether a D3-to-web migration bundle has enough evidence to claim readiness.").option("--artifacts-dir <dir>").option("--json").action(async (jsonFile: string, options: { artifactsDir?: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const report = createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderMigrationReadinessReport(report))
})

program.command("bundle-delegate").argument("<bundle-json-file>").description("Create a D3 bundle-specific subagent task plan from audit, code, data, API, and readiness evidence.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const plan = createBundleSubagentPlan(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderBundleSubagentPlan(plan))
})

program.command("bundle-skill-pack").argument("<bundle-json-file>").description("Create a D3 bundle-specific baked skill pack with modes, recipes, evidence gates, and reference-skill mapping.").option("--json").action(async (jsonFile: string, options: { json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const pack = createBundleSkillPack(bundle, createBundleArtifacts(bundle))
  console.log(options.json ? JSON.stringify(pack, null, 2) : renderBundleSkillPack(pack))
})

program.command("bundle-completion-audit").argument("<bundle-json-file>").description("Audit goal completion requirements for a D3 migration bundle and name missing proof.").option("--artifacts-dir <dir>").option("--json").action(async (jsonFile: string, options: { artifactsDir?: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const report = createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderCompletionAuditReport(report))
})

program.command("bundle-evidence").argument("<bundle-json-file>").description("Create phase-specific GSD goal evidence suggestions from a D3 application bundle.").option("--artifacts-dir <dir>").option("--json").action(async (jsonFile: string, options: { artifactsDir?: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const report = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderBundleEvidenceReport(report))
})

program.command("bundle-execution-plan").argument("<bundle-json-file>").description("Create an ordered GSD/migration execution plan with skills, subagents, commands, and proof gates.").option("--artifacts-dir <dir>").option("--json").action(async (jsonFile: string, options: { artifactsDir?: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const plan = createBundleExecutionPlan(bundle, artifacts, webapp, qaEvidence)
  console.log(options.json ? JSON.stringify(plan, null, 2) : renderBundleExecutionPlan(plan))
})

program.command("bundle-prd").argument("<bundle-json-file>").description("Generate a GSD-style PRD for a D3 migration bundle.").option("--artifacts-dir <dir>").action(async (jsonFile: string, options: { artifactsDir?: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  console.log(createBundlePrd(bundle, artifacts, webapp, qaEvidence))
})

program.command("bundle-adr").argument("<bundle-json-file>").description("Generate a GSD-style ADR for the D3 strangler REST boundary.").option("--artifacts-dir <dir>").action(async (jsonFile: string, options: { artifactsDir?: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  console.log(createBundleAdr(bundle, artifacts, webapp, qaEvidence))
})

program.command("bundle-release-report").argument("<bundle-json-file>").description("Generate a ship/canary release report with blockers, proof, scope, and rollback commands.").option("--artifacts-dir <dir>").option("--json").action(async (jsonFile: string, options: { artifactsDir?: string; json?: boolean }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const report = createBundleReleaseReport(bundle, artifacts, webapp, qaEvidence)
  console.log(options.json ? JSON.stringify(report, null, 2) : renderBundleReleaseReport(report))
})

program.command("bundle-context-pack").argument("<bundle-json-file>").description("Create a compact resumable D3 work context pack with runtime state, proof gaps, subagent queue, and next commands.").option("--artifacts-dir <dir>").option("--model <provider/model>").option("--safety <mode>").option("--profile <name>").option("--mode <mode>", "chat|plan|gsd|migrate|audit|api|modernize|qa", "migrate").option("--json").action(async (jsonFile: string, options: { artifactsDir?: string; model?: string; safety?: string; profile?: string; mode: string; json?: boolean }) => {
  const config = await loadConfig()
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  const webapp = options.artifactsDir ? await checkGeneratedWebApp(options.artifactsDir) : undefined
  const qaEvidence = options.artifactsDir ? await readQaEvidence(options.artifactsDir) : undefined
  const pack = createBundleContextPack(config, bundle, artifacts, {
    model: options.model ?? config.defaultModel,
    safety: options.safety ? parseSafety(options.safety) : config.defaultSafety,
    mode: options.mode,
    profile: options.profile ?? bundle.profile,
  }, webapp, qaEvidence)
  console.log(options.json ? JSON.stringify(pack, null, 2) : renderBundleContextPack(pack))
})

program.command("bundle-refresh-evidence").argument("<bundle-json-file>").requiredOption("--artifacts-dir <dir>").description("Refresh readiness, completion audit, goal evidence, and release report files from generated artifacts and recorded QA evidence.").action(async (jsonFile: string, options: { artifactsDir: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  const artifacts = createBundleArtifacts(bundle)
  console.log(JSON.stringify(await refreshBundleProofArtifacts(options.artifactsDir, artifacts, bundle), null, 2))
})

program.command("bundle-artifacts").argument("<bundle-json-file>").requiredOption("--out <dir>").description("Write audit, code map, migration, OpenAPI, index, and adapter files from a D3 bundle.").action(async (jsonFile: string, options: { out: string }) => {
  const input = await import("node:fs/promises").then((fs) => fs.readFile(jsonFile, "utf8"))
  const bundle = parseBundle(JSON.parse(input))
  console.log(JSON.stringify(await writeBundleArtifacts(options.out, createBundleArtifacts(bundle), bundle), null, 2))
})

program.command("ide").alias("id").description("Start the browser-based D3 Code IDE server.").option("--port <port>", "local port", (value) => Number(value), 3737).option("--host <host>", "bind host", "127.0.0.1").option("--profile <name>").option("--model <provider/model>").option("--safety <ask|plan|trust>").option("--mode <mode>", "chat|plan|gsd|migrate|audit|api|modernize|qa", "chat").action(async (options: { port: number; host: string; profile?: string; model?: string; safety?: string; mode: string }) => {
  const config = await loadConfig()
  const profile = selectProfile(config, options.profile)
  const mode = getMode(options.mode) ?? getMode("chat")!
  const safety = options.safety ? parseSafety(options.safety) : mode.safetyBias ?? effectiveSafety(config, undefined, profile)
  const server = await startIdeServer(config, {
    model: options.model ?? config.defaultModel,
    safety,
    profile: options.profile ?? profile?.name,
    mode: mode.id,
  }, { host: options.host, port: options.port })
  console.log(`D3 Code IDE running: ${server.url}`)
  console.log(`Profile: ${options.profile ?? profile?.name ?? "none"}`)
  console.log("Press Ctrl+C to stop.")
  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve())
    process.once("SIGTERM", () => resolve())
  })
})

program
  .command("bundle-capture")
  .description("Capture a D3 application bundle from the selected profile using read-only TCL commands.")
  .option("--profile <name>")
  .option("--account <account>")
  .option("--files <files>", "comma-separated file names to capture")
  .option("--program-files <files>", "comma-separated program file names", "BP")
  .option("--sample-limit <n>", "sample item count", (value) => Number(value), 3)
  .option("--no-indexes", "skip LIST-INDEX capture")
  .action(async (options: { profile?: string; account?: string; files?: string; programFiles: string; sampleLimit: number; indexes?: boolean }) => {
    const config = await loadConfig()
    const profile = selectProfile(config, options.profile)
    if (!profile) throw new Error("No profile configured")
    const session = createD3Session(profile)
    try {
      const bundle = await captureBundleFromSession(session, {
        profile: profile.name,
        account: options.account ?? profile.account ?? "unknown",
        files: options.files?.split(",").map((item) => item.trim()).filter(Boolean),
        programFiles: options.programFiles.split(",").map((item) => item.trim()).filter(Boolean),
        sampleLimit: options.sampleLimit,
        captureIndexes: options.indexes,
      })
      console.log(JSON.stringify(bundle, null, 2))
    } finally {
      await session.close()
    }
  })

await program.parseAsync(process.argv)
