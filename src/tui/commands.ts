import { readFile } from "node:fs/promises"
import { execFile, spawn } from "node:child_process"
import { platform } from "node:os"
import { agents } from "../agents/registry.js"
import { renderDelegationPlan } from "../agents/delegation.js"
import { renderAgentRunReport, runAgentTask } from "../agents/run.js"
import { createSubagentPromptPack, renderSubagentPromptPack } from "../agents/tasks.js"
import { createD3AccessPlan, renderD3AccessPlan } from "../app/access-plan.js"
import { createBundleArtifacts, parseBundle } from "../app/bundle.js"
import { createCompletionAuditReport, renderCompletionAuditReport } from "../app/completion-audit.js"
import { createBundleContextPack, renderBundleContextPack } from "../app/context-pack.js"
import { createBundleEvidenceReport, renderBundleEvidenceReport } from "../app/evidence.js"
import { createBundleExecutionPlan, renderBundleExecutionPlan } from "../app/execution-plan.js"
import { createErpMigrationBlueprint, renderErpMigrationBlueprint } from "../app/erp-migration.js"
import { createBundleAdr, createBundlePrd } from "../app/gsd-docs.js"
import { readQaEvidence } from "../app/qa-evidence.js"
import { createMigrationReadinessReport, renderMigrationReadinessReport } from "../app/readiness.js"
import { createBundleReleaseReport, renderBundleReleaseReport } from "../app/release-report.js"
import { createD3ReconciliationPlan, renderD3ReconciliationPlan } from "../app/reconciliation-plan.js"
import { createScreenModernizationPlan, renderScreenModernizationPlan } from "../app/screen-plan.js"
import { createSafetyGuardReport, renderSafetyGuardReport } from "../app/safety-guard.js"
import { createBundleSkillPack, renderBundleSkillPack } from "../app/skill-pack.js"
import { createBundleSubagentPlan, renderBundleSubagentPlan } from "../app/subagents.js"
import { createWebUiPlan, renderWebUiPlan } from "../app/ui-plan.js"
import { createModernizationProof, renderModernizationProof } from "../app/modernization-proof.js"
import { refreshBundleProofArtifacts } from "../app/write.js"
import type { D3CodeConfig } from "../config/config.js"
import { defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir } from "../config/paths.js"
import { createD3Session } from "../d3/adapter.js"
import { detectLocalD3 } from "../d3/detect.js"
import { createLiveProofReport, profileDoctorGoalEvidence, renderLiveProofReport } from "../d3/live-proof.js"
import { checkLiveProofArtifacts, renderLiveProofArtifactReport, renderLiveProofScaffold, writeLiveProofScaffold } from "../d3/live-proof-artifacts.js"
import { diagnoseProfile, renderProfileDoctor } from "../d3/profile-doctor.js"
import { createIdeTerminalContract, renderIdeTerminalContract } from "../d3/ide-terminal.js"
import { createD3ConnectorStrategy, renderD3ConnectorStrategy } from "../d3/connector-strategy.js"
import { parseD3ScreenTranscript, renderD3ScreenBuffer } from "../d3/screen-buffer.js"
import { captureD3Terminal, renderD3TerminalCapture, writeD3TerminalCapture } from "../d3/terminal-capture.js"
import { createD3TerminalBridgePlan, renderD3TerminalBridgePlan } from "../d3/terminal-plan.js"
import { d3Tools } from "../d3/tools.js"
import { assertD3Allowed } from "../core/permissions.js"
import type { SafetyMode } from "../domain/types.js"
import { providers } from "../providers/catalog.js"
import { createModelProofReport, renderModelProofReport } from "../providers/proof.js"
import { createModelRoutingPlan, renderModelRoutingPlan, type ModelBiasInput } from "../providers/routing.js"
import { defaultSecretStore } from "../security/secrets.js"
import { renderAcceptanceReport, runMockAcceptance } from "../quality/acceptance.js"
import { createIdeStatusReport, renderIdeStatusReport } from "../quality/ide-status.js"
import { createReadinessReport, renderReadinessReport } from "../quality/readiness.js"
import { createInstallProofReport } from "../quality/install-proof.js"
import { createProductCompletionAudit, renderProductCompletionAudit } from "../quality/product-audit.js"
import { createModernizationGoal, goalPlan, recordGoalEvidence, renderGoalVerification } from "../goal/goal.js"
import { auditGoalAgainstBundle, renderGoalBundleAudit } from "../goal/audit.js"
import { applyBundleEvidenceToGoal, renderAppliedGoalEvidence } from "../goal/evidence.js"
import { renderGoalNext } from "../goal/next.js"
import { loadGoal, saveGoal } from "../goal/store.js"
import { getMode, modes, modeSystemPrompt, renderModeRunbook, renderSkill, skills } from "../skills/modes.js"
import { renderSkillCoverage } from "../skills/coverage.js"
import { auditReferenceSkillInventory, renderReferenceSkillAudit } from "../skills/reference-audit.js"
import { renderReferenceSkillMap } from "../skills/reference-map.js"
import { renderWorkflow } from "../skills/workflows.js"
import { runToolByName } from "../tools/runner.js"
import { renderRecipe } from "../skills/recipes.js"
import { createSetupProofReport, renderSetupProofReport } from "../setup/proof.js"
import { listSessions, loadSession } from "../sessions/store.js"
import { checkGeneratedWebApp } from "../migration/webapp-check.js"
import { startIdeServer, stopIdeServers } from "../ide/server.js"
import { displayUrlForIdeBind, ideAccessNotes } from "../ide/access.js"

export interface RuntimeState {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
}

export interface CommandResult {
  exit?: boolean
  clear?: boolean
  state?: Partial<RuntimeState>
  output: string
}

function openBrowserBestEffort(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open"
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url]
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" })
    child.unref()
  } catch {
    // Opening the browser is a convenience only; the URL is still printed.
  }
}

function decodeInlineBody(parts: string[]): string {
  return parts.join(" ").replace(/\\n/g, "\n")
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index !== -1) return args[index + 1]
  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  return inline?.slice(flag.length + 1)
}

function runSystemCommand(command: string, args: string[], timeoutMs = 2500): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      const errorCode = (error as NodeJS.ErrnoException | null)?.code
      resolve({
        code: typeof errorCode === "number" ? errorCode : error ? 1 : 0,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
      })
    })
  })
}

const temporaryFirewallPorts = new Set<number>()

async function openTemporaryFirewallPort(port: number): Promise<string[]> {
  if (port <= 0) return ["Firewall: skipped for ephemeral port."]
  if (platform() !== "linux") return ["Firewall: not changed; this host is not Linux."]
  const state = await runSystemCommand("firewall-cmd", ["--state"])
  if (state.code !== 0) return ["Firewall: not changed; firewalld is not running or firewall-cmd is unavailable."]
  const add = await runSystemCommand("firewall-cmd", [`--add-port=${port}/tcp`, "--timeout=2h"])
  if (add.code !== 0) return [`Firewall: could not open ${port}/tcp temporarily (${add.stderr.trim() || add.stdout.trim() || "permission denied"}).`]
  const query = await runSystemCommand("firewall-cmd", [`--query-port=${port}/tcp`])
  if (query.code === 0) {
    temporaryFirewallPorts.add(port)
    return [`Firewall: opened ${port}/tcp temporarily for 2 hours.`]
  }
  return [`Firewall: attempted temporary open for ${port}/tcp, but the rule was not confirmed.`]
}

async function closeTemporaryFirewallPorts(): Promise<string[]> {
  if (temporaryFirewallPorts.size === 0) return []
  const notes: string[] = []
  for (const port of [...temporaryFirewallPorts]) {
    const result = await runSystemCommand("firewall-cmd", [`--remove-port=${port}/tcp`])
    notes.push(result.code === 0 ? `Firewall: closed temporary ${port}/tcp rule.` : `Firewall: could not close temporary ${port}/tcp rule; it will expire automatically if firewalld accepted the timeout.`)
    temporaryFirewallPorts.delete(port)
  }
  return notes
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

async function loadBundleReport(jsonFile: string) {
  const input = await readFile(jsonFile, "utf8")
  const bundle = parseBundle(JSON.parse(input))
  return { bundle, artifacts: createBundleArtifacts(bundle) }
}

async function loadArtifactEvidence(artifactsDir?: string) {
  if (!artifactsDir) return {}
  return {
    webapp: await checkGeneratedWebApp(artifactsDir),
    qaEvidence: await readQaEvidence(artifactsDir),
  }
}

export async function handleSlashCommand(input: string, config: D3CodeConfig, state: RuntimeState): Promise<CommandResult> {
  const [command, ...args] = input.trim().split(/\s+/)
  switch (command) {
    case "/help":
      return {
        output: [
          "Commands:",
          "/help, /setup, /profile [name], /d3 [profile], /chat, /status, /ide|/id [public|stop] [--port N] [--host 127.0.0.1|0.0.0.0], /terminal-plan [profile], /ide-terminal [profile], /connector-strategy [profile], /terminal-capture <out-dir> <command...>, /screen-parse <transcript-file> [width] [height], /models, /model <provider/model>, /model-proof [mode] [--bias quality|balanced|speed|ollama], /model-routing [mode] [--bias quality|balanced|speed|ollama], /agents, /tools, /skills, /skill-coverage, /reference-skills, /reference-audit, /setup-proof, /readiness, /product-audit [--with-acceptance] [--live-proof-dir <dir>], /acceptance, /live-proof, /live-proof-init <dir>, /live-proof-check <dir>, /modes",
          "/login [profile] [account], /logout, /account, /files, /read <file> <item>, /write <file> <item> <body>, /dict <file> <item>, /locks",
          "/diff <file> <item> <proposed-body>, /index [name], /search <query>, /manual-search <query>, /compile <file> <item>, /catalog <file> <item>, /call <subroutine> [args...]",
          "/mode <chat|plan|gsd|migrate|audit|api|modernize|qa>, /workflow [mode], /runbook [mode], /delegate [mode], /delegate-prompts [mode], /agent-run basic-check <file> <item> [--compile] [--catalog] [--confirm], /agent-run file-audit <file> [--sample-limit N], /agent-run migration-slice <bundle.json> --out <dir>, /skill <id>, /goal <title>",
          "/goal-plan <id>, /goal-next <id>, /goal-verify <id>, /goal-evidence <id> <evidence>, /goal-apply-bundle-evidence <id> <bundle.json> [artifacts-dir], /goal-audit-bundle <id> <bundle.json> [artifacts-dir] [--apply]",
          "/bundle-readiness <bundle.json> [artifacts-dir], /bundle-delegate <bundle.json>, /bundle-skill-pack <bundle.json>, /bundle-completion-audit <bundle.json> [artifacts-dir], /bundle-evidence <bundle.json> [artifacts-dir], /bundle-execution-plan <bundle.json> [artifacts-dir], /bundle-erp-plan <bundle.json> [target-db], /bundle-screen-plan <bundle.json>, /bundle-ui-plan <bundle.json>, /bundle-reconciliation-plan <bundle.json> [target-db], /bundle-access-plan <bundle.json>, /bundle-prd <bundle.json> [artifacts-dir], /bundle-adr <bundle.json> [artifacts-dir], /bundle-release-report <bundle.json> [artifacts-dir], /bundle-context-pack <bundle.json> [artifacts-dir], /bundle-refresh-evidence <bundle.json> <artifacts-dir>",
          "/safety-guard [bundle.json] [command...], /run-tool <tool> [json], /tcl <command>, /aql <query>",
          "/modernization-proof <before-file> <after-file> [compile-output-file]",
          "/sessions, /resume <id>, /audit-help, /migrate-help, /api-help, /modernize-help",
          "/safety ask|plan|trust, /profile <name>, /doctor, /profile-doctor, /config, /clear, /exit",
          "! <unix command> runs a local shell command in this same session and reports output plus file changes.",
          "Normal text is sent to the selected model with D3 Code system context.",
        ].join("\n"),
      }
    case "/setup":
      return {
        output: [
          "D3 Code setup",
          "",
          "For the full interactive setup wizard, exit this session and run:",
          "  d3code setup",
          "",
          "That wizard configures the AI provider/key/model first, then optionally creates a Rocket D3 profile.",
          "After setup, come back here and use:",
          "  /profile",
          "  /d3",
        ].join("\n"),
      }
    case "/d3":
      return {
        output: [
          "D3 terminal mode is handled by the live TUI shell.",
          "Use /d3 [profile] from `d3code` to attach to the configured Rocket D3 runtime.",
          "Once attached, type TCL/D3 commands directly. Use /chat to return to the agent.",
        ].join("\n"),
      }
    case "/chat":
      return { output: "Already in agent chat. Use /d3 to attach to the D3 runtime terminal." }
    case "/status":
      return { output: renderIdeStatusReport(await createIdeStatusReport(config, state)) }
    case "/ide":
    case "/id": {
      if (args[0] === "stop") {
        await stopIdeServers()
        const firewallNotes = await closeTemporaryFirewallPorts()
        return { output: ["D3 Code IDE stopped.", ...firewallNotes].join("\n") }
      }
      const publicMode = args.includes("public")
      const portValue = flagValue(args, "--port") ?? args.find((arg) => /^\d+$/.test(arg))
      const port = portValue ? Number(portValue) : 3737
      if (!Number.isInteger(port) || port < 0 || port > 65535) return { output: "Usage: /ide [public|stop] [--port 3737] [--host 127.0.0.1|0.0.0.0]" }
      const host = flagValue(args, "--host") ?? (publicMode ? "0.0.0.0" : "127.0.0.1")
      const server = await startIdeServer(config, state, { host, port })
      if (port !== 0) openBrowserBestEffort(server.url)
      const firewallNotes = publicMode ? await openTemporaryFirewallPort(server.port) : []
      const displayUrl = displayUrlForIdeBind(host, server.port)
      return {
        output: [
          `D3 Code IDE started: ${displayUrl}`,
          ...(displayUrl !== server.url ? [`Bound: ${server.host}:${server.port}`] : []),
          `Profile: ${state.profile ?? config.defaultProfile ?? "default"}`,
          `Safety: ${state.safety}`,
          ...ideAccessNotes(host, server.port, undefined, { publicCommand: "/ide public" }),
          ...firewallNotes,
          "Opened in your browser if the terminal allows it.",
          "Use /ide stop to stop the server.",
        ].join("\n"),
      }
    }
    case "/terminal-plan": {
      const profileName = args[0] ?? state.profile
      const profile = profileName ? config.profiles.find((item) => item.name === profileName) : config.profiles[0]
      return { output: renderD3TerminalBridgePlan(createD3TerminalBridgePlan(profile)) }
    }
    case "/ide-terminal": {
      const profileName = args[0] ?? state.profile
      const profile = profileName ? config.profiles.find((item) => item.name === profileName) : config.profiles[0]
      return { output: renderIdeTerminalContract(createIdeTerminalContract(profile)) }
    }
    case "/connector-strategy": {
      const profileName = args[0] ?? state.profile
      const profile = profileName ? config.profiles.find((item) => item.name === profileName) : config.profiles[0]
      return { output: renderD3ConnectorStrategy(createD3ConnectorStrategy(profile)) }
    }
    case "/screen-parse": {
      const file = args[0]
      if (!file) return { output: "Usage: /screen-parse <transcript-file> [width] [height]" }
      const width = Number(args[1] ?? "80")
      const height = Number(args[2] ?? "24")
      return { output: renderD3ScreenBuffer(parseD3ScreenTranscript(await readFile(file, "utf8"), { width, height })) }
    }
    case "/terminal-capture": {
      const outDir = args[0]
      const command = args.slice(1).join(" ")
      if (!outDir || !command) return { output: "Usage: /terminal-capture <out-dir> <command...>" }
      const profile = state.profile ? config.profiles.find((item) => item.name === state.profile) : config.profiles[0]
      if (!profile) return { output: "No profile configured" }
      assertD3Allowed(state.safety, command, state.safety === "trust")
      const session = createD3Session(profile)
      try {
        const capture = await captureD3Terminal(session, command)
        const written = (await writeD3TerminalCapture(outDir, capture)).written
        return { output: renderD3TerminalCapture(capture, written) }
      } finally {
        await session.close()
      }
    }
    case "/models":
      return { output: providers.flatMap((provider) => [`${provider.id} (${provider.name})`, ...provider.models.map((model) => `  ${provider.id}/${model}`)]).join("\n") }
    case "/model": {
      const model = args.join(" ")
      if (!model.includes("/")) return { output: "Usage: /model <provider/model>" }
      return { state: { model }, output: `Model set to ${model}` }
    }
    case "/model-proof": {
      const biasIndex = args.indexOf("--bias")
      const bias = (biasIndex === -1 ? "balanced" : args[biasIndex + 1] ?? "balanced") as ModelBiasInput
      const mode = args.find((arg) => !arg.startsWith("--") && arg !== bias) ?? state.mode
      return { output: renderModelProofReport(await createModelProofReport(config, defaultSecretStore(), { mode, bias })) }
    }
    case "/model-routing": {
      const biasIndex = args.indexOf("--bias")
      const bias = (biasIndex === -1 ? "balanced" : args[biasIndex + 1] ?? "balanced") as ModelBiasInput
      const mode = args.find((arg) => !arg.startsWith("--") && arg !== bias) ?? state.mode
      return { output: renderModelRoutingPlan(createModelRoutingPlan(config, mode, bias)) }
    }
    case "/agents":
      return { output: agents.map((agent) => `${agent.id}\t${agent.mode}\t${agent.defaultSafety}\t${agent.description}`).join("\n") }
    case "/delegate":
      return { output: renderDelegationPlan(args[0] ?? state.mode) }
    case "/delegate-prompts":
      return { output: renderSubagentPromptPack(createSubagentPromptPack(args[0] ?? state.mode)) }
    case "/agent-run": {
      const [task, file] = args
      const rest = args.slice(2)
      const item = task === "basic-check" ? rest[0] : undefined
      const flags = task === "basic-check" ? rest.slice(1) : rest
      if (task !== "basic-check" && task !== "file-audit" && task !== "migration-slice") return { output: "Usage: /agent-run basic-check <file> <item> [--compile] [--catalog] [--global] [--confirm] OR /agent-run file-audit <file> [--sample-limit N] OR /agent-run migration-slice <bundle.json> --out <dir>" }
      if (!file || (task === "basic-check" && !item)) return { output: "Usage: /agent-run basic-check <file> <item> [--compile] [--catalog] [--global] [--confirm] OR /agent-run file-audit <file> [--sample-limit N] OR /agent-run migration-slice <bundle.json> --out <dir>" }
      const sampleLimitIndex = flags.indexOf("--sample-limit")
      const sampleLimit = sampleLimitIndex === -1 ? undefined : Number(flags[sampleLimitIndex + 1] ?? "3")
      const outIndex = flags.indexOf("--out")
      const report = await runAgentTask(config, {
        task,
        file,
        item: task === "basic-check" ? item : undefined,
        outDir: outIndex === -1 ? undefined : flags[outIndex + 1],
        profile: state.profile,
        safety: state.safety,
        compile: flags.includes("--compile"),
        catalog: flags.includes("--catalog"),
        global: flags.includes("--global"),
        confirm: flags.includes("--confirm"),
        sampleLimit,
      })
      return { output: renderAgentRunReport(report) }
    }
    case "/skills":
      return { output: skills.map((skill) => `${skill.id}\t${skill.source}\t${skill.appliesToD3 ? "d3" : "generic"}\t${skill.description}`).join("\n") }
    case "/skill-coverage":
      return { output: renderSkillCoverage() }
    case "/reference-skills":
      return { output: renderReferenceSkillMap() }
    case "/reference-audit":
      return { output: renderReferenceSkillAudit(await auditReferenceSkillInventory(args[0] ?? defaultReferenceDir)) }
    case "/readiness":
      return { output: renderReadinessReport(await createReadinessReport(config, defaultSecretStore())) }
    case "/product-audit": {
      const withAcceptance = args.includes("--with-acceptance")
      const liveProofDirIndex = args.indexOf("--live-proof-dir")
      return {
        output: renderProductCompletionAudit(await createProductCompletionAudit(config, defaultSecretStore(), {
          referenceDir: defaultReferenceDir,
          manualPath: defaultD3ReferenceManual,
          userGuidePath: defaultD3UserGuide,
          liveProofDir: liveProofDirIndex === -1 ? undefined : args[liveProofDirIndex + 1],
          installProof: await createInstallProofReport(),
          acceptance: withAcceptance ? await runMockAcceptance() : undefined,
        })),
      }
    }
    case "/setup-proof":
      return { output: renderSetupProofReport(createSetupProofReport(config)) }
    case "/acceptance":
      return { output: renderAcceptanceReport(await runMockAcceptance()) }
    case "/live-proof": {
      const run = args.includes("--run")
      const goalIndex = args.indexOf("--goal")
      const phaseIndex = args.indexOf("--phase")
      const goalId = goalIndex === -1 ? undefined : args[goalIndex + 1]
      const phase = phaseIndex === -1 ? "verify" : args[phaseIndex + 1]
      const profileName = args.find((arg) => !arg.startsWith("--") && arg !== goalId && arg !== phase) ?? state.profile
      const profile = profileName ? config.profiles.find((item) => item.name === profileName) : config.profiles[0]
      const doctor = run && profile ? await diagnoseProfile(profile) : undefined
      if (goalId) {
        if (!doctor) return { output: "Usage: /live-proof [profile] --run --goal <id> [--phase <phase>]" }
        if (!doctor.ready) return { output: `${renderLiveProofReport(createLiveProofReport(config, profileName, doctor))}\nLive proof failed; goal evidence was not recorded.` }
        await saveGoal(recordGoalEvidence(await loadGoal(goalId), profileDoctorGoalEvidence(doctor), phase))
      }
      return { output: renderLiveProofReport(createLiveProofReport(config, profileName, doctor)) }
    }
    case "/live-proof-check": {
      const dir = args[0]
      if (!dir) return { output: "Usage: /live-proof-check <dir>" }
      return { output: renderLiveProofArtifactReport(await checkLiveProofArtifacts(dir)) }
    }
    case "/live-proof-init": {
      const dir = args[0]
      if (!dir) return { output: "Usage: /live-proof-init <dir>" }
      return { output: renderLiveProofScaffold(await writeLiveProofScaffold(dir, { profile: state.profile })) }
    }
    case "/bundle-readiness": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-readiness <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: renderMigrationReadinessReport(createMigrationReadinessReport(bundle, artifacts, webapp, qaEvidence)) }
    }
    case "/bundle-delegate": {
      const jsonFile = args[0]
      if (!jsonFile) return { output: "Usage: /bundle-delegate <bundle.json>" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: renderBundleSubagentPlan(createBundleSubagentPlan(bundle, artifacts)) }
    }
    case "/bundle-completion-audit": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-completion-audit <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: renderCompletionAuditReport(createCompletionAuditReport(bundle, artifacts, webapp, qaEvidence)) }
    }
    case "/bundle-evidence": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-evidence <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: renderBundleEvidenceReport(createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)) }
    }
    case "/bundle-execution-plan": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-execution-plan <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: renderBundleExecutionPlan(createBundleExecutionPlan(bundle, artifacts, webapp, qaEvidence)) }
    }
    case "/bundle-erp-plan": {
      const jsonFile = args[0]
      const targetDb = args[1] ?? "target database"
      if (!jsonFile) return { output: "Usage: /bundle-erp-plan <bundle.json> [target-db]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: renderErpMigrationBlueprint(createErpMigrationBlueprint(bundle, artifacts, targetDb)) }
    }
    case "/bundle-screen-plan": {
      const jsonFile = args[0]
      if (!jsonFile) return { output: "Usage: /bundle-screen-plan <bundle.json>" }
      const { bundle } = await loadBundleReport(jsonFile)
      return { output: renderScreenModernizationPlan(createScreenModernizationPlan(bundle)) }
    }
    case "/bundle-ui-plan": {
      const jsonFile = args[0]
      if (!jsonFile) return { output: "Usage: /bundle-ui-plan <bundle.json>" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: renderWebUiPlan(createWebUiPlan(bundle, artifacts)) }
    }
    case "/bundle-reconciliation-plan": {
      const jsonFile = args[0]
      const targetDb = args[1] ?? "target database"
      if (!jsonFile) return { output: "Usage: /bundle-reconciliation-plan <bundle.json> [target-db]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: renderD3ReconciliationPlan(createD3ReconciliationPlan(bundle, artifacts, targetDb)) }
    }
    case "/bundle-access-plan": {
      const jsonFile = args[0]
      if (!jsonFile) return { output: "Usage: /bundle-access-plan <bundle.json>" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: renderD3AccessPlan(createD3AccessPlan(bundle, artifacts)) }
    }
    case "/bundle-prd": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-prd <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: createBundlePrd(bundle, artifacts, webapp, qaEvidence) }
    }
    case "/bundle-adr": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-adr <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: createBundleAdr(bundle, artifacts, webapp, qaEvidence) }
    }
    case "/bundle-release-report": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-release-report <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: renderBundleReleaseReport(createBundleReleaseReport(bundle, artifacts, webapp, qaEvidence)) }
    }
    case "/bundle-context-pack": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile) return { output: "Usage: /bundle-context-pack <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      return { output: renderBundleContextPack(createBundleContextPack(config, bundle, artifacts, state, webapp, qaEvidence)) }
    }
    case "/bundle-skill-pack": {
      const jsonFile = args[0]
      if (!jsonFile) return { output: "Usage: /bundle-skill-pack <bundle.json>" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: renderBundleSkillPack(createBundleSkillPack(bundle, artifacts)) }
    }
    case "/safety-guard": {
      const maybeBundle = args[0]?.endsWith(".json") ? args[0] : undefined
      const commandText = args.slice(maybeBundle ? 1 : 0).join(" ").trim()
      const bundleReport = maybeBundle ? await loadBundleReport(maybeBundle) : undefined
      return {
        output: renderSafetyGuardReport(createSafetyGuardReport(config, {
          safety: state.safety,
          profile: state.profile ?? bundleReport?.bundle.profile,
          bundle: bundleReport?.bundle,
          commands: commandText ? [commandText] : [],
        })),
      }
    }
    case "/bundle-refresh-evidence": {
      const jsonFile = args[0]
      const artifactsDir = args[1]
      if (!jsonFile || !artifactsDir) return { output: "Usage: /bundle-refresh-evidence <bundle.json> <artifacts-dir>" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      return { output: JSON.stringify(await refreshBundleProofArtifacts(artifactsDir, artifacts, bundle), null, 2) }
    }
    case "/modernization-proof": {
      const beforeFile = args[0]
      const afterFile = args[1]
      const compileFile = args[2]
      if (!beforeFile || !afterFile) return { output: "Usage: /modernization-proof <before-file> <after-file> [compile-output-file]" }
      return {
        output: renderModernizationProof(createModernizationProof({
          before: await readFile(beforeFile, "utf8"),
          after: await readFile(afterFile, "utf8"),
          compileOutput: compileFile ? await readFile(compileFile, "utf8") : undefined,
        })),
      }
    }
    case "/skill":
      return { output: renderSkill(args[0] ?? "") }
    case "/modes":
      return { output: modes.map((mode) => `${mode.id}\t${mode.safetyBias}\t${mode.description}`).join("\n") }
    case "/workflow":
      return { output: renderWorkflow(args[0] ?? state.mode) }
    case "/runbook":
      return { output: renderModeRunbook(args[0] ?? state.mode) }
    case "/audit-help":
      return { output: renderRecipe("audit") }
    case "/migrate-help":
      return { output: renderRecipe("migrate") }
    case "/api-help":
      return { output: renderRecipe("api") }
    case "/modernize-help":
      return { output: renderRecipe("modernize") }
    case "/mode": {
      const modeID = args[0]
      const mode = getMode(modeID)
      if (!mode) return { output: `Usage: /mode ${modes.map((item) => item.id).join("|")}` }
      return { state: { mode: mode.id, safety: mode.safetyBias }, output: `${mode.title}\n${mode.description}\n\n${modeSystemPrompt(mode.id)}` }
    }
    case "/goal": {
      const title = args.join(" ").trim()
      if (!title) return { output: "Usage: /goal <title>" }
      const goal = createModernizationGoal(title, `Complete ${title}`, state.mode)
      await saveGoal(goal)
      return { output: JSON.stringify(goal, null, 2) }
    }
    case "/goal-plan": {
      const id = args[0]
      if (!id) return { output: "Usage: /goal-plan <id>" }
      return { output: goalPlan(await loadGoal(id)) }
    }
    case "/goal-next": {
      const id = args[0]
      if (!id) return { output: "Usage: /goal-next <id>" }
      return { output: renderGoalNext(await loadGoal(id)) }
    }
    case "/goal-verify": {
      const id = args[0]
      if (!id) return { output: "Usage: /goal-verify <id>" }
      return { output: renderGoalVerification(await loadGoal(id)) }
    }
    case "/goal-evidence": {
      const id = args[0]
      const evidence = args.slice(1).join(" ").trim()
      if (!id || !evidence) return { output: "Usage: /goal-evidence <id> <evidence>" }
      const goal = recordGoalEvidence(await loadGoal(id), evidence)
      await saveGoal(goal)
      return { output: goalPlan(goal) }
    }
    case "/goal-apply-bundle-evidence": {
      const id = args[0]
      const jsonFile = args[1]
      const artifactsDir = args[2]
      if (!id || !jsonFile) return { output: "Usage: /goal-apply-bundle-evidence <id> <bundle.json> [artifacts-dir]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      const result = applyBundleEvidenceToGoal(await loadGoal(id), createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence))
      await saveGoal(result.goal)
      return { output: renderAppliedGoalEvidence(result) }
    }
    case "/goal-audit-bundle": {
      const id = args[0]
      const jsonFile = args[1]
      const artifactsDir = args.find((arg) => arg !== id && arg !== jsonFile && arg !== "--apply")
      if (!id || !jsonFile) return { output: "Usage: /goal-audit-bundle <id> <bundle.json> [artifacts-dir] [--apply]" }
      const { bundle, artifacts } = await loadBundleReport(jsonFile)
      const { webapp, qaEvidence } = await loadArtifactEvidence(artifactsDir)
      const report = createBundleEvidenceReport(bundle, artifacts, webapp, qaEvidence)
      let goal = await loadGoal(id)
      if (args.includes("--apply")) {
        const applied = applyBundleEvidenceToGoal(goal, report)
        goal = applied.goal
        await saveGoal(goal)
      }
      return { output: renderGoalBundleAudit(auditGoalAgainstBundle(goal, report)) }
    }
    case "/sessions": {
      const sessions = await listSessions()
      if (sessions.length === 0) return { output: "No saved sessions yet." }
      return {
        output: sessions.slice(0, 20).map((session) => {
          const last = session.events.at(-1)?.content.replace(/\s+/g, " ").slice(0, 70) ?? ""
          return `${session.id}\t${session.updatedAt}\t${session.model}\t${session.profile ?? "none"}\t${last}`
        }).join("\n"),
      }
    }
    case "/resume": {
      const id = args[0]
      if (!id) return { output: "Usage: /resume <session-id>" }
      const session = await loadSession(id)
      return {
        state: { model: session.model, safety: session.safety, profile: session.profile },
        output: `Loaded session settings for ${session.id}. To restore full transcript context, exit and run: d3code resume ${session.id}`,
      }
    }
    case "/tools":
      return { output: d3Tools.map((tool) => `${tool.name}\t${tool.mutates ? "mutates" : "read"}\t${tool.description}`).join("\n") }
    case "/run-tool": {
      const name = args[0]
      if (!name) return { output: "Usage: /run-tool <tool> [json]" }
      const json = args.slice(1).join(" ").trim()
      const input = json ? JSON.parse(json) : {}
      const result = await runToolByName(config, { name, input, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/tcl": {
      const commandText = args.join(" ").trim()
      if (!commandText) return { output: "Usage: /tcl <command>" }
      const result = await runToolByName(config, { name: "d3_tcl", input: { command: commandText, confirmed: state.safety === "trust" }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/aql": {
      const query = args.join(" ").trim()
      if (!query) return { output: "Usage: /aql <query>" }
      const result = await runToolByName(config, { name: "d3_query_aql", input: { query }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/safety": {
      const safety = args[0]
      if (safety !== "ask" && safety !== "plan" && safety !== "trust") return { output: "Usage: /safety ask|plan|trust" }
      return { state: { safety }, output: `Safety set to ${safety}` }
    }
    case "/profile": {
      const profile = args[0]
      if (!profile) return { output: `Current profile: ${state.profile ?? "none"}\nProfiles: ${config.profiles.map((item) => item.name).join(", ") || "none"}` }
      if (!config.profiles.some((item) => item.name === profile)) return { output: `Unknown profile: ${profile}` }
      return { state: { profile }, output: `Profile set to ${profile}` }
    }
    case "/login": {
      const profileName = args[0] ?? state.profile
      const account = args[1]
      const profile = profileName ? config.profiles.find((item) => item.name === profileName) : config.profiles[0]
      if (!profile) return { output: "No profile configured. Use d3code profile-add-local or profile-add-ssh first." }
      if (account) {
        const result = await runToolByName(config, { name: "d3_login", input: { account, confirmed: state.safety === "trust" }, safety: state.safety, profile: profile.name })
        return { state: { profile: profile.name }, output: result.compact }
      }
      return { state: { profile: profile.name }, output: renderProfileDoctor(await diagnoseProfile(profile)) }
    }
    case "/logout":
      return { state: { profile: undefined }, output: "Profile cleared for this session." }
    case "/account": {
      const profile = state.profile ? config.profiles.find((item) => item.name === state.profile) : config.profiles[0]
      if (!profile) return { output: "No profile configured." }
      const who = await runToolByName(config, { name: "d3_tcl", input: { command: "WHO", confirmed: true }, safety: state.safety, profile: profile.name })
      return { output: [`Profile: ${profile.name}`, `Configured account: ${profile.account ?? "not pinned"}`, "", who.compact].join("\n") }
    }
    case "/files": {
      const result = await runToolByName(config, { name: "d3_list_files", safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/read": {
      const [file, item] = args
      if (!file || !item) return { output: "Usage: /read <file> <item>" }
      const result = await runToolByName(config, { name: "d3_read_item", input: { file, item }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/write": {
      const [file, item, ...bodyParts] = args
      if (!file || !item || bodyParts.length === 0) return { output: "Usage: /write <file> <item> <body-with-\\n-for-newlines>" }
      const result = await runToolByName(config, {
        name: "d3_write_item",
        input: { file, item, body: decodeInlineBody(bodyParts), confirmed: state.safety === "trust" },
        safety: state.safety,
        profile: state.profile,
      })
      return { output: result.compact }
    }
    case "/dict": {
      const [file, item] = args
      if (!file || !item) return { output: "Usage: /dict <file> <item>" }
      const result = await runToolByName(config, { name: "d3_read_dict", input: { file, item }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/locks": {
      const result = await runToolByName(config, { name: "d3_locks", safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/diff": {
      const [file, item, ...bodyParts] = args
      if (!file || !item || bodyParts.length === 0) return { output: "Usage: /diff <file> <item> <proposed-body-with-\\n-for-newlines>" }
      const current = await runToolByName(config, { name: "d3_read_item", input: { file, item }, safety: state.safety, profile: state.profile, compact: false })
      return { output: renderSimpleDiff(`${file}/${item}`, commandStdout(current.raw), decodeInlineBody(bodyParts)) }
    }
    case "/index": {
      const saveAs = args[0]
      const result = await runToolByName(config, { name: "d3_index_account", input: saveAs ? { saveAs } : {}, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/search": {
      const query = args.join(" ").trim()
      if (!query) return { output: "Usage: /search <query>" }
      const result = await runToolByName(config, { name: "d3_search", input: { query }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/manual-search": {
      const query = args.join(" ").trim()
      if (!query) return { output: "Usage: /manual-search <query>" }
      const result = await runToolByName(config, { name: "d3_manual_search", input: { query }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/compile": {
      const [file, item] = args
      if (!file || !item) return { output: "Usage: /compile <file> <item>" }
      const result = await runToolByName(config, { name: "d3_compile_basic", input: { file, item, confirmed: state.safety === "trust" }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/catalog": {
      const [file, item, flag] = args
      if (!file || !item) return { output: "Usage: /catalog <file> <item> [(G]" }
      const result = await runToolByName(config, { name: "d3_catalog", input: { file, item, global: flag === "(G" || flag === "G", confirmed: state.safety === "trust" }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/call": {
      const [name, ...callArgs] = args
      if (!name) return { output: "Usage: /call <subroutine> [args...]" }
      const result = await runToolByName(config, { name: "d3_call_subroutine", input: { name, args: callArgs, confirmed: state.safety === "trust" }, safety: state.safety, profile: state.profile })
      return { output: result.compact }
    }
    case "/doctor": {
      const detection = await detectLocalD3(config.profiles.find((profile) => profile.name === state.profile)?.entryCommand)
      return {
        output: [
          `Model: ${state.model}`,
          `Safety: ${state.safety}`,
          `Profile: ${state.profile ?? "none"}`,
          `Mode: ${state.mode}`,
          `Profiles: ${config.profiles.length}`,
          `Local D3: ${detection.available ? "yes" : "no"} (${detection.details})`,
        ].join("\n"),
      }
    }
    case "/profile-doctor": {
      const profileName = args[0] ?? state.profile
      const profile = profileName ? config.profiles.find((item) => item.name === profileName) : config.profiles[0]
      if (!profile) return { output: "No profile configured." }
      return { output: renderProfileDoctor(await diagnoseProfile(profile)) }
    }
    case "/config":
      return { output: JSON.stringify({ defaultModel: config.defaultModel, defaultSafety: config.defaultSafety, defaultProfile: config.defaultProfile, profiles: config.profiles.map((profile) => profile.name) }, null, 2) }
    case "/clear":
      return { clear: true, output: "" }
    case "/exit":
    case "/quit":
      return { exit: true, output: "Goodbye." }
    default:
      return { output: `Unknown command: ${command}. Try /help.` }
  }
}
