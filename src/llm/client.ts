import type { SecretStore } from "../security/secrets.js"
import type { D3CodeConfig } from "../config/config.js"
import { resolveModel } from "../providers/catalog.js"

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  /** Raw JSON argument string as emitted by the provider. */
  arguments: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  /** Set on tool-result messages so providers can pair them with the request. */
  toolCallId?: string
  /** Set on assistant messages that natively requested tools. */
  toolCalls?: ToolCall[]
}

export interface ChatRequest {
  modelRef: string
  messages: ChatMessage[]
  /** Native function/tool schemas. When empty, providers run text-only. */
  tools?: ToolSchema[]
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
  /** Native tool calls requested by the model, if any. */
  toolCalls?: ToolCall[]
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
  if (provider.id === "anthropic") return anthropicChat(config, secrets, provider.env, model, request.messages, request.tools, request.onToken, request.signal)
  return openAICompatibleChat(config, secrets, provider.id, provider.env, model, request.messages, request.tools, provider.baseURL, provider.chatPath, request.onToken, request.signal)
}

function toOpenAIMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === "tool") {
      // Native tool result when the assistant requested it; otherwise a plain
      // user turn so text-only (XML fallback) providers still see the evidence.
      return message.toolCallId
        ? { role: "tool", tool_call_id: message.toolCallId, content: message.content || "(no output)" }
        : { role: "user", content: message.content }
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } })),
      }
    }
    return { role: message.role, content: message.content }
  })
}

function toOpenAITools(tools?: ToolSchema[]): Array<Record<string, unknown>> | undefined {
  if (!tools?.length) return undefined
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }))
}

function parseOpenAIToolCalls(message: { tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } | undefined): ToolCall[] | undefined {
  const calls = (message?.tool_calls ?? [])
    .filter((part) => part.function?.name)
    .map((part, index) => ({ id: part.id ?? `call_${index}`, name: part.function!.name!, arguments: part.function?.arguments ?? "{}" }))
  return calls.length ? calls : undefined
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

interface StreamedToolCall {
  id: string
  name: string
  arguments: string
}

function collectStreamedToolCalls(acc: Record<number, StreamedToolCall>): ToolCall[] {
  return Object.keys(acc)
    .map((key) => Number(key))
    .sort((a, b) => a - b)
    .map((index) => {
      const call = acc[index]!
      return { id: call.id || `call_${index}`, name: call.name, arguments: call.arguments || "{}" }
    })
    .filter((call) => call.name)
}

async function readOpenAIStream(response: Response, onToken: (token: string) => void): Promise<{ content: string; usage?: ChatUsage; toolCalls?: ToolCall[] }> {
  if (!response.body) return { content: "" }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let content = ""
  let usage: ChatUsage | undefined
  const toolCallAcc: Record<number, StreamedToolCall> = {}
  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) return
    const data = trimmed.slice(5).trim()
    if (!data || data === "[DONE]") return
    const parsed = JSON.parse(data) as {
      choices?: Array<{
        delta?: { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }
        message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
      }>
      usage?: unknown
    }
    usage = openAIUsage(parsed) ?? usage
    const choice = parsed.choices?.[0]
    const token = choice?.delta?.content ?? choice?.message?.content ?? ""
    if (token) {
      content += token
      onToken(token)
    }
    for (const part of choice?.delta?.tool_calls ?? []) {
      const index = typeof part.index === "number" ? part.index : 0
      const current = toolCallAcc[index] ?? (toolCallAcc[index] = { id: "", name: "", arguments: "" })
      if (part.id) current.id = part.id
      if (part.function?.name) current.name += part.function.name
      if (part.function?.arguments) current.arguments += part.function.arguments
    }
    ;(choice?.message?.tool_calls ?? []).forEach((part, index) => {
      toolCallAcc[index] = { id: part.id ?? `call_${index}`, name: part.function?.name ?? "", arguments: part.function?.arguments ?? "{}" }
    })
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
  const toolCalls = collectStreamedToolCalls(toolCallAcc)
  return { content, usage, ...(toolCalls.length ? { toolCalls } : {}) }
}

async function openAICompatibleChat(config: D3CodeConfig, secrets: SecretStore, provider: string, env: string[], model: string, messages: ChatMessage[], tools?: ToolSchema[], configuredBaseURL?: string, configuredChatPath = "/v1/chat/completions", onToken?: (token: string) => void, signal?: AbortSignal): Promise<ChatResponse> {
  const key = provider === "ollama" ? "" : await providerKey(config, secrets, provider, env)
  const baseURL = provider === "openrouter"
    ? configuredBaseURL ?? "https://openrouter.ai/api"
    : provider === "ollama"
      ? process.env.D3CODE_OLLAMA_BASE_URL ?? process.env.D3CODE_LOCAL_BASE_URL ?? "http://localhost:11434"
      : configuredBaseURL ?? "https://api.openai.com"
  const stream = Boolean(onToken)
  const openAITools = toOpenAITools(tools)
  const body = {
    model,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(openAITools ? { tools: openAITools, tool_choice: "auto" } : {}),
    messages: toOpenAIMessages(messages),
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
  const contentType = response.headers.get("content-type") ?? ""
  const shouldReadStream = onToken && response.ok && response.body && !contentType.includes("application/json")
  if (shouldReadStream) {
    const { content, usage, toolCalls } = await readOpenAIStream(response, onToken)
    return { provider, model, content, usage, toolCalls, raw: { streamed: true, usage, toolCalls } }
  }
  const raw = await readJsonResponse(response) as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>; error?: { message?: string }; usage?: unknown }
  if (!response.ok) throw new Error(raw.error?.message ?? `Provider request failed with ${response.status}`)
  const message = raw.choices?.[0]?.message
  const content = message?.content ?? ""
  const toolCalls = parseOpenAIToolCalls(message)
  if (onToken && content) onToken(content)
  return { provider, model, content, usage: openAIUsage(raw), toolCalls, raw }
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

function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const message of messages) {
    if (message.role === "system") continue
    if (message.role === "tool") {
      out.push({ role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId ?? "call_0", content: message.content || "(no output)" }] })
      continue
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      const blocks: Array<Record<string, unknown>> = []
      if (message.content) blocks.push({ type: "text", text: message.content })
      for (const call of message.toolCalls) {
        let input: unknown = {}
        try {
          input = JSON.parse(call.arguments)
        } catch {
          input = {}
        }
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input })
      }
      out.push({ role: "assistant", content: blocks })
      continue
    }
    out.push({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })
  }
  return out
}

async function anthropicChat(config: D3CodeConfig, secrets: SecretStore, env: string[], model: string, messages: ChatMessage[], tools?: ToolSchema[], onToken?: (token: string) => void, signal?: AbortSignal): Promise<ChatResponse> {
  const key = await providerKey(config, secrets, "anthropic", env)
  const system = messages.find((message) => message.role === "system")?.content
  const bodyMessages = toAnthropicMessages(messages)
  // Streaming Anthropic tool_use blocks are avoided; tools run over the non-streamed response for reliable parsing.
  const stream = Boolean(onToken) && !tools?.length
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: bodyMessages,
      ...(tools?.length ? { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}),
      ...(stream ? { stream: true } : {}),
    }),
    signal,
  })
  if (stream && response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
    const { content, usage } = await readAnthropicStream(response, onToken!)
    return { provider: "anthropic", model, content, usage, raw: { streamed: true, usage } }
  }
  const raw = await readJsonResponse(response) as { content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>; error?: { message?: string }; usage?: unknown }
  if (!response.ok) throw new Error(raw.error?.message ?? `Provider request failed with ${response.status}`)
  const parts = raw.content ?? []
  const content = parts.filter((part) => part.type !== "tool_use").map((part) => part.text ?? "").join("")
  const toolCalls = parts
    .filter((part) => part.type === "tool_use" && part.name)
    .map((part, index) => ({ id: part.id ?? `call_${index}`, name: part.name!, arguments: JSON.stringify(part.input ?? {}) }))
  if (onToken && content) onToken(content)
  return { provider: "anthropic", model, content, usage: anthropicUsage(raw), ...(toolCalls.length ? { toolCalls } : {}), raw }
}
