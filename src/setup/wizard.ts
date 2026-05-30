import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import type { D3CodeConfig } from "../config/config.js"
import { saveConfig } from "../config/config.js"
import { normalizeProviderID, providers } from "../providers/catalog.js"
import type { SecretStore } from "../security/secrets.js"
import type { ConnectionProfile, SafetyMode } from "../domain/types.js"

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

function modelChoices(provider: { models: string[] }): Choice[] {
  return provider.models.map((model) => ({ id: model, label: model }))
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
    const providerID = normalizeProviderID(resolveSetupChoice(await rl.question(`Provider 1-${providerChoices.length} [1 OpenAI]: `), providerChoices, "openai"))
    const provider = providers.find((item) => item.id === providerID) ?? providers[0]
    if (provider.id === "ollama") {
      console.log("Ollama uses the local OpenAI-compatible endpoint at http://localhost:11434 by default.")
    }
    const key = provider.id === "ollama" ? "" : await rl.question(`API key for ${provider.name} (blank to use env ${provider.env.join("/")}): `)
    if (key.trim()) {
      const ref = `keychain:model:${provider.id}`
      await secrets.set(ref, key.trim())
      config.modelSecrets[provider.id] = ref
    }
    const models = modelChoices(provider)
    renderChoices(`${provider.name} model`, models)
    const model = resolveSetupChoice(await rl.question(`Model 1-${models.length} [1 ${provider.defaultModel}]: `), models, provider.defaultModel)
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
      const profileName = (await rl.question("Profile name [default]: ")).trim() || "default"
      const account = (await rl.question("Default D3 account name/path: ")).trim() || undefined
      const allowedAccounts = (await rl.question("Allowed D3 accounts for this profile (comma-separated, blank for no allowlist): ")).trim()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const entryCommand = (await rl.question("Command to enter D3/TCL on that server (blank if shell already lands there): ")).trim() || undefined
      const promptPattern = (await rl.question("D3 prompt regex [>]: ")).trim() || ">"
      renderChoices("D3 runtime session", [
        { id: "persistent", label: "Keep connected", hint: "best for the IDE and agent" },
        { id: "oneshot", label: "One command at a time", hint: "safer but less interactive" },
      ])
      const sessionModeAnswer = resolveSetupChoice(await rl.question("Session 1-2 [1 Keep connected]: "), [
        { id: "persistent", label: "Keep connected" },
        { id: "oneshot", label: "One command at a time" },
      ], "persistent").toLowerCase()
      const sessionMode = sessionModeAnswer === "oneshot" ? "oneshot" : "persistent"
      let profile: ConnectionProfile
      if (localOrSsh === "ssh") {
        profile = {
          name: profileName,
          type: "ssh",
          host: (await rl.question("SSH host/IP: ")).trim(),
          username: (await rl.question("SSH username: ")).trim(),
          port: Number((await rl.question("SSH port [22]: ")).trim() || "22"),
          account,
          entryCommand,
          promptPattern,
          sessionMode,
          safetyDefault: config.defaultSafety,
          allowedAccounts: allowedAccounts.length ? allowedAccounts : undefined,
        }
      } else {
        profile = { name: profileName, type: "local", account, entryCommand, promptPattern, sessionMode, safetyDefault: config.defaultSafety, allowedAccounts: allowedAccounts.length ? allowedAccounts : undefined }
      }
      config.profiles = [...config.profiles.filter((item) => item.name !== profile.name), profile]
      config.defaultProfile = profile.name
    }
    await saveConfig(config)
    return config
  } finally {
    rl.close()
  }
}
