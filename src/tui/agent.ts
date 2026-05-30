import type { D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { chat, type ChatMessage, type ChatRequest, type ChatResponse } from "../llm/client.js"
import type { ProjectContext } from "./project-context.js"
import type { SecretStore } from "../security/secrets.js"
import { d3Tools, getTool } from "../d3/tools.js"
import { runToolByName, type ToolRunResult } from "../tools/runner.js"
import { createChatSystemPrompt } from "./context.js"

export interface D3AgentState {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
  project?: ProjectContext
}

export interface D3AgentTurnRequest extends D3AgentState {
  input: string
  history?: ChatMessage[]
  maxToolIterations?: number
  chatFn?: AgentChatFunction
  onToken?: (token: string) => void
  signal?: AbortSignal
}

export interface D3AgentToolRequest {
  name: string
  input?: unknown
  reason?: string
}

export interface D3AgentToolEvent {
  name: string
  input?: unknown
  reason?: string
  result: ToolRunResult
}

export interface D3AgentTurnResult {
  output: string
  messages: ChatMessage[]
  toolEvents: D3AgentToolEvent[]
}

export type AgentChatFunction = (config: D3CodeConfig, secrets: SecretStore, request: ChatRequest) => Promise<ChatResponse>

const d3ToolNames = new Set(d3Tools.map((tool) => tool.name))

export function createD3AgentSystemPrompt(config: D3CodeConfig, state: D3AgentState): string {
  const toolCatalog = d3Tools.map((tool) => `- ${tool.name}: ${tool.description}${tool.mutates ? " (mutation-gated)" : ""}`).join("\n")
  return [
    createChatSystemPrompt(config, state),
    "",
    "D3 Agent Tool Protocol:",
    "- You are a D3-only terminal engine. D3 Code is for Rocket D3 investigation, modernization, and D3-backed application buildout.",
    "- Do not start general-purpose coding in unrelated languages or frameworks unless the user is building a D3-backed application slice from D3 evidence.",
    "- Ground D3 behavior in the active profile, captured D3 evidence, and repo-local Rocket D3 manuals/reference material. If manual-backed clarity is missing, ask for or run D3/manual/search evidence instead of guessing.",
    "- Use D3 tools when you need facts from the current account, dictionaries, BASIC, locks, indexes, terminal evidence, or generated D3 application artifacts.",
    "- Assume the user may not know D3 terminology. Explain D3 concepts in plain language as you work: accounts, master dictionaries, data files, dictionaries, items, attributes, values, BASIC programs, cataloged subroutines, AQL, locks, and indexes.",
    "- For BASIC, remember this is procedural MultiValue BASIC, not an object-oriented application stack. Prefer inspect-plan-confirm loops, preserve attribute/value/subvalue shape, and avoid broad rewrites without compile/catalog proof.",
    "- Never invent D3 output. Ask for a tool call or say which profile/manual evidence is missing.",
    "- For writes, compile/catalog, CALL, LOGTO, destructive TCL, shell-like TCL, or account-changing work, explain the risk and rely on the tool safety layer to require confirmation.",
    "- Request exactly one tool at a time using this literal XML wrapper:",
    "<d3_tool>",
    "{\"name\":\"d3_list_files\",\"input\":{},\"reason\":\"inspect active account file pointers\"}",
    "</d3_tool>",
    "- After a tool result is returned, continue naturally and summarize what the D3 evidence proves.",
    "",
    "Available D3 tools:",
    toolCatalog,
  ].join("\n")
}

export function parseD3ToolRequest(content: string): D3AgentToolRequest | undefined {
  const match = content.match(/<d3_tool>\s*([\s\S]*?)\s*<\/d3_tool>/i)
  if (!match) return undefined
  let parsed: Partial<D3AgentToolRequest>
  try {
    parsed = JSON.parse(match[1] ?? "{}") as Partial<D3AgentToolRequest>
  } catch (error) {
    throw new Error(`Malformed D3 tool request JSON. The model must emit a complete JSON object inside <d3_tool>...</d3_tool>. ${(error as Error).message}`)
  }
  if (!parsed.name || typeof parsed.name !== "string") throw new Error("D3 tool request must include a string name.")
  return { name: parsed.name, input: parsed.input, reason: typeof parsed.reason === "string" ? parsed.reason : undefined }
}

function toolResultMessage(request: D3AgentToolRequest, result: ToolRunResult): ChatMessage {
  return {
    role: "tool",
    content: [
      `D3 tool result: ${request.name}`,
      request.reason ? `Reason: ${request.reason}` : undefined,
      "Compact result:",
      result.compact,
    ].filter(Boolean).join("\n"),
  }
}

function blockedToolMessage(request: D3AgentToolRequest): string {
  const known = getTool(request.name)
  if (known && d3ToolNames.has(request.name)) return ""
  return [
    `Blocked non-D3 tool request: ${request.name}`,
    "D3 Code is a Rocket D3 terminal engine. It can only run registered D3 tools from the active D3 profile, D3 evidence cache, or D3 application workbench.",
  ].join("\n")
}

export async function runD3AgentTurn(config: D3CodeConfig, secrets: SecretStore, request: D3AgentTurnRequest): Promise<D3AgentTurnResult> {
  const chatFn = request.chatFn ?? chat
  const messages: ChatMessage[] = request.history?.length
    ? [...request.history]
    : [{ role: "system", content: createD3AgentSystemPrompt(config, request) }]
  messages.push({ role: "user", content: request.input })

  const toolEvents: D3AgentToolEvent[] = []
  const maxToolIterations = request.maxToolIterations ?? 4

  for (let iteration = 0; iteration <= maxToolIterations; iteration += 1) {
    const response = await chatFn(config, secrets, { modelRef: request.model, messages, onToken: iteration === 0 ? request.onToken : undefined, signal: request.signal })
    const assistant: ChatMessage = { role: "assistant", content: response.content }
    messages.push(assistant)

    const toolRequest = parseD3ToolRequest(response.content)
    if (!toolRequest) return { output: response.content, messages, toolEvents }

    const blocked = blockedToolMessage(toolRequest)
    if (blocked) return { output: blocked, messages, toolEvents }

    const result = await runToolByName(config, {
      name: toolRequest.name,
      input: toolRequest.input,
      profile: request.profile,
      safety: request.safety,
    })
    toolEvents.push({ name: toolRequest.name, input: toolRequest.input, reason: toolRequest.reason, result })
    messages.push(toolResultMessage(toolRequest, result))
  }

  return {
    output: "Stopped after the D3 tool-iteration limit. Ask me to continue if you want the session to keep investigating with the same evidence.",
    messages,
    toolEvents,
  }
}
