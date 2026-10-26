import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"
import { runInNewContext } from "node:vm"
import { workspaceStateClientScript } from "../src/ide/workspace-state.js"
import { startIdeServer } from "../src/ide/server.js"

let script = ""
test.before(async () => {
  const server = await startIdeServer({ version: 1, defaultModel: "openai/test", defaultSafety: "ask", modelSecrets: {}, profiles: [] }, { model: "openai/test", safety: "ask", mode: "chat" }, { port: 0 })
  try { script = await fetch(server.url).then(response => response.text()) } finally { await server.close() }
})
const fn = (name: string) => {
  const content = script.slice(script.lastIndexOf("<script>") + 8, script.lastIndexOf("</script>"))
  const source = ts.createSourceFile("client.js", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const value = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name)
  assert.ok(value, name);return value.getText(source)
}

test("startup status exposes retry and never changes the drafts", async () => {
  const fields = Object.fromEntries(["chatPrompt", "agentPrompt", "terminalAgentPrompt"].map(id => [id, { value: "draft", attributes: {} as Record<string, string>, setAttribute(key: string, value: string) { this.attributes[key] = value } }]))
  const statuses = Array.from({ length: 3 }, () => { const span = { textContent: "" }, retry = { hidden: true, onclick: async () => {} };return { hidden: false, dataset: {}, span, retry, querySelector: (selector: string) => selector === "span" ? span : retry } })
  let retries = 0
  const context = { $: (id: string) => fields[id], document: { querySelectorAll: () => statuses }, syncAgentSendButtons() {}, applyChatInputPlaceholders() {}, boot: async () => { retries++ } }
  const ui = runInNewContext(workspaceStateClientScript() + ";({set:setWorkspaceState})", context) as { set(state: string): void }
  ui.set("loading");assert.equal(fields.chatPrompt!.attributes["aria-busy"], "true")
  ui.set("error");assert.ok(statuses.every(status => !status.hidden && !status.retry.hidden && /draft is kept/.test(status.span.textContent)))
  await statuses[0]!.retry.onclick();assert.equal(retries, 1)
  ui.set("ready");assert.ok(statuses.every(status => status.hidden));assert.equal(fields.chatPrompt!.attributes["aria-busy"], "false")
  assert.ok(Object.values(fields).every(field => field.value === "draft"))
})

test("loading and failed startup preserve input and attachments without sending", async () => {
  for (const workspaceState of ["loading", "error"]) {
    const input = { value: "D3 draft" }, attachment = { text: "context" }, messages: string[] = []
    const context = { workspaceState, activeChatId: "one", busyChatIds: new Set(), $: () => input, composerAttachments: [attachment], toast: (message: string) => messages.push(message) }
    await runInNewContext(fn("sendPrompt") + ";sendPrompt('chatPrompt')", context)
    assert.equal(input.value, "D3 draft");assert.deepEqual(context.composerAttachments, [attachment]);assert.match(messages[0]!, /draft is kept/)
  }
})

test("Stop remains available while the workspace refreshes", async () => {
  let stopped = ""
  await runInNewContext(fn("sendPrompt") + ";sendPrompt('chatPrompt')", { workspaceState: "loading", activeChatId: "one", busyChatIds: new Set(["one"]), cancelAgentRun: async (id: string) => { stopped = id } })
  assert.equal(stopped, "one")
  for (const workspaceState of ["loading", "error", "ready"]) for (const busy of [false, true]) {
    const button = { disabled: false, dataset: {} as Record<string, string>, innerHTML: "Send", title: "", attributes: {} as Record<string, string>, setAttribute(key: string, value: string) { this.attributes[key] = value } }
    runInNewContext(fn("syncAgentSendButtons") + ";syncAgentSendButtons()", { workspaceState, activeChatId: "one", busyChatIds: new Set(busy ? ["one"] : []), document: { querySelectorAll: () => [button] } })
    assert.equal(button.disabled, !busy && workspaceState !== "ready");if (busy) assert.equal(button.attributes["aria-label"], "Stop agent")
  }
})

function bootContext(api: (path: string) => Promise<unknown>) {
  const states: string[] = [], options: unknown[] = []
  return { api, states, options, workspaceLoad: 0, profileCache: [], document: { body: { dataset: { view: "chat" } } }, setWorkspaceState: (state: string) => states.push(state), applyStatus: async () => {}, renderTerminalProfiles() {}, refreshTerminalState: async () => {}, migrateChatProfiles() {}, syncActiveChatForProfile() {}, renderChatList() {}, renderD3Browser() {}, renderActiveChat() {}, renderTerminal() {}, resumeAgentJobs: async () => {}, refreshWorkspaceOptions: (status: unknown) => { options.push(status);return new Promise(() => {}) } }
}

test("core startup becomes ready without waiting for optional model metadata", async () => {
  const context = bootContext(async path => path === "/api/status" ? { model: "openai/test", safety: "ask", profile: "demo" } : { profiles: [] })
  await runInNewContext(fn("boot") + ";boot()", context)
  assert.deepEqual(context.states, ["loading", "ready"]);assert.equal(context.options.length, 1)
})

test("failed core responses enter retry state without starting optional requests", async () => {
  const context = bootContext(async () => ({ error: "denied" }))
  await assert.rejects(runInNewContext(fn("boot") + ";boot()", context), /Workspace status unavailable/)
  assert.deepEqual(context.states, ["loading", "error"]);assert.equal(context.options.length, 0)
})

test("an older startup response cannot replace a newer ready workspace", async () => {
  let release: (value: unknown) => void = () => {}, calls = 0
  const first = new Promise(resolve => { release = resolve })
  const context = bootContext(async path => path === "/api/status" ? (++calls === 1 ? first : { model: "openai/new" }) : { profiles: [] })
  const ui = runInNewContext(fn("boot") + ";({boot})", context) as { boot(): Promise<void> }
  const older = ui.boot();await ui.boot();release({ model: "openai/old" });await older
  assert.deepEqual(context.states, ["loading", "loading", "ready"]);assert.equal(context.options.length, 1)
  assert.equal((context.options[0] as { model: string }).model, "openai/new")
})
