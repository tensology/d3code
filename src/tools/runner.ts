import { selectProfile, type D3CodeConfig } from "../config/config.js"
import { createD3Session } from "../d3/adapter.js"
import { getTool } from "../d3/tools.js"
import { parseD3ToolInput } from "../d3/tool-input.js"
import type { SafetyMode } from "../domain/types.js"
import { assertD3Scope } from "../scope/d3-scope.js"
import { compactToolOutput } from "./compact.js"

export interface ToolRunRequest {
  name: string
  input?: unknown
  profile?: string
  safety: SafetyMode
  compact?: boolean
  signal?: AbortSignal
  commandTimeoutMs?: number
  mode?: string
  /** False for model-originated input. Prevents a model from self-confirming mutations. */
  acceptInputConfirmation?: boolean
}

export interface ToolRunResult {
  name: string
  compact: string
  raw: unknown
  status?: "success" | "warning" | "error"
  summary?: string
  nextActions?: string[]
  artifacts?: string[]
}

function artifactPaths(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const record = raw as Record<string, unknown>
  const candidates = [record.path, record.output, record.outDir, ...(Array.isArray(record.written) ? record.written : []), ...(Array.isArray(record.artifacts) ? record.artifacts : [])]
  return [...new Set(candidates.filter((value): value is string => typeof value === "string" && value.length > 0))].slice(0, 20)
}

function observationStatus(raw: unknown): "success" | "warning" {
  if (!raw || typeof raw !== "object") return "success"
  const record = raw as Record<string, unknown>
  if (record.ready === false || record.ok === false || record.status === "warning" || record.status === "blocked") return "warning"
  return "success"
}

export async function runToolByName(config: D3CodeConfig, request: ToolRunRequest): Promise<ToolRunResult> {
  const tool = getTool(request.name)
  if (!tool) throw new Error(`Unknown tool: ${request.name}`)
  if (request.mode) assertD3Scope({ mode: request.mode, toolName: request.name, input: request.input })
  const profile = selectProfile(config, request.profile)
  const sessionlessTools = new Set(["d3_detect", "d3_search", "d3_manual_search", "d3_rag_search", "d3_builder_capabilities", "d3_sbplus_plan"])
  const needsSession = !sessionlessTools.has(request.name)
  if (needsSession && !profile) throw new Error("No D3 profile selected. Use /profile or configure one with profile-add-local/profile-add-ssh.")
  const session = needsSession && profile ? createD3Session(profile) : undefined
  const rawInput = parseD3ToolInput(request.name, request.input)
  const input = request.acceptInputConfirmation === false && rawInput && typeof rawInput === "object"
    ? { ...rawInput as Record<string, unknown>, confirmed: false }
    : rawInput
  try {
    const raw = await tool.execute(input, { safety: request.safety, profile, session, signal: request.signal, commandTimeoutMs: request.commandTimeoutMs })
    const compact = request.compact === false ? JSON.stringify(raw, null, 2) : compactToolOutput(raw, request.name)
    const status = observationStatus(raw)
    return {
      name: request.name,
      raw,
      compact,
      status,
      summary: compact.split(/\r?\n/).find((line) => line.trim())?.trim() || `${request.name} completed`,
      nextActions: status === "warning" ? ["Inspect the returned evidence and resolve the reported readiness gap before claiming completion."] : [],
      artifacts: artifactPaths(raw),
    }
  } finally {
    await session?.close()
  }
}
