import { selectProfile, type D3CodeConfig } from "../config/config.js"
import { createD3Session } from "../d3/adapter.js"
import { getTool } from "../d3/tools.js"
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
}

export interface ToolRunResult {
  name: string
  compact: string
  raw: unknown
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
  try {
    const raw = await tool.execute(request.input ?? {}, { safety: request.safety, profile, session, signal: request.signal, commandTimeoutMs: request.commandTimeoutMs })
    return { name: request.name, raw, compact: request.compact === false ? JSON.stringify(raw, null, 2) : compactToolOutput(raw, request.name) }
  } finally {
    await session?.close()
  }
}
