import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { configHome } from "../config/paths.js"
import { randomUUID } from "node:crypto"
import type { AddressInfo } from "node:net"
import type { D3CodeConfig } from "../config/config.js"
import { saveConfig, selectProfile } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { createD3Session } from "../d3/adapter.js"
import { formatD3ToolResultForDisplay, humanD3SessionError, humanizeD3ConnectError } from "../d3/connection-message.js"
import { d3Capabilities } from "../d3/capabilities.js"
import { d3Tools } from "../d3/tools.js"
import { assertD3Allowed } from "../core/permissions.js"
import { defaultSecretStore, secretRefForProvider } from "../security/secrets.js"
import { runToolByName } from "../tools/runner.js"
import { runD3AgentTurn, createD3AgentSystemPrompt, type AgentChatFunction, type D3AgentTurnEvent, type D3ToolApproval } from "../tui/agent.js"
import type { ChatMessage } from "../llm/client.js"
import type { D3CommandResult, D3Session } from "../domain/types.js"
import { normalizeD3PromptPattern, D3_TCL_PROMPT_PATTERN } from "../d3/prompts.js"
import { inspectD3Browser } from "../d3/estate.js"
import { createLocalD3Profile } from "../d3/profile-defaults.js"
import { createD3ToolRoutingStatus } from "../d3/tool-routing.js"
import { ragIndexStatus } from "../rag/reference-rag.js"
import { providers } from "../providers/catalog.js"
import { discoverProviderModels } from "../providers/model-discovery.js"
import { compactText, sanitizeD3TerminalOutput } from "../tools/compact.js"
import { isPublicIdeHost } from "./access.js"
import { isBasicAuthValid, resolveIdeAuth } from "./auth.js"
import type { ProjectContext } from "../tui/project-context.js"
import { buildHarnessTurnContext } from "../operator/harness-context.js"
import { parseCtItem } from "../capture/parsers.js"
import { embeddedClientScript } from "./embedding.js"
import { itemBrowserClientScript } from "./item-browser.js"
import { confirmationClientScript, confirmationHtml } from "./confirmation.js"
import { agentApprovalClientScript, agentApprovalStyles } from "./agent-approval.js"
import { workspaceStateClientScript, workspaceStatusHtml, workspaceStatusStyles } from "./workspace-state.js"
import { listD3Items } from "../d3/items.js"
import { readDictionaryFields } from "../d3/dictionary-fields.js"
import { recordEditorClientScript, recordEditorStyles } from "./record-editor.js"
import { programEditorHtml, programEditorLoaderScript, programEditorStyles } from "./program-editor.js"
import { EditorRecordError, readEditorRecord, saveEditorRecord, prepareEditorRecord, createEditorRecord, recordConnection } from "../d3/records.js"
import type { runRecordOperation } from "../d3/record-session.js"

export interface IdeRuntimeState {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
  agentHistory?: ChatMessage[]
  agentHistories?: Map<string, ChatMessage[]>
  agentJobs?: Map<string, AgentJob>
  terminalSessions?: Map<string, D3Session>
  terminalTranscripts?: Map<string, string>
  terminalDisplayTranscripts?: Map<string, string>
  project?: ProjectContext
}

export type AgentJobStatus = "pending" | "running" | "done" | "error"

export interface AgentJobEvent {
  job_id: string
  seq: number
  type: string
  data: unknown
}

export interface AgentJob {
  id: string
  chatId: string
  status: AgentJobStatus
  events: AgentJobEvent[]
  nextSeq: number
  input: string
  clientHistory?: ChatMessage[]
  startedAt: number
  finishedAt?: number
  controller: AbortController
  approval?: {
    id: string
    proposal: D3ToolApproval
    expiresAt: number
    resolve: (approved: boolean, reason?: "approved" | "declined" | "expired" | "cancelled" | "invalidated") => void
  }
}

export interface IdeServerOptions {
  host?: string
  port?: number
  agentChatFn?: AgentChatFunction
  requireAuth?: boolean
  saveConfigFn?: (config: D3CodeConfig) => Promise<void>
  pythonApiUrl?: string
  recordOperation?: typeof runRecordOperation
}

export interface IdeServerHandle {
  host: string
  port: number
  url: string
  server: Server
  close(): Promise<void>
}

const running = new Map<string, IdeServerHandle>()

function agentJobsFor(state: IdeRuntimeState): Map<string, AgentJob> {
  if (!state.agentJobs) state.agentJobs = new Map()
  return state.agentJobs
}

function terminalSessionsFor(state: IdeRuntimeState): Map<string, D3Session> {
  if (!state.terminalSessions) state.terminalSessions = new Map()
  return state.terminalSessions
}

function terminalTranscriptsFor(state: IdeRuntimeState): Map<string, string> {
  if (!state.terminalTranscripts) state.terminalTranscripts = new Map()
  return state.terminalTranscripts
}

function terminalDisplayTranscriptsFor(state: IdeRuntimeState): Map<string, string> {
  if (!state.terminalDisplayTranscripts) state.terminalDisplayTranscripts = new Map()
  return state.terminalDisplayTranscripts
}

function terminalKey(profileName?: string): string {
  return profileName || "default"
}

function terminalIssueLabel(result: D3CommandResult): string {
  return humanD3SessionError(result.stdout, result.stderr) ? "Connection/login issue" : "TCL output"
}

function formatTerminalCleanOutput(result: D3CommandResult): string {
  const issue = humanD3SessionError(result.stdout, result.stderr)
  if (issue) return compactText(issue, { maxLines: 24, maxChars: 4000 })
  const body = [result.stdout, result.stderr].filter(Boolean).join("\n")
  const clean = sanitizeD3TerminalOutput(body)
  return (clean || body.trim() || "(no visible output)").trim()
}

function appendTerminalTranscript(state: IdeRuntimeState, profileName: string | undefined, command: string, result: D3CommandResult): string {
  const key = terminalKey(profileName)
  const current = terminalTranscriptsFor(state).get(key) ?? ""
  const output = [result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ""].filter(Boolean).join("\n").trim()
  const next = [current.trimEnd(), `> ${command}`, output || "(no output)"].filter(Boolean).join("\n").trim()
  terminalTranscriptsFor(state).set(key, next)
  return next
}

function appendTerminalDisplayTranscript(state: IdeRuntimeState, profileName: string | undefined, command: string, result: D3CommandResult): string {
  const key = terminalKey(profileName)
  const current = terminalDisplayTranscriptsFor(state).get(key) ?? ""
  const label = terminalIssueLabel(result)
  const output = formatTerminalCleanOutput(result)
  const next = [current.trimEnd(), `> ${command}`, `${label}\n${output}`].filter(Boolean).join("\n").trim()
  terminalDisplayTranscriptsFor(state).set(key, next)
  return next
}

async function closeTerminalSession(state: IdeRuntimeState, profileName?: string): Promise<void> {
  const sessions = terminalSessionsFor(state)
  const key = terminalKey(profileName)
  const session = sessions.get(key)
  sessions.delete(key)
  await session?.close().catch(() => {})
}

async function closeAllTerminalSessions(state: IdeRuntimeState): Promise<void> {
  const sessions = [...terminalSessionsFor(state).values()]
  terminalSessionsFor(state).clear()
  await Promise.all(sessions.map((session) => session.close().catch(() => {})))
}

function assertSelectedConnection(config: D3CodeConfig, state: IdeRuntimeState, input: { profile?: string; connection?: string }, required: boolean): void {
  if (!required && input.profile === undefined && input.connection === undefined) return
  const profile = selectProfile(config, state.profile)
  if (!profile || input.profile !== profile.name || input.connection !== recordConnection(profile)) {
    throw new EditorRecordError(409, "Connection settings changed. Reopen the item or reconnect before continuing.")
  }
}

async function invalidateProfileRuntimes(runtimes: Iterable<IdeRuntimeState>, names: string[], replacement?: string): Promise<void> {
  const affected = [...runtimes]
  for (const runtime of affected) {
    if (runtime.profile && names.includes(runtime.profile)) {
      resetAgentHistory(runtime)
      runtime.profile = replacement
    }
    for (const name of names) {
      terminalTranscriptsFor(runtime).delete(terminalKey(name))
      terminalDisplayTranscriptsFor(runtime).delete(terminalKey(name))
    }
  }
  await Promise.all(affected.flatMap(runtime => names.map(name => closeTerminalSession(runtime, name))))
}

async function runTerminalCommand(config: D3CodeConfig, state: IdeRuntimeState, command: string, confirmed?: boolean): Promise<{ result: D3CommandResult; transcript: string; displayTranscript: string; clean: string; label: string; mechanism: string }> {
  const profile = selectProfile(config, state.profile)
  if (!profile) throw new Error("No D3 profile selected. Add and select a D3 profile first.")
  assertD3Allowed(state.safety, command, Boolean(confirmed), profile.allowedAccounts, profile)
  const key = terminalKey(profile.name)
  const sessions = terminalSessionsFor(state)
  let session = sessions.get(key)
  if (!session) {
    const stale = [...sessions.entries()].filter(([sessionKey]) => sessionKey !== key)
    stale.forEach(([sessionKey]) => sessions.delete(sessionKey))
    await Promise.all(stale.map(([, oldSession]) => oldSession.close().catch(() => {})))
    session = createD3Session(profile)
    sessions.set(key, session)
  }
  let result: D3CommandResult
  try {
    result = await session.run(command, 0)
  } catch (error) {
    sessions.delete(key)
    await session.close().catch(() => {})
    throw error
  }
  const transcript = appendTerminalTranscript(state, profile.name, command, result)
  const displayTranscript = appendTerminalDisplayTranscript(state, profile.name, command, result)
  return {
    result,
    transcript,
    displayTranscript,
    clean: formatTerminalCleanOutput(result),
    label: terminalIssueLabel(result),
    mechanism: profile.sessionMode === "persistent" ? "persistent-pty" : "oneshot-command",
  }
}

function agentHistoriesFor(state: IdeRuntimeState): Map<string, ChatMessage[]> {
  if (!state.agentHistories) state.agentHistories = new Map()
  return state.agentHistories
}

function agentHistoryFor(state: IdeRuntimeState, chatId: string): ChatMessage[] | undefined {
  return agentHistoriesFor(state).get(chatId) ?? (chatId === "default" ? state.agentHistory : undefined)
}

function setAgentHistoryFor(state: IdeRuntimeState, chatId: string, messages: ChatMessage[]): void {
  agentHistoriesFor(state).set(chatId, messages)
  state.agentHistory = messages
}

function resetAgentHistory(state: IdeRuntimeState, chatId?: string): void {
  if (chatId) {
    state.agentJobs?.get(chatId)?.controller.abort(new Error("Stopped by operator"))
    agentHistoriesFor(state).delete(chatId)
    state.agentJobs?.delete(chatId)
    if (state.agentHistories?.size === 0) state.agentHistory = undefined
    return
  }
  for (const job of state.agentJobs?.values() ?? []) job.controller.abort(new Error("Stopped by operator"))
  state.agentHistory = undefined
  state.agentHistories?.clear()
  state.agentJobs?.clear()
}

function pushAgentJobEvent(job: AgentJob, type: string, data: unknown): number {
  const seq = job.nextSeq++
  job.events.push({ job_id: job.id, seq, type, data })
  if (job.events.length > 5000) job.events.splice(0, job.events.length - 5000)
  return seq
}

function approvalView(job: AgentJob) {
  const pending = job.approval
  return pending ? { id: pending.id, proposal: pending.proposal, expires_at: pending.expiresAt } : undefined
}

function awaitAgentApproval(job: AgentJob, proposal: D3ToolApproval, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const id = randomUUID(), expiresAt = Date.now() + 120_000
    let settled = false
    const finish: NonNullable<AgentJob["approval"]>["resolve"] = (approved, reason = approved ? "approved" : "declined") => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
      if (job.approval?.id === id) job.approval = undefined
      pushAgentJobEvent(job, "approval_resolved", { approval_id: id, approved, reason })
      if (reason === "expired" || reason === "invalidated") reject(new Error(`Approval ${reason}. This action was not run.`))
      else resolve(approved)
    }
    const onAbort = () => finish(false, "cancelled")
    const timer = setTimeout(() => finish(false, "expired"), 120_000)
    timer.unref()
    job.approval = { id, proposal, expiresAt, resolve: finish }
    signal.addEventListener("abort", onAbort, { once: true })
    pushAgentJobEvent(job, "approval_required", { approval: approvalView(job) })
    if (signal.aborted) onAbort()
  })
}

function normalizeAgentHistory(
  config: D3CodeConfig,
  state: IdeRuntimeState,
  clientHistory: ChatMessage[] | undefined,
  serverHistory: ChatMessage[] | undefined,
): ChatMessage[] | undefined {
  const base = clientHistory?.length ? clientHistory : serverHistory
  if (!base?.length) return undefined
  if (base[0]?.role === "system") return base
  return [{ role: "system", content: createD3AgentSystemPrompt(config, state) }, ...base]
}

async function executeAgentJob(
  config: D3CodeConfig,
  state: IdeRuntimeState,
  options: IdeServerOptions,
  job: AgentJob,
): Promise<void> {
  if (job.status !== "pending") return
  job.status = "running"
  try {
    const turn = await runD3AgentTurn(config, defaultSecretStore(), {
      ...state,
      input: job.input,
      history: normalizeAgentHistory(config, state, job.clientHistory, agentHistoryFor(state, job.chatId)),
      chatFn: options.agentChatFn,
      signal: job.controller.signal,
      onEvent: (event: D3AgentTurnEvent) => pushAgentJobEvent(job, event.type, event),
      approveTool: (proposal, signal) => awaitAgentApproval(job, proposal, signal),
    })
    setAgentHistoryFor(state, job.chatId, turn.messages)
    pushAgentJobEvent(job, "done", {
      output: turn.output,
      tools: turn.toolEvents.map((event) => ({ name: event.name, input: event.input, reason: event.reason, result: event.result.compact })),
      usage: turn.usage,
    })
    job.status = "done"
  } catch (error) {
    pushAgentJobEvent(job, "error", { error: (error as Error).message })
    job.status = "error"
  } finally {
    job.approval?.resolve(false, "cancelled")
    job.finishedAt = Date.now()
  }
}

function agentJobEventsSince(job: AgentJob, since: number): AgentJobEvent[] {
  return job.events.filter((event) => event.seq >= since)
}

function waitForAgentJob(job: AgentJob, timeoutMs = 120_000): Promise<AgentJob> {
  if (job.status === "done" || job.status === "error") return Promise.resolve(job)
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (job.status === "done" || job.status === "error") {
        resolve(job)
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("agent job timed out"))
        return
      }
      setTimeout(tick, 40)
    }
    tick()
  })
}

async function streamAgentJobToSse(res: ServerResponse, job: AgentJob, since = 0): Promise<void> {
  let cursor = since
  let closed = false
  reqOnClose(res, () => {
    closed = true
  })
  while (!closed) {
    const pending = agentJobEventsSince(job, cursor)
    for (const event of pending) {
      if (closed) return
      writeSse(res, event.type, { job_id: event.job_id, seq: event.seq, ...event.data as Record<string, unknown> })
      cursor = event.seq + 1
    }
    if (job.status === "done" || job.status === "error") break
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  if (!closed) res.end()
}

function reqOnClose(res: ServerResponse, onClose: () => void): void {
  res.on("close", onClose)
}

function startAgentJob(
  config: D3CodeConfig,
  state: IdeRuntimeState,
  options: IdeServerOptions,
  chatId: string,
  input: string,
  clientHistory?: ChatMessage[],
  runtimes: Iterable<IdeRuntimeState> = [state],
): AgentJob {
  const jobs = agentJobsFor(state)
  const cutoff = Date.now() - 15 * 60_000
  for (const [id, candidate] of jobs) {
    if (candidate.finishedAt && candidate.finishedAt < cutoff) jobs.delete(id)
  }
  const existing = jobs.get(chatId)
  if (existing?.status === "running" || existing?.status === "pending") return existing
  const activeJobs = [...runtimes].flatMap(runtime => [...agentJobsFor(runtime).values()]).filter((job) => job.status === "running" || job.status === "pending").length
  if (activeJobs >= 4) throw Object.assign(new Error("Agent concurrency limit reached. Wait for an active run to finish or stop one."), { statusCode: 429 })
  const job: AgentJob = {
    id: `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    chatId,
    status: "pending",
    events: [],
    nextSeq: 0,
    input,
    clientHistory,
    startedAt: Date.now(),
    controller: new AbortController(),
  }
  jobs.set(chatId, job)
  void executeAgentJob(config, state, options, job)
  return job
}

function framePolicyHeaders(): Record<string, string> {
  // D3CODE_FRAME_ANCESTORS lets an embedding host (e.g. the Tensology dashboard)
  // frame this IDE. Unset keeps the original DENY behaviour.
  const ancestors = (process.env.D3CODE_FRAME_ANCESTORS || "").trim()
  if (!ancestors) {
    return {
      "content-security-policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "x-frame-options": "DENY",
    }
  }
  return {
    "content-security-policy":
      `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors ${ancestors}`,
  }
}

function send(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    ...framePolicyHeaders(),
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  })
  res.end(body)
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, `${JSON.stringify(value, null, 2)}\n`, "application/json; charset=utf-8")
}

function sendAuthRequired(res: ServerResponse): void {
  res.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "www-authenticate": "Basic realm=\"D3 Code IDE\"",
  })
  res.end("Authentication required.\n")
}

function startSse(res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  })
}

function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
  const flush = (res as ServerResponse & { flush?: () => void }).flush
  flush?.()
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 1_048_576) throw Object.assign(new Error("JSON request body exceeds the 1 MiB limit"), { statusCode: 413 })
    chunks.push(buffer)
  }
  const body = Buffer.concat(chunks).toString("utf8")
  return body ? JSON.parse(body) : {}
}

function html(storageScope = ""): string {
  const workspaceStatus = workspaceStatusHtml()
  const iconPlus =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  const iconCog =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  const iconMenu =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  const sessionsFooterHtml =
    `<div class="sessions-footer"><div class="sessions-footer-actions"><button type="button" class="icon-button sessions-add-profile" title="Add profile" aria-label="Add profile">${iconPlus}</button><button type="button" class="icon-button sessions-settings" title="Settings" aria-label="Settings">${iconCog}</button></div></div>`
  const rightWorkbench = (inner: string) =>
    `<div class="right-workbench"><div class="column-resizer column-resizer-left" data-resize="right" title="Resize chat panel width"></div>${inner}<div class="sessions-backdrop" tabindex="-1" aria-hidden="true"></div><aside class="sessions-drawer" aria-hidden="true"><div class="sessions-drawer-head"><div class="dock-title">Sessions</div><button type="button" class="sessions-close" aria-label="Close sessions">&times;</button></div><div class="sessions-drawer-body"><div class="session-chat-list sessions-tree"></div></div>${sessionsFooterHtml}</aside></div>`
  const sideChat = (tag: "aside" | "section", className: string, outputId: string, promptId: string, sendId: string, activityId: string, runStatusId: string) =>
    `<${tag} class="${className} right-chat-pane"><div class="dock agent-shell"><div class="dock-head side-chat-head chat-banner"><div class="dock-title side-chat-title" data-chat-title>New chat</div></div><div class="dock-body agent-chat side-chat"><div class="chat-stage-side"><div id="${outputId}" class="agent-thread side-chat-thread chat-column"></div><div class="agent-composer side-chat-composer">${workspaceStatus}<textarea id="${promptId}" class="agentbox side-chat-input" placeholder="Plan, build: / for commands and context"></textarea><div class="side-chat-actions"><button class="primary" id="${sendId}" disabled>Send</button></div></div></div></div></div></${tag}>`
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<title>D3 Code IDE</title>",
    "<style>",
    ":root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#081019;color:#dbe7f3;--bg:#081019;--chrome:#0c1520;--rail:#0f1b27;--panel:#121f2d;--panel2:#172635;--editor:#0a121b;--line:#243448;--line2:#304256;--text:#dbe7f3;--muted:#8293a7;--soft:#aebed0;--accent:#4f8cff;--accent-fill:#1f6feb;--accent-ink:#fff;--accent2:#35c49a;--warn:#f4b860;--danger:#ff6b6b;--bubble:#18293a;--bubble-user:#1d3f5f}",
    "body[data-theme='light']{color-scheme:light;--bg:#f6f8fb;--chrome:#ffffff;--rail:#eef2f7;--panel:#ffffff;--panel2:#f7f9fc;--editor:#ffffff;--line:#d7dee8;--line2:#c3cedb;--text:#142033;--muted:#687789;--soft:#405166;--accent:#1f6feb;--accent-ink:#fff;--accent2:#008b6a;--warn:#a15c00;--danger:#c24141;--bubble:#ffffff;--bubble-user:#e7f0ff}",
    "*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text)}button,input,select,textarea{font:inherit}button{min-height:32px;border:1px solid var(--line2);background:var(--panel2);color:var(--text);border-radius:5px;padding:0 10px;cursor:pointer;font-size:12px;font-weight:650;letter-spacing:0;line-height:1.12;white-space:nowrap}button:hover{background:var(--panel);border-color:var(--accent)}button.primary{background:var(--accent-fill);color:var(--accent-ink);border-color:var(--accent-fill);box-shadow:0 0 0 1px rgba(79,140,255,.18)}input,select,textarea{width:100%;border:1px solid var(--line2);background:var(--editor);color:var(--text);border-radius:5px;padding:8px 9px;font-size:12px;outline:none}input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(79,140,255,.14)}textarea{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical}",
    ".top{height:44px;display:grid;grid-template-columns:220px 1fr auto;align-items:center;border-bottom:1px solid var(--line);background:var(--chrome);padding:0 12px;gap:10px}.brand{font-weight:760;font-size:14px}.meta{font-size:12px;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.view-toggle{display:flex;align-items:center;gap:6px}.mode-button{width:34px;min-width:34px;padding:0;border-radius:6px;display:grid;place-items:center}.mode-button svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.mode-button.active{background:var(--accent-fill);border-color:var(--accent-fill);color:var(--accent-ink)}.modal-backdrop{position:fixed;inset:0;background:rgba(2,8,15,.62);display:none;place-items:center;z-index:30;padding:18px}.modal-backdrop.open{display:grid}.profile-form{width:min(680px,100%);border:1px solid var(--line);border-radius:9px;padding:14px;background:var(--panel);box-shadow:0 24px 80px rgba(0,0,0,.38);display:grid;gap:12px}.profile-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.profile-form-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.settings-form{width:min(420px,100%);border:1px solid var(--line);border-radius:9px;padding:14px;background:var(--panel);box-shadow:0 24px 80px rgba(0,0,0,.38);display:grid;gap:12px}.settings-form-actions{display:flex;justify-content:flex-end}.field{display:grid;gap:4px}.field.wide{grid-column:1/3}.field span{font-size:11px;color:var(--muted);font-weight:700}.field em{font-style:normal;font-size:11px;line-height:1.35;color:var(--muted)}.theme-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.theme-choice.active{background:var(--accent-fill);border-color:var(--accent-fill);color:var(--accent-ink)}.menu-title{font-size:12px;font-weight:760}.menu-muted{font-size:11px;color:var(--muted);line-height:1.4}",
    ".profile-connection-banner{position:relative;z-index:29;width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(244,184,96,.5);background:var(--panel);color:var(--text)}.profile-connection-banner[hidden]{display:none}.profile-connection-icon{width:22px;height:22px;display:grid;place-items:center;color:var(--warn)}.profile-connection-icon svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.profile-connection-copy{min-width:0;font-size:12px;line-height:1.4}.profile-connection-copy strong{display:block;color:var(--warn)}.profile-connection-copy span{display:block;color:var(--soft);white-space:normal}.profile-connection-retry{min-width:64px;background:transparent}.session-profile-issue{width:20px;min-width:20px;height:28px;display:grid;place-items:center;color:var(--warn);flex-shrink:0}.session-profile-issue svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}body.profile-connection-active .chat-layout,body.profile-connection-active .layout{height:calc(100vh - 44px - var(--profile-connection-h,0px));min-height:0}",
    ".layout{display:grid;grid-template-columns:var(--editor-sidebar-w,290px) minmax(380px,1fr) var(--right-w,340px);grid-template-rows:minmax(320px,1fr) minmax(180px,32vh);height:calc(100vh - 44px);min-height:720px}#editorView{display:none}.editor-sidebar{grid-row:1/3;background:var(--rail);border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0;position:relative}.layout>.right-workbench{grid-column:3;grid-row:1/3;background:var(--rail);border-left:1px solid var(--line);min-width:0;min-height:0}.editor-screen{grid-column:2;grid-row:2;background:var(--rail);border-top:1px solid var(--line);min-width:0;min-height:0;display:flex}main.editor-main{grid-column:2;grid-row:1;min-width:0;background:var(--editor);display:flex;flex-direction:column}.sidebar{grid-row:1/3;background:var(--rail);border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.runtime{grid-column:2;grid-row:2;background:var(--rail);border-top:1px solid var(--line);min-width:0;min-height:0}main{grid-column:2;grid-row:1;min-width:0;background:var(--editor);display:flex;flex-direction:column}.dock{height:100%;display:flex;flex-direction:column;min-height:0}.dock-head{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line);padding:0 12px;background:var(--panel2)}.dock-title{font-size:12px;font-weight:760;text-transform:uppercase;color:var(--text);letter-spacing:.02em}.dock-sub{font-size:11px;color:var(--muted);white-space:nowrap}.dock-body{padding:12px;overflow:auto;min-height:0;flex:1}.dock-head-actions{display:flex;align-items:center;gap:6px}.editor-screen>.dock{flex:1;min-width:0}.editor-screen .dock-body{padding:0;min-height:0}.editor-screen .terminal{height:100%;min-height:0;border:0;border-radius:0;padding:14px 16px}.editor-screen .terminal:focus{box-shadow:inset 0 0 0 1px rgba(53,196,154,.45)}.d3-browser-body{padding:0 0 8px}.d3-account-row{display:grid;gap:4px;padding:0 10px 8px 36px}.d3-account-label{font-size:11px;font-weight:760;color:var(--text)}.d3-account-who{font-size:10px;color:var(--muted)}.d3-logto-row{display:grid;grid-template-columns:1fr auto;gap:6px;padding:0 10px 10px 36px}.d3-logto-row input{min-height:30px;padding:6px 8px;font-size:11px}.d3-browser-error{padding:0 10px 10px 36px;font-size:11px;line-height:1.45;color:var(--warn);white-space:normal}.d3-category-head{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 10px 7px 28px;border:0;background:transparent;color:var(--soft);text-align:left;font:inherit;font-size:11px;font-weight:760;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}.d3-category-head:hover{background:rgba(79,140,255,.08);color:var(--text)}.d3-category-toggle{width:18px;min-width:18px;height:18px;display:grid;place-items:center;color:var(--muted)}.d3-category-toggle svg{width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;transition:transform .15s ease}.d3-category.collapsed .d3-category-toggle svg{transform:rotate(-90deg)}.d3-category-count{font-size:10px;color:var(--muted);font-weight:700}.d3-category.collapsed .d3-files{display:none}.d3-files{display:flex;flex-direction:column;padding-bottom:2px}.d3-file-item{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;padding:5px 10px 5px 42px;border:0;border-radius:0;background:transparent;color:var(--soft);text-align:left;font:inherit;font-size:12px;font-weight:650;line-height:1.3;cursor:pointer}.d3-file-item:hover{background:rgba(79,140,255,.09);color:var(--text)}.d3-file-item.active{background:rgba(79,140,255,.11);box-shadow:inset 3px 0 0 var(--accent);color:var(--text)}.d3-file-kind{font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em}.editor-toolbar-actions{height:auto;min-height:44px;flex-wrap:wrap;padding:6px 10px;gap:8px}.editor-toolbar-actions button{flex:0 0 auto}",
    ".tabs{display:grid;grid-template-columns:1fr;gap:4px;padding:10px;border-bottom:1px solid var(--line);background:var(--rail)}.tab{height:auto;text-align:left;display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;border-color:transparent;background:transparent;padding:9px 8px;color:var(--soft)}.tab b{display:block;font-size:12px;color:inherit}.tab span{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:2px}.tab.active{background:var(--panel);color:var(--text);border-color:var(--line2);box-shadow:inset 3px 0 0 var(--accent)}.tab.active span{color:var(--muted)}.glyph{width:18px;height:18px;display:grid;place-items:center;color:var(--accent2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.pane{display:none}.pane.active{display:block}",
    ".row{display:flex;gap:8px;align-items:center;margin-bottom:8px}.row>*{flex:1}.row button{flex:0 0 auto}.stack{display:grid;gap:8px}.label{font-size:11px;font-weight:750;color:var(--muted);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.04em}.hint{font-size:11px;color:var(--muted);line-height:1.45;margin:6px 0 10px}.list{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;background:var(--editor);border:1px solid var(--line);border-radius:6px;padding:10px;min-height:92px;color:var(--text)}.mini{min-height:70px}.check{display:flex;gap:7px;align-items:center;color:var(--muted);font-size:12px;margin:8px 0}.check input{width:auto}.toolbar{min-height:38px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line);background:var(--panel2);padding:0 10px}.editor-actions{height:auto;min-height:44px;flex-wrap:wrap;padding:6px 10px}.editor-actions .check{flex:1 1 185px;margin:0}.tool-chip{height:24px;border:1px solid var(--line);border-radius:4px;padding:4px 7px;color:var(--muted);font-size:11px;background:var(--panel)}.tool-chip.hot{color:#fff;background:var(--accent2);border-color:var(--accent2)}",
    ".editor-wrap{display:grid;grid-template-columns:44px 1fr;min-height:0;flex:1}.gutter{background:var(--panel2);border-right:1px solid var(--line);color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:22px;padding:12px 8px;text-align:right;user-select:none}.editor{border:0;border-radius:0;background:var(--editor);min-height:430px;height:100%;padding:12px 14px;line-height:22px;font-size:13px;color:var(--text);tab-size:2}.editor:focus{box-shadow:none;border:0}.editor-fields{display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.3fr) auto;gap:8px;padding:10px;border-bottom:1px solid var(--line);background:var(--panel2)}",
    ".agent-shell{height:100%;display:flex;flex-direction:column}.agent-chat{padding:0;display:grid;grid-template-rows:1fr auto;height:100%;overflow:hidden}.agent-thread{overflow:auto;padding:14px;display:grid;align-content:start;gap:10px;background:var(--rail)}.right-workbench{position:relative;min-width:0;min-height:0;height:100%;overflow:hidden}.right-chat-pane{position:relative;z-index:1;height:100%}.chat-sidebar,.chat-info{position:relative}.column-resizer{position:absolute;top:0;bottom:0;width:9px;cursor:col-resize;z-index:12;touch-action:none}.column-resizer-left{left:-5px}.column-resizer-right{right:-5px}.column-resizer:hover,.column-resizer.dragging{background:rgba(79,140,255,.25)}.chat-banner{display:flex;align-items:center;min-height:40px}.chat-banner .dock-title,.chat-banner .side-chat-title{margin:0;line-height:1;min-height:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.side-chat-head{display:flex;align-items:center;min-height:40px}.icon-button{width:32px;min-width:32px;min-height:32px;padding:0;border-radius:6px;display:grid;place-items:center}.icon-button svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round}.sessions-drawer{position:absolute;top:0;right:0;bottom:0;width:min(268px,92%);z-index:26;background:var(--rail);border-left:1px solid var(--line2);box-shadow:-16px 0 36px rgba(0,0,0,.28);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;pointer-events:none}.sessions-drawer-head{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line);padding:0 10px;background:var(--panel2)}.sessions-drawer-actions{display:flex;align-items:center;gap:6px}.sessions-drawer-actions .sessions-new{color:var(--accent)}.sessions-close{width:28px;min-width:28px;min-height:28px;padding:0;border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1}.sessions-close:hover{color:var(--text)}.sessions-drawer-body{padding:0;overflow:auto;min-height:0;flex:1}.sessions-body{padding:0!important;display:flex;flex-direction:column;min-height:0}.sessions-tree{flex:1;overflow:auto;min-height:0}.sessions-footer{padding:8px 10px;border-top:1px solid var(--line);background:var(--panel2);flex-shrink:0}.sessions-footer-actions{display:flex;align-items:center;justify-content:flex-end;gap:4px}.sessions-footer .icon-button{color:var(--soft);border:0;background:transparent}.sessions-footer .icon-button:hover{color:var(--text);background:rgba(79,140,255,.1);border-color:transparent}.sessions-drawer{display:flex;flex-direction:column}.sessions-drawer .sessions-footer{margin-top:auto}.sessions-empty{padding:14px 12px;font-size:12px;line-height:1.45;color:var(--muted)}.session-profile{border-bottom:1px solid var(--line)}.session-profile.active .session-profile-head{background:rgba(79,140,255,.07);box-shadow:inset 3px 0 0 var(--accent)}.session-profile.active .session-profile-select{color:var(--text)}.session-profile-head{width:100%}.session-profile-head:hover .session-profile-row,.session-profile-head:hover .session-profile-meta{background:rgba(79,140,255,.09)}.session-profile-head:hover .session-profile-toggle,.session-profile-head:hover .session-profile-new-chat,.session-profile-head:hover .session-profile-menu{background:rgba(79,140,255,.14);border-color:transparent;color:var(--text)}.session-profile-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;align-items:center;gap:2px;padding:2px 6px 2px 4px;transition:background .12s ease}.session-profile-online{width:20px;min-width:20px;height:28px;display:grid;place-items:center;color:var(--accent2);flex-shrink:0}.session-profile-online svg{width:9px;height:9px;fill:currentColor}.session-profile-toggle{width:28px;min-width:28px;min-height:32px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--muted);display:grid;place-items:center;transition:background .12s ease,color .12s ease}.session-profile-toggle svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;transition:transform .15s ease}.session-profile.collapsed .session-profile-toggle svg{transform:rotate(-90deg)}.session-profile-select{height:auto;min-height:32px;text-align:left;border:0;background:transparent;color:var(--text);padding:6px 4px;font-size:12px;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.session-profile-select:hover{background:transparent;border-color:transparent}.session-profile-meta{font-size:10px;color:var(--muted);font-weight:600;padding:0 8px 8px 36px;transition:background .12s ease}.session-profile-new-chat,.session-profile-menu{width:28px;min-width:28px;min-height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--muted);display:grid;place-items:center;transition:background .12s ease,color .12s ease}.session-profile-new-chat{color:var(--accent)}.session-profile-new-chat svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.session-profile-menu svg{width:16px;height:16px;fill:currentColor}.session-profile.collapsed .session-chats{display:none}.session-profile.collapsed .d3-browser-body{display:none}.session-chats{display:flex;flex-direction:column;padding:0 0 4px}.session-chat-item{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:6px 10px 6px 28px;border:0;border-radius:0;background:transparent;color:var(--soft);text-align:left;font:inherit;font-size:12px;font-weight:650;line-height:1.3;cursor:pointer;transition:background .12s ease,color .12s ease}.session-chat-item:hover{background:rgba(79,140,255,.09);color:var(--text)}.session-chat-item.active{background:linear-gradient(90deg,rgba(79,140,255,.22),rgba(53,196,154,.08));box-shadow:inset 4px 0 0 var(--accent2);color:var(--text)}.session-chat-selected{margin-left:auto;border:1px solid rgba(53,196,154,.55);border-radius:999px;padding:2px 6px;color:var(--accent2);font-size:10px;font-weight:800;line-height:1;text-transform:uppercase}.session-chat-icon{width:16px;min-width:16px;height:16px;display:grid;place-items:center;color:var(--muted);flex-shrink:0}.session-chat-icon svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.session-chat-item:hover .session-chat-icon,.session-chat-item.active .session-chat-icon{color:var(--accent2)}.session-chat-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.session-chat-busy{width:16px;min-width:16px;height:16px;display:grid;place-items:center;color:var(--accent2);flex-shrink:0;margin-left:auto}.session-chat-busy svg{width:14px;height:14px;animation:session-chat-spin .8s linear infinite}@keyframes session-chat-spin{to{transform:rotate(360deg)}}.sessions-backdrop{position:absolute;inset:0;z-index:24;background:rgba(2,8,15,.38);display:none;cursor:pointer}.sessions-drawer.peek{transform:translateX(calc(100% - 56px));pointer-events:auto}.right-workbench.sessions-peek .sessions-backdrop,.right-workbench.sessions-open .sessions-backdrop{display:block;pointer-events:auto}.right-workbench.sessions-peek .sessions-backdrop{background:rgba(2,8,15,.18)}.right-workbench.sessions-peek .right-chat-pane,.right-workbench.sessions-open .right-chat-pane{pointer-events:none}.right-workbench.sessions-peek .sessions-drawer,.right-workbench.sessions-open .sessions-drawer{pointer-events:auto}.right-workbench.sessions-open .sessions-drawer{transform:translateX(0);pointer-events:auto}.side-chat-thread.chat-column{padding:18px;background:var(--editor)}.side-chat-composer{border-top:1px solid var(--line);padding:12px;background:var(--editor)}.side-chat-input{min-height:88px;resize:vertical;background:var(--panel);border-radius:8px}.side-chat-actions{display:flex;justify-content:flex-end;margin-top:8px}.chat-bubble{max-width:92%;border:1px solid var(--line);border-radius:10px;padding:10px 11px;background:var(--bubble);font-size:13px;line-height:1.45;white-space:normal}.chat-bubble.user{justify-self:end;background:var(--bubble-user);border-color:rgba(79,140,255,.45);cursor:text}.chat-bubble.assistant{justify-self:start}.message-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.message-meta{font-size:11px;color:var(--muted);font-weight:700}.message-actions{display:flex;gap:10px;align-items:center;margin-top:12px}.copy-message{width:24px;min-width:24px;min-height:24px;padding:0;border:0;border-radius:5px;color:var(--muted);background:transparent;display:grid;place-items:center}.copy-message svg{width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.copy-message:hover{color:var(--text);background:var(--panel2);border-color:transparent}.message-body{overflow-wrap:anywhere}.message-body p{margin:0 0 12px}.message-body p:last-child{margin-bottom:0}.message-body ul{margin:6px 0 12px 18px;padding:0}.message-body li{margin:4px 0}.message-body strong{font-weight:780;color:var(--text)}.message-body code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:var(--panel2);border:1px solid var(--line);border-radius:4px;padding:1px 4px}.message-body pre{margin:8px 0 0;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--editor);overflow:auto;white-space:pre}.user-edit{min-width:min(620px,70vw);min-height:74px;background:transparent;border:0;box-shadow:none!important;color:var(--text);padding:0;font:inherit;line-height:1.45;resize:vertical}.control-menu{position:fixed;z-index:70;display:none;gap:8px;width:min(360px,calc(100vw - 28px));background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:10px;box-shadow:0 18px 48px rgba(0,0,0,.34)}.control-menu.open{display:grid}.control-menu-title{font-size:12px;font-weight:780}.control-menu-note{font-size:11px;color:var(--muted);line-height:1.35}.control-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.control-row button.active{background:var(--accent-fill);border-color:var(--accent-fill);color:var(--accent-ink)}.model-menu-grid{display:grid;gap:8px}.model-menu-grid label{display:grid;gap:4px;font-size:11px;color:var(--muted);font-weight:750}.model-menu-grid input,.model-menu-grid select{font-size:12px}.model-key-panel{display:none;gap:8px}.model-key-panel.open{display:grid}.snackbar{position:fixed;left:50%;bottom:22px;transform:translate(-50%,18px);z-index:60;background:var(--panel2);border:1px solid var(--line2);box-shadow:0 12px 34px rgba(0,0,0,.32);border-radius:8px;color:var(--text);padding:9px 12px;font-size:12px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease}.snackbar.show{opacity:1;transform:translate(-50%,0)}.tool-event{width:100%;max-width:var(--chat-content-w,100%);justify-self:start;border:0;background:transparent;border-radius:0;box-shadow:none;padding:0 18px;box-sizing:border-box}.tool-event.running{border-color:rgba(244,184,96,.55)}.tool-event-head{display:flex;align-items:center;gap:8px;width:100%;min-height:28px;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:inherit;text-align:left;font:inherit;font-size:15px;font-weight:400;line-height:1.55;cursor:default}.tool-event-head:hover,.tool-event-head:disabled{background:transparent;border-color:transparent;opacity:1;color:inherit}.tool-event.collapsible .tool-event-head{cursor:pointer}.tool-name{font-size:15px;color:var(--text);font-weight:600;white-space:nowrap}.tool-preview{flex:1;min-width:0;font-size:15px;font-weight:400;line-height:1.55;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tool-meta{display:flex;align-items:center;gap:8px;justify-self:end;white-space:nowrap}.tool-status{font-size:13px;color:var(--muted);font-weight:500;white-space:nowrap}.tool-event.blocked .tool-status,.tool-event.error .tool-status{color:var(--danger)}.tool-chevron{font-size:14px;color:var(--muted);line-height:1;transition:transform .15s ease}.tool-event.expanded .tool-chevron{transform:rotate(90deg)}.tool-event.expanded .tool-preview{display:none}.chat-tool-detail{display:none;margin:2px 0 0;padding:0;border:0;background:transparent;font-size:15px;line-height:1.55;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto}.tool-event.expanded .chat-tool-detail{display:block}.agent-composer{border-top:1px solid var(--line);padding:10px;background:var(--panel)}.agentbox{min-height:72px;max-height:140px;line-height:1.45;background:var(--editor)}.agent-actions{display:flex;justify-content:flex-end;margin-top:8px}",
    "#chatView,#terminalView{display:none}.chat-layout{height:calc(100vh - 44px);min-height:680px;grid-template-columns:var(--sidebar-w,290px) minmax(360px,1fr) var(--right-w,320px);background:var(--bg)}.chat-layout.workbench-layout{grid-template-columns:minmax(0,1fr) var(--right-w,320px)}body[data-view='chat'] #chatView,body[data-view='terminal'] #terminalView{display:grid}body[data-view='editor'] #editorView{display:grid}body[data-view='chat'] #editorView,body[data-view='terminal'] #editorView{display:none}.chat-sidebar,.chat-info,.right-rail{background:var(--rail);border-right:1px solid var(--line);min-width:0;min-height:0}.chat-info,.right-rail{border-right:0;border-left:1px solid var(--line)}.chat-main{grid-column:auto;grid-row:auto;background:var(--editor);min-height:0;display:grid;grid-template-rows:auto 1fr}.chat-stage{--chat-content-w:min(900px,100%);display:grid;grid-template-rows:1fr auto;min-height:0;overflow:hidden}.chat-stage-side{--chat-content-w:min(900px,100%);display:grid;grid-template-rows:1fr auto;min-height:0;overflow:hidden}.terminal-main{grid-column:auto;grid-row:auto;background:var(--editor);min-height:0;display:grid;grid-template-rows:auto 1fr}.chat-context-menu{position:fixed;z-index:80;display:none;min-width:156px;background:var(--panel);border:1px solid var(--line2);border-radius:8px;padding:4px;box-shadow:0 14px 36px rgba(0,0,0,.32)}.chat-context-menu.open{display:grid}.chat-context-menu button{height:auto;min-height:34px;text-align:left;border:0;background:transparent;color:var(--text);border-radius:6px;padding:7px 10px;font-size:12px;font-weight:650}.chat-context-menu button:hover{background:var(--panel2)}.chat-context-menu button[data-chat-action='delete'],.chat-context-menu button[data-profile-action='remove']{color:#ff9b9b}.nav-section{border-bottom:1px solid var(--line);padding:12px}.nav-section:last-child{border-bottom:0}.nav-kicker{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:800;margin-bottom:8px}.run-status{font-size:11px;color:var(--muted);font-weight:750;white-space:nowrap}.run-status[data-kind='running']{color:var(--warn)}.run-status[data-kind='streaming']{color:var(--accent2)}.run-activity{font-size:11px;color:var(--muted);line-height:1.35;min-height:16px}.run-activity[data-kind='running'],.run-activity[data-kind='streaming']{color:var(--soft)}.typing-row{display:flex;align-items:center;gap:8px;padding:10px 18px;color:var(--muted);font-size:13px;width:100%;max-width:var(--chat-content-w);box-sizing:border-box;margin:0}.typing-dots{display:inline-flex;gap:4px;align-items:center}.typing-dots span{width:5px;height:5px;border-radius:50%;background:var(--accent2);animation:typing-bounce 1.1s ease-in-out infinite}.typing-dots span:nth-child(2){animation-delay:.16s}.typing-dots span:nth-child(3){animation-delay:.32s}@keyframes typing-bounce{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}@keyframes streamBubbleIn{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:none}}@keyframes streamPulse{0%{opacity:.85}100%{opacity:1}}@keyframes streamCaret{0%,100%{opacity:.4;transform:scaleY(.82)}50%{opacity:1;transform:scaleY(1)}}.chat-bubble.assistant.streaming{animation:streamBubbleIn .48s cubic-bezier(.22,1,.36,1)}.chat-bubble.assistant.streaming .message-body.stream-pulse{animation:streamPulse .36s cubic-bezier(.22,1,.36,1)}.chat-bubble.assistant.streaming .message-body:after{content:'';display:inline-block;width:7px;height:1.05em;margin-left:4px;vertical-align:text-bottom;background:linear-gradient(180deg,var(--accent2),var(--accent));border-radius:2px;animation:streamCaret .9s ease-in-out infinite}.chat-thread-main,.agent-thread.chat-column{display:flex;flex-direction:column;align-items:center;gap:16px;overflow:auto;padding:20px 18px 28px;background:var(--editor)}.chat-thread-main>*,.agent-thread.chat-column>*{width:100%;max-width:var(--chat-content-w);box-sizing:border-box}.chat-thread-main .chat-bubble,.agent-thread.chat-column .chat-bubble{font-size:15px;line-height:1.55}.chat-thread-main .chat-bubble.user,.agent-thread.chat-column .chat-bubble.user{width:100%;max-width:var(--chat-content-w);border-radius:24px;padding:16px 18px;background:#2b2b2e;border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 44px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04);color:var(--text);cursor:default;user-select:text}body[data-theme='light'] .chat-thread-main .chat-bubble.user,body[data-theme='light'] .agent-thread.chat-column .chat-bubble.user{background:#f7f9fc;border-color:#d9e1ea;box-shadow:0 12px 28px rgba(20,32,51,.08)}.chat-thread-main .chat-bubble.user .message-head,.chat-thread-main .chat-bubble.user .message-actions,.agent-thread.chat-column .chat-bubble.user .message-head,.agent-thread.chat-column .chat-bubble.user .message-actions{display:none}.chat-thread-main .chat-bubble.assistant,.agent-thread.chat-column .chat-bubble.assistant,.chat-thread-main .chat-bubble.assistant.streaming,.agent-thread.chat-column .chat-bubble.assistant.streaming{width:100%;max-width:var(--chat-content-w);background:transparent;border:0;box-shadow:none;border-radius:0;padding:10px 18px 18px;box-sizing:border-box}.chat-thread-main .chat-bubble.assistant .message-head,.agent-thread.chat-column .chat-bubble.assistant .message-head{display:none}.chat-thread-main .chat-bubble.assistant .message-actions,.agent-thread.chat-column .chat-bubble.assistant .message-actions{display:flex;justify-content:flex-end;margin-top:8px;padding-top:0;border-top:0}.chat-thread-main .chat-bubble.assistant .copy-message,.agent-thread.chat-column .chat-bubble.assistant .copy-message{opacity:.75}.chat-thread-main .chat-bubble.assistant .copy-message:hover,.agent-thread.chat-column .chat-bubble.assistant .copy-message:hover{opacity:1}.chat-thread-main .tool-event,.chat-thread-main .tool-event,.agent-thread.chat-column .tool-event{width:100%;max-width:var(--chat-content-w);margin:0;box-sizing:border-box;background:transparent;border:0;border-radius:0;box-shadow:none;padding:0 18px}.chat-thread-main .tool-event.running,.agent-thread.chat-column .tool-event.running{border-color:rgba(244,184,96,.55)}.chat-composer-main{border-top:1px solid var(--line);padding:14px 18px 16px;background:var(--editor);display:flex;flex-direction:column;align-items:center}.composer-wrap{position:relative;min-width:0;width:100%;max-width:var(--chat-content-w);margin:0 auto;box-sizing:border-box;background:#2b2b2e;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:16px 16px 12px;box-shadow:0 18px 44px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04)}body[data-theme='light'] .composer-wrap{background:#f7f9fc;border-color:#d9e1ea;box-shadow:0 12px 28px rgba(20,32,51,.08)}.chat-composer-main textarea,.side-chat-input{text-align:left}.chat-composer-main textarea{min-height:72px;max-height:180px;resize:none;border:0;border-radius:0;background:transparent;box-shadow:none!important;padding:2px 8px 10px;font-family:inherit;font-size:16px;line-height:1.45;color:var(--text)}.chat-composer-main textarea:focus{border:0;box-shadow:none}.chat-composer-main textarea::placeholder{color:rgba(174,190,208,.58)}.composer-controls{display:flex;align-items:center;gap:10px;margin-top:2px}.composer-left,.composer-right{display:flex;align-items:center;gap:10px;min-width:0}.composer-right{margin-left:auto}.composer-icon{width:36px;min-width:36px;min-height:36px;border:0;background:transparent;border-radius:999px;padding:0;display:grid;place-items:center;color:var(--soft)}.composer-icon:hover{background:rgba(255,255,255,.07);border-color:transparent;color:var(--text)}body[data-theme='light'] .composer-icon:hover{background:rgba(20,32,51,.07)}.composer-icon svg,.composer-send svg,.composer-safety svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.composer-safety{display:flex;align-items:center;gap:7px;min-height:36px;border:0;background:transparent;color:#ff8b4a;padding:0 4px;font-size:15px;font-weight:720}.composer-safety:hover{background:transparent;border-color:transparent;color:#ff9c63}.composer-safety svg{width:18px;height:18px}.composer-model{max-width:260px;overflow:hidden;text-overflow:ellipsis;border:0;background:transparent;color:var(--soft);min-height:36px;padding:0 4px;font-size:15px;font-weight:680}.composer-model:hover{background:transparent;border-color:transparent;color:var(--text)}.composer-send{width:46px;min-width:46px;min-height:46px;border-radius:999px;background:#e5e5e5;color:#151515;border:0;padding:0;display:grid;place-items:center}.composer-send:hover{background:#fff;border-color:transparent;color:#111}.composer-send svg{width:24px;height:24px;stroke-width:2.2}.slash-palette,.action-popover{position:absolute;left:12px;right:12px;bottom:calc(100% + 10px);background:var(--panel);border:1px solid var(--line2);box-shadow:0 18px 44px rgba(0,0,0,.35);border-radius:14px;padding:7px;display:none;z-index:20;max-height:310px;overflow:auto}.slash-palette.open,.action-popover.open{display:grid;gap:4px}.slash-option,.action-option{height:auto;min-height:42px;text-align:left;display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center;background:transparent;border-color:transparent;border-radius:10px;padding:7px 9px}.slash-option.active,.action-option:hover{background:var(--panel2);border-color:var(--line2)}.slash-option b,.action-option b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--accent)}.slash-option span,.action-option span{font-size:11px;color:var(--muted);white-space:normal;line-height:1.35}.attachment-tray{display:flex;flex-wrap:wrap;gap:6px;padding:0 8px 8px}.attachment-chip{display:flex;align-items:center;gap:6px;max-width:100%;border:1px solid var(--line2);background:var(--panel2);color:var(--soft);border-radius:999px;padding:4px 8px;font-size:11px}.attachment-chip button{min-height:20px;width:20px;min-width:20px;padding:0;border:0;background:transparent;color:var(--muted);border-radius:999px}.info-card{padding:12px;border-bottom:1px solid var(--line);font-size:12px;line-height:1.45}.info-card:last-child{border-bottom:0}.info-card h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.02em}.info-line{display:grid;grid-template-columns:84px 1fr;gap:8px;margin:6px 0}.info-line span:first-child{color:var(--muted);font-weight:750}.info-copy{color:var(--soft)}",
    ".runtime .dock-body{padding:10px 12px}.terminal-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px}.terminal{background:#02070c;color:#b7f7c5;border:1px solid #193324;border-radius:6px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:136px;white-space:pre-wrap;line-height:1.5;font-size:12px;outline:none;cursor:text;overflow:auto}.terminal-main .dock-body{padding:0;min-height:0}.terminal-main .terminal{height:100%;min-height:0;border:0;border-radius:0;padding:14px 16px}.terminal:focus{border-color:#35c49a;box-shadow:0 0 0 2px rgba(53,196,154,.18)}.terminal-main .terminal:focus{box-shadow:inset 0 0 0 1px rgba(53,196,154,.45)}.terminal:empty:before{content:'D3 runtime output will appear here';color:#4e665a}.command-label{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent);font-size:11px}",
    "@media(max-width:1100px){.layout{grid-template-columns:280px 1fr;grid-template-rows:minmax(420px,1fr) 240px 320px;height:auto;min-height:calc(100vh - 44px)}main{grid-column:2;grid-row:1}.runtime{grid-column:2;grid-row:2}.layout>.right-workbench{grid-column:1/3;grid-row:3;border-left:0;border-top:1px solid var(--line)}.sidebar{grid-row:1/3}.chat-layout{grid-template-columns:var(--sidebar-w,250px) minmax(0,1fr) var(--right-w,280px)}.chat-layout.workbench-layout{grid-template-columns:1fr}.chat-layout.workbench-layout .right-workbench{grid-column:1;border-top:1px solid var(--line);min-height:280px}.chat-info{grid-column:1/3;border-left:0;border-top:1px solid var(--line)}.top{grid-template-columns:1fr auto auto}.meta{display:none}}@media(max-width:760px){.chat-layout{display:block;height:auto}.sidebar,.layout>.right-workbench,.runtime,.chat-sidebar,.chat-info,.right-workbench{border:0;border-top:1px solid var(--line);min-height:260px}.sessions-drawer{width:min(300px,100%)}.editor-fields{grid-template-columns:1fr}.editor-wrap{grid-template-columns:34px 1fr}.chat-main{display:grid;min-height:0}.chat-thread-main{min-height:0}.chat-composer-main{grid-template-columns:1fr}.top{height:44px;padding:0 10px}.tabs{grid-template-columns:1fr 1fr}.tab{grid-template-columns:1fr}.glyph{display:none}}",
    ".brand-group{display:flex;align-items:center;gap:8px;min-width:0}.mobile-panel-button,.mobile-panel-backdrop{display:none}.mobile-panel-button[hidden]{display:none!important}.composer-wrap textarea:focus-visible{outline:none}.editor-action-group{display:flex;align-items:center;gap:6px;padding-right:8px;border-right:1px solid var(--line)}.editor-action-group:last-child{padding-right:0;border-right:0}.mutation-action{color:var(--warn)}.d3-browser-error{margin:0 10px 10px 36px;padding:10px;border:1px solid rgba(244,184,96,.35);border-radius:6px;background:rgba(244,184,96,.07)}.d3-browser-error strong,.d3-browser-error span{display:block}.d3-browser-error span{margin-top:4px}.d3-browser-error button{margin-top:8px}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:disabled,input:disabled,select:disabled,textarea:disabled{cursor:not-allowed;opacity:.5}",
    "@media(max-width:760px){body{overflow-x:hidden}.top{grid-template-columns:minmax(0,1fr) auto}.brand{font-size:13px}.mobile-panel-button{display:grid;width:44px;min-width:44px;min-height:44px;margin-left:-10px;border:0;background:transparent}.mode-button{width:44px;min-width:44px;min-height:44px}.chat-layout{display:block!important;height:calc(100dvh - 44px)!important;min-height:0!important;overflow:auto}.chat-main,.terminal-main{width:100%;min-height:calc(100dvh - 44px)}.chat-main{height:calc(100dvh - 44px);min-height:0}.chat-info,.layout>.right-workbench,.chat-layout.workbench-layout>.right-workbench{display:none}.chat-sidebar,.editor-sidebar{position:fixed;z-index:42;top:44px;bottom:0;left:0;width:min(320px,88vw);min-height:0;border-right:1px solid var(--line2);border-top:0;box-shadow:20px 0 50px rgba(0,0,0,.45);transform:translateX(calc(-100% - 24px));transition:transform .18s ease;visibility:hidden}.chat-sidebar.open,.editor-sidebar.open{transform:translateX(0);visibility:visible}.mobile-panel-backdrop.open{position:fixed;z-index:41;inset:44px 0 0;display:block;background:rgba(2,8,15,.58)}.column-resizer{display:none}.composer-wrap{border-radius:18px;padding:13px 12px 10px}.composer-controls{gap:5px}.composer-left,.composer-right{gap:5px}.composer-model{max-width:116px;font-size:12px}.composer-icon{width:44px;min-width:44px;min-height:44px}.composer-safety{min-height:44px;font-size:13px}.composer-send{width:44px;min-width:44px;min-height:44px}.editor-screen{width:100%;min-height:280px}.editor-toolbar-actions{align-items:stretch}.editor-action-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;padding:8px 0;border-right:0;border-bottom:1px solid var(--line)}.editor-action-group:last-child{border-bottom:0}.editor-action-group button{min-height:44px;white-space:normal}.editor-fields input,.editor-fields button,.terminal-row input,.terminal-row button{min-height:44px}.profile-form-grid{grid-template-columns:1fr}.field.wide{grid-column:auto}.profile-form-actions{grid-template-columns:1fr}.profile-form-actions button,.theme-choice,.settings-form-actions button{min-height:44px}}",
    "@media(max-width:760px){body[data-view='chat'] #chatView,body[data-view='terminal'] #terminalView{display:block!important}body[data-view='editor'] #editorView{display:grid!important;grid-template-columns:minmax(0,1fr)!important}body[data-view='chat'] #terminalView,body[data-view='chat'] #editorView,body[data-view='terminal'] #chatView,body[data-view='terminal'] #editorView,body[data-view='editor'] #chatView,body[data-view='editor'] #terminalView{display:none!important}}",
    "@media(max-width:760px){body.profile-connection-active .chat-layout,body.profile-connection-active .layout{height:calc(100dvh - 44px - var(--profile-connection-h,0px))!important}.profile-connection-banner{padding:8px 10px}.profile-connection-copy{font-size:11px}.chat-sidebar,.editor-sidebar{top:calc(44px + var(--profile-connection-h,0px))}.mobile-panel-backdrop.open{inset:calc(44px + var(--profile-connection-h,0px)) 0 0}}",
    ".terminal-main{background:#05090d}.terminal-head{min-height:44px;background:#101820;border-bottom-color:#26323d}.terminal-title-group{display:flex;align-items:center;gap:10px;min-width:0}.terminal-session-mark{width:9px;height:9px;border-radius:50%;background:#7b8791;flex:0 0 auto}.terminal-session-mark[data-state='connected']{background:#42d392}.terminal-session-mark[data-state='busy']{background:#f4b860}.terminal-session-mark[data-state='error']{background:#ff7373}.terminal-head-copy{min-width:0}.terminal-connection-state{display:flex;align-items:center;gap:6px;min-height:16px}.terminal-head .dock-title{text-transform:none;font-size:13px}.terminal-head .dock-sub{max-width:min(52vw,620px);overflow:hidden;text-overflow:ellipsis}.terminal-actions{display:flex;align-items:center;gap:4px}.terminal-tool{min-height:28px;border:0;background:transparent;color:#9bacba;padding:0 8px}.terminal-tool:hover{background:#1b2731;color:#eef5fa;border-color:transparent}.terminal-tool:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.terminal-tool svg{width:14px;height:14px;margin-inline-start:5px;vertical-align:-2px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.terminal-main .dock-body.terminal-body{display:grid;grid-template-rows:minmax(0,1fr) auto auto;padding:0;overflow:hidden;background:#05090d}.terminal-main .terminal{padding:18px 20px;background:#05090d;color:#d8f7df;border:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;line-height:1.48;letter-spacing:0;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:8;caret-color:#eaf7ed;scrollbar-color:#40505a #081016;scrollbar-width:thin}.terminal-main .terminal::selection{background:#3c7657;color:#fff}.terminal-main .terminal:focus{box-shadow:inset 0 0 0 1px #345a45}.terminal-main .terminal:empty:before{content:'';color:#718078}.terminal-input-bar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;min-height:48px;padding:7px 10px;border-top:1px solid #23303a;background:#0c1319}.terminal-prompt{font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;color:#61d99d;font-size:15px;font-weight:800;padding-inline-start:4px}.terminal-command{min-height:34px;border:0;background:transparent;color:#edf8ef;border-radius:3px;padding:6px 4px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px}.terminal-command:focus{border:0;box-shadow:none;outline:1px solid #345a45;outline-offset:3px}.terminal-command::placeholder{color:#718078}.terminal-send{min-height:32px;background:#245e43;border-color:#347c59;color:#f2fff6}.terminal-send:hover{background:#2e7653;border-color:#54a778}.terminal-hints{display:flex;align-items:center;gap:14px;min-height:27px;padding:0 14px;border-top:1px solid #16222b;background:#081016;color:#74838d;font-size:10px;overflow:hidden;white-space:nowrap}.terminal-hints kbd{font:inherit;color:#a8b8c2}.terminal-hints .terminal-transport{margin-inline-start:auto;color:#8da19a}@media(max-width:760px){.terminal-head{padding:0 8px}.terminal-head .dock-sub{max-width:38vw}.terminal-tool{min-width:44px;min-height:44px;padding:0 6px}.terminal-tool-label{display:none}.terminal-tool svg{margin-inline-start:0}.terminal-main .terminal{padding:14px 12px;font-size:12px}.terminal-input-bar{min-height:58px}.terminal-command{min-height:44px;font-size:16px}.terminal-send{min-height:44px}.terminal-hints{gap:9px;padding:0 10px}.terminal-hints .optional-hint{display:none}}",
    ".message-body ul,.message-body ol{margin:6px 0 12px 22px;padding:0}.message-body h1,.message-body h2,.message-body h3,.message-body h4{margin:16px 0 8px;line-height:1.25;color:var(--text)}.message-body h1:first-child,.message-body h2:first-child,.message-body h3:first-child{margin-top:0}.message-body h1{font-size:1.42em}.message-body h2{font-size:1.25em}.message-body h3,.message-body h4{font-size:1.08em}.message-body em{font-style:italic}.message-body a{color:var(--accent);text-decoration:underline}.message-body blockquote{margin:8px 0 12px;padding:2px 0 2px 12px;border-left:3px solid var(--accent);color:var(--soft)}.message-body hr{border:0;border-top:1px solid var(--line2);margin:14px 0}.message-body pre{margin-bottom:12px}.message-body pre code{border:0;background:transparent;padding:0}.message-body table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:.94em}.message-body th,.message-body td{border:1px solid var(--line2);padding:6px 8px;text-align:left;vertical-align:top}.message-body th{background:var(--panel2);font-weight:780}.message-body th:first-child,.message-body td:first-child{min-width:7ch}",
    ".composer-model,.composer-safety{font-size:12px;font-weight:500}.composer-wrap textarea::placeholder{color:var(--muted);opacity:1}.chat-banner .dock-title{text-transform:none;letter-spacing:0;font-weight:600}.composer-send{width:36px;height:36px;min-width:36px}.sessions-tree .profile-meta{font-weight:400}",
    "#itemBrowser[hidden],#d3Browser[hidden]{display:none!important}.item-browser-head{display:flex;gap:8px;align-items:center;padding:10px}.item-browser-head strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;flex:1}.item-browser-field{display:grid;gap:4px;padding:5px 10px;font-size:11px;color:var(--soft)}.item-browser-search{display:flex;gap:4px}.item-browser-search input{min-width:0;flex:1}.item-browser-status{padding:8px 10px;font-size:11px;color:var(--muted)}.item-list{display:grid;padding:4px;gap:2px;font-size:12px}.d3-item-row{text-align:left;border:0;background:transparent;min-height:36px;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.d3-item-row:hover{background:var(--panel2)}.d3-item-row[aria-current=true]{background:var(--bubble-user);color:var(--text)}#readDict,#writeDict{display:none}body:not([data-sbplus=verified]) #sbplusDiscover,body:not([data-sbplus=verified]) #sbplusPlan{display:none}body:not([data-editor-kind=program]) #editorView [aria-label='Build actions']{display:none}@media(max-width:760px){.d3-item-row{min-height:44px}}",
    ".editor-target{display:flex;align-items:center;gap:8px;min-width:0}.editor-target span{font-size:11px;color:var(--soft)}.editor-target input{flex:1;min-width:0}.editor-main>.dock>.dock-head{display:none}.editor-main>.dock{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}.editor-main .editor-wrap{flex:1;min-height:0;overflow:hidden}#editorGutter{overflow:hidden;white-space:pre}.editor-main .editor{min-height:0!important;height:100%;resize:none}.editor-toolbar-actions{flex-shrink:0;overflow:visible}.editor-toolbar-actions>.editor-action-group{display:contents}.editor-more{position:relative;margin-left:auto}.editor-more summary{cursor:pointer;list-style:none;border:1px solid var(--line2);border-radius:5px;min-height:32px;display:flex;align-items:center;padding:0 10px;font-size:12px}.editor-more-menu{position:absolute;z-index:40;bottom:calc(100% + 8px);right:0;width:180px;padding:4px;background:var(--panel);border:1px solid var(--line);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.12)}.editor-more-menu button{display:block;width:100%;text-align:left;border:0;background:transparent}body:not([data-editor-kind=program]) #buildBasic{display:none}body:not([data-editor-file]) #editorView .editor-fields{display:none}@media(max-width:760px){#editorView .editor-main{height:100%;grid-column:1;grid-row:1;min-height:0!important;overflow:hidden}#editorView .editor-screen{grid-column:1;grid-row:2;min-height:0}#editorView .editor-fields{grid-template-columns:minmax(0,1fr) auto}#editorView .editor-fields .editor-target{grid-column:1/-1}#editorView .editor-fields #file{min-height:30px;padding:4px 8px}#editorView .editor-toolbar-actions{padding:8px;gap:6px}#editorView .editor-toolbar-actions button,.editor-more summary{min-height:44px}}",
    ".editor-empty{padding:32px;color:var(--soft);font-size:13px;line-height:1.6}body:not([data-editor-state=loaded]) #editorView .editor-wrap,body:not([data-editor-state=loaded]) #editorView .editor-toolbar-actions{display:none}body[data-editor-state=loaded] .editor-empty{display:none}body:not([data-editor-output=visible]) #editorView .editor-screen{display:none}body:not([data-editor-output=visible]) #editorView{grid-template-rows:minmax(0,1fr)}body[data-theme=light] #editorScreen{background:var(--editor);color:var(--text)}",
    recordEditorStyles(),
    programEditorStyles(),
    agentApprovalStyles(),
    workspaceStatusStyles(),
    "@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}",
    ".top{grid-template-columns:auto minmax(0,1fr) auto}.mode-button{width:auto;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px}.mode-label{font-size:12px}.terminal-head{flex-wrap:wrap;gap:8px;padding:8px 12px;min-height:60px}.terminal-title-group{flex:1;min-width:0}.terminal-target{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;font-size:12px}.terminal-account-label{display:inline-flex;align-items:baseline;gap:4px;min-width:0;color:var(--soft);white-space:nowrap}.terminal-target select{width:auto;min-width:100px;max-width:220px;padding:5px 8px;min-height:32px}.terminal-account-label strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;color:var(--text)}.terminal-head .dock-sub{margin-top:4px;max-width:none}.terminal-actions{flex-shrink:0}.terminal-tool.primary{background:var(--accent-fill);border:1px solid var(--accent-fill);color:var(--accent-ink)}.terminal-tool:disabled{opacity:.5;cursor:wait}body[data-agent-panel='hidden'] #terminalView{grid-template-columns:minmax(0,1fr)}body[data-agent-panel='hidden'] #editorView{grid-template-columns:var(--editor-sidebar-w,290px) minmax(380px,1fr)}body[data-agent-panel='hidden'] .right-workbench{display:none}body[data-view='chat'] #agentPanelToggle{display:none}body[data-theme='light'] .terminal-main,body[data-theme='light'] .terminal-main .dock-body.terminal-body,body[data-theme='light'] .terminal-main .terminal{background:var(--editor);color:var(--text);caret-color:var(--text);scrollbar-color:var(--line2) var(--editor)}body[data-theme='light'] .terminal-head,body[data-theme='light'] .terminal-input-bar,body[data-theme='light'] .terminal-hints{background:var(--panel2);border-color:var(--line);color:var(--soft)}body[data-theme='light'] .terminal-tool{color:var(--soft)}body[data-theme='light'] .terminal-tool:hover{background:var(--rail);color:var(--text)}body[data-theme='light'] .terminal-tool.primary{background:var(--accent-fill);color:var(--accent-ink)}body[data-theme='light'] .terminal-command{background:transparent;color:var(--text)}body[data-theme='light'] .terminal-command::placeholder,body[data-theme='light'] .terminal-main .terminal:empty:before{color:var(--muted)}body[data-theme='light'] .terminal-prompt,body[data-theme='light'] .terminal-hints kbd,body[data-theme='light'] .terminal-hints .terminal-transport{color:var(--soft)}body[data-theme='light'] .terminal-send{background:var(--accent-fill);border-color:var(--accent-fill);color:var(--accent-ink)}body[data-theme='light'] .terminal-send:hover{filter:brightness(.92)}body[data-theme='light'] .terminal-main .terminal:focus{box-shadow:inset 0 0 0 1px var(--accent)}@media(max-width:760px){.top .meta{display:none}.top{grid-template-columns:minmax(0,1fr) auto;padding:0 8px;gap:4px}.brand{font-size:12px}.mode-label{display:none}.mode-button{width:40px;min-width:40px;padding:0}.view-toggle{gap:2px}.terminal-head{align-items:flex-start}.terminal-title-group{flex-basis:100%}.terminal-target{gap:6px}.terminal-target select{max-width:160px}.terminal-actions{margin-left:auto}.terminal-tool-label{display:inline}.terminal-tool svg{margin-inline-start:5px}.terminal-actions .terminal-tool{min-width:44px}.terminal-head .dock-sub{max-width:100%}.terminal-hints{font-size:11px}body[data-agent-panel='visible'] #terminalView>.right-workbench,body[data-agent-panel='visible'] #editorView>.right-workbench{display:block;position:fixed;z-index:30;top:44px;bottom:0;right:0;height:auto;width:min(360px,100vw);border-left:1px solid var(--line);box-shadow:-8px 0 24px rgba(0,0,0,.15)}.terminal-main{height:calc(100dvh - 44px);min-height:0}}",
    "body{height:100dvh;min-height:0;overflow:hidden}.chat-layout{min-height:0;height:calc(100dvh - 44px)}#chatView{grid-template-columns:var(--sidebar-w,260px) minmax(0,1fr)}.chat-info{display:none}.terminal-account-label strong{font-family:inherit;font-weight:600}.terminal-target{gap:8px}.terminal-target select{font-size:12px}.terminal-target #terminalProfileEdit{border:1px solid var(--line2);background:var(--panel);border-radius:6px;padding:0 10px;min-height:32px}.terminal-main .terminal:empty:before{content:none}.terminal-hints{color:var(--muted)}.chat-composer-main .composer-wrap{border-radius:8px;box-shadow:none;background:var(--panel);border-color:var(--line2)}.chat-composer-main textarea{min-height:56px;font-size:14px}.embedded .brand,.embedded .top .meta{display:none}.embedded .top{display:flex;justify-content:flex-end}.layout{min-height:0}#editorView{height:calc(100dvh - 44px);overflow:hidden;grid-template-rows:minmax(0,1fr) minmax(140px,30vh)}@media(max-width:1100px) and (min-width:761px){body[data-agent-panel='hidden'] #editorView{grid-template-columns:220px minmax(0,1fr)}body[data-agent-panel='visible'] #editorView>.right-workbench{position:fixed;z-index:30;right:0;top:44px;bottom:0;height:auto;width:320px;display:block}}@media(max-width:760px){.terminal-target select,.terminal-target #terminalProfileEdit{min-height:44px}.terminal-target select{font-size:16px}#editorView{overflow:hidden}.embedded .top{justify-content:center}}",
    "</style>",
    "</head>",
    "<body data-theme=\"light\" data-view=\"chat\" data-agent-panel=\"hidden\">",
    `<div class="top"><div class="brand-group"><button id="mobilePanelButton" class="icon-button mobile-panel-button" type="button" title="Open workspace panel" aria-label="Open workspace panel" aria-expanded="false">${iconMenu}</button><div class="brand">D3 Code IDE</div></div><div class="meta" id="meta">Sessions</div><div class="view-toggle" aria-label="Workspace view"><button id="chatModeButton" class="mode-button" title="Chat mode" aria-label="Chat mode" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg><span class="mode-label">Chat</span></button><button id="editorModeButton" class="mode-button" title="Editor mode" aria-label="Editor mode" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span class="mode-label">Editor</span></button><button id="terminalModeButton" class="mode-button active" title="D3 terminal" aria-label="D3 terminal" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg><span class="mode-label">Terminal</span></button><button id="agentPanelToggle" class="mode-button" type="button" aria-pressed="false" aria-label="Show chat panel" title="Show chat panel"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M6 8h6M6 12h4"/></svg><span class="mode-label">Chat panel</span></button><button id="workspaceSettings" class="mode-button" type="button" aria-label="Settings" title="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></svg></button></div></div>`,
    '<div id="profileConnectionBanner" class="profile-connection-banner" role="status" aria-live="polite" hidden></div>',
    '<div id="mobilePanelBackdrop" class="mobile-panel-backdrop" tabindex="-1" aria-hidden="true"></div>',
    `<div id="chatView" class="chat-layout"><aside class="chat-sidebar"><div class="column-resizer column-resizer-right" data-resize="sidebar" title="Resize sessions list"></div><div class="dock"><div class="dock-head sessions-head"><div class="dock-title">Sessions</div><button type="button" id="sessionsNewThread" class="icon-button" title="New thread" aria-label="New thread">+</button></div><div class="dock-body sessions-body"><div id="chatList" class="sessions-tree"></div>${sessionsFooterHtml}</div></div></aside><main class="chat-main"><div class="dock-head chat-banner"><div class="dock-title" id="chatTitle" data-chat-title>New chat</div></div><div class="chat-stage"><div id="chatOutput" class="chat-thread-main chat-column"></div><div class="chat-composer-main"><div class="composer-wrap"><div id="slashPalette" class="slash-palette"></div><div id="actionPopover" class="action-popover" role="menu"><button id="addFileAction" class="action-option" type="button"><b>File</b><span>Attach a file as context for this message.</span></button><button id="addPhotoAction" class="action-option" type="button"><b>Photo</b><span>Attach an image or screenshot to the message.</span></button><button id="planModeAction" class="action-option" type="button"><b>Plan mode</b><span>Switch permissions to Plan before sending.</span></button></div><input id="fileUpload" type="file" multiple hidden /><input id="photoUpload" type="file" accept="image/*" multiple hidden />${workspaceStatus}<textarea id="chatPrompt" aria-label="Describe the D3 work" placeholder="Plan, build: / for commands and context"></textarea><div id="attachmentTray" class="attachment-tray"></div><div class="composer-controls"><div class="composer-left"><button id="composerAdd" class="composer-icon" type="button" title="Add context" aria-label="Add context"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button id="composerSafety" class="composer-safety" type="button" title="Change permission mode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg><span id="composerSafetyLabel">Ask</span></button></div><div class="composer-right"><button id="composerModel" class="composer-model" type="button" title="Change provider and model">model</button><button id="composerMic" class="composer-icon" type="button" title="Voice input" aria-label="Voice input"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg></button><button class="composer-send" id="chatSend" type="button" disabled title="Send" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></button></div></div></div></div></div></main><aside class="chat-info"><div class="column-resizer column-resizer-left" data-resize="right" title="Resize info panel"></div><div class="dock"><div class="dock-head"><div class="dock-title">Info</div><div class="dock-sub" id="chatInfoSafety"></div></div><div class="dock-body"><div class="info-card"><h3>Connection</h3><div class="info-line"><span>Profile</span><strong id="chatInfoProfile">none</strong></div><div class="info-line"><span>Account</span><strong id="chatInfoAccount">none</strong></div><div class="info-line"><span>Model</span><strong id="chatInfoModel">unknown</strong></div><div class="info-line"><span>Safety</span><strong id="chatInfoSafetyValue">ask</strong></div></div><div class="info-card"><h3>D3/SB+ Capabilities</h3><div id="capabilitiesPanel" class="info-copy">BASIC builder, file/dictionary builder, SB+ discovery/planning, RAG/manual search, terminal/screen proof.</div></div><div class="info-card"><h3>Last tool</h3><div id="chatLastTool" class="info-copy">No D3 tool has run in this browser session.</div></div></div></div></aside></div>`,
    "<div id=\"terminalView\" class=\"chat-layout workbench-layout\"><main class=\"terminal-main\"><div class=\"dock-head terminal-head\"><div class=\"terminal-title-group\"><div class=\"terminal-head-copy\"><div class=\"terminal-target\"><select id=\"terminalProfile\" aria-label=\"D3 connection profile\"></select><span class=\"terminal-account-label\">Account <strong id=\"terminalAccount\">none</strong></span><button id=\"terminalProfileEdit\" class=\"terminal-tool\" type=\"button\" title=\"Edit connection\">Edit</button></div><div class=\"dock-sub terminal-connection-state\"><span id=\"terminalSessionMark\" class=\"terminal-session-mark\" data-state=\"idle\" aria-hidden=\"true\"></span><span id=\"terminalSessionMeta\" role=\"status\" aria-live=\"polite\" aria-label=\"Terminal connection status\">Not connected</span></div></div></div><div class=\"terminal-actions\"><button id=\"terminalCopy\" class=\"terminal-tool\" type=\"button\" title=\"Copy terminal transcript\">Copy</button><button id=\"terminalClear\" class=\"terminal-tool\" type=\"button\" title=\"Clear the visible transcript\">Clear</button><button id=\"terminalReconnect\" class=\"terminal-tool\" type=\"button\" title=\"Close and reconnect the SSH PTY\"><span class=\"terminal-tool-label\">Connect</span><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 11a8 8 0 1 0-2.3 5.7\"/><path d=\"M20 4v7h-7\"/></svg></button></div></div><div class=\"dock-body terminal-body\"><div id=\"terminalMain\" class=\"terminal\" tabindex=\"0\" role=\"log\" aria-live=\"polite\" aria-label=\"D3 console transcript\"></div><div class=\"terminal-input-bar\"><span class=\"terminal-prompt\" aria-hidden=\"true\">:</span><input id=\"terminalCommand\" class=\"terminal-command\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\" aria-label=\"D3 command\" placeholder=\"Enter TCL, D3 input, or a menu choice\" /><button id=\"terminalSend\" class=\"terminal-send\" type=\"button\">Send</button></div><div class=\"terminal-hints\"><span><kbd>Enter</kbd> send</span><span><kbd>Up/Down</kbd> history</span><span class=\"optional-hint\"><kbd>Ctrl L</kbd> clear</span><span id=\"terminalTransport\" class=\"terminal-transport\">Persistent SSH PTY</span></div></div></main>",
    rightWorkbench(sideChat("aside", "right-rail", "terminalAgentOutput", "terminalAgentPrompt", "terminalAgentSend", "terminalAgentActivity", "terminalRunStatus")),
    "</div>",
    "<div id=\"editorView\" class=\"layout\">",
    "<aside class=\"editor-sidebar\"><div class=\"column-resizer column-resizer-right\" data-resize=\"editor-sidebar\" title=\"Resize D3 browser\"></div><div class=\"dock\"><div class=\"dock-head sessions-head\"><div class=\"dock-title\">D3 Browser</div><div class=\"dock-head-actions\"><button type=\"button\" id=\"refreshBrowser\" class=\"icon-button\" title=\"Refresh account files\" aria-label=\"Refresh account files\">↻</button></div></div><div class=\"dock-body sessions-body\"><div id=\"d3Browser\" class=\"sessions-tree\"></div><div id=\"itemBrowser\" hidden><div class=\"item-browser-head\"><button id=\"backToFiles\" type=\"button\">Files</button><strong id=\"itemBrowserFile\"></strong><button id=\"refreshItems\" class=\"icon-button\" type=\"button\" aria-label=\"Refresh items\">↻</button></div><label class=\"item-browser-field\">Section<select id=\"itemSection\"><option value=\"data\">Data</option><option value=\"dict\">Dictionary</option></select></label><div class=\"item-browser-field\"><label for=\"itemFilter\">Find items</label><div class=\"item-browser-search\"><input id=\"itemFilter\" type=\"search\" placeholder=\"ID prefix\" /><button id=\"searchItems\" type=\"button\">Search</button></div></div><div id=\"itemBrowserStatus\" class=\"item-browser-status\" role=\"status\"></div><div id=\"itemList\" class=\"item-list\"></div></div></div></div></aside>",
    "<main class=\"editor-main\">",
    "<div class=\"dock\"><div class=\"dock-head\"><div class=\"dock-title\">Item</div><div class=\"dock-sub\"></div></div><div class=\"editor-fields\"><div class=\"editor-target\"><span id=\"editorSectionLabel\">Data</span><input id=\"file\" aria-label=\"D3 file\" placeholder=\"D3 file, e.g. CUSTOMERS or BP\" /></div><input id=\"item\" aria-label=\"D3 item or program\" placeholder=\"item-ID, record, program, or subroutine\" /><button id=\"readItem\">Read item</button></div><div id=\"editorEmpty\" class=\"editor-empty\" role=\"status\">Select a file and open an item to begin.</div><div id=\"recordFields\" class=\"record-fields\" hidden></div><div id=\"recordDictionaryStatus\" class=\"record-status\" role=\"status\" aria-live=\"polite\" hidden></div><div class=\"program-editor-notice\" role=\"status\">Code editor unavailable. Plain text editing is available.</div><div class=\"editor-wrap\">" + programEditorHtml() + "<div id=\"editorGutter\" class=\"gutter\" aria-hidden=\"true\">1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>10<br>11<br>12<br>13<br>14<br>15<br>16<br>17<br>18<br>19<br>20</div><textarea id=\"itemBody\" wrap=\"off\" class=\"editor\" aria-label=\"D3 item editor\" spellcheck=\"false\" placeholder=\"Pick a file from the browser or type a file and item ID, then read.\"></textarea></div><div id=\"editorRecordStatus\" class=\"record-status\" role=\"status\" aria-live=\"polite\"></div><div class=\"toolbar editor-toolbar-actions\"><div class=\"editor-action-group\" aria-label=\"Item actions\"><button id=\"writeItem\" class=\"primary\">Save</button><button id=\"readDict\">Read dictionary</button></div><div class=\"editor-action-group\" aria-label=\"Build actions\"><button id=\"compileBasic\">Compile</button><button id=\"catalogBasic\">Catalog</button><button id=\"runBasic\">Run</button></div><details class=\"editor-more\"><summary>Tools</summary><div class=\"editor-more-menu\"><button id=\"buildBasic\">Build BASIC</button><button id=\"writeDict\">Write dictionary</button><button id=\"createFile\">Create file</button><button id=\"ragSearchEditor\">Search manuals</button><button id=\"sbplusDiscover\">SB+ Discover</button><button id=\"sbplusPlan\">SB+ Plan</button></div></details></div></div>",
    "</main>",
    rightWorkbench(sideChat("section", "right", "agentOutput", "agentPrompt", "agentSend", "agentActivity", "agentRunStatus")),
    "<section class=\"editor-screen\"><div class=\"dock\"><div class=\"dock-head\"><div class=\"dock-title\">Output</div><button id=\"closeEditorOutput\" class=\"terminal-tool\" type=\"button\" aria-label=\"Hide output\">Close</button></div><div class=\"dock-body\"><div id=\"editorScreen\" class=\"terminal\" tabindex=\"0\" role=\"log\" aria-label=\"Build and tool output\"></div></div></div></section>",
    "</div>",
    confirmationHtml(),
    "<div id=\"discardEditorModal\" class=\"modal-backdrop\"><div class=\"settings-form\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"discardEditorTitle\"><div id=\"discardEditorTitle\" class=\"menu-title\">Discard unsaved changes?</div><p>The open item has changes that have not been saved.</p><div class=\"settings-form-actions\"><button id=\"keepEditorChanges\" type=\"button\">Keep editing</button><button id=\"discardEditorChanges\" type=\"button\">Discard changes</button></div></div></div>",
    "<div id=\"snackbar\" class=\"snackbar\" role=\"status\" aria-live=\"polite\"></div>",
    "<div id=\"chatContextMenu\" class=\"chat-context-menu\" role=\"menu\" aria-hidden=\"true\"><button type=\"button\" data-chat-action=\"delete\">Delete chat</button></div>",
    "<div id=\"profileContextMenu\" class=\"chat-context-menu\" role=\"menu\" aria-hidden=\"true\"><button type=\"button\" data-profile-action=\"edit\">Edit profile</button><button type=\"button\" data-profile-action=\"remove\">Remove profile</button></div>",
    "<div id=\"safetyMenu\" class=\"control-menu\"><div class=\"control-menu-title\">Permission mode</div><div class=\"control-row\"><button data-safety-option=\"ask\">Ask</button><button data-safety-option=\"plan\">Plan</button><button data-safety-option=\"trust\">Full access</button></div><div class=\"control-menu-note\">This updates the current session and saves the default for this profile.</div></div>",
    "<div id=\"modelMenu\" class=\"control-menu\"><div class=\"control-menu-title\">Provider and model</div><div class=\"model-menu-grid\"><label>Provider<select id=\"modelProvider\"></select></label><div id=\"modelKeyPanel\" class=\"model-key-panel\"><div id=\"modelKeyMessage\" class=\"control-menu-note\"></div><label>API key<input id=\"modelApiKey\" type=\"password\" placeholder=\"Paste provider API key\" /></label><button id=\"saveModelKey\" class=\"primary\">Save key</button></div><label id=\"modelChoiceWrap\">Model<select id=\"modelChoice\"></select></label><button id=\"saveModelChoice\" class=\"primary\">Save model</button><div id=\"modelMenuNote\" class=\"control-menu-note\"></div></div></div>",
    "<div id=\"settingsModal\" class=\"modal-backdrop\"><div class=\"settings-form\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"settingsFormTitle\"><div><div class=\"menu-title\" id=\"settingsFormTitle\">Settings</div><div class=\"menu-muted\">Appearance and other IDE preferences.</div></div><div class=\"field\"><span>Theme</span><div class=\"theme-row\" id=\"themeRow\"><button type=\"button\" class=\"theme-choice\" data-theme-choice=\"dark\">Dark</button><button type=\"button\" class=\"theme-choice\" data-theme-choice=\"light\">Light</button><button type=\"button\" class=\"theme-choice\" data-theme-choice=\"system\">System</button></div><em>Choose dark, light, or match your system setting.</em></div><div class=\"settings-form-actions\"><button type=\"button\" id=\"closeSettings\">Close</button></div></div></div>",
    "<div id=\"profileModal\" class=\"modal-backdrop\"><div id=\"profileForm\" class=\"profile-form\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"profileFormTitle\"><div><div class=\"menu-title\" id=\"profileFormTitle\">Add D3 connection</div><div class=\"menu-muted\">This tells D3 Code how to reach a Rocket D3 account. It is separate from the AI model provider.</div></div><div class=\"profile-form-grid\"><label class=\"field\"><span>Profile name</span><input id=\"profileName\" placeholder=\"Production, Test, Local DM\" /><em>A friendly name for this saved connection.</em></label><label class=\"field\"><span>Connection</span><select id=\"profileType\"><option value=\"local\">This machine</option><option value=\"ssh\">SSH server</option></select><em>Choose SSH when D3 lives on another server.</em></label><label class=\"field\"><span>SSH host</span><input id=\"profileHost\" placeholder=\"d3.example.com\" /><em>Only needed for SSH connections.</em></label><label class=\"field\"><span>SSH user</span><input id=\"profileUser\" /><em>Only needed for SSH connections.</em></label><label class=\"field\"><span>Starting D3 account</span><input id=\"profileAccount\" placeholder=\"DM\" /><em>The account to use after connecting, such as DM or SALES.</em></label><label class=\"field\"><span>Runtime session</span><select id=\"profileSession\"><option value=\"persistent\">Keep connected</option><option value=\"oneshot\">Run one command at a time</option></select><em>Keep connected is best for the IDE and agent.</em></label><label class=\"field wide\"><span>Command that opens D3</span><input id=\"profileEntry\" placeholder=\"d3, ap, or your server login command\" /><em>Leave blank if the shell or SSH login already lands inside D3/TCL.</em></label><label class=\"field wide\"><span>Startup input</span><textarea id=\"profileStartup\" rows=\"3\" placeholder=\"dm\\ndm\\n\"></textarea><em>Keys sent after D3 opens, before D3 Code waits for the ready prompt. Use this for user/account/master-dictionary prompts.</em></label><label class=\"field\"><span>Ready prompt</span><input id=\"profilePrompt\" placeholder=\":\" /><em>Normal TCL is a standalone :. The > prompt means an active select list.</em></label><label class=\"field\"><span>Approval mode</span><select id=\"profileSafety\"><option value=\"ask\">Ask before risky actions</option><option value=\"plan\">Read and plan only</option><option value=\"trust\">Allow normal guarded work</option></select><em>Controls writes, compile, catalog, LOGTO, and runtime commands.</em></label></div><div class=\"profile-form-actions\"><button id=\"saveProfile\">Save profile</button><button id=\"cancelProfile\">Cancel</button></div></div></div>",
    "<script>",
    agentApprovalClientScript(),
    workspaceStateClientScript(),
    embeddedClientScript(process.env.D3CODE_BASE_PATH ?? "", storageScope),
    "const $=id=>document.getElementById(id);",
    "async function api(path, options){const r=await ideFetch(path,options);const t=await r.text();try{return JSON.parse(t)}catch{return {text:t,status:r.status}}}",
    "function escapeHtml(s){return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]))}",
    "let terminalDraft='';let terminalHistory=[];let terminalHistoryIndex=0;let terminalBusy=false;let terminalConnectionState={connected:false,mechanism:'not-configured',profile:'',account:''};",
    "function terminalText(v){if(v==null)return '';if(typeof v==='string')return v;if(typeof v!=='object')return String(v);const pick=v.result??v.output??v.text??v.clean??v.message??v.summary;if(typeof pick==='string'&&pick.trim())return pick;const parts=[];for(const [k,val] of Object.entries(v)){if(val==null||val==='')continue;if(Array.isArray(val))parts.push(k+': '+val.length+' item'+(val.length===1?'':'s'));else if(typeof val==='object')parts.push(k+': '+terminalText(val));else parts.push(k+': '+String(val).slice(0,160));if(parts.join('; ').length>600)break}return parts.join('; ')||'ok'}",
    "function formatTerminalResponse(v){if(!v)return '';if(typeof v==='string')return v;if(v.displayTranscript)return String(v.displayTranscript);if(v.clean||v.result)return [v.label||'TCL output',v.clean||v.result].filter(Boolean).join('\\n');if(v.error)return 'Error: '+v.error;if(v.transcript)return String(v.transcript);return terminalText(v)}",
    "function terminalEls(){return ['terminalMain'].map(id=>$(id)).filter(Boolean)}",
    "function commandEls(){return ['terminalCommand'].map(id=>$(id)).filter(Boolean)}",
    "function renderTerminal(){const out=terminalEls()[0]?.dataset.output||'';terminalEls().forEach(el=>{el.dataset.output=out;el.textContent=out;el.scrollTop=el.scrollHeight});commandEls().forEach(el=>{if(el.value!==terminalDraft)el.value=terminalDraft});renderTerminalConnection()}",
    "function renderTerminalConnection(){const mark=$('terminalSessionMark');const meta=$('terminalSessionMeta');const transport=$('terminalTransport');const connected=Boolean(terminalConnectionState.connected);const state=terminalBusy?'busy':connected?'connected':terminalConnectionState.error?'error':'idle';if(mark)mark.dataset.state=state;const message=terminalBusy?'Waiting for D3 response':connected?'Connected':(terminalConnectionState.error||'Not connected');if(meta&&meta.textContent!==message)meta.textContent=message;if(transport)transport.textContent=terminalConnectionState.mechanism==='persistent-pty'?'Persistent SSH PTY':'Command session';const account=$('terminalAccount');if(account){account.textContent=terminalConnectionState.account||profileCache.find(profile=>profile.name===selectedProfile)?.account||'none';account.title=account.textContent}const reconnect=$('terminalReconnect');if(reconnect){reconnect.classList.toggle('primary',!connected);reconnect.disabled=terminalBusy||!selectedProfile;reconnect.querySelector('.terminal-tool-label').textContent=terminalBusy?'Waiting':connected?'Reconnect':'Connect';reconnect.title=connected?'Reconnect to the selected D3 account':'Connect to the selected D3 account'}const send=$('terminalSend');if(send){send.disabled=terminalBusy;send.textContent=terminalBusy?'Waiting':'Send'}}",
    "function setTerminalTranscript(text){terminalEls().forEach(el=>el.dataset.output=String(text||''));renderTerminal()}",
    "function show(id,v){if(id==='editorScreen'){if(document.body.dataset.view==='editor')document.body.dataset.editorOutput='visible';$('editorScreen').textContent=formatTerminalResponse(v);return}if(id==='terminal'){setTerminalTranscript(formatTerminalResponse(v));return}const node=$(id);if(node)node.textContent=terminalText(v)}",
    "const CHAT_STORE='d3code.ide.chats.v1';",
    "const CHAT_VIEW_STORE='d3code.ide.view';",
    "const RIGHT_WIDTH_STORE='d3code.ide.rightWidth';",
    "const EDITOR_SIDEBAR_WIDTH_STORE='d3code.ide.editorSidebarWidth';",
    "const D3_BROWSER_COLLAPSE_STORE='d3code.ide.d3BrowserCollapse.v1';",
    "const SIDEBAR_WIDTH_STORE='d3code.ide.sidebarWidth';",
    "const PROFILE_COLLAPSE_STORE='d3code.ide.profileCollapse.v1';",
    "const CHAT_INPUT_PLACEHOLDER='Plan, build: / for commands and context';",
    "let chatSessions=[];",
    "let activeChatId='';",
    "let agentRunChatId='';",
    "const busyChatIds=new Set();",
    "function chatById(id){return chatSessions.find(c=>c.id===id)||null}",
    "function isAgentChatLive(){return Boolean(agentRunChatId&&agentRunChatId===activeChatId)}",
    "function recordingChat(){return chatById(agentRunChatId)||currentChat()}",
    "function syncAgentSendButtons(){const activeBusy=busyChatIds.has(activeChatId);document.querySelectorAll('#chatSend,#agentSend,#terminalAgentSend').forEach(btn=>{btn.disabled=!activeBusy&&workspaceState!=='ready';if(!btn.dataset.sendHtml)btn.dataset.sendHtml=btn.innerHTML;btn.innerHTML=activeBusy?'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1\"/></svg>':btn.dataset.sendHtml;btn.title=activeBusy?'Stop':workspaceState==='ready'?'Send':workspaceState==='error'?'Workspace unavailable':'Loading workspace';btn.setAttribute('aria-label',activeBusy?'Stop agent':workspaceState==='ready'?'Send message':workspaceState==='error'?'Workspace unavailable':'Loading workspace')})}",
    "function setChatBusy(id,busy){if(!id)return;if(busy)busyChatIds.add(id);else busyChatIds.delete(id);syncAgentSendButtons();renderChatList()}",
    "let chatContextTargetId='';",
    "let profileContextTarget='';",
    "let editingProfileName='';",
    "let profileCache=[];",
    "let selectedProfile='';",
    "let profileCollapse={};",
    "let d3BrowserCollapse={};",
    "let d3BrowserCache={};",
    "let selectedD3File='';",
    "let currentSafety='ask';",
    "let pythonRuntime=null;",
    "function makeChat(profile){const id='chat-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);return {id,title:'New chat',profile:profile||'',updatedAt:Date.now(),messages:[]}}",
    "function isBlankChatSession(chat){return !chat||!chat.messages||chat.messages.length===0}",
    "function activeChatSession(){return chatSessions.find(c=>c.id===activeChatId)||null}",
    "function chatsForProfile(profile){return chatSessions.filter(c=>(c.profile||'')===profile).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))}",
    "function loadProfileCollapse(){try{const saved=JSON.parse(localStorage.getItem(PROFILE_COLLAPSE_STORE)||'{}');profileCollapse=saved&&typeof saved==='object'?saved:{}}catch{profileCollapse={}}}",
    "function saveProfileCollapse(){try{localStorage.setItem(PROFILE_COLLAPSE_STORE,JSON.stringify(profileCollapse))}catch{}}",
    "function profileCollapsed(name){return profileCollapse[name]===true}",
    "function toggleProfileCollapsed(name){profileCollapse[name]=!profileCollapsed(name);saveProfileCollapse();renderChatList();renderD3Browser()}",
    "function migrateChatProfiles(activeProfile){chatSessions.forEach(c=>{if(!c.profile&&activeProfile)c.profile=activeProfile})}",
    "function syncActiveChatForProfile(){if(!selectedProfile){activeChatId='';return}const chats=chatsForProfile(selectedProfile);if(!chats.length){activeChatId='';return}if(!chats.some(c=>c.id===activeChatId))activeChatId=chats[0].id}",
    "function sameBubble(a,b){return a?.kind==='bubble'&&b?.kind==='bubble'&&a.role===b.role&&String(a.text||'').trim()===String(b.text||'').trim()}",
    "function sameCompletedTool(a,b){return a?.kind==='tool'&&b?.kind==='tool'&&a.status!=='running'&&b.status!=='running'&&a.name===b.name&&String(a.detail||a.text||'').trim()===String(b.detail||b.text||'').trim()}",
    "function normalizeChatMessages(messages){const out=[];let changed=false;for(const raw of Array.isArray(messages)?messages:[]){const message=raw&&typeof raw==='object'?raw:null;if(!message){changed=true;continue}const last=out[out.length-1];if(sameBubble(last,message)||sameCompletedTool(last,message)){changed=true;continue}if(message.runKey&&out.some(m=>m.runKey===message.runKey)){changed=true;continue}out.push(message)}return {messages:out,changed}}",
    "function loadChats(){loadProfileCollapse();try{const saved=JSON.parse(localStorage.getItem(CHAT_STORE)||'[]');if(Array.isArray(saved)&&saved.length){let changed=false;chatSessions=saved.map(chat=>{const norm=normalizeChatMessages(chat.messages);changed=changed||norm.changed;return {...chat,messages:norm.messages}});activeChatId=chatSessions[0]?.id||'';if(changed)saveChats();return}}catch{}chatSessions=[];activeChatId=''}",
    "let chatSyncTimer=null;",
    "async function hydrateChatsFromServer(){try{const data=await api('/api/chats');const serverChats=Array.isArray(data&&data.chats)?data.chats:[];if(!serverChats.length)return;const stamp=c=>String(c.updatedAt||c.updated_at||c.createdAt||c.created_at||'');const byId=new Map(chatSessions.map(c=>[c.id,c]));for(const c of serverChats){if(!c||!c.id)continue;const existing=byId.get(c.id);if(!existing||stamp(c)>=stamp(existing))byId.set(c.id,c)}chatSessions=[...byId.values()].sort((a,b)=>stamp(b).localeCompare(stamp(a)));if(!activeChatId)activeChatId=chatSessions[0]?chatSessions[0].id:'';try{localStorage.setItem(CHAT_STORE,JSON.stringify(chatSessions))}catch{}}catch{}}",
    "function syncChatsToServer(){try{api('/api/chats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chats:chatSessions.slice(0,60)})}).catch(()=>{})}catch{}}",
    "function saveChats(){try{chatSessions=chatSessions.slice(0,60).map(chat=>({...chat,messages:(chat.messages||[]).slice(-200)}));localStorage.setItem(CHAT_STORE,JSON.stringify(chatSessions))}catch{}try{clearTimeout(chatSyncTimer);chatSyncTimer=setTimeout(syncChatsToServer,800)}catch{}}",
    "function confirmLeaveCurrentChat(){const chat=chatById(activeChatId);if(!chat||!chat.messages||!chat.messages.length)return true;return confirm('Leave this chat? It stays saved in Sessions, and you can return to it any time.')}function requireActiveChat(){let chat=activeChatSession();if(chat)return chat;if(!selectedProfile)return null;chat=makeChat(selectedProfile);chatSessions.unshift(chat);activeChatId=chat.id;saveChats();renderChatList();return chat}",
    "function currentChat(){return requireActiveChat()}",
    "function previewText(text){return String(text||'').replace(/\\s+/g,' ').trim().slice(0,90)}",
    "function ensureMessageId(message){message.id=message.id||('msg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));message.createdAt=message.createdAt||Date.now();return message}",
    "function recordChatMessage(message,chatId){ensureMessageId(message);const chat=chatById(chatId)||recordingChat();if(!chat)return;if(message.runKey&&chat.messages.some(m=>m.runKey===message.runKey))return;const last=chat.messages[chat.messages.length-1];if(sameBubble(last,message)||sameCompletedTool(last,message))return;chat.messages.push(message);chat.updatedAt=Date.now();const firstUser=chat.messages.find(m=>m.role==='user');if(firstUser)chat.title=previewText(firstUser.text).slice(0,44)||'Session';chatSessions=[chat,...chatSessions.filter(c=>c.id!==chat.id)];saveChats();renderChatList();if(chatId===activeChatId||chat.id===activeChatId)syncChatTitle()}",
    "function formatTime(ts){try{return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(ts||Date.now()))}catch{return ''}}",
    "function cleanAgentText(text){return String(text||'').replace(/<\\/?(?:d3_tool|tool_call|d_value|arg_key|arg_value)[^>]*>/gi,'').replace(/\\{\\s*\"name\"\\s*:\\s*\"d3_[\\s\\S]*?\\}\\s*/g,'').trim()}",
    "function inlineMarkdown(s){return escapeHtml(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')}",
    "function markdownHtml(text){const raw=cleanAgentText(text);if(!raw)return '<p></p>';const lines=raw.split(/\\r?\\n/);let html='';let para=[];let list=[];const flushPara=()=>{if(para.length){html+='<p>'+inlineMarkdown(para.join(' '))+'</p>';para=[]}};const flushList=()=>{if(list.length){html+='<ul>'+list.map(item=>'<li>'+inlineMarkdown(item)+'</li>').join('')+'</ul>';list=[]}};for(const line of lines){const trimmed=line.trim();if(!trimmed){flushPara();flushList();continue}const bullet=trimmed.match(/^[-*]\\s+(.+)/);if(bullet){flushPara();list.push(bullet[1]);continue}flushList();para.push(trimmed)}flushPara();flushList();return html||'<p></p>'}",
    "function placeMenu(menu,anchor){const rect=anchor.getBoundingClientRect();menu.style.left=Math.min(rect.left,window.innerWidth-menu.offsetWidth-14)+'px';menu.style.top=Math.max(12,rect.top-menu.offsetHeight-10)+'px'}",
    "function closeControlMenus(){document.querySelectorAll('.control-menu').forEach(menu=>menu.classList.remove('open'))}",
    "function openControlMenu(id,anchor){closeControlMenus();const menu=$(id);menu.classList.add('open');requestAnimationFrame(()=>placeMenu(menu,anchor))}",
    "function activeLayoutRoot(){const view=document.body.dataset.view;if(view==='chat')return document.getElementById('chatView');if(view==='terminal')return document.getElementById('terminalView');if(view==='editor')return document.getElementById('editorView');return null}",
    "function setRightWidth(px){const width=Math.max(260,Math.min(720,Number(px)||340));document.documentElement.style.setProperty('--right-w',width+'px');try{localStorage.setItem(RIGHT_WIDTH_STORE,String(width))}catch{}}",
    "function setSidebarWidth(px){const width=Math.max(220,Math.min(480,Number(px)||290));document.documentElement.style.setProperty('--sidebar-w',width+'px');try{localStorage.setItem(SIDEBAR_WIDTH_STORE,String(width))}catch{}}",
    "function setEditorSidebarWidth(px){const width=Math.max(220,Math.min(480,Number(px)||290));document.documentElement.style.setProperty('--editor-sidebar-w',width+'px');try{localStorage.setItem(EDITOR_SIDEBAR_WIDTH_STORE,String(width))}catch{}}",
    "function editorSidebarWidthFromPointer(clientX){const root=document.getElementById('editorView');if(!root)return null;const rect=root.getBoundingClientRect();return Math.max(220,Math.min(480,clientX-rect.left))}",
    "function rightWidthFromPointer(clientX){const root=activeLayoutRoot();if(!root)return null;const rect=root.getBoundingClientRect();return Math.max(260,Math.min(720,rect.right-clientX))}",
    "function sidebarWidthFromPointer(clientX){const root=document.getElementById('chatView');if(!root)return null;const rect=root.getBoundingClientRect();return Math.max(220,Math.min(480,clientX-rect.left))}",
    "function initColumnResize(){try{const savedRight=localStorage.getItem(RIGHT_WIDTH_STORE);if(savedRight)setRightWidth(savedRight)}catch{}try{const savedSidebar=localStorage.getItem(SIDEBAR_WIDTH_STORE);if(savedSidebar)setSidebarWidth(savedSidebar)}catch{}try{const savedEditorSidebar=localStorage.getItem(EDITOR_SIDEBAR_WIDTH_STORE);if(savedEditorSidebar)setEditorSidebarWidth(savedEditorSidebar)}catch{}document.querySelectorAll('.column-resizer').forEach(handle=>{handle.addEventListener('pointerdown',event=>{event.preventDefault();const mode=handle.dataset.resize||'right';handle.classList.add('dragging');const move=e=>{if(mode==='sidebar'){const width=sidebarWidthFromPointer(e.clientX);if(width!=null)setSidebarWidth(width);return}if(mode==='editor-sidebar'){const width=editorSidebarWidthFromPointer(e.clientX);if(width!=null)setEditorSidebarWidth(width);return}const width=rightWidthFromPointer(e.clientX);if(width!=null)setRightWidth(width)};const up=()=>{handle.classList.remove('dragging');document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up)};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)})})}",
    "let snackbarTimer=null;",
    "function toast(text){const bar=$('snackbar');if(!bar)return;bar.textContent=text;bar.classList.add('show');clearTimeout(snackbarTimer);snackbarTimer=setTimeout(()=>bar.classList.remove('show'),1400)}",
    "async function copyText(text){try{await navigator.clipboard.writeText(text||'');toast('Copied')}catch{toast('Could not copy')}}",
    "function inlineMarkdownV2(s){return inlineMarkdown(s).replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/\\*([^*]+)\\*/g,'<em>$1</em>').replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g,'<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>')}",
    "function markdownCells(line){return line.trim().replace(/^\\||\\|$/g,'').split('|').map(cell=>cell.trim())}",
    "function markdownHtmlV2(text){const raw=cleanAgentText(text);if(!raw)return '<p></p>';const lines=raw.split(/\\r?\\n/),fenceMark=String.fromCharCode(96).repeat(3);let html='',para=[],list=[],listTag='',code=null,lang='';const flushPara=()=>{if(para.length){html+='<p>'+inlineMarkdownV2(para.join(' '))+'</p>';para=[]}};const flushList=()=>{if(list.length){html+='<'+listTag+'>'+list.map(item=>'<li>'+inlineMarkdownV2(item)+'</li>').join('')+'</'+listTag+'>';list=[];listTag=''}};for(let i=0;i<lines.length;i++){const line=lines[i],trimmed=line.trim();if(code){if(trimmed===fenceMark){html+='<pre><code'+(lang?' data-language=\"'+escapeHtml(lang)+'\"':'')+'>'+escapeHtml(code.join('\\n'))+'</code></pre>';code=null;lang=''}else code.push(line);continue}if(trimmed.startsWith(fenceMark)){flushPara();flushList();code=[];lang=trimmed.slice(3).trim();continue}if(!trimmed){flushPara();flushList();continue}const heading=trimmed.match(/^(#{1,4})\\s+(.+)$/);if(heading){flushPara();flushList();const level=heading[1].length;html+='<h'+level+'>'+inlineMarkdownV2(heading[2])+'</h'+level+'>';continue}if(i+1<lines.length&&line.includes('|')&&markdownCells(lines[i+1]).every(cell=>/^:?-{3,}:?$/.test(cell))){flushPara();flushList();const rows=[markdownCells(line)];i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){rows.push(markdownCells(lines[i]));i++}i--;html+='<table><thead><tr>'+rows[0].map(cell=>'<th>'+inlineMarkdownV2(cell)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(row=>'<tr>'+row.map(cell=>'<td>'+inlineMarkdownV2(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';continue}if(/^(?:-{3,}|\\*{3,}|_{3,})$/.test(trimmed)){flushPara();flushList();html+='<hr>';continue}const quote=trimmed.match(/^>\\s?(.+)/);if(quote){flushPara();flushList();html+='<blockquote>'+inlineMarkdownV2(quote[1])+'</blockquote>';continue}const bullet=trimmed.match(/^[-*+]\\s+(.+)/),numbered=trimmed.match(/^\\d+[.)]\\s+(.+)/);if(bullet||numbered){flushPara();const tag=numbered?'ol':'ul';if(listTag&&listTag!==tag)flushList();listTag=tag;list.push((bullet||numbered)[1]);continue}flushList();para.push(trimmed)}if(code)html+='<pre><code>'+escapeHtml(code.join('\\n'))+'</code></pre>';flushPara();flushList();return html||'<p></p>'}",
    "function updateMessageNode(node,message){const body=node.querySelector('.message-body');if(body)body.innerHTML=message.role==='assistant'?markdownHtmlV2(message.text):'<p>'+escapeHtml(message.text||'')+'</p>';node.dataset.rawText=message.text||''}",
    "function copyIcon(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"9\" y=\"9\" width=\"11\" height=\"11\" rx=\"2\"></rect><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"></path></svg>'}",
    "function beginEditMessage(message){if(message.role!=='user'||!message.id)return;document.querySelectorAll('.user-edit').forEach(el=>renderActiveChat());const nodes=document.querySelectorAll(`[data-message-id=\"${message.id}\"]`);nodes.forEach(node=>{const body=node.querySelector('.message-body');if(!body)return;body.innerHTML='<textarea class=\"user-edit\" spellcheck=\"true\"></textarea>';const area=body.querySelector('textarea');area.value=message.text||'';area.focus();area.setSelectionRange(area.value.length,area.value.length);area.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();renderActiveChat();return}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitEditedMessage(message.id,area.value)}}})}",
    "async function submitEditedMessage(id,text){const next=String(text||'').trim();if(!next){renderActiveChat();return}const chat=currentChat();const index=chat.messages.findIndex(m=>m.id===id);if(index<0){renderActiveChat();return}chat.messages=chat.messages.slice(0,index);chat.updatedAt=Date.now();const firstUser=chat.messages.find(m=>m.role==='user');chat.title=previewText((firstUser&&firstUser.text)||next).slice(0,44)||'Session';saveChats();renderChatList();renderActiveChat();try{await streamAgent(next)}catch(error){addBubble('assistant',error.message||String(error))}}",
    "const toolTitles={d3_list_files:'Listed D3 files',d3_read_item:'Read D3 item',d3_write_item:'Wrote D3 item',d3_create_item:'Created D3 item',d3_create_file:'Created D3 file',d3_read_dict:'Read D3 dictionary',d3_write_dict:'Wrote D3 dictionary',d3_build_basic_program:'Built BASIC program',d3_compile_basic:'Compiled BASIC',d3_run_basic:'Ran BASIC',d3_catalog:'Cataloged BASIC',d3_sbplus_plan:'Planned SB+ process',d3_sbplus_discover:'Checked SB+ candidates',d3_builder_capabilities:'Listed D3/SB+ capabilities',d3_query_aql:'Ran AQL',d3_tcl:'Ran TCL',d3_login:'Checked account',d3_detect:'Checked D3',d3_operations_status:'Checked D3 operations',d3_locks:'Inspected locks',d3_index_account:'Indexed account',d3_search:'Searched account',d3_manual_search:'Searched manuals',d3_rag_search:'Searched RAG'};",
    "function toolTitle(name,status,detail=''){if(name==='d3_login'&&status==='running')return 'Checking D3 account';if(name==='d3_login'&&status==='blocked')return 'D3 login blocked';if(name==='d3_operations_status'){if(status==='running')return 'Checking D3 operations';if(detail.startsWith('TCL: LIST-JOBS'))return 'Checked background jobs';if(detail.startsWith('TCL: SP-STATUS'))return 'Checked printers';if(detail.startsWith('TCL: LISTPEQS'))return 'Checked print queue'}const action=approvalAction(name);if(status&&status!=='done'&&action!=='Run D3 action')return action;return toolTitles[name]||('D3 tool '+String(name||'').replace(/^d3_/,''))}",
    "function toolPreviewLine(text){const line=String(text||'').split(/\\r?\\n/).map(l=>l.trim()).filter(Boolean)[0]||'';if(!line)return 'Done';return line.length>96?line.slice(0,93)+'…':line}",
    "function toolExpandable(full){const body=String(full||'').trim();if(!body)return false;const lines=body.split(/\\r?\\n/).map(l=>l.trim()).filter(Boolean);if(lines.length>1)return true;return lines[0].length>96}",
    "let activeToolNode=null;",
    "function renderToolNode(div,message){message.createdAt=message.createdAt||Date.now();const full=message.detail||message.text||'';const running=message.status==='running';const status=running?'running':(message.status||'done');const preview=running?(message.reason||'Working...'):toolPreviewLine(full);const expandable=!running&&toolExpandable(full);const expanded=expandable&&message.expanded===true;div.className='tool-event '+(running?'running ':'')+(status==='blocked'?'blocked ':'')+(status==='error'?'error ':'')+(expandable?'collapsible ':'')+(expanded?'expanded':'');div.dataset.rawText=full;div.dataset.toolName=message.name;const statusLabel=(status==='done'||status==='success')?'':status;div.innerHTML='<button type=\"button\" class=\"tool-event-head\"'+(expandable?' aria-expanded=\"'+(expanded?'true':'false')+'\"':'')+'><span class=\"tool-name\">'+escapeHtml(toolTitle(message.name,status,full))+'</span><span class=\"tool-preview\">'+escapeHtml(preview)+'</span><span class=\"tool-meta\">'+(statusLabel?'<span class=\"tool-status\">'+escapeHtml(statusLabel)+'</span>':'')+(expandable?'<span class=\"tool-chevron\" aria-hidden=\"true\">›</span>':'')+'</span></button>'+(expandable?'<div class=\"chat-tool-detail\">'+escapeHtml(full)+'</div>':'');const head=div.querySelector('.tool-event-head');if(head&&expandable)head.onclick=()=>{const open=div.classList.toggle('expanded');message.expanded=open;head.setAttribute('aria-expanded',open?'true':'false');syncToolMessage(message)}}",
    "function syncToolMessage(message,chatId){ensureMessageId(message);const chat=chatById(chatId||agentRunChatId||activeChatId);if(!chat)return;const index=chat.messages.findIndex(m=>m.id===message.id);if(index>=0)chat.messages[index]={...chat.messages[index],...message};else chat.messages.push(message);chat.updatedAt=Date.now();chatSessions=[chat,...chatSessions.filter(c=>c.id!==chat.id)];saveChats();renderChatList()}",
    "function messageNode(message){message.createdAt=message.createdAt||Date.now();const div=document.createElement('div');if(message.id)div.dataset.messageId=message.id;if(message.kind==='approval'){renderApprovalNode(div,message);return div}if(message.kind==='tool'){renderToolNode(div,message);return div}div.className='chat-bubble '+(message.role||'assistant');div.innerHTML='<div class=\"message-head\"><div class=\"message-meta\">'+escapeHtml(message.role==='user'?'You':'D3 Code')+' · '+escapeHtml(formatTime(message.createdAt))+'</div></div><div class=\"message-body\"></div>'+(message.role==='assistant'?'<div class=\"message-actions\"><button class=\"copy-message\" type=\"button\" title=\"Copy response\" aria-label=\"Copy response\">'+copyIcon()+'</button></div>':'');const copy=div.querySelector('.copy-message');if(copy)copy.onclick=()=>copyText(div.dataset.rawText);updateMessageNode(div,message);return div}",
    "function chatOutputs(){return ['chatOutput','agentOutput','terminalAgentOutput'].map(id=>$(id)).filter(Boolean)}",
    "function activeOutput(){if(document.body.dataset.view==='chat')return $('chatOutput');if(document.body.dataset.view==='terminal')return $('terminalAgentOutput');return $('agentOutput')}",
    "function runStatusNodes(){return ['runStatus','agentRunStatus','terminalRunStatus'].map(id=>$(id)).filter(Boolean)}",
    "function activityNodes(){return ['chatActivity','agentActivity','terminalAgentActivity'].map(id=>$(id)).filter(Boolean)}",
    "function setRunStatus(){}",
    "function setActivityText(){}",
    "function scrollChatOutputs(){chatOutputs().forEach(out=>{out.scrollTop=out.scrollHeight})}",
    "function removeTypingRows(){if(agentRunChatId&&agentRunChatId!==activeChatId)return;document.querySelectorAll('[data-typing=\"1\"]').forEach(node=>node.remove())}",
    "function showTypingRows(label){if(agentRunChatId&&agentRunChatId!==activeChatId)return;removeTypingRows();const text=label||'Working...';chatOutputs().forEach(out=>{const row=document.createElement('div');row.className='typing-row';row.dataset.typing='1';row.innerHTML='<span class=\"typing-dots\" aria-hidden=\"true\"><span></span><span></span><span></span></span><span>'+escapeHtml(text)+'</span>';out.appendChild(row)});scrollChatOutputs()}",
    "function clearStreamingBubbles(){if(agentRunChatId&&agentRunChatId!==activeChatId)return;document.querySelectorAll('[data-streaming=\"1\"]').forEach(node=>node.remove())}",
    "function ensureStreamingBubble(){if(!isAgentChatLive())return null;clearStreamingBubbles();chatOutputs().forEach(out=>{const div=messageNode({kind:'bubble',role:'assistant',text:'',createdAt:Date.now()});div.classList.add('streaming');div.dataset.streaming='1';out.appendChild(div)});scrollChatOutputs();return document.querySelector('[data-streaming=\"1\"]')}",
    "function pulseStreamingBody(body,nextLen){if(!body||nextLen<=Number(body.dataset.streamLen||0))return;body.dataset.streamLen=String(nextLen);body.classList.remove('stream-pulse');void body.offsetWidth;body.classList.add('stream-pulse')}",
    "function updateStreamingBubbles(text){if(!isAgentChatLive())return;const next=String(text||'');document.querySelectorAll('[data-streaming=\"1\"]').forEach(node=>{const body=node.querySelector('.message-body');updateMessageNode(node,{role:'assistant',text:next});node.classList.add('streaming');pulseStreamingBody(body,next.length)});scrollChatOutputs()}",
    "function finalizeStreamingBubbles(text){const finalText=cleanAgentText(text||'');if(isAgentChatLive())document.querySelectorAll('[data-streaming=\"1\"]').forEach(node=>{const body=node.querySelector('.message-body');if(body){body.classList.remove('stream-pulse');body.removeAttribute('data-stream-len')}node.classList.remove('streaming');updateMessageNode(node,{role:'assistant',text:finalText});node.dataset.rawText=finalText});return finalText}",
    "function appendMessage(message,{record=true,chatId}={}){const targetId=chatId||agentRunChatId||activeChatId;if(record)recordChatMessage(message,targetId);if(targetId!==activeChatId)return null;let first=null;chatOutputs().forEach(out=>{const div=messageNode(message);out.appendChild(div);if(!first)first=div});scrollChatOutputs();return first}",
    "function addBubble(role,text){return appendMessage({kind:'bubble',role,text})}",
    "function addToolEvent(t,{record=true}={}){const full=t.result||t.compact||t.reason||'running';const message={kind:'tool',role:'tool',name:t.name||'d3_tool',status:t.status||'done',text:toolPreviewLine(full),detail:full,reason:t.reason,expanded:t.expanded===true||((t.expanded!==false)&&(t.status==='blocked'||t.status==='error'))};$('chatLastTool').textContent=toolTitle(message.name,message.status)+': '+previewText(full);const runId=agentRunChatId||activeChatId;if(message.status==='running'){ensureMessageId(message);if(isAgentChatLive())activeToolNode=appendMessage(message,{record:false,chatId:runId});else recordChatMessage(message,runId);return activeToolNode}ensureMessageId(message);if(activeToolNode&&isAgentChatLive()){message.id=message.id||activeToolNode.dataset.messageId||'';renderToolNode(activeToolNode,message);syncToolMessage(message);activeToolNode=null;return activeToolNode}const chat=chatById(runId);const runningMsg=chat?.messages?.slice().reverse().find(m=>m.kind==='tool'&&m.status==='running');if(runningMsg)message.id=runningMsg.id;syncToolMessage(message);if(runId===activeChatId){const node=document.querySelector(`[data-message-id=\"${message.id}\"]`);if(node)renderToolNode(node,message);else appendMessage(message,{record:false,chatId:runId})}return null}",
    "const slashCommands=[{name:'/help',desc:'show browser IDE commands'},{name:'/stop',desc:'stop the active agent run'},{name:'/harness-context',desc:'show refreshed memory, skills, and project context'},{name:'/terminal',desc:'switch main area to the D3 terminal'},{name:'/editor',desc:'switch main area to item/BASIC editor'},{name:'/chat',desc:'switch back to current chat'},{name:'/files',desc:'list D3 files in the active account'},{name:'/locks',desc:'inspect active D3 locks'},{name:'/index',desc:'index the active D3 account'},{name:'/tcl',desc:'run a TCL/D3 command: /tcl WHO'},{name:'/aql',desc:'run an AQL query: /aql LIST MD'},{name:'/read',desc:'read item: /read FILE ITEM'},{name:'/dict',desc:'read dictionary item: /dict FILE ITEM'},{name:'/manual-search',desc:'search Rocket D3 manuals'},{name:'/new',desc:'start a new chat session'},{name:'/clear',desc:'clear this chat'}];",
    "let slashActive=0;",
    "let composerAttachments=[];",
    "function closeActionPopover(){const box=$('actionPopover');if(box)box.classList.remove('open')}",
    "function toggleActionPopover(){closeSlashPalette();const box=$('actionPopover');if(box)box.classList.toggle('open')}",
    "function fileLabel(file){return file.name+' · '+Math.max(1,Math.round(file.size/1024))+' KB'}",
    "function readAttachment(file,kind){return new Promise(resolve=>{const base={name:file.name,type:file.type||'unknown',size:file.size,kind,text:''};if(kind==='photo'||file.size>200000||!/^text\\//.test(file.type||'')){resolve(base);return}const reader=new FileReader();reader.onload=()=>resolve({...base,text:String(reader.result||'').slice(0,12000)});reader.onerror=()=>resolve(base);reader.readAsText(file)})}",
    "function renderAttachments(){const tray=$('attachmentTray');if(!tray)return;tray.innerHTML=composerAttachments.map((file,i)=>`<span class=\"attachment-chip\"><span>${escapeHtml(file.kind==='photo'?'Photo':'File')}: ${escapeHtml(fileLabel(file))}</span><button type=\"button\" data-remove-attachment=\"${i}\" aria-label=\"Remove attachment\">x</button></span>`).join('');document.querySelectorAll('[data-remove-attachment]').forEach(btn=>btn.onclick=()=>{composerAttachments.splice(Number(btn.dataset.removeAttachment),1);renderAttachments()})}",
    "async function addFiles(files,kind){const next=await Promise.all([...files].map(file=>readAttachment(file,kind)));composerAttachments.push(...next);renderAttachments();toast(next.length+' attached')}",
    "function attachmentPromptPrefix(){if(!composerAttachments.length)return '';return 'Attached context:\\n'+composerAttachments.map(file=>'- '+file.kind+': '+file.name+' ('+(file.type||'unknown')+', '+file.size+' bytes)'+(file.text?'\\n```\\n'+file.text+'\\n```':'')).join('\\n')+'\\n\\n'}",
    "function clearAttachments(){composerAttachments=[];renderAttachments();$('fileUpload').value='';$('photoUpload').value=''}",
    "function slashMatches(){const value=$('chatPrompt')?.value.trimStart()||'';if(!value.startsWith('/'))return[];const query=value.split(/\\s+/,1)[0].toLowerCase();return slashCommands.filter(c=>c.name.startsWith(query)).slice(0,8)}",
    "function renderSlashPalette(){const box=$('slashPalette');if(!box)return;const matches=slashMatches();if(!matches.length){box.classList.remove('open');box.innerHTML='';return}slashActive=Math.max(0,Math.min(slashActive,matches.length-1));box.innerHTML=matches.map((c,i)=>`<button type=\"button\" class=\"slash-option ${i===slashActive?'active':''}\" data-slash-index=\"${i}\"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.desc)}</span></button>`).join('');box.classList.add('open');document.querySelectorAll('[data-slash-index]').forEach(btn=>btn.onclick=()=>acceptSlash(Number(btn.dataset.slashIndex)))}",
    "function closeSlashPalette(){const box=$('slashPalette');if(box){box.classList.remove('open');box.innerHTML=''}}",
    "function acceptSlash(index=slashActive){const matches=slashMatches();const command=matches[index];if(!command)return;const input=$('chatPrompt');input.value=command.name+' ';input.focus();input.setSelectionRange(input.value.length,input.value.length);closeSlashPalette()}",
    "function compactApiResult(value){if(value==null)return '';if(typeof value==='string')return value;if(value?.result)return terminalText(value.result);if(value?.output)return terminalText(value.output);if(value?.clean)return terminalText(value.clean);if(value?.error)return 'error: '+terminalText(value.error);return terminalText(value)}",
    "async function runSlash(input){const [command,...parts]=input.trim().split(/\\s+/);const rest=parts.join(' ');if(command!=='/help'&&command!=='/chat'&&command!=='/terminal'&&command!=='/editor'&&command!=='/harness-context'&&!requireActiveChat()){addBubble('user',input);addBubble('assistant','Add and select a D3 profile in Sessions first.');return}addBubble('user',input);if(command==='/help'){addBubble('assistant','Browser commands:\\n'+slashCommands.map(c=>'- `'+c.name+'` - '+c.desc).join('\\n'));return}if(command==='/stop'){await cancelAgentRun(activeChatId);return}if(command==='/harness-context'){const value=await api('/api/harness-context?request='+encodeURIComponent(rest||'inspect D3 harness context'));addBubble('assistant',value.text||JSON.stringify(value,null,2));return}if(command==='/terminal'){setView('terminal');addBubble('assistant','Opened the D3 terminal.');return}if(command==='/editor'){setView('editor');addBubble('assistant','Opened the editor.');return}if(command==='/chat'){setView('chat');return}if(command==='/new'){await newChat();return}if(command==='/clear'){const chat=requireActiveChat();if(chat){chat.messages=[];saveChats();renderChatList();renderActiveChat();syncChatEmptyLayout()}return}if(command==='/files'){addToolEvent({name:'D3 files',status:'done',result:compactApiResult(await api('/api/files'))});return}if(command==='/locks'){addToolEvent({name:'D3 locks',status:'done',result:compactApiResult(await api('/api/locks'))});return}if(command==='/index'){addToolEvent({name:'D3 account index',status:'done',result:compactApiResult(await api('/api/index',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))});return}if(command==='/tcl'){if(!rest){addBubble('assistant','Usage: `/tcl WHO` or `/tcl LIST MD`');return}setView('terminal');await sendTerminalCommand(rest);return}if(command==='/aql'){if(!rest){addBubble('assistant','Usage: `/aql LIST CUSTOMERS NAME`');return}addToolEvent({name:'D3 AQL',status:'done',result:compactApiResult(await api('/api/aql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:rest})}))});return}if(command==='/manual-search'){if(!rest){addBubble('assistant','Usage: `/manual-search dictionary`');return}addToolEvent({name:'Manual search',status:'done',result:compactApiResult(await api('/api/manual-search?query='+encodeURIComponent(rest)))});return}if(command==='/read'||command==='/dict'){const [file,item]=parts;if(!file||!item){addBubble('assistant','Usage: `'+command+' <file> <item>`');return}const path=(command==='/read'?'/api/item?':'/api/dict?')+new URLSearchParams({file,item});addToolEvent({name:command==='/read'?'Read item':'Read dict',status:'done',result:compactApiResult(await api(path))});return}addBubble('assistant','Unknown command. Press `/` to pick a command.');}",
    "function closeChatContextMenu(){const menu=$('chatContextMenu');if(menu){menu.classList.remove('open');menu.setAttribute('aria-hidden','true')}chatContextTargetId=''}",
    "function closeProfileContextMenu(){const menu=$('profileContextMenu');if(menu){menu.classList.remove('open');menu.setAttribute('aria-hidden','true')}profileContextTarget=''}",
    "function closeSessionContextMenus(){closeChatContextMenu();closeProfileContextMenu()}",
    "function placeContextMenu(menu,x,y){if(!menu)return;requestAnimationFrame(()=>{const left=Math.max(8,Math.min(x,window.innerWidth-menu.offsetWidth-8));const top=Math.max(8,Math.min(y,window.innerHeight-menu.offsetHeight-8));menu.style.left=left+'px';menu.style.top=top+'px'})}",
    "function openChatContextMenu(chatId,x,y){closeSessionContextMenus();chatContextTargetId=chatId||'';const menu=$('chatContextMenu');if(!menu||!chatContextTargetId)return;menu.classList.add('open');menu.setAttribute('aria-hidden','false');placeContextMenu(menu,x,y)}",
    "function openProfileContextMenu(profileName,x,y){closeSessionContextMenus();profileContextTarget=profileName||'';const menu=$('profileContextMenu');if(!menu||!profileContextTarget)return;menu.classList.add('open');menu.setAttribute('aria-hidden','false');placeContextMenu(menu,x,y)}",
    "async function resetAgentThread(chatId){try{await api('/api/agent/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId||activeChatId})})}catch{}}",
    "async function cancelAgentRun(chatId){const id=chatId||activeChatId;if(!id)return;try{const result=await api('/api/agent/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:id})});if(result.cancelled)toast('Stopping agent');else toast('No active run')}catch(error){toast(error.message||String(error))}}",
    "async function deleteChat(chatId){const id=chatId||chatContextTargetId;if(!id)return;const index=chatSessions.findIndex(c=>c.id===id);if(index<0)return;const wasActive=activeChatId===id;const profile=chatSessions[index]?.profile||'';chatSessions=chatSessions.filter(c=>c.id!==id);if(wasActive){const next=chatsForProfile(profile)[0];activeChatId=next?next.id:''}closeChatContextMenu();saveChats();renderChatList();await resetAgentThread(id);if(wasActive)renderActiveChat();toast('Chat deleted')}",
    "function profileChevron(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\"/></svg>'}",
    "function iconPlusSvg(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>'}",
    "function iconChatBubbleSvg(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z\"/></svg>'}",
    "function iconDotsSvg(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"5\" cy=\"12\" r=\"1.8\"/><circle cx=\"12\" cy=\"12\" r=\"1.8\"/><circle cx=\"19\" cy=\"12\" r=\"1.8\"/></svg>'}",
    "function iconSpinnerSvg(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"42\" stroke-dashoffset=\"12\"/></svg>'}",
    "function iconOnlineSvg(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"currentColor\"/></svg>'}",
    "function iconConnectionIssueSvg(){return '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v6M12 17h.01\"/></svg>'}",
    "let profileOnlineStatus={};",
    "let profileConnectionDetails={};",
    "let profileOnlineTimer=null;",
    "function profileOnlineHtml(name){const detail=profileConnectionDetails[name];if(profileOnlineStatus[name])return '<span class=\"session-profile-online\" title=\"D3 account online\" aria-label=\"D3 account online\">'+iconOnlineSvg()+'</span>';if(detail?.issue)return '<span class=\"session-profile-issue\" title=\"'+escapeHtml(detail.issue.replace(/\\s+/g,' ').trim())+'\" aria-label=\"D3 connection issue\">'+iconConnectionIssueSvg()+'</span>';return ''}",
    "function connectionIssueSummary(issue){const lines=String(issue||'').split(/\\r?\\n/).map(line=>line.trim()).filter(Boolean);return {title:lines[0]||'D3 connection unavailable.',detail:lines.slice(1).join(' ')}}",
    "function syncProfileConnectionHeight(){const banner=$('profileConnectionBanner');document.documentElement.style.setProperty('--profile-connection-h',banner&&!banner.hidden?banner.offsetHeight+'px':'0px')}",
    "function renderProfileConnectionBanner(){const banner=$('profileConnectionBanner');if(!banner)return;const status=profileConnectionDetails[selectedProfile];if(!selectedProfile||!status||status.online||!status.issue){banner.hidden=true;banner.innerHTML='';document.body.classList.remove('profile-connection-active');syncProfileConnectionHeight();return}const issue=connectionIssueSummary(status.issue);banner.innerHTML='<span class=\"profile-connection-icon\">'+iconConnectionIssueSvg()+'</span><span class=\"profile-connection-copy\"><strong>'+escapeHtml(selectedProfile)+': '+escapeHtml(issue.title)+'</strong><span>'+escapeHtml(issue.detail)+'</span></span><button type=\"button\" class=\"profile-connection-retry\">Retry</button>';banner.hidden=false;document.body.classList.add('profile-connection-active');syncProfileConnectionHeight();banner.querySelector('.profile-connection-retry').onclick=()=>refreshProfileOnlineStatus()}",
    "async function refreshProfileOnlineStatus(){const banner=$('profileConnectionBanner');const retry=banner?.querySelector('.profile-connection-retry');if(retry){retry.disabled=true;retry.textContent='Checking…'}let payload;try{payload=await api('/api/profiles/online')}catch{return}const next=payload.profiles||{};const details=payload.details||{};const changed=JSON.stringify(profileOnlineStatus)!==JSON.stringify(next)||JSON.stringify(profileConnectionDetails)!==JSON.stringify(details);profileOnlineStatus=next;profileConnectionDetails=details;renderProfileConnectionBanner();if(changed){renderChatList();renderD3Browser()}}",
    "function startProfileOnlinePolling(){if(profileOnlineTimer)clearInterval(profileOnlineTimer);profileOnlineTimer=setInterval(()=>{refreshProfileOnlineStatus().catch(()=>{})},30000)}",
    "function pythonRuntimeLabel(){if(!pythonRuntime)return'';if(pythonRuntime.runtime==='node-only')return'Node tools';if(!pythonRuntime.available)return'FastAPI offline';const routing=pythonRuntime.routing||{};if(routing.d3pyAvailable||routing.uopyAvailable)return'FastAPI D3PY/UOPY spike';return'FastAPI D3PY blocked'}",
    "async function refreshPythonRuntime(){try{pythonRuntime=await api('/api/python-runtime')}catch{pythonRuntime=null}}",
    "function profileMetaLine(p){const bits=[p.type||'local'];if(p.account)bits.push(p.account);if(p.host)bits.push(p.host);if(p.sessionMode==='persistent')bits.push(p.promptPattern?'PTY ready':'PTY partial');else bits.push('one-shot');const py=pythonRuntimeLabel();if(py)bits.push(py);return bits.join(' · ')}",
    "function loadD3BrowserCollapse(){try{const saved=JSON.parse(localStorage.getItem(D3_BROWSER_COLLAPSE_STORE)||'{}');d3BrowserCollapse=saved&&typeof saved==='object'?saved:{}}catch{d3BrowserCollapse={}}}",
    "function saveD3BrowserCollapse(){try{localStorage.setItem(D3_BROWSER_COLLAPSE_STORE,JSON.stringify(d3BrowserCollapse))}catch{}}",
    "function d3CategoryKey(profile,categoryId){return profile+'::'+categoryId}",
    "function d3CategoryCollapsed(profile,categoryId){return d3BrowserCollapse[d3CategoryKey(profile,categoryId)]===true}",
    "function toggleD3CategoryCollapsed(profile,categoryId){const key=d3CategoryKey(profile,categoryId);d3BrowserCollapse[key]=!d3CategoryCollapsed(profile,categoryId);saveD3BrowserCollapse();renderD3Browser()}",
    "function d3KindLabel(kind){if(kind==='program')return 'prog';if(kind==='screen')return 'scr';if(kind==='system'||kind==='dictionary')return 'sys';if(kind==='data')return 'data';return 'file'}",
    "function renderD3BrowserHtml(){loadD3BrowserCollapse();if(!profileCache.length)return '<div class=\"sessions-empty\">Add a D3 profile in Sessions first.</div>';return profileCache.map(p=>{const name=p.name;const collapsed=profileCollapsed(name);const profileActive=name===selectedProfile;const browser=d3BrowserCache[name]||{};const account=browser.account||p.account||'';const who=browser.who||'';const categories=browser.categories||[];const loading=profileActive&&browser.loading;const error=browser.error;return `<section class=\"session-profile d3-browser-profile ${collapsed?'collapsed':''} ${profileActive?'active':''}\" data-profile-name=\"${escapeHtml(name)}\"><div class=\"session-profile-head\"><div class=\"session-profile-row\"><button type=\"button\" class=\"session-profile-toggle\" data-profile-toggle=\"${escapeHtml(name)}\" aria-expanded=\"${collapsed?'false':'true'}\" aria-label=\"${collapsed?'Expand':'Collapse'} account for ${escapeHtml(name)}\">${profileChevron()}</button><button type=\"button\" class=\"session-profile-select\" data-profile-select=\"${escapeHtml(name)}\">${escapeHtml(name)}</button>${profileOnlineHtml(name)}</div><div class=\"session-profile-meta\">${escapeHtml(profileMetaLine(p))}</div></div><div class=\"d3-browser-body\">${profileActive?`<div class=\"d3-account-row\"><div class=\"d3-account-label\">Account ${escapeHtml(account||'unknown')}</div>${who?`<div class=\"d3-account-who\">${escapeHtml(who)}</div>`:''}</div><div class=\"d3-logto-row\"><input id=\"account\" aria-label=\"D3 account\" placeholder=\"LOGTO account, e.g. SALES\" value=\"${escapeHtml(account)}\" /><button id=\"loginAccount\" type=\"button\">Switch</button></div>`:''}${loading?'<div class=\"sessions-empty\">Loading D3 files…</div>':''}${error?`<div class=\"d3-browser-error\"><strong>Connection failed</strong><span>${escapeHtml(error)}</span><button type=\"button\" data-review-profile=\"${escapeHtml(name)}\">Review connection</button></div>`:''}${categories.map(cat=>{const catCollapsed=d3CategoryCollapsed(name,cat.id);return `<section class=\"d3-category ${catCollapsed?'collapsed':''}\"><button type=\"button\" class=\"d3-category-head\" data-category-toggle=\"${escapeHtml(name)}::${escapeHtml(cat.id)}\"><span class=\"d3-category-toggle\">${profileChevron()}</span><span>${escapeHtml(cat.label)}</span><span class=\"d3-category-count\">${cat.files.length}</span></button><div class=\"d3-files\">${cat.files.map(file=>`<button type=\"button\" class=\"d3-file-item ${selectedD3File===file.name?'active':''}\" data-d3-file=\"${escapeHtml(file.name)}\" data-d3-kind=\"${escapeHtml(file.kind)}\"><span>${escapeHtml(file.name)}</span><span class=\"d3-file-kind\">${escapeHtml(d3KindLabel(file.kind))}</span></button>`).join('')}</div></section>`}).join('')}${profileActive&&!loading&&!error&&!categories.length?'<div class=\"sessions-empty\">No files listed yet. Refresh or check the D3 connection.</div>':''}</div></section>`}).join('')}",
    "function bindD3Browser(){const root=$('d3Browser');if(!root)return;root.querySelectorAll('[data-profile-toggle]').forEach(btn=>btn.onclick=event=>{event.stopPropagation();toggleProfileCollapsed(btn.dataset.profileToggle||'');renderD3Browser()});root.querySelectorAll('[data-profile-select]').forEach(btn=>btn.onclick=async()=>{await switchProfile(btn.dataset.profileSelect||'');await refreshD3Browser()});root.querySelectorAll('[data-review-profile]').forEach(btn=>btn.onclick=()=>{const profile=profileCache.find(p=>p.name===btn.dataset.reviewProfile);if(profile)openProfileForm(profile)});root.querySelectorAll('[data-category-toggle]').forEach(btn=>btn.onclick=event=>{event.stopPropagation();const [profile,categoryId]=(btn.dataset.categoryToggle||'').split('::');if(profile&&categoryId)toggleD3CategoryCollapsed(profile,categoryId)});root.querySelectorAll('[data-d3-file]').forEach(btn=>btn.onclick=()=>openD3File(btn.dataset.d3File||'',btn.dataset.d3Kind||''));const login=$('loginAccount');if(login)login.onclick=async()=>{show('editorScreen',await api('/api/account/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account:$('account').value,confirmed:mutationConfirmed()})}));d3BrowserCache={};await boot();await refreshD3Browser()}}",
    "function renderD3Browser(){const node=$('d3Browser');if(!node)return;node.innerHTML=renderD3BrowserHtml();bindD3Browser()}",
    "function formatBrowserError(text){const line=String(text||'').split(/\\r?\\n/).map(l=>l.trim()).filter(Boolean)[0]||'Could not load D3 files.';return line.length>120?line.slice(0,117)+'…':line}",
    "async function refreshD3Browser(forceProfile){renderD3Browser();const targets=forceProfile?[forceProfile]:selectedProfile?[selectedProfile]:[];for(const profileName of targets){if(!profileName)continue;d3BrowserCache[profileName]={...(d3BrowserCache[profileName]||{}),loading:true,error:''};renderD3Browser();try{const data=await api('/api/browser?profile='+encodeURIComponent(profileName));if(data.error){const issue=formatBrowserError(data.error);d3BrowserCache[profileName]={error:issue};profileOnlineStatus[profileName]=false;profileConnectionDetails[profileName]={online:false,issue};renderProfileConnectionBanner();renderChatList()}else d3BrowserCache[profileName]={account:data.account,who:data.who,categories:data.categories||[],loading:false}}catch(error){const issue=formatBrowserError(error?.message||String(error));d3BrowserCache[profileName]={error:issue};profileOnlineStatus[profileName]=false;profileConnectionDetails[profileName]={online:false,issue};renderProfileConnectionBanner();renderChatList()}}renderD3Browser()}",
    "function renderSessionsTreeHtml(){const knownProfiles=new Set(profileCache.map(p=>p.name));const orphanChats=chatSessions.filter(c=>!knownProfiles.has(c.profile||''));const orphanHtml=orphanChats.length?'<section class=\"session-profile\"><div class=\"session-profile-head\"><div class=\"session-profile-row\"><span class=\"session-profile-select\">Other threads</span></div></div><div class=\"session-chats\">'+orphanChats.map(c=>'<button type=\"button\" class=\"session-chat-item '+(c.id===activeChatId?'active':'')+'\" data-chat-id=\"'+escapeHtml(c.id)+'\"><span class=\"session-chat-icon\" aria-hidden=\"true\">'+iconChatBubbleSvg()+'</span><span class=\"session-chat-label\">'+escapeHtml(c.title||'New chat')+'</span></button>').join('')+'</div></section>':'';if(!profileCache.length)return orphanHtml||'<div class=\"sessions-empty\">Add a D3 profile to start chatting.</div>';return orphanHtml+profileCache.map((p,i)=>{const name=p.name;const collapsed=profileCollapsed(name);const chats=chatsForProfile(name);const profileActive=name===selectedProfile;return `<section class=\"session-profile ${collapsed?'collapsed':''} ${profileActive?'active':''}\" data-profile-name=\"${escapeHtml(name)}\"><div class=\"session-profile-head\"><div class=\"session-profile-row\"><button type=\"button\" class=\"session-profile-toggle\" data-profile-toggle=\"${escapeHtml(name)}\" aria-expanded=\"${collapsed?'false':'true'}\" aria-label=\"${collapsed?'Expand':'Collapse'} chats for ${escapeHtml(name)}\">${profileChevron()}</button><button type=\"button\" class=\"session-profile-select\" data-profile-select=\"${escapeHtml(name)}\">${escapeHtml(name)}</button>${profileOnlineHtml(name)}<button type=\"button\" class=\"session-profile-menu icon-button\" data-profile-menu=\"${escapeHtml(name)}\" title=\"Profile options\" aria-label=\"Options for ${escapeHtml(name)}\">${iconDotsSvg()}</button><button type=\"button\" class=\"session-profile-new-chat icon-button\" data-profile-new-chat=\"${escapeHtml(name)}\" title=\"New chat\" aria-label=\"New chat for ${escapeHtml(name)}\">${iconPlusSvg()}</button></div><div class=\"session-profile-meta\">${escapeHtml(profileMetaLine(p))}</div></div><div class=\"session-chats\">${chats.map(c=>{const chatActive=c.id===activeChatId;const chatBusy=busyChatIds.has(c.id);return `<button type=\"button\" class=\"session-chat-item ${chatActive?'active':''} ${chatBusy?'is-busy':''}\" data-chat-id=\"${escapeHtml(c.id)}\"><span class=\"session-chat-icon\" aria-hidden=\"true\">${iconChatBubbleSvg()}</span><span class=\"session-chat-label\">${escapeHtml(c.title||'New chat')}</span>${chatActive?'<span class=\"session-chat-selected\">Selected</span>':''}${chatBusy?'<span class=\"session-chat-busy\" aria-label=\"Working\">'+iconSpinnerSvg()+'</span>':''}</button>`}).join('')}</div></section>`}).join('')}",
    "function bindSessionsTree(root){const scope=root||document;scope.querySelectorAll('.session-chat-item[data-chat-id]').forEach(btn=>{btn.onclick=async()=>{closeSessionContextMenus();const chatId=btn.dataset.chatId||'';if(chatId===activeChatId){closeSessionsPanel();focusChatPrompt();return}if(!confirmLeaveCurrentChat())return;const chat=chatSessions.find(c=>c.id===chatId);if(chat?.profile&&chat.profile!==selectedProfile){await switchProfile(chat.profile);activeChatId=chatId;renderChatList();renderActiveChat();closeSessionsPanel();focusChatPrompt();return}activeChatId=chatId;renderChatList();renderActiveChat();closeSessionsPanel();focusChatPrompt()};btn.oncontextmenu=e=>{e.preventDefault();openChatContextMenu(btn.dataset.chatId,e.clientX,e.clientY)}});scope.querySelectorAll('[data-profile-toggle]').forEach(btn=>btn.onclick=event=>{event.stopPropagation();toggleProfileCollapsed(btn.dataset.profileToggle||'')});scope.querySelectorAll('[data-profile-select]').forEach(btn=>btn.onclick=async()=>{closeSessionContextMenus();await switchProfile(btn.dataset.profileSelect||'')});scope.querySelectorAll('[data-profile-new-chat]').forEach(btn=>btn.onclick=async event=>{event.stopPropagation();closeSessionContextMenus();await newChatForProfile(btn.dataset.profileNewChat||'')});scope.querySelectorAll('[data-profile-menu]').forEach(btn=>btn.onclick=event=>{event.stopPropagation();closeSessionContextMenus();const rect=btn.getBoundingClientRect();openProfileContextMenu(btn.dataset.profileMenu||'',rect.right,rect.bottom)})}",
    "function renderChatList(){const html=renderSessionsTreeHtml();if($('chatList'))$('chatList').innerHTML=html;document.querySelectorAll('.session-chat-list').forEach(list=>{list.innerHTML=html});bindSessionsTree();document.querySelectorAll('.session-chat-list').forEach(list=>bindSessionsTree(list))}",
    "const SESSIONS_OPEN_STORE='d3code.ide.sessionsOpen';",
    "const SESSIONS_HOVER_ZONE=0.7;",
    "function activeRightWorkbench(){const view=document.body.dataset.view;return view==='terminal'?document.querySelector('#terminalView .right-workbench'):view==='editor'?document.querySelector('#editorView .right-workbench'):null}",
    "function setSessionsOpen(open,{persist=true}={}){const workbench=activeRightWorkbench();document.querySelectorAll('.right-workbench').forEach(node=>node.classList.remove('sessions-open','sessions-peek'));document.querySelectorAll('.sessions-drawer').forEach(drawer=>{drawer.classList.remove('peek');drawer.setAttribute('aria-hidden','true')});if(!workbench||!open){if(persist){try{localStorage.setItem(SESSIONS_OPEN_STORE,'0')}catch{}}return}workbench.classList.add('sessions-open');const drawer=workbench.querySelector('.sessions-drawer');if(drawer)drawer.setAttribute('aria-hidden','false');if(persist){try{localStorage.setItem(SESSIONS_OPEN_STORE,'1')}catch{}}}",
    "function peekSessions(open){const workbench=activeRightWorkbench();if(!workbench||workbench.classList.contains('sessions-open'))return;const drawer=workbench.querySelector('.sessions-drawer');if(!drawer)return;if(open){workbench.classList.add('sessions-peek');drawer.classList.add('peek')}else{workbench.classList.remove('sessions-peek');drawer.classList.remove('peek')}}",
    "function pointerInWorkbench(workbench,clientX,clientY){if(!workbench)return false;const rect=workbench.getBoundingClientRect();return clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom}",
    "function sessionsHoverHot(workbench,clientX,clientY){if(!pointerInWorkbench(workbench,clientX,clientY))return false;const rect=workbench.getBoundingClientRect();return clientX>=rect.left+rect.width*SESSIONS_HOVER_ZONE}",
    "let hoverPeekTimer=null;let hoverOpenTimer=null;let hoverZoneActive=false;let sessionsHoverSuppress=false;let lastPointer={x:0,y:0};function clearSessionsHoverTimers(){clearTimeout(hoverPeekTimer);clearTimeout(hoverOpenTimer);hoverPeekTimer=null;hoverOpenTimer=null}function closeSessionsPanel(){hoverZoneActive=false;sessionsHoverSuppress=true;clearSessionsHoverTimers();peekSessions(false);setSessionsOpen(false)}function activeMobilePanel(){return document.body.dataset.view==='editor'?document.querySelector('.editor-sidebar'):document.querySelector('.chat-sidebar')}function setMobilePanelOpen(open){document.querySelectorAll('.chat-sidebar,.editor-sidebar').forEach(panel=>panel.classList.remove('open'));const panel=activeMobilePanel();if(open&&panel)panel.classList.add('open');$('mobilePanelBackdrop')?.classList.toggle('open',Boolean(open&&panel));$('mobilePanelBackdrop')?.setAttribute('aria-hidden',open&&panel?'false':'true');$('mobilePanelButton')?.setAttribute('aria-expanded',open&&panel?'true':'false')}function closeMobilePanel(){setMobilePanelOpen(false)}function toggleMobilePanel(){setMobilePanelOpen(!activeMobilePanel()?.classList.contains('open'))}function openSettingsModal(){const modal=$('settingsModal');if(!modal)return;modal.classList.add('open');const choice=document.body.dataset.themeChoice||'light';document.querySelectorAll('.theme-choice').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeChoice===choice));requestAnimationFrame(()=>$('closeSettings')?.focus())}function closeSettingsModal(){const modal=$('settingsModal');if(modal)modal.classList.remove('open')}function initSessionsFooter(){document.querySelectorAll('.sessions-add-profile').forEach(btn=>btn.onclick=()=>openProfileForm(undefined));document.querySelectorAll('.sessions-settings').forEach(btn=>btn.onclick=()=>openSettingsModal())}function initSessionsDrawer(){document.querySelectorAll('.sessions-close').forEach(btn=>btn.onclick=()=>closeSessionsPanel());document.querySelectorAll('.sessions-backdrop').forEach(backdrop=>{backdrop.onclick=event=>{event.preventDefault();event.stopPropagation();closeSessionsPanel()};backdrop.onmousedown=event=>{event.preventDefault();event.stopPropagation()}});document.addEventListener('mousemove',event=>{lastPointer={x:event.clientX,y:event.clientY};const workbench=activeRightWorkbench();if(!workbench){clearSessionsHoverTimers();hoverZoneActive=false;return}const inside=pointerInWorkbench(workbench,event.clientX,event.clientY);const pinned=workbench.classList.contains('sessions-open');const peeking=workbench.classList.contains('sessions-peek');if(!inside){hoverZoneActive=false;clearSessionsHoverTimers();if(!pinned&&peeking)peekSessions(false);if(!pinned)sessionsHoverSuppress=false;return}const hot=sessionsHoverHot(workbench,event.clientX,event.clientY);if(sessionsHoverSuppress){if(!hot)sessionsHoverSuppress=false;else return}if(hot&&!hoverZoneActive&&!pinned){hoverZoneActive=true;hoverPeekTimer=setTimeout(()=>{const wb=activeRightWorkbench();if(!wb||!pointerInWorkbench(wb,lastPointer.x,lastPointer.y)||!sessionsHoverHot(wb,lastPointer.x,lastPointer.y))return;peekSessions(true)},160);hoverOpenTimer=setTimeout(()=>{const wb=activeRightWorkbench();if(!wb||!pointerInWorkbench(wb,lastPointer.x,lastPointer.y)||!sessionsHoverHot(wb,lastPointer.x,lastPointer.y))return;setSessionsOpen(true,{persist:false})},720)}if(!hot&&hoverZoneActive&&!pinned){hoverZoneActive=false;clearSessionsHoverTimers();peekSessions(false)}})}",
    "function chatShellForPrompt(promptId){if(promptId==='chatPrompt')return document.querySelector('#chatView .chat-main');if(promptId==='terminalAgentPrompt')return document.querySelector('#terminalView .agent-shell');if(promptId==='agentPrompt')return document.querySelector('#editorView .agent-shell');return null}",
    "function chatInputPlaceholder(){return workspaceState==='loading'?'Loading workspace...':workspaceState==='error'?'Retry loading the workspace to continue.':selectedProfile?CHAT_INPUT_PLACEHOLDER:'Add a profile in Sessions to start…'}",
    "function applyChatInputPlaceholders(){const text=chatInputPlaceholder();['chatPrompt','agentPrompt','terminalAgentPrompt'].forEach(id=>{const el=$(id);if(el)el.placeholder=text})}",
    "function focusChatPrompt(){if(document.body.dataset.view!=='chat')setView('chat');const input=$('chatPrompt');if(!input)return;requestAnimationFrame(()=>{input.focus();try{input.setSelectionRange(input.value.length,input.value.length)}catch{}})}",
    "function syncChatEmptyLayout(){const empty=isBlankChatSession(activeChatSession());const main=document.querySelector('#chatView .chat-main');if(main)main.classList.toggle('chat-empty',empty);applyChatInputPlaceholders();document.querySelectorAll('.agent-shell').forEach(shell=>shell.classList.toggle('chat-empty',empty))}",
    "function renderChatInto(id){const out=$(id);if(!out)return;out.innerHTML='';const chat=activeChatSession();if(!chat)return;chat.messages.forEach(m=>out.appendChild(messageNode(m)));out.scrollTop=out.scrollHeight}",
    "function syncLastToolFromChat(){const el=$('chatLastTool');if(!el)return;const last=activeChatSession()?.messages?.slice().reverse().find(m=>m.kind==='tool');if(!last){el.textContent='No D3 tool has run in this browser session.';return}el.textContent=toolTitle(last.name,last.status)+': '+previewText(last.detail||last.text||'')}",
    "function renderActiveChat(){['chatOutput','agentOutput','terminalAgentOutput'].forEach(renderChatInto);if(busyChatIds.has(activeChatId)&&!chatAwaitingApproval(activeChatId))showTypingRows('Working...');syncLastToolFromChat();syncChatTitle();syncChatEmptyLayout();syncAgentSendButtons();reconcileChatApprovals(activeChatId)}",
    "function chatTitleLabel(){const chat=activeChatSession();return chat?(chat.title||'New chat'):'New chat'}",
    "function syncChatTitle(){const title=chatTitleLabel();document.querySelectorAll('[data-chat-title]').forEach(el=>{el.textContent=title})}",
    "function syncMeta(status){const profile=status?.profile||selectedProfile||'';const account=status?.account||'';const meta=$('meta');if(!meta)return;if(!profile){meta.textContent='Sessions';return}meta.textContent=account&&account!=='none'?`${profile} · ${account}`:profile}",
    "async function newChatForProfile(profileName){if(!profileName){toast('Add and select a D3 profile first');return}if(!confirmLeaveCurrentChat())return;if(profileName!==selectedProfile)await switchProfile(profileName);const profileChats=chatsForProfile(profileName);const latest=profileChats[0];if(latest&&isBlankChatSession(latest)){if(activeChatId!==latest.id){activeChatId=latest.id;saveChats();renderChatList();renderActiveChat();await resetAgentThread(activeChatId)}closeSessionsPanel();focusChatPrompt();return}const chat=makeChat(profileName);chatSessions.unshift(chat);activeChatId=chat.id;saveChats();renderChatList();renderActiveChat();closeSessionsPanel();await resetAgentThread(activeChatId);focusChatPrompt()}",
    "async function newChat(){await newChatForProfile(selectedProfile)}",
    "function setView(view){const next=view==='editor'?'editor':view==='terminal'?'terminal':'chat';document.body.dataset.view=next;try{localStorage.setItem(CHAT_VIEW_STORE,next)}catch{}[['chatModeButton','chat'],['editorModeButton','editor'],['terminalModeButton','terminal']].forEach(([id,name])=>{const active=next===name;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',active?'true':'false')});$('mobilePanelButton').hidden=next==='terminal';closeMobilePanel();closeSessionsPanel();renderActiveChat();renderTerminal();if(next==='editor')refreshD3Browser()}",
    "function showAgent(v){if(v.error){addBubble('assistant',v.error);return}addBubble('assistant',v.output||JSON.stringify(v,null,2));(v.tools||[]).forEach(t=>addToolEvent(t))}",
    "const AGENT_SEQ_STORE='d3code.ide.agentSeq.v1';",
    "const AGENT_EVENT_STORE='d3code.ide.agentEvents.v1';",
    "let agentPollers={};",
    "let agentResuming=false;",
    "function loadAgentSeqMap(){try{const saved=JSON.parse(localStorage.getItem(AGENT_SEQ_STORE)||'{}');return saved&&typeof saved==='object'?saved:{}}catch{return {}}}",
    "function getAgentSeq(chatId){return Number(loadAgentSeqMap()[chatId]||0)}",
    "function setAgentSeq(chatId,seq){const map=loadAgentSeqMap();map[chatId]=seq;try{localStorage.setItem(AGENT_SEQ_STORE,JSON.stringify(map))}catch{}}",
    "function loadProcessedAgentEvents(){try{const saved=JSON.parse(sessionStorage.getItem(AGENT_EVENT_STORE)||localStorage.getItem(AGENT_EVENT_STORE)||'{}');return saved&&typeof saved==='object'?saved:{}}catch{return {}}}",
    "let processedAgentEvents=loadProcessedAgentEvents();",
    "function saveProcessedAgentEvents(){const entries=Object.entries(processedAgentEvents).slice(-600);processedAgentEvents=Object.fromEntries(entries);try{sessionStorage.setItem(AGENT_EVENT_STORE,JSON.stringify(processedAgentEvents));localStorage.setItem(AGENT_EVENT_STORE,JSON.stringify(processedAgentEvents))}catch{}}",
    "function agentEventKey(chatId,msg){const data=msg?.data||{};const job=data.job_id||msg.job_id;const seq=Number(data.seq??msg.seq);if(!job||!Number.isFinite(seq))return '';return chatId+':'+job+':'+seq}",
    "function shouldProcessAgentEvent(chatId,msg){const key=agentEventKey(chatId,msg);if(!key)return true;if(processedAgentEvents[key])return false;processedAgentEvents[key]=Date.now();saveProcessedAgentEvents();return true}",
    "function parseSseEvent(block){let event='message';let data='';block.split(/\\r?\\n/).forEach(line=>{if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trim()});try{return {event,data:JSON.parse(data||'{}')}}catch{return {event,data:{}}}}",
    "function visibleAssistantText(buffer,suppress){let text=buffer;if(suppress){const toolIndex=text.search(/<(d3_tool|tool_call)>/i);if(toolIndex!==-1)text=text.slice(0,toolIndex)}return cleanAgentText(text).trimEnd()}",
    "function createAgentStreamState(){return {buffer:'',suppress:false,streamIteration:-1}}",
    "function noteAgentSeq(chatId,data){const seq=Number(data?.seq);if(Number.isFinite(seq)&&seq>=0)setAgentSeq(chatId,seq+1)}",
    "function shouldSkipAssistantDeltaOnResume(runChatId){if(!agentResuming)return false;const chat=chatById(runChatId);const last=chat?.messages?.[chat.messages.length-1];return last?.kind==='bubble'&&last?.role==='assistant'&&Boolean(String(last.text||'').trim())}",
    "function processAgentEvent(runChatId,msg,state){const runKey=msg.data?.job_id?msg.data.job_id+':'+msg.event:'';if(msg.event==='approval_required')receiveApproval(runChatId,msg.data.job_id,msg.data.approval);if(msg.event==='approval_resolved')resolveApprovalMessage(runChatId,msg.data.approval_id,msg.data.reason);if(msg.event==='assistant_delta'){if(shouldSkipAssistantDeltaOnResume(runChatId))return;const iteration=Number(msg.data.iteration??0);if(iteration!==state.streamIteration){state.streamIteration=iteration;state.suppress=false;state.buffer='';removeTypingRows();ensureStreamingBubble()}if(state.suppress)return;state.buffer+=msg.data.token||'';if(state.buffer.search(/<(d3_tool|tool_call)>/i)!==-1)state.suppress=true;updateStreamingBubbles(visibleAssistantText(state.buffer,state.suppress))}if(msg.event==='tool_start'){state.suppress=true;const partial=visibleAssistantText(state.buffer,true);if(!partial)clearStreamingBubbles();else{finalizeStreamingBubbles(partial);recordChatMessage({kind:'bubble',role:'assistant',text:partial,createdAt:Date.now()},runChatId)}state.buffer='';state.streamIteration=-1;removeTypingRows();addToolEvent({name:msg.data.name,reason:msg.data.reason,status:'running',result:msg.data.reason||'Working...'},{record:false})}if(msg.event==='tool_output'){const chunk=msg.data.chunk||'';if(chunk&&activeToolNode){activeToolNode.dataset.toolStream=(activeToolNode.dataset.toolStream||'')+chunk;const detail=activeToolNode.querySelector('.chat-tool-detail');if(detail){detail.textContent=activeToolNode.dataset.toolStream.slice(-6000);activeToolNode.classList.add('expanded')}}}if(msg.event==='tool_result'){state.suppress=false;state.buffer='';state.streamIteration=-1;removeTypingRows();addToolEvent({name:msg.data.name,result:msg.data.compact,status:msg.data.status==='error'?'blocked':msg.data.status==='warning'?'warning':'done'})}if(msg.event==='done'){removeTypingRows();const finalText=cleanAgentText(msg.data.output||state.buffer);const hasStreaming=isAgentChatLive()&&document.querySelector('[data-streaming=\"1\"]');if(hasStreaming){finalizeStreamingBubbles(finalText);if(finalText.trim())recordChatMessage({kind:'bubble',role:'assistant',text:finalText,createdAt:Date.now(),runKey},runChatId)}else if(finalText.trim())recordChatMessage({kind:'bubble',role:'assistant',text:finalText,runKey},runChatId)}if(msg.event==='error'){removeTypingRows();clearStreamingBubbles();const err=msg.data.error||'Agent failed';const message={kind:'bubble',role:'assistant',text:err,runKey};if(isAgentChatLive())appendMessage(message,{chatId:runChatId});else recordChatMessage(message,runChatId)}}",
    "function finishAgentRun(runChatId){setChatBusy(runChatId,false);if(agentRunChatId===runChatId)agentRunChatId='';activeToolNode=null;if(activeChatId===runChatId){removeTypingRows();renderActiveChat()}else saveChats()}",
    "async function consumeAgentSseStream(runChatId,reader,state){const decoder=new TextDecoder();let pending='';while(true){const read=await reader.read();if(read.done)break;pending+=decoder.decode(read.value,{stream:true});let boundary;while((boundary=pending.indexOf('\\n\\n'))!==-1){const block=pending.slice(0,boundary);pending=pending.slice(boundary+2);if(!block.trim())continue;const msg=parseSseEvent(block);if(!shouldProcessAgentEvent(runChatId,msg))continue;noteAgentSeq(runChatId,msg.data);processAgentEvent(runChatId,msg,state)}}}",
    "async function pollAgentJob(runChatId,{since=0}={}){agentRunChatId=runChatId;setChatBusy(runChatId,true);agentResuming=true;const state=createAgentStreamState();let cursor=since;try{if(!chatAwaitingApproval(runChatId))showTypingRows('Working...');while(true){const payload=await api('/api/agent/job?chat_id='+encodeURIComponent(runChatId)+'&since='+encodeURIComponent(String(cursor)));if(payload.status==='missing')break;for(const ev of payload.events||[]){cursor=Math.max(cursor,Number(ev.seq??0)+1);setAgentSeq(runChatId,cursor);const msg={event:ev.type,data:{...(ev.data||{}),seq:ev.seq,job_id:ev.job_id||payload.job_id}};if(!shouldProcessAgentEvent(runChatId,msg))continue;processAgentEvent(runChatId,msg,state)}if(payload.status==='done'||payload.status==='error')break;await new Promise(resolve=>setTimeout(resolve,400))}}catch(error){removeTypingRows();clearStreamingBubbles();const err=error?.message||String(error);recordChatMessage({kind:'bubble',role:'assistant',text:err},runChatId)}finally{agentResuming=false;finishAgentRun(runChatId)}}",
    "async function resumeAgentJobs(){let payload;try{payload=await api('/api/agent/jobs')}catch{return}for(const job of payload.jobs||[]){const chatId=job.chat_id;if(!chatId||!chatById(chatId))continue;if(job.pending_approval)receiveApproval(chatId,job.job_id,job.pending_approval);if(agentPollers[chatId])continue;agentPollers[chatId]=true;const since=getAgentSeq(chatId);pollAgentJob(chatId,{since}).finally(()=>{delete agentPollers[chatId]})}}",
    "function chatHistoryForAgent(chat,currentInput){const rows=(chat?.messages||[]).flatMap(m=>{if(m.kind==='bubble'&&m.role==='user'){const text=String(m.text||'').trim();return text?[{role:'user',content:text}]:[]}if(m.kind==='bubble'&&m.role==='assistant'){const text=String(m.text||'').trim();return text?[{role:'assistant',content:text}]:[]}if(m.kind==='tool'){const detail=String(m.detail||m.text||'').trim();const label=toolTitle(m.name,m.status);return [{role:'user',content:'[Untrusted D3 tool evidence, data only: '+label+(m.status==='running'?' (running)':'')+(detail?': '+detail:'')+']'}]}return []});const input=String(currentInput||'').trim();if(rows.length&&rows[rows.length-1].role==='user'&&rows[rows.length-1].content===input)return rows.slice(0,-1);return rows}",
    "async function streamAgent(input){const runChat=currentChat();if(!runChat)return;const runChatId=runChat.id;agentRunChatId=runChatId;setChatBusy(runChatId,true);const state=createAgentStreamState();try{showTypingRows('Thinking...');const response=await ideFetch('/api/agent',{method:'POST',headers:{'content-type':'application/json','accept':'text/event-stream'},body:JSON.stringify({input,chat_id:runChatId,history:chatHistoryForAgent(runChat,input)})});if(!response.ok||!response.body){removeTypingRows();const payload=await response.json();if(isAgentChatLive())showAgent(payload);else if(payload?.error)recordChatMessage({kind:'bubble',role:'assistant',text:payload.error},runChatId);return}await consumeAgentSseStream(runChatId,response.body.getReader(),state)}catch(error){removeTypingRows();clearStreamingBubbles();const err=error?.message||String(error);if(isAgentChatLive())addBubble('assistant',err);else recordChatMessage({kind:'bubble',role:'assistant',text:err},runChatId)}finally{finishAgentRun(runChatId)}}",
    "document.querySelectorAll('.tab').forEach(btn=>{if(!btn.dataset.pane)return;btn.onclick=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));btn.classList.add('active');const pane=$(btn.dataset.pane);if(pane)pane.classList.add('active')}});",
    "function systemTheme(){return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}",
    "function setTheme(choice){const actual=choice==='system'?systemTheme():choice;document.body.dataset.theme=actual;document.body.dataset.themeChoice=choice;try{localStorage.setItem('d3code.theme',choice)}catch{}document.querySelectorAll('.theme-choice').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeChoice===choice))}",
    "document.querySelectorAll('.theme-choice').forEach(btn=>btn.onclick=()=>setTheme(btn.dataset.themeChoice));",
    "try{setTheme(localStorage.getItem('d3code.theme')||IDE_DEFAULT_THEME)}catch{setTheme(IDE_DEFAULT_THEME)}",
    "if(window.matchMedia)window.matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{if(document.body.dataset.themeChoice==='system')setTheme('system')});",
    "loadChats();",
    "initColumnResize();",
    "initSessionsDrawer();",
    "initSessionsFooter();",
    "setView('chat');",
    "$('chatModeButton').onclick=()=>setView('chat');",
    "$('editorModeButton').onclick=()=>setView('editor');",
    "$('terminalModeButton').onclick=()=>setView('terminal');",
    "function setAgentPanel(open){document.body.dataset.agentPanel=open?'visible':'hidden';const button=$('agentPanelToggle');button.setAttribute('aria-pressed',open?'true':'false');button.setAttribute('aria-label',open?'Hide chat panel':'Show chat panel');button.title=open?'Hide chat panel':'Show chat panel';button.classList.toggle('active',open);if(open)requestAnimationFrame(()=>document.querySelector('#'+(document.body.dataset.view==='editor'?'agentPrompt':'terminalAgentPrompt'))?.focus())}",
    "$('agentPanelToggle').onclick=()=>setAgentPanel(document.body.dataset.agentPanel!=='visible');$('workspaceSettings').onclick=openSettingsModal;$('terminalProfileEdit').onclick=()=>openProfileForm(profileCache.find(profile=>profile.name===selectedProfile));$('terminalProfile').onchange=async()=>{const picker=$('terminalProfile');picker.disabled=true;try{await switchProfile(picker.value)}finally{picker.disabled=false}};",
    "$('mobilePanelButton').onclick=toggleMobilePanel;",
    "$('mobilePanelBackdrop').onclick=closeMobilePanel;",
    "async function switchProfile(profile){if(!profile||!await confirmEditorDiscard())return;resetEditorSelection();$('file').value='';$('item').value='';selectedD3File='';delete document.body.dataset.editorFile;$('itemBrowser').hidden=true;$('d3Browser').hidden=false;closeMobilePanel();show('editorScreen',await api('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile})}));d3BrowserCache={};await boot();if(document.body.dataset.view==='editor')await refreshD3Browser(profile)}",
    "function defaultProfile(){return {name:'new-profile',type:'local',account:'DM',entryCommand:'d3',startupInput:'dm\\ndm\\n',promptPattern:':',sessionMode:'persistent',safetyDefault:'ask'}}",
    "function setValue(id,value){$(id).value=value||''}",
    "function openProfileForm(profile){const p=profile?{...profile}:defaultProfile();editingProfileName=profile?.name||'';$('profileFormTitle').textContent=profile?'Edit profile':'Add profile';$('profileModal').classList.add('open');setValue('profileName',p.name);setValue('profileType',p.type||'local');setValue('profileHost',p.host);setValue('profileUser',p.username);setValue('profileAccount',p.account);setValue('profileEntry',p.entryCommand);setValue('profileStartup',p.startupInput);setValue('profilePrompt',p.promptPattern||':');setValue('profileSession',p.sessionMode||'oneshot');setValue('profileSafety',p.safetyDefault||'ask')}",
    "function closeProfileForm(){editingProfileName='';$('profileModal').classList.remove('open')}",
    "function migrateProfileRename(oldName,newName){if(!oldName||!newName||oldName===newName)return;chatSessions.forEach(c=>{if((c.profile||'')===oldName)c.profile=newName});if(profileCollapse[oldName]!==undefined){profileCollapse[newName]=profileCollapse[oldName];delete profileCollapse[oldName];saveProfileCollapse()}saveChats()}",
    "function collectProfileForm(){const type=$('profileType').value;const profile={name:$('profileName').value.trim(),type,account:$('profileAccount').value.trim()||undefined,entryCommand:$('profileEntry').value.trim()||undefined,startupInput:$('profileStartup').value.replace(/\\\\n/g,'\\n')||undefined,promptPattern:$('profilePrompt').value.trim()||undefined,sessionMode:$('profileSession').value,safetyDefault:$('profileSafety').value};if(type==='ssh'){profile.host=$('profileHost').value.trim()||undefined;profile.username=$('profileUser').value.trim()||undefined}return profile}",
    "async function saveProfileForm(){const profile=collectProfileForm();if(!profile.name){alert('Profile name is required.');return}const payload={profile,confirmed:true};if(editingProfileName)payload.previousName=editingProfileName;const result=await api('/api/profile/manage',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(result.error){alert(result.error);return}const previousName=editingProfileName||profile.name;migrateProfileRename(previousName,profile.name);closeProfileForm();await boot()}",
    "$('saveProfile').onclick=saveProfileForm;",
    "$('cancelProfile').onclick=closeProfileForm;",
    "$('closeSettings').onclick=closeSettingsModal;",
    "$('settingsModal').onclick=event=>{if(event.target===$('settingsModal'))closeSettingsModal()};",
    "async function removeProfile(profile){if(!profile)return;if(!confirm(`Remove profile ${profile}?`))return;const result=await api('/api/profile/manage',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({profile,confirmed:true})});if(result.error){alert(result.error);return}await boot();}",
    "function safetyLabel(value){if(value==='trust')return 'Full access';if(value==='plan')return 'Plan';return 'Ask'}",
    "function modelParts(ref){const parts=String(ref||'').split('/');return {provider:parts.shift()||'',model:parts.join('/')}}",
    "function setModelKeyNeeded(data){const needed=Boolean(data.needsKey);$('modelKeyPanel').classList.toggle('open',needed);$('modelChoiceWrap').style.display=needed?'none':'grid';$('saveModelChoice').style.display=needed?'none':'';$('modelKeyMessage').textContent=data.message||'Please provide an API key for this provider before choosing a model.';$('modelApiKey').value=''}",
    "async function refreshModels(provider,current,load){$('modelMenuNote').textContent='Loading models...';const data=await api('/api/models?provider='+encodeURIComponent(provider));if((load!==undefined&&load!==workspaceLoad)||$('modelProvider').value!==provider)return;if(data.error||!Array.isArray(data.models)){ $('modelMenuNote').textContent='Model choices could not load. Choose a provider to retry.';return}setModelKeyNeeded(data);const models=data.models||[];$('modelChoice').innerHTML=models.map(m=>`<option value=\"${escapeHtml(m)}\">${escapeHtml(m)}</option>`).join('');const parsed=modelParts(current||'');const model=parsed.provider===provider?parsed.model:(models[0]||'');if(model&&models.includes(model))$('modelChoice').value=model;$('modelMenuNote').textContent=data.warning||''}",
    "async function applyStatus(status){selectedProfile=status.profile||'';currentSafety=status.safety||'ask';const account=status.account||'none';syncMeta(status);syncChatTitle();$('chatInfoSafety').textContent='';$('chatInfoProfile').textContent=status.profile||'none';$('chatInfoAccount').textContent=account;$('chatInfoModel').textContent=status.model||'unknown';$('chatInfoSafetyValue').textContent=status.safety||'ask';$('composerSafetyLabel').textContent=safetyLabel(status.safety||'ask');$('composerModel').textContent=(status.model||'model').split('/').pop().replace(/^deepseek-/,'DeepSeek ').replace(/-/g,' ');$('composerModel').title=status.model||'Change provider and model';document.querySelectorAll('[data-safety-option]').forEach(b=>b.classList.toggle('active',b.dataset.safetyOption===(status.safety||'ask')))}",
    "function renderTerminalProfiles(){const picker=$('terminalProfile');picker.innerHTML=profileCache.length?profileCache.map(profile=>'<option value=\"'+escapeHtml(profile.name)+'\">'+escapeHtml(profile.name)+'</option>').join(''):'<option value=\"\">No connection</option>';picker.value=selectedProfile;picker.disabled=!profileCache.length;$('terminalProfileEdit').textContent=profileCache.length?'Settings':'Add connection';$('terminalAccount').textContent=terminalConnectionState.account||profileCache.find(profile=>profile.name===selectedProfile)?.account||'none';}",
    "async function refreshTerminalState(){try{const state=await api('/api/terminal/state');terminalConnectionState={...terminalConnectionState,...state,error:''};if(state&&typeof (state.displayTranscript||state.transcript)==='string')setTerminalTranscript(state.displayTranscript||state.transcript);else renderTerminalConnection()}catch(error){terminalConnectionState={...terminalConnectionState,connected:false,error:error?.message||String(error)};renderTerminalConnection()}}",
    "async function refreshWorkspaceOptions(status,load){try{const data=await api('/api/model-providers');if(load!==workspaceLoad)return;if(data.error||!Array.isArray(data.providers))throw new Error('Model providers unavailable');$('modelProvider').innerHTML=data.providers.map(p=>'<option value=\"'+escapeHtml(p.id)+'\">'+escapeHtml(p.name)+'</option>').join('');const parsed=modelParts(status.model);if(parsed.provider)$('modelProvider').value=parsed.provider;await refreshModels($('modelProvider').value,status.model,load)}catch{if(load===workspaceLoad)$('modelMenuNote').textContent='Model choices could not load. Refresh this page to retry.'}await refreshPythonRuntime()}",
    "async function boot(){const load=++workspaceLoad;setWorkspaceState('loading');try{const status=await api('/api/status');if(status.error||typeof status.model!=='string')throw new Error('Workspace status unavailable');const profiles=await api('/api/profiles');if(profiles.error||!Array.isArray(profiles.profiles))throw new Error('Workspace connections unavailable');if(load!==workspaceLoad)return;await applyStatus(status);profileCache=profiles.profiles;renderTerminalProfiles();await refreshTerminalState();if(load!==workspaceLoad)return;migrateChatProfiles(status.profile||'');await hydrateChatsFromServer();syncActiveChatForProfile();renderChatList();renderD3Browser();renderActiveChat();renderTerminal();await resumeAgentJobs();if(load!==workspaceLoad)return;setWorkspaceState('ready');refreshWorkspaceOptions(status,load);if(document.body.dataset.view==='editor')await refreshD3Browser()}catch(error){if(load===workspaceLoad)setWorkspaceState('error');throw error}}",
    "function mutationConfirmed(){return false}",
    "async function sendTerminalCommand(command){const line=(command??terminalDraft??'').trim();if(!line||terminalBusy)return;const out=terminalEls()[0]?.dataset.output||'';terminalHistory.push(line);terminalHistory=terminalHistory.slice(-100);terminalHistoryIndex=terminalHistory.length;terminalEls().forEach(el=>el.dataset.output=(out.replace(/\\s*$/,'')+'\\n: '+line+'\\n').trimStart());terminalDraft='';terminalBusy=true;renderTerminal();try{const invoke=confirmed=>api('/api/terminal/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:line,confirmed,profile:selectedProfile,connection:terminalConnectionState.connection})});let response=await invoke(false);if(response.requiresConfirmation){if(!await confirmD3Action('Run D3 command?',line,'Run command')){setTerminalTranscript((out+'\\n: '+line+'\\nNot run: approval cancelled.').trim());addToolEvent({name:'d3_tcl',status:'blocked',result:'Command not run: approval cancelled.'});return {cancelled:true}}response=await invoke(true)}if(response.error)throw new Error(response.error);terminalConnectionState={...terminalConnectionState,connected:response.mechanism==='persistent-pty',mechanism:response.mechanism||terminalConnectionState.mechanism,error:''};setTerminalTranscript(response.displayTranscript||response.transcript||'');addToolEvent({name:'d3_tcl',status:'done',result:(response.label?response.label+'\\n':'')+(response.clean||response.result||'Done')});return response}catch(error){const msg=error?.message||String(error);const label=/Confirmation required|Denied by|blocked|outside the allowed accounts/i.test(msg)?'Permission blocked':'Connection/login issue';const detail=label+'\\n'+msg;terminalConnectionState={...terminalConnectionState,connected:label==='Permission blocked'?terminalConnectionState.connected:false,error:label};setTerminalTranscript((out.replace(/\\s*$/,'')+'\\n: '+line+'\\n'+detail).trim());addToolEvent({name:'d3_tcl',status:'blocked',result:detail});return {error:msg}}finally{terminalBusy=false;renderTerminal();$('terminalCommand')?.focus()}}",
    "function terminalHistoryStep(delta){if(!terminalHistory.length)return;terminalHistoryIndex=Math.max(0,Math.min(terminalHistory.length,terminalHistoryIndex+delta));terminalDraft=terminalHistoryIndex===terminalHistory.length?'':terminalHistory[terminalHistoryIndex]||'';renderTerminal();const input=$('terminalCommand');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length)}}",
    "function bindTerminalInput(el){if(!el)return;el.addEventListener('click',()=>{$('terminalCommand')?.focus()});el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendTerminalCommand(terminalDraft);return}if(e.key==='ArrowUp'){e.preventDefault();terminalHistoryStep(-1);return}if(e.key==='ArrowDown'){e.preventDefault();terminalHistoryStep(1);return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='l'){e.preventDefault();clearTerminalTranscript();return}})}",
    "function bindTerminalCommandInput(inputId,buttonId){const input=$(inputId);const button=$(buttonId);if(!input||!button)return;const send=()=>{const value=input.value.trim();if(!value)return;sendTerminalCommand(value)};button.onclick=send;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();return}if(e.key==='ArrowUp'){e.preventDefault();terminalHistoryStep(-1);return}if(e.key==='ArrowDown'){e.preventDefault();terminalHistoryStep(1);return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='l'){e.preventDefault();clearTerminalTranscript()}});input.addEventListener('input',()=>{terminalDraft=input.value})}",
    "async function clearTerminalTranscript(){await api('/api/terminal/clear',{method:'POST'});setTerminalTranscript('');toast('Terminal cleared')}",
    "async function reconnectTerminal(){if(terminalBusy)return;const previous=terminalEls()[0]?.dataset.output||'';terminalBusy=true;renderTerminalConnection();try{const status=await api('/api/status');if(status.error)throw new Error(status.error);if(status.profile&&(status.profile!==selectedProfile||status.connection!==terminalConnectionState.connection)){terminalConnectionState={...terminalConnectionState,connected:false,error:'Connection changed'};renderTerminalConnection();const updatedProfiles=await api('/api/profiles');if(updatedProfiles.error)throw new Error(updatedProfiles.error);const target=(updatedProfiles.profiles||[]).find(profile=>profile.name===status.profile);if(!await confirmD3Action('Connection settings changed','Reconnect to '+status.profile+' / '+(status.account||'no account')+' at '+(target?.host||'local D3')+' using the updated settings?','Reconnect'))return;await applyStatus(status);profileCache=updatedProfiles.profiles||[];renderTerminalProfiles();terminalConnectionState={...terminalConnectionState,profile:status.profile,account:status.account,connection:status.connection}}const reset=await api('/api/terminal/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile:selectedProfile,connection:terminalConnectionState.connection})});if(reset.error)throw new Error(reset.error);setTerminalTranscript('');terminalConnectionState={...terminalConnectionState,connected:false,error:''}}catch(error){const message=error?.message||String(error);terminalConnectionState={...terminalConnectionState,connected:false,error:'Connection/login issue'};setTerminalTranscript((previous+'\\nConnection/login issue\\n'+message).trim());return}finally{terminalBusy=false;renderTerminalConnection()}await sendTerminalCommand('WHO')}",
    "bindTerminalInput($('terminalMain'));",
    "bindTerminalCommandInput('terminalCommand','terminalSend');",
    "$('terminalCopy').onclick=async()=>{const text=terminalEls()[0]?.dataset.output||'';if(!text){toast('Nothing to copy');return}try{await navigator.clipboard.writeText(text);toast('Terminal transcript copied')}catch{toast('Could not copy the terminal transcript')}};",
    "$('terminalClear').onclick=clearTerminalTranscript;",
    "$('terminalReconnect').onclick=reconnectTerminal;",
    "if($('refreshBrowser'))$('refreshBrowser').onclick=async()=>{d3BrowserCache={};await refreshD3Browser(selectedProfile)};",
    "$('readItem').onclick=readSelectedItem;$('closeEditorOutput').onclick=()=>document.body.dataset.editorOutput='hidden';",
    "$('readDict').onclick=async()=>{const q=new URLSearchParams({file:$('file').value,item:$('item').value});show('editorScreen',await api('/api/dict?'+q));};",
    "$('writeItem').onclick=saveSelectedRecord;",
    "$('compileBasic').onclick=()=>runSelectedProgramAction('compile','Compile program?');",
    "$('catalogBasic').onclick=()=>runSelectedProgramAction('catalog','Catalog program?');",
    "$('runBasic').onclick=()=>runSelectedProgramAction('run','Run program?');$('buildBasic').onclick=async()=>{if(await saveSelectedRecord())await runSelectedProgramAction('compile','Compile program?')};",
    "$('writeDict').onclick=saveSelectedRecord;",
    "$('createFile').onclick=async()=>{const file=prompt('D3 file name',$('file').value||'');if(!file)return;const dictModulo=Number(prompt('Dictionary modulo','3')||'3');const dataModulo=Number(prompt('Data modulo','11')||'11');show('editorScreen',await api('/api/file/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file,dictModulo,dataModulo,confirmed:mutationConfirmed()})}))};",
    "$('ragSearchEditor').onclick=async()=>{const query=prompt('Search D3/SB+ references',$('itemBody').value.split(/\\n/).slice(0,3).join(' ')||$('file').value||'SB+ screen definition');if(!query)return;show('editorScreen',await api('/api/rag-search?query='+encodeURIComponent(query)+'&limit=6'))};",
    "$('sbplusDiscover').onclick=async()=>show('editorScreen',await api('/api/sbplus/discover'));",
    "$('sbplusPlan').onclick=async()=>{const process=prompt('SB+ process name',$('item').value||'');if(!process)return;const fields=(prompt('Fields/prompts, comma separated','')||'').split(',').map(x=>x.trim()).filter(Boolean);show('editorScreen',await api('/api/sbplus/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({process,kind:'input process',file:$('file').value,fields})}))};",
    "async function sendPrompt(id){if(busyChatIds.has(activeChatId)){await cancelAgentRun(activeChatId);return}if(workspaceState!=='ready'){toast(workspaceState==='loading'?'Workspace is still loading. Your draft is kept.':'Retry loading the workspace. Your draft is kept.');return}const input=$(id).value.trim();if(!input&&!composerAttachments.length)return;if(!selectedProfile&&!input.startsWith('/')){toast('Add and select a D3 profile first');return}const payload=attachmentPromptPrefix()+input;$(id).value='';closeSlashPalette();closeActionPopover();clearAttachments();try{if(input.startsWith('/'))await runSlash(input);else{if(!requireActiveChat()){toast('Add and select a D3 profile first');return}addBubble('user',payload);await streamAgent(editorContextPrefix()+payload)}}catch(error){addBubble('assistant',error.message||String(error))}finally{syncChatEmptyLayout()}}",
    "$('agentSend').onclick=async()=>sendPrompt('agentPrompt');",
    "$('chatSend').onclick=async()=>sendPrompt('chatPrompt');const newThreadBtn=$('sessionsNewThread');if(newThreadBtn)newThreadBtn.onclick=()=>newChat();;",
    "$('composerAdd').onclick=toggleActionPopover;",
    "$('addFileAction').onclick=()=>{$('fileUpload').click();closeActionPopover()};",
    "$('addPhotoAction').onclick=()=>{$('photoUpload').click();closeActionPopover()};",
    "$('planModeAction').onclick=async()=>{closeActionPopover();await setSafety('plan')};",
    "$('fileUpload').onchange=e=>addFiles(e.target.files||[],'file');",
    "$('photoUpload').onchange=e=>addFiles(e.target.files||[],'photo');",
    "$('composerSafety').onclick=()=>openControlMenu('safetyMenu',$('composerSafety'));",
    "$('composerModel').onclick=()=>openControlMenu('modelMenu',$('composerModel'));",
    "$('composerMic').onclick=()=>toast('Voice input is not wired yet');",
    "$('terminalAgentSend').onclick=async()=>sendPrompt('terminalAgentPrompt');",
    "$('agentPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('agentSend').click()}});",
    "$('chatPrompt').addEventListener('keydown',e=>{const open=$('slashPalette')?.classList.contains('open');if(open&&e.key==='ArrowDown'){e.preventDefault();slashActive++;renderSlashPalette();return}if(open&&e.key==='ArrowUp'){e.preventDefault();slashActive--;renderSlashPalette();return}if(open&&(e.key==='Tab'||e.key==='Enter')&&!e.shiftKey){e.preventDefault();acceptSlash();return}if(e.key==='Escape'){closeSlashPalette();return}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chatSend').click()}});",
    "$('chatPrompt').addEventListener('input',()=>{slashActive=0;renderSlashPalette()});",
    "$('chatPrompt').addEventListener('blur',()=>setTimeout(closeSlashPalette,150));",
    "$('terminalAgentPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('terminalAgentSend').click()}});",
    "async function setSafety(safety){const status=await api('/api/config/safety',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({safety})});await applyStatus(status);document.querySelectorAll('[data-safety-option]').forEach(b=>b.classList.toggle('active',b.dataset.safetyOption===status.safety));closeControlMenus();toast('Permission set to '+safetyLabel(status.safety))}",
    "document.querySelectorAll('[data-safety-option]').forEach(btn=>btn.onclick=async()=>setSafety(btn.dataset.safetyOption));",
    "$('modelProvider').onchange=()=>refreshModels($('modelProvider').value,'');",
    "$('saveModelChoice').onclick=async()=>{const provider=$('modelProvider').value;const modelId=$('modelChoice').value;if(!modelId){toast('Choose a model first');return}const status=await api('/api/config/model',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:provider+'/'+modelId})});await applyStatus(status);closeControlMenus();toast('Model set to '+status.model)};",
    "$('saveModelKey').onclick=async()=>{const provider=$('modelProvider').value;const key=$('modelApiKey').value.trim();if(!key){toast('Paste an API key first');return}const saved=await api('/api/config/model-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider,key})});if(saved.error){toast(saved.error);return}toast('Key saved for '+provider);await refreshModels(provider,'')};",
    "document.addEventListener('click',e=>{if(!e.target.closest('.control-menu')&&!e.target.closest('#composerSafety')&&!e.target.closest('#composerModel'))closeControlMenus();if(!e.target.closest('#actionPopover')&&!e.target.closest('#composerAdd'))closeActionPopover();if(!e.target.closest('#chatContextMenu')&&!e.target.closest('.session-chat-item'))closeChatContextMenu();if(!e.target.closest('#profileContextMenu')&&!e.target.closest('[data-profile-menu]'))closeProfileContextMenu()});",
    "document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSessionContextMenus();closeMobilePanel();closeSettingsModal();closeProfileForm();closeControlMenus();closeActionPopover()}});",
    "$('chatContextMenu')?.querySelector('[data-chat-action=\"delete\"]')?.addEventListener('click',()=>deleteChat(chatContextTargetId));",
    "$('profileContextMenu')?.querySelector('[data-profile-action=\"edit\"]')?.addEventListener('click',()=>{const profile=profileCache.find(p=>p.name===profileContextTarget);closeProfileContextMenu();openProfileForm(profile)});",
    "$('profileContextMenu')?.querySelector('[data-profile-action=\"remove\"]')?.addEventListener('click',()=>{const name=profileContextTarget;closeProfileContextMenu();removeProfile(name)});",
    "window.addEventListener('resize',syncProfileConnectionHeight);window.addEventListener('beforeunload',event=>{const chat=chatById(activeChatId);if(chat&&chat.messages&&chat.messages.length){event.preventDefault();event.returnValue=''}});",
    itemBrowserClientScript(),
    recordEditorClientScript(),
    confirmationClientScript(),
    "boot().catch(()=>{});",
    programEditorLoaderScript(),
    "</script>",
    "</body></html>",
  ].join("")
}

function toolResultPayload(result: { compact: string; raw: unknown }): { result: string; raw: unknown } {
  return { result: formatD3ToolResultForDisplay(result), raw: result.raw }
}

function editorReadPayload(result: { compact: string; raw: unknown }): { result: string; raw: unknown; error?: string } {
  if (result.raw && typeof result.raw === "object" && "stdout" in result.raw) {
    const raw = result.raw as D3CommandResult
    const hint = humanD3SessionError(raw.stdout, raw.stderr)
    if (hint) return { result: "", error: hint, raw: result.raw }
    const missing=(raw.stdout+"\n"+raw.stderr).match(/^\s*\[(?:401|201)\]\s*.*$/m)?.[0]?.trim()
    if(missing)return {result:"",error:missing,raw:result.raw}
    const body = parseCtItem(raw.stdout || raw.stderr || "")
    if (body) return { result: body, raw: result.raw }
  }
  return toolResultPayload(result)
}

interface ProfileConnectionStatus {
  online: boolean
  issue?: string
}

async function probeProfileConnection(config: D3CodeConfig, profileName: string, timeoutMs = 8000): Promise<ProfileConnectionStatus> {
  const profile = selectProfile(config, profileName)
  if (!profile) return { online: false, issue: "Profile not found." }
  const session = createD3Session({ ...profile, sessionMode: "oneshot" })
  try {
    const result = await session.run("WHO", timeoutMs)
    const output = `${result.stdout}\n${result.stderr}`
    const sessionIssue = humanD3SessionError(result.stdout, result.stderr)
    if (sessionIssue) return { online: false, issue: sessionIssue }
    if (/\bssh:/i.test(output)) {
      return { online: false, issue: "Could not complete the SSH D3 connection. Check the profile settings and that D3 is running on the server." }
    }
    if (result.exitCode !== null && result.exitCode !== 0) {
      return { online: false, issue: `D3 connection exited with status ${result.exitCode}.` }
    }
    if (!output.trim()) return { online: false, issue: "D3 did not return a response." }
    return { online: true }
  } catch (error) {
    return { online: false, issue: humanizeD3ConnectError(error instanceof Error ? error.message : String(error), profile) }
  } finally {
    await session.close().catch(() => {})
  }
}

async function probeAllProfileConnections(config: D3CodeConfig): Promise<Record<string, ProfileConnectionStatus>> {
  const entries = await Promise.all(config.profiles.map(async (profile) => [profile.name, await probeProfileConnection(config, profile.name)] as const))
  return Object.fromEntries(entries)
}

function normalizeManagedSshProfile(
  profile: D3CodeConfig["profiles"][number],
  existing?: D3CodeConfig["profiles"][number],
): D3CodeConfig["profiles"][number] {
  const account = (profile.account || existing?.account || "DM").trim()
  const login = account.toLowerCase() || "dm"
  const startupInput = (profile.startupInput ?? existing?.startupInput)?.replace(/\\n/g, "\n")
    || `${login}\n${login}\n`
  return {
    ...(existing ?? {}),
    ...profile,
    startupInput,
    promptPattern: normalizeD3PromptPattern(profile.promptPattern)
      ?? normalizeD3PromptPattern(existing?.promptPattern)
      ?? D3_TCL_PROMPT_PATTERN,
    entryCommand: profile.entryCommand ?? existing?.entryCommand ?? "d3",
    sessionMode: profile.sessionMode ?? existing?.sessionMode ?? "persistent",
  }
}

// Server-side thread store: chats persist under D3CODE_HOME so they survive a
// browser/device change instead of living only in localStorage.
const chatsStorePath = join(configHome, "chats.json")

async function readChatStore(): Promise<unknown[]> {
  try {
    const parsed = JSON.parse(await readFile(chatsStorePath, "utf8"))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeChatStore(chats: unknown[]): Promise<void> {
  await mkdir(configHome, { recursive: true })
  await writeFile(chatsStorePath, `${JSON.stringify(chats, null, 2)}\n`)
}

async function route(req: IncomingMessage, res: ServerResponse, config: D3CodeConfig, state: IdeRuntimeState, options: IdeServerOptions, userStates?: Map<string, IdeRuntimeState>): Promise<void> {
  const userScoped = Boolean(userStates)
  const url = new URL(req.url ?? "/", "http://127.0.0.1")
  if (req.method === "GET" && url.pathname === "/") {
    const workspace = process.env.D3CODE_STORAGE_NAMESPACE
    const user = String(req.headers["x-d3code-user"] ?? "")
    const scope = workspace ? `d3code.${workspace}.${user}.` : ""
    return send(res, 200, html(scope), "text/html; charset=utf-8")
  }
  if (req.method === "GET" && url.pathname === "/assets/program-editor.js") {
    const asset = new URL(import.meta.url.endsWith(".ts") ? "../../dist/ide/program-editor.js" : "../../ide/program-editor.js", import.meta.url)
    return send(res, 200, await readFile(asset, "utf8"), "text/javascript; charset=utf-8")
  }
  if (req.method === "GET" && url.pathname === "/favicon.ico") return send(res, 204, "")
  if (req.method === "GET" && url.pathname === "/api/status") {
    const profile = selectProfile(config, state.profile)
    return sendJson(res, 200, { model: state.model, safety: state.safety, mode: state.mode, profile: profile?.name, account: profile?.account, connection: profile ? recordConnection(profile) : undefined })
  }
  if (req.method === "GET" && url.pathname === "/api/model-providers") {
    return sendJson(res, 200, { providers: providers.map((provider) => ({ id: provider.id, name: provider.name, defaultModel: provider.defaultModel, models: provider.models })) })
  }
  if (req.method === "GET" && url.pathname === "/api/models") {
    const id = url.searchParams.get("provider") ?? providers[0]?.id
    const provider = providers.find((item) => item.id === id)
    if (!provider) return sendJson(res, 404, { error: `unknown provider: ${id}` })
    const secretRef = config.modelSecrets[provider.id]
    const envKey = provider.env.map((name) => process.env[name]).find(Boolean)
    const key = secretRef ? await defaultSecretStore().get(secretRef) : envKey
    if (provider.id !== "ollama" && !key) {
      return sendJson(res, 200, {
        provider: provider.id,
        models: [],
        source: "none",
        needsKey: true,
        message: `Please provide an API key for ${provider.name} before choosing a model.`,
        env: provider.env,
      })
    }
    const discovery = await discoverProviderModels(provider, key)
    if (provider.id !== "ollama" && discovery.authFailed) {
      return sendJson(res, 200, {
        provider: provider.id,
        models: [],
        source: "none",
        needsKey: true,
        message: `${provider.name} rejected the saved API key. Paste a working key before choosing a model.`,
        warning: discovery.warning,
        env: provider.env,
      })
    }
    const current = state.model.startsWith(`${provider.id}/`) ? state.model.slice(provider.id.length + 1) : undefined
    const models = [...new Set([current, ...discovery.models, ...provider.models].filter(Boolean))]
    return sendJson(res, 200, { provider: provider.id, models, source: discovery.source, warning: discovery.warning })
  }
  if (req.method === "POST" && url.pathname === "/api/config/model-key") {
    const body = await readJson(req) as { provider?: string; key?: string }
    const provider = providers.find((item) => item.id === body.provider)
    if (!provider) return sendJson(res, 400, { error: `unknown provider: ${body.provider ?? ""}` })
    if (provider.id === "ollama") return sendJson(res, 400, { error: "Ollama does not use an API key here" })
    const key = body.key?.trim()
    if (!key) return sendJson(res, 400, { error: "API key is required" })
    const secretRef = config.modelSecrets[provider.id] ?? secretRefForProvider(provider.id)
    try {
      await defaultSecretStore().set(secretRef, key)
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
    config.modelSecrets[provider.id] = secretRef
    await (options.saveConfigFn ?? saveConfig)(config)
    return sendJson(res, 200, { provider: provider.id, saved: true })
  }
  if (req.method === "POST" && url.pathname === "/api/config/safety") {
    const body = await readJson(req) as { safety?: SafetyMode }
    if (body.safety !== "ask" && body.safety !== "plan" && body.safety !== "trust") return sendJson(res, 400, { error: "safety must be ask, plan, or trust" })
    state.safety = body.safety
    const profile = selectProfile(config, state.profile)
    if (!userScoped) {
      config.defaultSafety = body.safety
      if (profile) profile.safetyDefault = body.safety
      await (options.saveConfigFn ?? saveConfig)(config)
    }
    return sendJson(res, 200, { ...state, profile: profile?.name, account: profile?.account })
  }
  if (req.method === "POST" && url.pathname === "/api/config/model") {
    const body = await readJson(req) as { model?: string }
    if (!body.model || !body.model.includes("/")) return sendJson(res, 400, { error: "model must be provider/model" })
    const providerID = body.model.split("/")[0]
    if (!providers.some((provider) => provider.id === providerID)) return sendJson(res, 400, { error: `unknown provider: ${providerID}` })
    state.model = body.model
    if (!userScoped) {
      config.defaultModel = body.model
      await (options.saveConfigFn ?? saveConfig)(config)
    }
    const profile = selectProfile(config, state.profile)
    return sendJson(res, 200, { ...state, profile: profile?.name, account: profile?.account })
  }
  if (req.method === "GET" && url.pathname === "/api/profiles") {
    return sendJson(res, 200, { profiles: config.profiles.map((profile) => ({ ...profile })) })
  }
  if (req.method === "GET" && url.pathname === "/api/profiles/online") {
    const details = await probeAllProfileConnections(config)
    const profiles = Object.fromEntries(Object.entries(details).map(([name, status]) => [name, status.online]))
    return sendJson(res, 200, { profiles, details })
  }
  if (req.method === "POST" && url.pathname === "/api/profile") {
    const body = await readJson(req) as { profile?: string }
    if (!body.profile) return sendJson(res, 400, { error: "profile is required" })
    const profile = selectProfile(config, body.profile)
    if (!profile) return sendJson(res, 404, { error: `unknown profile: ${body.profile}` })
    if (state.profile && state.profile !== profile.name) await closeTerminalSession(state, state.profile)
    state.profile = profile.name
    state.safety = profile.safetyDefault ?? config.defaultSafety ?? state.safety
    if (!userScoped) {
      config.defaultProfile = profile.name
      await (options.saveConfigFn ?? saveConfig)(config)
    }
    return sendJson(res, 200, { ...state, profile: profile.name, account: profile.account })
  }
  if (req.method === "PUT" && url.pathname === "/api/profile/manage") {
    const body = await readJson(req) as {
      profile?: D3CodeConfig["profiles"][number]
      previousName?: string
      confirmed?: boolean
    }
    if (!body.confirmed) return sendJson(res, 409, { error: "profile edit requires confirmation" })
    if (!body.profile?.name) return sendJson(res, 400, { error: "profile.name is required" })
    const previousName = (body.previousName?.trim() || body.profile.name).trim()
    const existing = config.profiles.find((profile) => profile.name === previousName)
    const nextProfile = body.profile.type === "local"
      ? await createLocalD3Profile({
        name: body.profile.name,
        account: body.profile.account,
        entry: body.profile.entryCommand,
        startupInput: body.profile.startupInput,
        prompt: body.profile.promptPattern,
        session: body.profile.sessionMode,
        safety: body.profile.safetyDefault,
        allowedAccounts: body.profile.allowedAccounts ?? existing?.allowedAccounts,
      })
      : normalizeManagedSshProfile(
        {
          ...body.profile,
          startupInput: body.profile.startupInput?.replace(/\\n/g, "\n"),
          promptPattern: normalizeD3PromptPattern(body.profile.promptPattern),
        },
        existing,
      )
    config.profiles = [
      ...config.profiles.filter((profile) => profile.name !== previousName && profile.name !== nextProfile.name),
      nextProfile,
    ]
    if (config.defaultProfile === previousName) config.defaultProfile = nextProfile.name
    config.defaultProfile ??= nextProfile.name
    await invalidateProfileRuntimes(userStates?.values() ?? [state], [previousName, nextProfile.name], nextProfile.name)
    await (options.saveConfigFn ?? saveConfig)(config)
    return sendJson(res, 200, { profile: nextProfile.name, saved: true, previousName })
  }
  if (req.method === "DELETE" && url.pathname === "/api/profile/manage") {
    const body = await readJson(req) as { profile?: string; confirmed?: boolean }
    if (!body.confirmed) return sendJson(res, 409, { error: "profile removal requires confirmation" })
    if (!body.profile) return sendJson(res, 400, { error: "profile is required" })
    const before = config.profiles.length
    config.profiles = config.profiles.filter((profile) => profile.name !== body.profile)
    if (before === config.profiles.length) return sendJson(res, 404, { error: `unknown profile: ${body.profile}` })
    if (config.defaultProfile === body.profile) config.defaultProfile = config.profiles[0]?.name
    await invalidateProfileRuntimes(userStates?.values() ?? [state], [body.profile], config.defaultProfile)
    await (options.saveConfigFn ?? saveConfig)(config)
    return sendJson(res, 200, { profile: body.profile, removed: true, defaultProfile: config.defaultProfile })
  }
  if (req.method === "POST" && url.pathname === "/api/account/login") {
    const body = await readJson(req) as { account?: string; confirmed?: boolean }
    if (!body.account) return sendJson(res, 400, { error: "account is required" })
    const result = await runToolByName(config, { name: "d3_login", input: { account: body.account, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/tools") {
    return sendJson(res, 200, { tools: d3Tools.map((tool) => ({ name: tool.name, description: tool.description, mutates: tool.mutates })) })
  }
  if (req.method === "GET" && url.pathname === "/api/capabilities") {
    return sendJson(res, 200, { capabilities: d3Capabilities })
  }
  if (req.method === "GET" && url.pathname === "/api/tool-routing") {
    return sendJson(res, 200, createD3ToolRoutingStatus(selectProfile(config, state.profile)))
  }
  if (req.method === "GET" && url.pathname === "/api/python-runtime") {
    if (!options.pythonApiUrl) return sendJson(res, 200, { runtime: "node-only", available: false, url: null })
    try {
      const target = new URL("/tool-routing", options.pythonApiUrl)
      const profile = selectProfile(config, state.profile)
      if (profile?.name) target.searchParams.set("profile", profile.name)
      const response = await fetch(target, { signal: AbortSignal.timeout(2000) })
      const payload = await response.json()
      return sendJson(res, 200, { runtime: "fastapi-python", available: response.ok, url: options.pythonApiUrl, routing: payload })
    } catch (error) {
      return sendJson(res, 200, { runtime: "fastapi-python", available: false, url: options.pythonApiUrl, error: (error as Error).message })
    }
  }
  if (req.method === "GET" && url.pathname === "/api/rag/status") {
    return sendJson(res, 200, await ragIndexStatus())
  }
  if (req.method === "GET" && url.pathname === "/api/harness-context") {
    const input = url.searchParams.get("request")?.trim() || "inspect D3 harness context"
    const context = await buildHarnessTurnContext({
      ...state,
      input,
      eccRoot: config.hermes?.eccRoot ?? process.env.D3CODE_ECC_REPO,
      memoryEnabled: config.hermes?.memoryEnabled !== false,
      skillsEnabled: config.hermes?.enabled !== false,
    })
    return sendJson(res, 200, context)
  }
  if (req.method === "POST" && url.pathname === "/api/agent/cancel") {
    const body = await readJson(req) as { chat_id?: string }
    const chatId = body.chat_id?.trim() || "default"
    const job = agentJobsFor(state).get(chatId)
    if (!job || (job.status !== "running" && job.status !== "pending")) return sendJson(res, 200, { cancelled: false, chat_id: chatId })
    job.controller.abort(new Error("Stopped by operator"))
    return sendJson(res, 200, { cancelled: true, chat_id: chatId, job_id: job.id })
  }
  if (req.method === "POST" && url.pathname === "/api/agent/approval") {
    const body = await readJson(req) as Record<string, unknown>
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.chat_id !== "string" || typeof body.job_id !== "string" || typeof body.approval_id !== "string" || typeof body.approved !== "boolean") {
      return sendJson(res, 400, { error: "chat_id, job_id, approval_id and boolean approved are required." })
    }
    const job = agentJobsFor(state).get(body.chat_id)
    if (!job) return sendJson(res, 404, { error: "No agent job for this user and chat." })
    const approval = job.approval
    if (job.id !== body.job_id || job.status !== "running" || !approval || approval.id !== body.approval_id) return sendJson(res, 409, { error: "No matching pending approval." })
    if (Date.now() >= approval.expiresAt) {
      approval.resolve(false, "expired")
      return sendJson(res, 409, { error: "Approval expired. This action was not run." })
    }
    const profile = selectProfile(config, state.profile)
    if (state.safety === "plan" || !profile || profile.name !== approval.proposal.profile || recordConnection(profile) !== approval.proposal.connection) {
      approval.resolve(false, "invalidated")
      return sendJson(res, 409, { error: "Connection or permission settings changed. This action was not run." })
    }
    approval.resolve(body.approved)
    return sendJson(res, 200, { resolved: true, approved: body.approved, approval_id: body.approval_id })
  }
  if (req.method === "POST" && url.pathname === "/api/agent/reset") {
    const body = await readJson(req) as { chat_id?: string }
    const chatId = body.chat_id?.trim()
    resetAgentHistory(state, chatId)
    return sendJson(res, 200, { reset: true, chat_id: chatId })
  }
  if (req.method === "GET" && url.pathname === "/api/chats") {
    return sendJson(res, 200, { chats: await readChatStore() })
  }
  if (req.method === "POST" && url.pathname === "/api/chats") {
    const body = await readJson(req) as { chats?: unknown }
    const chats = Array.isArray(body.chats) ? body.chats.slice(0, 200) : []
    await writeChatStore(chats)
    return sendJson(res, 200, { saved: true, count: chats.length })
  }
  if (req.method === "GET" && url.pathname === "/api/agent/jobs") {
    const jobs = [...agentJobsFor(state).values()]
      .filter((job) => job.status === "running" || job.status === "pending")
      .map((job) => ({ job_id: job.id, chat_id: job.chatId, status: job.status, started_at: job.startedAt, pending_approval: approvalView(job) }))
    return sendJson(res, 200, { jobs })
  }
  if (req.method === "GET" && url.pathname === "/api/agent/job") {
    const chatId = url.searchParams.get("chat_id")
    if (!chatId) return sendJson(res, 400, { error: "chat_id is required" })
    const job = agentJobsFor(state).get(chatId)
    if (!job) return sendJson(res, 404, { error: "no agent job for this chat", status: "missing" })
    const since = Number(url.searchParams.get("since") ?? "0")
    return sendJson(res, 200, {
      job_id: job.id,
      chat_id: job.chatId,
      status: job.status,
      events: agentJobEventsSince(job, since),
      pending_approval: approvalView(job),
    })
  }
  if (req.method === "POST" && url.pathname === "/api/agent") {
    const body = await readJson(req) as { input?: string; chat_id?: string; history?: ChatMessage[] }
    if (!body.input) return sendJson(res, 400, { error: "input is required" })
    if (body.input.length > 32_000) return sendJson(res, 413, { error: "input exceeds the 32,000 character limit" })
    const chatId = body.chat_id?.trim() || "default"
    const clientHistory = Array.isArray(body.history)
      ? body.history.slice(-200).filter((message) => message && typeof message.content === "string" && message.content.length <= 32_000 && (message.role === "user" || message.role === "assistant" || message.role === "system"))
      : undefined
    const jobs = agentJobsFor(state)
    const existing = jobs.get(chatId)
    const wantsStream = (req.headers.accept ?? "").includes("text/event-stream") || url.searchParams.get("stream") === "1"
    if (existing && (existing.status === "running" || existing.status === "pending")) {
      if (wantsStream) {
        const since = Number(url.searchParams.get("since") ?? "0")
        startSse(res)
        try {
          await streamAgentJobToSse(res, existing, since)
        } catch (error) {
          if (!res.writableEnded) writeSse(res, "error", { error: (error as Error).message })
          if (!res.writableEnded) res.end()
        }
        return
      }
      return sendJson(res, 409, { error: "agent already running for this chat" })
    }
    const job = startAgentJob(config, state, options, chatId, body.input, clientHistory, userStates?.values())
    if (wantsStream) {
      startSse(res)
      try {
        await streamAgentJobToSse(res, job, 0)
      } catch (error) {
        if (!res.writableEnded) writeSse(res, "error", { error: (error as Error).message })
        if (!res.writableEnded) res.end()
      }
      return
    }
    try {
      const finished = await waitForAgentJob(job)
      const done = finished.events.find((event) => event.type === "done")?.data as { output?: string; tools?: unknown[] } | undefined
      const err = finished.events.find((event) => event.type === "error")?.data as { error?: string } | undefined
      if (finished.status === "error" || err) return sendJson(res, 500, { error: err?.error ?? "agent failed" })
      return sendJson(res, 200, {
        output: done?.output ?? "",
        tools: done?.tools ?? [],
      })
    } catch (error) {
      return sendJson(res, 500, { error: (error as Error).message })
    }
  }
  if (req.method === "POST" && url.pathname === "/api/terminal/send") {
    const body = await readJson(req) as { command?: string; confirmed?: boolean; profile?: string; connection?: string }
    if (!body.command) return sendJson(res, 400, { error: "command is required" })
    assertSelectedConnection(config, state, body, userScoped)
    try {
      const terminal = await runTerminalCommand(config, state, body.command, body.confirmed)
      return sendJson(res, 200, {
        label: terminal.label,
        result: terminal.clean,
        clean: terminal.clean,
        displayTranscript: terminal.displayTranscript,
        raw: terminal.result,
        transcript: terminal.transcript,
        rawTranscript: terminal.transcript,
        mechanism: terminal.mechanism,
      })
    } catch (error) {
      const message=error instanceof Error?error.message:String(error)
      const requiresConfirmation=message.startsWith("Confirmation required")
      const permissionDenied=/Denied by|outside the allowed accounts/i.test(message)
      return sendJson(res,requiresConfirmation?409:permissionDenied?403:500,{error:message,requiresConfirmation,permissionDenied})
    }
  }
  if (req.method === "GET" && url.pathname === "/api/terminal/state") {
    const profile = selectProfile(config, state.profile)
    const key = terminalKey(profile?.name)
    return sendJson(res, 200, {
      profile: profile?.name,
      account: profile?.account,
      connection: profile ? recordConnection(profile) : undefined,
      transcript: terminalTranscriptsFor(state).get(key) ?? "",
      displayTranscript: terminalDisplayTranscriptsFor(state).get(key) ?? "",
      connected: terminalSessionsFor(state).has(key),
      mechanism: profile?.sessionMode === "persistent" ? "persistent-pty" : profile ? "oneshot-command" : "not-configured",
    })
  }
  if (req.method === "POST" && url.pathname === "/api/terminal/reset") {
    const body = await readJson(req) as { profile?: string; connection?: string }
    assertSelectedConnection(config, state, body, userScoped)
    const profile = selectProfile(config, state.profile)
    const key = terminalKey(profile?.name)
    terminalTranscriptsFor(state).delete(key)
    terminalDisplayTranscriptsFor(state).delete(key)
    await closeTerminalSession(state, profile?.name)
    return sendJson(res, 200, { reset: true, profile: profile?.name })
  }
  if (req.method === "POST" && url.pathname === "/api/terminal/clear") {
    const profile = selectProfile(config, state.profile)
    const key = terminalKey(profile?.name)
    terminalTranscriptsFor(state).delete(key)
    terminalDisplayTranscriptsFor(state).delete(key)
    return sendJson(res, 200, { cleared: true, profile: profile?.name, connected: terminalSessionsFor(state).has(key) })
  }
  if (req.method === "GET" && url.pathname === "/api/browser") {
    const profileName = url.searchParams.get("profile") ?? state.profile
    const profile = selectProfile(config, profileName)
    if (!profile) return sendJson(res, 404, { error: "profile not found" })
    const session = createD3Session(profile)
    try {
      const timeoutMs = profile.type === "ssh" ? 45_000 : 15_000
      const report = await inspectD3Browser(session, { limit: 200, timeoutMs })
      return sendJson(res, 200, {
        profile: profile.name,
        account: profile.account,
        who: report.who,
        fileCount: report.fileCount,
        limited: report.limited,
        categories: report.categories,
      })
    } catch (error) {
      return sendJson(res, 500, { error: humanizeD3ConnectError((error as Error).message, profile) })
    } finally {
      await session.close().catch(() => {})
    }
  }
  if (req.method === "GET" && url.pathname === "/api/dictionary-fields") {
    const profile = selectProfile(config, state.profile)
    if (!profile) return sendJson(res, 404, { error: "No D3 profile selected" })
    if (url.searchParams.get("profile") !== profile.name) return sendJson(res, 409, { error: "Connection changed. Field names were not loaded." })
    const session = createD3Session(profile)
    try { return sendJson(res, 200, await readDictionaryFields(session, url.searchParams.get("file") ?? "", state.safety)) }
    catch (error) { return sendJson(res, 400, { error: humanizeD3ConnectError((error as Error).message, profile) }) }
    finally { await session.close().catch(() => {}) }
  }
  if (req.method === "GET" && url.pathname === "/api/items") {
    const profile=selectProfile(config,state.profile)
    if(!profile)return sendJson(res,404,{error:"No D3 profile selected"})
    const section=url.searchParams.get("section")??"data"
    if(section!=="data"&&section!=="dict")return sendJson(res,400,{error:"Section must be data or dict"})
    const session=createD3Session(profile)
    try{return sendJson(res,200,await listD3Items(session,url.searchParams.get("file")??"",{section,limit:Number(url.searchParams.get("limit")??100),prefix:url.searchParams.get("prefix")??undefined,timeoutMs:45000}))}
    catch(error){return sendJson(res,400,{error:humanizeD3ConnectError((error as Error).message,profile)})}
    finally{await session.close().catch(()=>{})}
  }
  if (req.method === "GET" && url.pathname === "/api/files") {
    const result = await runToolByName(config, { name: "d3_list_files", safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/locks") {
    const result = await runToolByName(config, { name: "d3_locks", safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/index") {
    const body = await readJson(req) as { saveAs?: string }
    const result = await runToolByName(config, { name: "d3_index_account", input: { saveAs: body.saveAs }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if ((["GET", "PUT", "POST"].includes(req.method ?? "") && url.pathname === "/api/record") || (req.method === "GET" && url.pathname === "/api/record/new")) {
    try {
      const profile = selectProfile(config, state.profile)
      if (!profile) return sendJson(res, 400, { error: "Select a D3 connection first." })
      const input = req.method === "GET" ? Object.fromEntries(url.searchParams) : await readJson(req)
      if (!input || typeof input !== "object" || Array.isArray(input)) return sendJson(res, 400, { error: "Record request must be an object." })
      const value = req.method === "GET"
        ? await (url.pathname === "/api/record/new" ? prepareEditorRecord : readEditorRecord)(profile, input as Record<string, unknown>, options.recordOperation)
        : await (req.method === "POST" ? createEditorRecord : saveEditorRecord)(profile, state.safety, input as Record<string, unknown>, options.recordOperation)
      return sendJson(res, req.method === "POST" ? 201 : 200, value)
    } catch (error) {
      if (error instanceof EditorRecordError) return sendJson(res, error.status, { error: error.message, bridgeUnavailable: error.bridgeUnavailable })
      throw error
    }
  }
  if (req.method === "GET" && url.pathname === "/api/item") {
    if (url.searchParams.has("profile") && url.searchParams.get("profile") !== selectProfile(config, state.profile)?.name) return sendJson(res, 409, { error: "Connection changed. Select the connection again before opening an item." })
    const result = await runToolByName(config, { name: "d3_read_item", input: { file: url.searchParams.get("file"), item: url.searchParams.get("item") }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, editorReadPayload(result))
  }
  if (req.method === "PUT" && url.pathname === "/api/item") {
    const body = await readJson(req) as { file?: string; item?: string; body?: string; baseline?: unknown; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_write_item", input: { file: body.file, item: body.item, body: body.body ?? "", baseline: body.baseline, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/file/create") {
    const body = await readJson(req) as { file?: string; dictModulo?: number; dataModulo?: number; dictionaryOnly?: boolean; dataOnlyDictionary?: string; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_create_file", input: body, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/dict") {
    if (url.searchParams.has("profile") && url.searchParams.get("profile") !== selectProfile(config, state.profile)?.name) return sendJson(res, 409, { error: "Connection changed. Select the connection again before opening an item." })
    const result = await runToolByName(config, { name: "d3_read_dict", input: { file: url.searchParams.get("file"), item: url.searchParams.get("item") }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, editorReadPayload(result))
  }
  if (req.method === "PUT" && url.pathname === "/api/dict") {
    const body = await readJson(req) as { file?: string; item?: string; body?: string; baseline?: unknown; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_write_dict", input: { file: body.file, item: body.item, body: body.body ?? "", baseline: body.baseline, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/aql") {
    const body = await readJson(req) as { query?: string }
    if (!body.query) return sendJson(res, 400, { error: "query is required" })
    const result = await runToolByName(config, { name: "d3_query_aql", input: { query: body.query }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && ["/api/basic/compile", "/api/basic/catalog", "/api/basic/run"].includes(url.pathname)) {
    const body = await readJson(req) as { file?: string; item?: string; global?: boolean; confirmed?: boolean; profile?: string; connection?: string }
    assertSelectedConnection(config, state, body, userScoped)
    const name = url.pathname === "/api/basic/catalog" ? "d3_catalog" : url.pathname === "/api/basic/run" ? "d3_run_basic" : "d3_compile_basic"
    const input = { file: body.file, item: body.item, confirmed: body.confirmed, ...(name === "d3_catalog" ? { global: body.global } : {}) }
    const result = await runToolByName(config, { name, input, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/basic/build") {
    const body = await readJson(req) as { file?: string; item?: string; source?: string; baseline?: unknown; compile?: boolean; catalog?: boolean; global?: boolean; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_build_basic_program", input: body, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/sbplus/plan") {
    const body = await readJson(req) as { system?: string; process?: string; kind?: string; file?: string; fields?: string[]; notes?: string }
    const result = await runToolByName(config, { name: "d3_sbplus_plan", input: body, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/sbplus/discover") {
    const result = await runToolByName(config, { name: "d3_sbplus_discover", input: { limit: Number(url.searchParams.get("limit") ?? "300") }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/subroutine/call") {
    const body = await readJson(req) as { name?: string; args?: string[]; confirmed?: boolean }
    if (!body.name) return sendJson(res, 400, { error: "subroutine name is required" })
    const result = await runToolByName(config, { name: "d3_call_subroutine", input: { name: body.name, args: body.args ?? [], confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/search") {
    const result = await runToolByName(config, { name: "d3_search", input: { query: url.searchParams.get("query") ?? "" }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/manual-search") {
    const result = await runToolByName(config, { name: "d3_manual_search", input: { query: url.searchParams.get("query") ?? "" }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/rag-search") {
    const result = await runToolByName(config, { name: "d3_rag_search", input: { query: url.searchParams.get("query") ?? "", limit: Number(url.searchParams.get("limit") ?? "8") }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  return sendJson(res, 404, { error: "not found" })
}

export async function startIdeServer(config: D3CodeConfig, state: IdeRuntimeState, options: IdeServerOptions = {}): Promise<IdeServerHandle> {
  const host = options.host ?? "127.0.0.1"
  const requestedPort = options.port ?? 3737
  const key = `${host}:${requestedPort}:${state.profile ?? config.defaultProfile ?? "default"}`
  const existing = running.get(key)
  if (existing) return existing
  const requireAuth = options.requireAuth ?? (process.env.D3CODE_REQUIRE_AUTH === "1" || isPublicIdeHost(host))
  if (requireAuth && !config.ideAuth) throw new Error("Public IDE access requires configured credentials. Run `d3code ide setup-auth` first.")
  const credentials = resolveIdeAuth(config)
  const embedded = Boolean(process.env.D3CODE_STORAGE_NAMESPACE)
  if (embedded && !requireAuth) throw new Error("Embedded IDE user isolation requires authenticated proxy access.")
  const userStates = new Map<string, IdeRuntimeState>()
  const initialState = { model: state.model, safety: state.safety, mode: state.mode, profile: state.profile, project: state.project }
  const server = createServer((req, res) => {
    if (requireAuth && !isBasicAuthValid(req.headers.authorization, credentials)) {
      sendAuthRequired(res)
      return
    }
    const origin = req.headers.origin
    if (origin && req.method !== "GET" && req.method !== "HEAD") {
      try {
        if (new URL(origin).host !== req.headers.host) return sendJson(res, 403, { error: "Cross-origin state change blocked." })
      } catch {
        return sendJson(res, 403, { error: "Invalid request origin." })
      }
    }
    let requestState = state
    if (embedded) {
      const actor = req.headers["x-d3code-user"]
      if (typeof actor !== "string" || !/^[1-9]\d{0,18}$/.test(actor)) return sendJson(res, 403, { error: "Trusted workspace user identity is required." })
      requestState = userStates.get(actor) ?? {
        ...initialState,
        profile: config.profiles.some(profile => profile.name === initialState.profile) ? initialState.profile : config.defaultProfile,
      }
      userStates.set(actor, requestState)
    }
    route(req, res, config, requestState, options, embedded ? userStates : undefined).catch((error) => sendJson(res, Number((error as { statusCode?: number }).statusCode) || 500, { error: (error as Error).message }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(requestedPort, host, () => {
      server.off("error", reject)
      resolve()
    })
  })
  const address = server.address() as AddressInfo
  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    for (const runtime of [state, ...userStates.values()]) {
      resetAgentHistory(runtime)
      await closeAllTerminalSessions(runtime)
    }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
  const handle = { host, port: address.port, url: `http://${host}:${address.port}`, server, close }
  running.set(key, handle)
  return handle
}

export async function stopIdeServers(): Promise<void> {
  const handles = [...running.values()]
  running.clear()
  await Promise.all(handles.map((handle) => handle.close()))
}
