import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import { resolveModel } from "../providers/catalog.js"
import type { SecretStore } from "../security/secrets.js"
import type { SafetyMode } from "../domain/types.js"

export interface WelcomeState {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
}

export async function renderWelcome(config: D3CodeConfig, secrets: SecretStore, state: WelcomeState): Promise<string> {
  const profile = selectProfile(config, state.profile)
  const modelRef = state.model || config.defaultModel
  let providerLine = `AI provider: ${modelRef}`
  try {
    const { provider, model } = resolveModel(modelRef)
    const secretRef = config.modelSecrets[provider.id] ?? (provider.id === "ollama" ? config.modelSecrets.local : undefined)
    const envReady = provider.env.some((name) => Boolean(process.env[name]))
    const secretReady = secretRef ? Boolean(await secrets.get(secretRef)) : false
    const ready = provider.id === "ollama" || envReady || secretReady
    providerLine = `AI provider: ${ready ? "connected" : "not connected"} (${provider.name}, ${model})`
  } catch {
    providerLine = `AI provider: check setup (${modelRef})`
  }

  const d3Line = profile
    ? `D3 profile: ${profile.name} (${profile.type}${profile.account ? `, account ${profile.account}` : ""}${profile.sessionMode === "persistent" ? ", persistent session" : ""})`
    : "D3 profile: not connected"

  const tokenLine = "Context: token usage appears after the first model response"

  return [
    "D3 Code",
    "",
    providerLine,
    `Model: ${modelRef}`,
    d3Line,
    `Mode: ${state.mode}  Safety: ${state.safety}`,
    tokenLine,
    "",
    profile
      ? "Ask me to inspect files, dictionaries, BASIC, subroutines, or runtime output."
      : "Add a D3 profile when you are ready: /status shows exact setup commands.",
    "Use /help for controls, /status for the full readiness report, /ide for the browser IDE.",
  ].join("\n")
}
