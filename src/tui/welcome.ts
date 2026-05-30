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

export interface WelcomeSummary {
  providerStatus: "connected" | "not connected" | "check setup"
  providerName: string
  providerModel: string
  modelRef: string
  d3Status: "connected" | "not connected"
  d3Detail: string
  mode: string
  safety: SafetyMode
  tokenLine: string
  primaryAction: string
}

export async function createWelcomeSummary(config: D3CodeConfig, secrets: SecretStore, state: WelcomeState): Promise<WelcomeSummary> {
  const profile = selectProfile(config, state.profile)
  const modelRef = state.model || config.defaultModel
  let providerStatus: WelcomeSummary["providerStatus"] = "check setup"
  let providerName = "unknown provider"
  let providerModel = modelRef
  try {
    const { provider, model } = resolveModel(modelRef)
    const secretRef = config.modelSecrets[provider.id] ?? (provider.id === "ollama" ? config.modelSecrets.local : undefined)
    const envReady = provider.env.some((name) => Boolean(process.env[name]))
    const secretReady = secretRef ? Boolean(await secrets.get(secretRef)) : false
    const ready = provider.id === "ollama" || envReady || secretReady
    providerStatus = ready ? "connected" : "not connected"
    providerName = provider.name
    providerModel = model
  } catch {
    providerStatus = "check setup"
  }

  const d3Status = profile ? "connected" : "not connected"
  const d3Detail = profile
    ? `${profile.name} (${profile.type}${profile.account ? `, account ${profile.account}` : ""}${profile.sessionMode === "persistent" ? ", persistent session" : ""})`
    : "No D3 profile selected"

  return {
    providerStatus,
    providerName,
    providerModel,
    modelRef,
    d3Status,
    d3Detail,
    mode: state.mode,
    safety: state.safety,
    tokenLine: "Token usage appears after the first model response",
    primaryAction: profile
      ? "Ask me to inspect files, dictionaries, BASIC, subroutines, or runtime output."
      : "Add a D3 profile when you are ready. /status shows exact setup commands.",
  }
}

export async function renderWelcome(config: D3CodeConfig, secrets: SecretStore, state: WelcomeState): Promise<string> {
  const summary = await createWelcomeSummary(config, secrets, state)
  return [
    "D3 Code",
    "",
    `AI provider: ${summary.providerStatus} (${summary.providerName}, ${summary.providerModel})`,
    `Model: ${summary.modelRef}`,
    `D3 profile: ${summary.d3Status === "connected" ? summary.d3Detail : "not connected"}`,
    `Mode: ${summary.mode}  Safety: ${summary.safety}`,
    `Context: ${summary.tokenLine}`,
    "",
    summary.primaryAction,
    "Use /help for controls, /status for the full readiness report, /ide for the browser IDE.",
  ].join("\n")
}
