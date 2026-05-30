export interface ProviderInfo {
  id: string
  name: string
  env: string[]
  defaultModel: string
  models: string[]
  openAICompatible?: boolean
}

export const providers: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    env: ["OPENAI_API_KEY"],
    defaultModel: "gpt-5",
    models: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    env: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-sonnet-4-5",
    models: ["claude-opus-4-1", "claude-sonnet-4-5", "claude-haiku-4-5"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    env: ["OPENROUTER_API_KEY"],
    defaultModel: "openai/gpt-5",
    models: ["openai/gpt-5", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro"],
    openAICompatible: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    env: ["D3CODE_LOCAL_BASE_URL"],
    defaultModel: "llama3.1",
    models: ["llama3.1", "qwen2.5-coder:7b", "codellama"],
    openAICompatible: true,
  },
]

export function normalizeProviderID(provider: string): string {
  return provider === "local" ? "ollama" : provider
}

export function parseModelRef(ref: string): { provider: string; model: string } {
  const [provider, ...modelParts] = ref.split("/")
  if (!provider || modelParts.length === 0) throw new Error(`Model must be provider/model, got: ${ref}`)
  return { provider, model: modelParts.join("/") }
}

export function resolveModel(ref?: string): { provider: ProviderInfo; model: string } {
  const parsed = parseModelRef(ref ?? "openai/gpt-5")
  const providerID = normalizeProviderID(parsed.provider)
  const provider = providers.find((candidate) => candidate.id === providerID)
  if (!provider) throw new Error(`Unknown provider: ${parsed.provider}`)
  const model = parsed.provider === "local" && parsed.model === "local/default" ? provider.defaultModel : parsed.model
  return { provider, model }
}
