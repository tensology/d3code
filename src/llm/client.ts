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
  onToken?: (token: string) => void
  signal?: AbortSignal
}

export interface ChatUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

export interface ChatResponse {
  content: string
  provider: string
  model: string
  usage?: ChatUsage
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
  if (provider.id === "anthropic") return anthropicChat(config, secrets, provider.env, model, request.messages, request.onToken, request.signal)
  return openAICompatibleChat(config, secrets, provider.id, provider.env, model, request.messages, provider.baseURL, provider.chatPath, request.onToken, request.signal)
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new Error(`Provider returned invalid JSON: ${(error as Error).message}. Body: ${text.slice(0, 240)}`)
  }
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function openAIUsage(raw: unknown): ChatUsage | undefined {
  const usage = raw && typeof raw === "object" && "usage" in raw ? (raw as { usage?: unknown }).usage : raw
  if (!usage || typeof usage !== "object") return undefined
  const record = usage as Record<string, unknown>
  const inputTokens = numberField(record.prompt_tokens ?? record.input_tokens)
  const outputTokens = numberField(record.completion_tokens ?? record.output_tokens)
  const totalTokens = numberField(record.total_tokens) || inputTokens + outputTokens
  if (!inputTokens && !outputTokens && !totalTokens) return undefined
  return { inputTokens, outputTokens, totalTokens }
}

export function anthropicUsage(raw: unknown): ChatUsage | undefined {
  const usage = raw && typeof raw === "object" && "usage" in raw ? (raw as { usage?: unknown }).usage : raw
  if (!usage || typeof usage !== "object") return undefined
  const record = usage as Record<string, unknown>
  const inputTokens = numberField(record.input_tokens)
  const outputTokens = numberField(record.output_tokens)
  const cacheReadInputTokens = numberField(record.cache_read_input_tokens)
  const cacheCreationInputTokens = numberField(record.cache_creation_input_tokens)
  const totalTokens = inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens
  if (!totalTokens) return undefined
  return { inputTokens, outputTokens, totalTokens, cacheReadInputTokens, cacheCreationInputTokens }
}

async function readOpenAIStream(response: Response, onToken: (token: string) => void): Promise<{ content: string; usage?: ChatUsage }> {
  if (!response.body) return { content: "" }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let content = ""
  let usage: ChatUsage | undefined
  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) return
    const data = trimmed.slice(5).trim()
    if (!data || data === "[DONE]") return
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>; usage?: unknown }
    usage = openAIUsage(parsed) ?? usage
    const token = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? ""
    if (!token) return
    content += token
    onToken(token)
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      processLine(line)
    }
  }
  if (buffer.trim()) processLine(buffer)
  return { content, usage }
}

async function openAICompatibleChat(config: D3CodeConfig, secrets: SecretStore, provider: string, env: string[], model: string, messages: ChatMessage[], configuredBaseURL?: string, configuredChatPath = "/v1/chat/completions", onToken?: (token: string) => void, signal?: AbortSignal): Promise<ChatResponse> {
  const key = provider === "ollama" ? "" : await providerKey(config, secrets, provider, env)
  const baseURL = provider === "openrouter"
    ? configuredBaseURL ?? "https://openrouter.ai/api"
    : provider === "ollama"
      ? process.env.D3CODE_OLLAMA_BASE_URL ?? process.env.D3CODE_LOCAL_BASE_URL ?? "http://localhost:11434"
      : configuredBaseURL ?? "https://api.openai.com"
  const stream = Boolean(onToken)
  const body = {
    model,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    messages: messages.map((message) => ({ role: message.role === "tool" ? "user" : message.role, content: message.content })),
  }
  const response = await fetch(`${baseURL}${configuredChatPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
  if (onToken && response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
    const { content, usage } = await readOpenAIStream(response, onToken)
    return { provider, model, content, usage, raw: { streamed: true, usage } }
  }
  const raw = await readJsonResponse(response) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string }; usage?: unknown }
  if (!response.ok) throw new Error(raw.error?.message ?? `Provider request failed with ${response.status}`)
  const content = raw.choices?.[0]?.message?.content ?? ""
  if (onToken && content) onToken(content)
  return { provider, model, content, usage: openAIUsage(raw), raw }
}

function mergeAnthropicUsage(current: ChatUsage | undefined, next: ChatUsage | undefined): ChatUsage | undefined {
  if (!next) return current
  const inputTokens = Math.max(current?.inputTokens ?? 0, next.inputTokens)
  const outputTokens = Math.max(current?.outputTokens ?? 0, next.outputTokens)
  const cacheReadInputTokens = Math.max(current?.cacheReadInputTokens ?? 0, next.cacheReadInputTokens ?? 0)
  const cacheCreationInputTokens = Math.max(current?.cacheCreationInputTokens ?? 0, next.cacheCreationInputTokens ?? 0)
  const totalTokens = inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    ...(cacheReadInputTokens ? { cacheReadInputTokens } : {}),
    ...(cacheCreationInputTokens ? { cacheCreationInputTokens } : {}),
  }
}

async function readAnthropicStream(response: Response, onToken: (token: string) => void): Promise<{ content: string; usage?: ChatUsage }> {
  if (!response.body) return { content: "" }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let content = ""
  let usage: ChatUsage | undefined
  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) return
    const data = trimmed.slice(5).trim()
    if (!data || data === "[DONE]") return
    const parsed = JSON.parse(data) as {
      type?: string
      delta?: { type?: string; text?: string }
      message?: { usage?: unknown }
      usage?: unknown
    }
    usage = mergeAnthropicUsage(usage, anthropicUsage(parsed.message?.usage ? { usage: parsed.message.usage } : parsed.usage ? { usage: parsed.usage } : undefined))
    const token = parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" ? parsed.delta.text ?? "" : ""
    if (!token) return
    content += token
    onToken(token)
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      processLine(line)
    }
  }
  if (buffer.trim()) processLine(buffer)
  return { content, usage }
}

async function anthropicChat(config: D3CodeConfig, secrets: SecretStore, env: string[], model: string, messages: ChatMessage[], onToken?: (token: string) => void, signal?: AbortSignal): Promise<ChatResponse> {
  const key = await providerKey(config, secrets, "anthropic", env)
  const system = messages.find((message) => message.role === "system")?.content
  const bodyMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }))
  const stream = Boolean(onToken)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: bodyMessages, ...(stream ? { stream: true } : {}) }),
    signal,
  })
  if (onToken && response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
    const { content, usage } = await readAnthropicStream(response, onToken)
    return { provider: "anthropic", model, content, usage, raw: { streamed: true, usage } }
  }
  const raw = await readJsonResponse(response) as { content?: Array<{ text?: string }>; error?: { message?: string }; usage?: unknown }
  if (!response.ok) throw new Error(raw.error?.message ?? `Provider request failed with ${response.status}`)
  return { provider: "anthropic", model, content: raw.content?.map((part) => part.text ?? "").join("") ?? "", usage: anthropicUsage(raw), raw }
}
