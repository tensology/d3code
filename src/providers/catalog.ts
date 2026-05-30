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
    id: "local",
    name: "Local/Ollama OpenAI-compatible",
    env: ["D3CODE_LOCAL_BASE_URL"],
    defaultModel: "local/default",
    models: ["local/default", "llama3.1", "qwen2.5-coder:7b", "codellama"],
    openAICompatible: true,
  },
]

export function parseModelRef(ref: string): { provider: string; model: string } {
  const [provider, ...modelParts] = ref.split("/")
  if (!provider || modelParts.length === 0) throw new Error(`Model must be provider/model, got: ${ref}`)
  return { provider, model: modelParts.join("/") }
}

export function resolveModel(ref?: string): { provider: ProviderInfo; model: string } {
  const parsed = parseModelRef(ref ?? "openai/gpt-5")
  const provider = providers.find((candidate) => candidate.id === parsed.provider)
  if (!provider) throw new Error(`Unknown provider: ${parsed.provider}`)
  return { provider, model: parsed.model }
}
