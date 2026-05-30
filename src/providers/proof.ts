import type { D3CodeConfig } from "../config/config.js"
import type { SecretStore } from "../security/secrets.js"
import { providers, resolveModel } from "./catalog.js"
import { createModelRoutingPlan, type ModelBias } from "./routing.js"

export interface ProviderProofItem {
  id: string
  status: "ok" | "action" | "missing"
  evidence: string[]
  next: string
}

export interface ModelProofReport {
  ready: boolean
  defaultModel: string
  items: ProviderProofItem[]
}

function item(values: ProviderProofItem): ProviderProofItem {
  return values
}

function rank(status: ProviderProofItem["status"]): number {
  return { missing: 0, action: 1, ok: 2 }[status]
}

function providerOf(modelRef: string): string {
  return modelRef.split("/")[0] ?? ""
}

async function secretPresent(secrets: SecretStore | undefined, ref: string | undefined): Promise<boolean> {
  if (!ref || !secrets) return false
  return Boolean(await secrets.get(ref))
}

export async function createModelProofReport(config: D3CodeConfig, secrets?: SecretStore, options: { mode?: string; bias?: ModelBias } = {}): Promise<ModelProofReport> {
  const items: ProviderProofItem[] = []
  let defaultProvider = ""
  try {
    const resolved = resolveModel(config.defaultModel)
    defaultProvider = resolved.provider.id
    items.push(item({
      id: "default-model",
      status: "ok",
      evidence: [`provider:${resolved.provider.id}`, `model:${resolved.model}`],
      next: "Use `d3code --model <provider/model>` or `/model <provider/model>` to switch per session.",
    }))
  } catch (error) {
    items.push(item({
      id: "default-model",
      status: "missing",
      evidence: [error instanceof Error ? error.message : String(error)],
      next: "Run `d3code setup --provider <provider> --default-model <model>`.",
    }))
  }

  for (const provider of providers) {
    const configuredRef = config.modelSecrets[provider.id]
    const envPresent = provider.env.some((name) => Boolean(process.env[name]))
    const configuredPresent = await secretPresent(secrets, configuredRef)
    const local = provider.id === "local"
    const status: ProviderProofItem["status"] = local
      ? process.env.D3CODE_LOCAL_BASE_URL ? "ok" : "action"
      : configuredPresent || envPresent ? "ok" : configuredRef ? "action" : "missing"
    items.push(item({
      id: `provider-${provider.id}`,
      status,
      evidence: [
        `models:${provider.models.join(",")}`,
        `env:${provider.env.join("|")}`,
        `secret-ref:${configuredRef ?? "none"}`,
        `secret-present:${configuredPresent ? "yes" : "no"}`,
        `env-present:${envPresent ? "yes" : "no"}`,
        ...(local ? [`base-url:${process.env.D3CODE_LOCAL_BASE_URL ?? "default:http://localhost:11434"}`] : []),
      ],
      next: status === "ok"
        ? `Provider ${provider.id} can be selected with /model ${provider.id}/${provider.defaultModel}.`
        : local
          ? "Set D3CODE_LOCAL_BASE_URL if the local OpenAI-compatible endpoint is not the default Ollama URL. Do not include /v1; D3 Code adds it."
          : `Set ${provider.env.join(" or ")} or run setup with --api-key-env for ${provider.id}.`,
    }))
  }

  const routing = createModelRoutingPlan(config, options.mode ?? "migrate", options.bias ?? "balanced")
  const missingRouteProviders = [...new Set(routing.routes.map((route) => providerOf(route.recommended)).filter((provider) => provider !== "local" && !config.modelSecrets[provider] && !providers.find((item) => item.id === provider)?.env.some((env) => Boolean(process.env[env]))))]
  items.push(item({
    id: "routing-readiness",
    status: routing.ready && missingRouteProviders.length === 0 ? "ok" : "action",
    evidence: [`mode:${routing.mode}`, `bias:${routing.bias}`, `routes:${routing.routes.length}`, `missing-route-providers:${missingRouteProviders.join(",") || "none"}`],
    next: routing.ready ? "Keep model-routing output with setup proof." : "Run `d3code model-routing migrate` and configure missing route provider secrets or choose local bias.",
  }))

  return {
    ready: items.find((entry) => entry.id === "default-model")?.status === "ok" && items.some((entry) => entry.id === `provider-${defaultProvider}` && entry.status === "ok"),
    defaultModel: config.defaultModel,
    items: items.sort((a, b) => rank(b.status) - rank(a.status) || a.id.localeCompare(b.id)),
  }
}

export function renderModelProofReport(report: ModelProofReport): string {
  return [
    "# D3 Model Proof",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Default model: ${report.defaultModel}`,
    "",
    ...report.items.map((entry) => [
      `- [${entry.status}] ${entry.id}`,
      `  evidence: ${entry.evidence.join("; ")}`,
      `  next: ${entry.next}`,
    ].join("\n")),
    "",
  ].join("\n")
}
