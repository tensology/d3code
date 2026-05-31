import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { D3CodeConfig } from "../config/config.js"
import { saveConfig } from "../config/config.js"
import { normalizeProviderID, parseModelRef, providers } from "../providers/catalog.js"
import { discoverProviderModels } from "../providers/model-discovery.js"
import { secretRefForProvider, type SecretStore } from "../security/secrets.js"
import type { ConnectionProfile, SafetyMode } from "../domain/types.js"
import { D3_TCL_PROMPT_PATTERN, describeD3PromptPattern, normalizeD3PromptPattern } from "../d3/prompts.js"
import { DEFAULT_D3_PROFILE_NAME, inferLocalD3ProfileDefaults } from "../d3/profile-defaults.js"

const execFileAsync = promisify(execFile)

export interface Choice {
  id: string
  label: string
  hint?: string
}

function normalizeSafety(value: string): SafetyMode {
  if (value === "plan" || value === "trust" || value === "ask") return value
  return "ask"
}

function renderChoices(title: string, choices: Choice[]): void {
  console.log("")
  console.log(title)
  for (const [index, choice] of choices.entries()) {
    console.log(`  ${index + 1}. ${choice.label}${choice.hint ? ` - ${choice.hint}` : ""}`)
  }
}

export function resolveSetupChoice(input: string, choices: Choice[], fallback: string): string {
  const answer = input.trim().toLowerCase()
  if (!answer) return fallback
  const number = Number(answer)
  if (Number.isInteger(number) && number >= 1 && number <= choices.length) return choices[number - 1]?.id ?? fallback
  return choices.find((choice) => choice.id.toLowerCase() === answer || choice.label.toLowerCase() === answer)?.id ?? answer
}

export function isFreeModelID(model: string): boolean {
  const normalized = model.toLowerCase()
  return normalized.endsWith(":free") || normalized.endsWith("/free") || normalized.includes(":free/")
}

export function orderSetupModels(models: string[]): string[] {
  const free: string[] = []
  const paid: string[] = []
  for (const model of models) {
    if (isFreeModelID(model)) free.push(model)
    else paid.push(model)
  }
  return [...free, ...paid]
}

function modelChoices(models: string[]): Choice[] {
  return models.map((model) => ({ id: model, label: isFreeModelID(model) ? `${model} (free)` : model }))
}

function displayModelChoices(models: string[], limit = 50): string[] {
  return orderSetupModels(models).slice(0, limit)
}

export function configuredSetupProviderID(config: D3CodeConfig): string {
  try {
    const providerID = normalizeProviderID(parseModelRef(config.defaultModel).provider)
    return providers.some((provider) => provider.id === providerID) ? providerID : "openai"
  } catch {
    return "openai"
  }
}

export function configuredSetupModelForProvider(config: D3CodeConfig, providerID: string): string | undefined {
  try {
    const parsed = parseModelRef(config.defaultModel)
    return normalizeProviderID(parsed.provider) === providerID ? parsed.model : undefined
  } catch {
    return undefined
  }
}

export async function inferSshD3Defaults(input: { host: string; username: string; port: number }): Promise<{ entryCommand: string; startupInput: string; promptPattern: string; detectionDetails: string }> {
  try {
    const result = await execFileAsync("ssh", ["-p", String(input.port), `${input.username}@${input.host}`, "command -v d3 || true"], { timeout: 5_000 })
    const detected = result.stdout.trim().split(/\r?\n/).find(Boolean)
    return {
      entryCommand: detected ? "d3" : "d3",
      startupInput: "dm\ndm\n",
      promptPattern: D3_TCL_PROMPT_PATTERN,
      detectionDetails: detected ? `Rocket D3 detected at ${detected}` : "Could not verify d3 on PATH; using standard `d3` entry command.",
    }
  } catch {
    return {
      entryCommand: "d3",
      startupInput: "dm\ndm\n",
      promptPattern: D3_TCL_PROMPT_PATTERN,
      detectionDetails: "Could not probe SSH host; using standard Rocket D3 defaults.",
    }
  }
}

export async function runSetupWizard(config: D3CodeConfig, secrets: SecretStore): Promise<D3CodeConfig> {
  const rl = createInterface({ input, output })
  try {
    console.log("")
    console.log("D3 Code setup")
    console.log("Choose the model D3 Code should use, then optionally add a Rocket D3 connection profile.")
    const providerChoices = providers.map((provider) => ({
      id: provider.id,
      label: provider.name,
      hint: provider.id === "ollama" ? "local Ollama on this machine" : provider.id === "kilocode" ? "Kilo AI Gateway" : provider.id,
    }))
    renderChoices("Model provider", providerChoices)
    const defaultProviderID = configuredSetupProviderID(config)
    const defaultProviderIndex = providerChoices.findIndex((choice) => choice.id === defaultProviderID) + 1 || 1
    const defaultProviderLabel = providerChoices[defaultProviderIndex - 1]?.label ?? "OpenAI"
    const providerID = normalizeProviderID(resolveSetupChoice(await rl.question(`Provider 1-${providerChoices.length} [${defaultProviderIndex} ${defaultProviderLabel}]: `), providerChoices, defaultProviderID))
    const provider = providers.find((item) => item.id === providerID) ?? providers[0]
    if (provider.id === "ollama") {
      console.log("Ollama uses the local OpenAI-compatible endpoint at http://localhost:11434 by default.")
    }
    const key = provider.id === "ollama" ? "" : await rl.question(`API key for ${provider.name} (blank to use env ${provider.env.join("/")}): `)
    if (key.trim()) {
      const ref = secretRefForProvider(provider.id)
      await secrets.set(ref, key.trim())
      config.modelSecrets[provider.id] = ref
    }
    const discovery = await discoverProviderModels(provider, key.trim() || undefined)
    if (discovery.warning) console.log(discovery.warning)
    const visibleModels = displayModelChoices(discovery.models)
    const models = modelChoices(visibleModels)
    renderChoices(`${provider.name} model${discovery.source === "provider" ? ` (${discovery.models.length} fetched)` : ""}`, models)
    if (discovery.models.length > visibleModels.length) console.log(`Showing first ${visibleModels.length}. Type any exact model id to use another fetched model.`)
    const defaultModel = configuredSetupModelForProvider(config, provider.id) ?? visibleModels[0] ?? provider.defaultModel
    const model = resolveSetupChoice(await rl.question(`Model 1-${models.length} [${defaultModel}]: `), models, defaultModel)
    config.defaultModel = `${provider.id}/${model}`
    renderChoices("Default approval mode", [
      { id: "ask", label: "Ask", hint: "confirm risky actions before they run" },
      { id: "plan", label: "Plan", hint: "read and explain only" },
      { id: "trust", label: "Trust", hint: "allow normal guarded work" },
    ])
    config.defaultSafety = normalizeSafety(resolveSetupChoice(await rl.question("Approval mode 1-3 [1 Ask]: "), [
      { id: "ask", label: "Ask" },
      { id: "plan", label: "Plan" },
      { id: "trust", label: "Trust" },
    ], "ask"))

    renderChoices("Rocket D3 connection", [
      { id: "local", label: "This machine", hint: "run the D3 command from this shell" },
      { id: "ssh", label: "SSH server", hint: "connect to D3 on another server" },
      { id: "skip", label: "Skip for now", hint: "configure the model only" },
    ])
    const localOrSsh = resolveSetupChoice(await rl.question("Connection 1-3 [1 This machine]: "), [
      { id: "local", label: "This machine" },
      { id: "ssh", label: "SSH server" },
      { id: "skip", label: "Skip for now" },
    ], "local").toLowerCase()
    if (localOrSsh !== "skip") {
      const localDefaults = localOrSsh === "local" ? await inferLocalD3ProfileDefaults() : undefined
      if (localDefaults) console.log(`Detected local D3: ${localDefaults.detectionDetails}`)
      const defaultName = localOrSsh === "local" ? DEFAULT_D3_PROFILE_NAME : "prod"
      const profileName = (await rl.question(`Profile name [${defaultName}]: `)).trim() || defaultName
      const defaultAccount = localDefaults?.account ?? ""
      const account = (await rl.question(`Default D3 account name/path${defaultAccount ? ` [${defaultAccount}]` : ""}: `)).trim() || defaultAccount || undefined
      let profile: ConnectionProfile
      if (localOrSsh === "ssh") {
        const host = (await rl.question("SSH host/IP: ")).trim()
        const username = (await rl.question("SSH username: ")).trim()
        const port = Number((await rl.question("SSH port [22]: ")).trim() || "22")
        const sshDefaults = await inferSshD3Defaults({ host, username, port })
        console.log(`Detected SSH D3 defaults: ${sshDefaults.detectionDetails}`)
        profile = {
          name: profileName,
          type: "ssh",
          host,
          username,
          port,
          account,
          entryCommand: sshDefaults.entryCommand,
          startupInput: sshDefaults.startupInput,
          promptPattern: sshDefaults.promptPattern,
          sessionMode: "persistent",
          safetyDefault: config.defaultSafety,
        }
      } else {
        const defaultEntry = localDefaults?.entryCommand ?? ""
        const entryCommand = (await rl.question(`Command to enter D3/TCL${defaultEntry ? ` [${defaultEntry}]` : " (blank if shell already lands there)"}: `)).trim() || defaultEntry || undefined
        const defaultStartup = localDefaults?.startupInput?.replace(/\r/g, "\\n").replace(/\n/g, "\\n") ?? ""
        const startupAnswer = (await rl.question(`Startup input after D3 opens (use \\n for newlines${defaultStartup ? `, default ${defaultStartup}` : ", blank for none"}): `)).trim().replace(/\\n/g, "\n") || localDefaults?.startupInput || undefined
        const startupInput = entryCommand && /(^|[\/\s])d3(\s|$)/i.test(entryCommand) ? startupAnswer?.replace(/\n/g, "\r") : startupAnswer
        console.log(describeD3PromptPattern())
        const promptDefault = localDefaults?.promptPattern ?? D3_TCL_PROMPT_PATTERN
        const promptPattern = normalizeD3PromptPattern(await rl.question(`D3 prompt regex [${promptDefault}]: `)) || promptDefault
        renderChoices("D3 runtime session", [
          { id: "persistent", label: "Keep connected", hint: "best for the IDE and agent" },
          { id: "oneshot", label: "One command at a time", hint: "safer but less interactive" },
        ])
        const sessionModeAnswer = resolveSetupChoice(await rl.question("Session 1-2 [1 Keep connected]: "), [
          { id: "persistent", label: "Keep connected" },
          { id: "oneshot", label: "One command at a time" },
        ], "persistent").toLowerCase()
        const sessionMode = sessionModeAnswer === "oneshot" ? "oneshot" : "persistent"
        profile = { name: profileName, type: "local", account, entryCommand, startupInput, promptPattern, sessionMode, safetyDefault: config.defaultSafety }
      }
      config.profiles = [...config.profiles.filter((item) => item.name !== profile.name), profile]
      config.defaultProfile = profile.name
    }
    await saveConfig(config)
    return config
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ABORT_ERR") {
      console.log("\nSetup cancelled.")
      return config
    }
    throw error
  } finally {
    rl.close()
  }
}
