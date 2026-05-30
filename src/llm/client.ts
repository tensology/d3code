import type { SecretStore } from "../security/secrets.js"
import type { D3CodeConfig } from "../config/config.js"
import { resolveModel } from "../providers/catalog.js"

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
}

export interface ChatRequest {
  modelRef: string
  messages: ChatMessage[]
}

export interface ChatResponse {
  content: string
  provider: string
  model: string
  raw?: unknown
}

export class MissingModelKeyError extends Error {
  constructor(readonly provider: string, readonly env: string[]) {
    super(`Missing API key for ${provider}. Configure one with /setup or set ${env.join(" or ")}.`)
  }
}

function modelSecretRef(config: D3CodeConfig, provider: string): string | undefined {
  return config.modelSecrets[provider]
}

async function providerKey(config: D3CodeConfig, secrets: SecretStore, provider: string, env: string[]): Promise<string> {
  const configured = modelSecretRef(config, provider)
  if (configured) {
    const value = await secrets.get(configured)
    if (value) return value
  }
  for (const name of env) {
    const value = process.env[name]
    if (value) return value
  }
  throw new MissingModelKeyError(provider, env)
}

export async function chat(config: D3CodeConfig, secrets: SecretStore, request: ChatRequest): Promise<ChatResponse> {
  const { provider, model } = resolveModel(request.modelRef)
  if (provider.id === "anthropic") return anthropicChat(config, secrets, provider.env, model, request.messages)
  return openAICompatibleChat(config, secrets, provider.id, provider.env, model, request.messages)
}

async function openAICompatibleChat(config: D3CodeConfig, secrets: SecretStore, provider: string, env: string[], model: string, messages: ChatMessage[]): Promise<ChatResponse> {
  const key = provider === "ollama" ? "" : await providerKey(config, secrets, provider, env)
  const baseURL = provider === "openrouter"
    ? "https://openrouter.ai/api"
    : provider === "ollama"
      ? process.env.D3CODE_LOCAL_BASE_URL ?? "http://localhost:11434"
      : "https://api.openai.com"
  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ model, messages: messages.map((message) => ({ role: message.role === "tool" ? "user" : message.role, content: message.content })) }),
  })
  const raw = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
  if (!response.ok) throw new Error(raw.error?.message ?? `Provider request failed with ${response.status}`)
  return { provider, model, content: raw.choices?.[0]?.message?.content ?? "", raw }
}

async function anthropicChat(config: D3CodeConfig, secrets: SecretStore, env: string[], model: string, messages: ChatMessage[]): Promise<ChatResponse> {
  const key = await providerKey(config, secrets, "anthropic", env)
  const system = messages.find((message) => message.role === "system")?.content
  const bodyMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }))
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: bodyMessages }),
  })
  const raw = await response.json() as { content?: Array<{ text?: string }>; error?: { message?: string } }
  if (!response.ok) throw new Error(raw.error?.message ?? `Provider request failed with ${response.status}`)
  return { provider: "anthropic", model, content: raw.content?.map((part) => part.text ?? "").join("") ?? "", raw }
}
