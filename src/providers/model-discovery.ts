import type { ProviderInfo } from "./catalog.js"

export interface ModelDiscoveryResult {
  models: string[]
  source: "provider" | "fallback"
  warning?: string
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function bearer(key?: string): Record<string, string> {
  return key ? { authorization: `Bearer ${key}` } : {}
}

function envKey(provider: ProviderInfo): string | undefined {
  for (const name of provider.env) {
    if (process.env[name]) return process.env[name]
  }
  return undefined
}

function idsFromData(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || !("data" in raw) || !Array.isArray(raw.data)) return []
  return raw.data.flatMap((item) => item && typeof item === "object" && "id" in item && typeof item.id === "string" ? [item.id] : [])
}

function idsFromOllama(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || !("models" in raw) || !Array.isArray(raw.models)) return []
  return raw.models.flatMap((item) => item && typeof item === "object" && "name" in item && typeof item.name === "string" ? [item.name] : [])
}

async function requestModels(provider: ProviderInfo, key: string | undefined, fetchFn: FetchLike): Promise<string[]> {
  if (provider.id === "anthropic") {
    const response = await fetchFn("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key ?? "", "anthropic-version": "2023-06-01" },
    })
    if (!response.ok) throw new Error(`Anthropic returned ${response.status}`)
    return idsFromData(await response.json())
  }

  if (provider.id === "openrouter") {
    const response = await fetchFn("https://openrouter.ai/api/v1/models", { headers: bearer(key) })
    if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`)
    return idsFromData(await response.json())
  }

  if (provider.id === "kilocode") {
    const response = await fetchFn(`${provider.baseURL ?? "https://api.kilo.ai/api/gateway"}/models`, { headers: bearer(key) })
    if (!response.ok) throw new Error(`Kilo Code Gateway returned ${response.status}`)
    return idsFromData(await response.json())
  }

  if (provider.id === "ollama") {
    const baseURL = process.env.D3CODE_OLLAMA_BASE_URL ?? process.env.D3CODE_LOCAL_BASE_URL ?? "http://localhost:11434"
    const response = await fetchFn(`${baseURL}/api/tags`)
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
    return idsFromOllama(await response.json())
  }

  const response = await fetchFn("https://api.openai.com/v1/models", { headers: bearer(key) })
  if (!response.ok) throw new Error(`${provider.name} returned ${response.status}`)
  return idsFromData(await response.json())
}

export async function discoverProviderModels(provider: ProviderInfo, explicitKey?: string, fetchFn: FetchLike = fetch): Promise<ModelDiscoveryResult> {
  const key = explicitKey || envKey(provider)
  try {
    const discovered = unique(await requestModels(provider, key, fetchFn))
    if (discovered.length) return { models: discovered, source: "provider" }
    return { models: provider.models, source: "fallback", warning: `${provider.name} returned no models; using built-in fallback list.` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { models: provider.models, source: "fallback", warning: `Could not fetch ${provider.name} models (${message}); using built-in fallback list.` }
  }
}
