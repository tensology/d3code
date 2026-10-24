import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import type { D3Session } from "../src/domain/types.js"
import { basicAuthHeader, defaultIdeAuth } from "../src/ide/auth.js"
import { startIdeServer, stopIdeServers, type IdeRuntimeState, type IdeServerOptions } from "../src/ide/server.js"
import { handleSlashCommand } from "../src/tui/commands.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  defaultProfile: "fake",
  profiles: [{
    name: "fake",
    type: "local",
    account: "DM",
    entryCommand: "node -e \"process.stdin.on('data',d=>{const s=d.toString(); if(s.includes('LIST MD')) console.log('CUSTOMERS D Customer file\\nBP D Programs\\nVOC D Screens\\nMD D System'); else if(s.includes('LIST-LOCKS')) console.log('No locks'); else if(s.includes('BASIC')) console.log('BASIC OK'); else if(s.includes('CATALOG')) console.log('CATALOG OK'); else if(s.includes('CALL')) console.log('CALL OK'); else if(s.includes('LIST CUSTOMERS')) console.log('100 Alice'); else if(s.includes('LOGTO SALES')) console.log('SALES'); else if(s.includes('WHO')) console.log('DM'); else if(s.includes('CT DICT')) console.log('DICT ITEM'); else if(s.includes('CT')) console.log('ITEM BODY'); else console.log('OK')})\"",
    promptPattern: ">",
    sessionMode: "oneshot",
  }, {
    name: "alt",
    type: "local",
    account: "SALES",
    entryCommand: "node -e \"process.stdin.on('data',()=>console.log('SALES'))\"",
    promptPattern: ">",
    sessionMode: "oneshot",
  }],
  modelSecrets: {},
}

function startTestIdeServer(config: D3CodeConfig, state: IdeRuntimeState, options: IdeServerOptions = {}) {
  return startIdeServer(config, state, { ...options, saveConfigFn: async () => {} })
}

test.afterEach(async () => {
  await stopIdeServers()
})

test("IDE server serves browser shell and D3 profile APIs", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const shellResponse = await fetch(server.url)
  const html = await shellResponse.text()
  assert.equal(shellResponse.headers.get("x-content-type-options"), "nosniff")
  assert.equal(shellResponse.headers.get("x-frame-options"), "DENY")
  assert.match(shellResponse.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/)
  assert.match(html, /D3 Code IDE/)
  assert.match(html, /D3 Browser/)
  assert.match(html, /D3 Screen/)
  assert.match(html, /Live terminal \/ screen output/)
  assert.match(html, /id="d3Browser"/)
  assert.match(html, /id="editorScreen"/)
  assert.match(html, /mutationConfirmed\(\)/)
  assert.doesNotMatch(html, /confirm mutation-risk runtime command/)
  assert.doesNotMatch(html, /confirm D3 item write/)
  assert.match(html, /tabindex="0"/)
  assert.match(html, /sendTerminalCommand\(terminalDraft\)/)
  assert.match(html, /id="terminalCommand"/)
  assert.match(html, /id="terminalSessionMark"/)
  assert.match(html, /id="terminalReconnect"/)
  assert.match(html, /Persistent SSH PTY/)
  assert.match(html, /terminalHistoryStep/)
  assert.match(html, /id="editorTerminalCommand"/)
  assert.match(html, /bindTerminalCommandInput/)
  assert.match(html, /Startup input/)
  assert.match(html, /Item \/ BASIC Editor/)
  assert.match(html, /Agent/)
  assert.match(html, /Compile/)
  assert.match(html, /Build BASIC/)
  assert.match(html, /Write Dict/)
  assert.match(html, /Create File/)
  assert.match(html, /SB\+ Discover/)
  assert.match(html, /SB\+ Plan/)
  assert.match(html, /id="capabilitiesPanel"/)
  assert.match(html, /sessions-tree/)
  assert.match(html, /session-profile-new-chat/)
  assert.match(html, /session-profile-menu/)
  assert.match(html, /session-chat-icon/)
  assert.match(html, /session-chat-selected/)
  assert.match(html, /Selected/)
  assert.doesNotMatch(html, /session-chat-menu/)
  assert.doesNotMatch(html, /session-profile-edit/)
  assert.match(html, /id="profileContextMenu"/)
  assert.match(html, /sessions-settings/)
  assert.match(html, /id="settingsModal"/)
  assert.doesNotMatch(html, /id="profileMenuButton"/)
  assert.match(html, /sessions-add-profile/)
  assert.match(html, /id="actionPopover"/)
  assert.match(html, /id="fileUpload"/)
  assert.match(html, /id="photoUpload"/)
  assert.match(html, /id="planModeAction"/)
  assert.match(html, /attachmentPromptPrefix/)
  assert.match(html, /sameBubble/)
  assert.match(html, /normalizeChatMessages/)
  assert.match(html, /AGENT_EVENT_STORE/)
  assert.match(html, /shouldProcessAgentEvent/)
  assert.match(html, /runKey/)
  assert.match(html, /id="mobilePanelButton"/)
  assert.match(html, /class="chat-welcome"/)
  assert.match(html, /editor-action-group/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /prefers-reduced-motion:reduce/)
  assert.match(html, /role="dialog"/)
  assert.match(html, /Review connection/)
  assert.match(html, /id="profileConnectionBanner"/)
  assert.match(html, /renderProfileConnectionBanner/)
  assert.match(html, /profile-connection-retry/)
  assert.match(html, /composer-wrap textarea:focus-visible\{outline:none\}/)
  assert.match(html, /markdownHtmlV2/)
  assert.match(html, /<table><thead>/)
  assert.match(html, /message-body blockquote/)
  assert.match(html, /message-body ol/)
  assert.match(html, /\/harness-context/)
  assert.match(html, /\/api\/agent\/cancel/)
  assert.match(html, /slice\(-200\)/)

  const status = await fetch(`${server.url}/api/status`).then((response) => response.json()) as { profile: string; account: string; mode: string }
  assert.equal(status.profile, "fake")
  assert.equal(status.account, "DM")
  assert.equal(status.mode, "chat")

  const profiles = await fetch(`${server.url}/api/profiles`).then((response) => response.json()) as { profiles: Array<{ name: string }> }
  assert.deepEqual(profiles.profiles.map((profile) => profile.name), ["fake", "alt"])

  const favicon = await fetch(`${server.url}/favicon.ico`)
  assert.equal(favicon.status, 204)
})

test("IDE exposes the same project memory and skill harness context as the terminal", async () => {
  const root = join(tmpdir(), `d3code-ide-context-${Date.now()}`)
  await mkdir(join(root, ".d3code", "memory"), { recursive: true })
  await writeFile(join(root, ".d3code", "memory", "active.md"), "Current D3 evidence: preserve CUSTOMER multivalues.")
  const server = await startTestIdeServer(config, {
    model: "openai/gpt-5",
    safety: "ask",
    profile: "fake",
    mode: "audit",
    project: { cwd: root, root, instructions: [] },
  }, { port: 0 })

  const context = await fetch(`${server.url}/api/harness-context?request=review%20CUSTOMER%20D3`).then((response) => response.json()) as { text: string; workspaceMemoryFiles: string[] }
  assert.match(context.text, /preserve CUSTOMER multivalues/)
  assert.equal(context.workspaceMemoryFiles.length, 1)
  const statusText = await fetch(`${server.url}/api/status`).then((response) => response.text())
  assert.doesNotMatch(statusText, /preserve CUSTOMER multivalues/)
})

test("IDE blocks cross-origin state changes", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })
  const response = await fetch(`${server.url}/api/config/safety`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ safety: "trust" }),
  })
  assert.equal(response.status, 403)
  assert.equal(config.defaultSafety, "ask")
})

test("IDE can cancel a running agent job", async () => {
  const agentChatFn: NonNullable<IdeServerOptions["agentChatFn"]> = async (_config, _secrets, request) => new Promise((_resolve, reject) => {
    request.signal?.addEventListener("abort", () => reject(request.signal?.reason ?? new Error("aborted")), { once: true })
  })
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0, agentChatFn })
  const chatId = "cancel-test"
  const pending = fetch(`${server.url}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, input: "inspect D3 files" }),
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  const cancelled = await fetch(`${server.url}/api/agent/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  }).then((response) => response.json()) as { cancelled: boolean }
  const result = await pending.then((response) => response.json()) as { output: string }

  assert.equal(cancelled.cancelled, true)
  assert.match(result.output, /Stopped/)
})

test("IDE server exposes categorized D3 browser data", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const browser = await fetch(`${server.url}/api/browser?profile=fake`).then((response) => response.json()) as {
    profile: string
    account: string
    who: string
    categories: Array<{ id: string; label: string; files: Array<{ name: string; kind: string }> }>
  }

  assert.equal(browser.profile, "fake")
  assert.equal(browser.account, "DM")
  assert.match(browser.who, /DM/)
  const names = browser.categories.flatMap((category) => category.files.map((file) => [category.id, file.name, file.kind]))
  assert.deepEqual(names, [
    ["data", "CUSTOMERS", "data"],
    ["programs", "BP", "program"],
    ["screens", "VOC", "screen"],
    ["system", "MD", "system"],
  ])
})

test("IDE server updates model and permission defaults from browser controls", async () => {
  const editableConfig: D3CodeConfig = { ...config, profiles: config.profiles.map((profile) => ({ ...profile })) }
  const server = await startTestIdeServer(editableConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const providers = await fetch(`${server.url}/api/model-providers`).then((response) => response.json()) as { providers: Array<{ id: string }> }
  assert.ok(providers.providers.some((provider) => provider.id === "kilocode"))

  const html = await fetch(server.url).then((response) => response.text())
  assert.doesNotMatch(html, /modelExact/)

  const openaiModels = await fetch(`${server.url}/api/models?provider=openai`).then((response) => response.json()) as { models: string[]; needsKey?: boolean }
  if (!process.env.OPENAI_API_KEY) {
    assert.equal(openaiModels.needsKey, true)
    assert.deepEqual(openaiModels.models, [])
  }

  const models = await fetch(`${server.url}/api/models?provider=ollama`).then((response) => response.json()) as { models: string[] }
  assert.ok(models.models.includes("llama3.1"))

  const safety = await fetch(`${server.url}/api/config/safety`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ safety: "trust" }),
  }).then((response) => response.json()) as { safety: string }
  assert.equal(safety.safety, "trust")
  assert.equal(editableConfig.defaultSafety, "trust")
  assert.equal(editableConfig.profiles.find((profile) => profile.name === "fake")?.safetyDefault, "trust")

  const model = await fetch(`${server.url}/api/config/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "kilocode/kilo-auto/free" }),
  }).then((response) => response.json()) as { model: string }
  assert.equal(model.model, "kilocode/kilo-auto/free")
  assert.equal(editableConfig.defaultModel, "kilocode/kilo-auto/free")
})

test("IDE server requires basic auth when public", async () => {
  const secureConfig = { ...config, ideAuth: defaultIdeAuth }
  const server = await startTestIdeServer(secureConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { host: "0.0.0.0", port: 0 })
  const url = `http://127.0.0.1:${server.port}`

  const denied = await fetch(url)
  assert.equal(denied.status, 401)
  assert.match(denied.headers.get("www-authenticate") ?? "", /Basic realm="D3 Code IDE"/)

  const allowed = await fetch(url, { headers: { authorization: basicAuthHeader(defaultIdeAuth) } })
  assert.equal(allowed.status, 200)
  assert.match(await allowed.text(), /D3 Code IDE/)
})

test("IDE refuses public binding with default implicit credentials", async () => {
  await assert.rejects(
    startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { host: "0.0.0.0", port: 0 }),
    /setup-auth/,
  )
})

test("IDE server normalizes browser-created D3 profiles for terminal emulation", async () => {
  const server = await startTestIdeServer({ ...config, profiles: [...config.profiles] }, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/profile/manage`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirmed: true,
      profile: {
        name: "browser-d3",
        type: "local",
        account: "dm",
        entryCommand: "d3",
        startupInput: "dm\\ndm\\n",
        promptPattern: ":",
        sessionMode: "persistent",
        safetyDefault: "ask",
      },
    }),
  })
  const payload = await response.json() as { profile: string }
  assert.equal(response.status, 200)
  assert.equal(payload.profile, "browser-d3")

  const profiles = await fetch(`${server.url}/api/profiles`).then((res) => res.json()) as { profiles: Array<{ name: string; startupInput?: string; promptPattern?: string }> }
  const saved = profiles.profiles.find((profile) => profile.name === "browser-d3")
  assert.equal(saved?.startupInput, "dm\rdm\r")
  assert.equal(saved?.promptPattern, "(^|\\n):\\s*$")
})

test("IDE server updates an existing profile instead of duplicating it", async () => {
  const server = await startTestIdeServer(
    {
      ...config,
      profiles: [{
        name: "office",
        type: "ssh",
        host: "office.example.com",
        username: "dm",
        account: "DM",
        entryCommand: "d3",
        promptPattern: ":",
        sessionMode: "oneshot",
        safetyDefault: "ask",
      }],
      defaultProfile: "office",
    },
    { model: "openai/gpt-5", safety: "ask", profile: "office", mode: "chat" },
    { port: 0 },
  )

  const response = await fetch(`${server.url}/api/profile/manage`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirmed: true,
      previousName: "office",
      profile: {
        name: "office",
        type: "ssh",
        host: "office.crystallogic.org",
        username: "dm",
        account: "DM",
        entryCommand: "d3",
        promptPattern: ":",
        sessionMode: "oneshot",
        safetyDefault: "ask",
      },
    }),
  })
  assert.equal(response.status, 200)

  const profiles = await fetch(`${server.url}/api/profiles`).then((res) => res.json()) as {
    profiles: Array<{ name: string; host?: string }>
  }
  assert.equal(profiles.profiles.length, 1)
  assert.equal(profiles.profiles[0]?.name, "office")
  assert.equal(profiles.profiles[0]?.host, "office.crystallogic.org")
})

test("IDE server exposes terminal send through guarded D3 tool layer", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/terminal/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: "WHO" }),
  })
  const payload = await response.json() as { result: string; clean: string; label: string; transcript: string; rawTranscript: string }

  assert.equal(response.status, 200)
  assert.equal(payload.label, "TCL output")
  assert.equal(payload.clean, payload.result)
  assert.match(payload.result, /DM|OK/)
  assert.match(payload.transcript, /> WHO/)
  assert.equal(payload.rawTranscript, payload.transcript)
})

test("IDE terminal keeps a profile-scoped transcript and persistent local session", async () => {
  const terminalConfig: D3CodeConfig = {
    ...config,
    defaultProfile: "terminal",
    profiles: [{
      name: "terminal",
      type: "local",
      account: "DM",
      sessionMode: "persistent",
      safetyDefault: "trust",
    }],
  }
  const server = await startTestIdeServer(terminalConfig, { model: "openai/gpt-5", safety: "trust", profile: "terminal", mode: "chat" }, { port: 0 })

  const first = await fetch(`${server.url}/api/terminal/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: "D3CODE_STATE=kept", confirmed: true }),
  }).then((response) => response.json()) as { transcript: string; displayTranscript: string; mechanism: string }
  assert.equal(first.mechanism, "persistent-pty")
  assert.match(first.transcript, /> D3CODE_STATE=kept/)
  assert.match(first.displayTranscript, /> D3CODE_STATE=kept/)

  const second = await fetch(`${server.url}/api/terminal/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: "printf %s \"$D3CODE_STATE\"", confirmed: true }),
  }).then((response) => response.json()) as { transcript: string; displayTranscript: string; result: string }
  assert.match(second.transcript, /> D3CODE_STATE=kept/)
  assert.match(second.transcript, /> printf %s/)
  assert.match(second.transcript, /kept/)
  assert.match(second.displayTranscript, /> printf %s/)

  const state = await fetch(`${server.url}/api/terminal/state`).then((response) => response.json()) as { transcript: string; displayTranscript: string; connected: boolean; mechanism: string }
  assert.equal(state.connected, true)
  assert.equal(state.mechanism, "persistent-pty")
  assert.match(state.transcript, /kept/)
  assert.match(state.displayTranscript, /kept/)

  const cleared = await fetch(`${server.url}/api/terminal/clear`, { method: "POST" }).then((response) => response.json()) as { cleared: boolean; connected: boolean }
  assert.equal(cleared.cleared, true)
  assert.equal(cleared.connected, true)
  const clearedState = await fetch(`${server.url}/api/terminal/state`).then((response) => response.json()) as { transcript: string; connected: boolean }
  assert.equal(clearedState.transcript, "")
  assert.equal(clearedState.connected, true)

  await fetch(`${server.url}/api/terminal/reset`, { method: "POST" })
})

test("IDE closes the active terminal connection when switching profiles", async () => {
  let closeCount = 0
  const session: D3Session = {
    profile: config.profiles[0]!,
    run: async () => ({ command: "WHO", stdout: "DM", stderr: "", exitCode: 0, durationMs: 1 }),
    close: async () => { closeCount += 1 },
  }
  const state: IdeRuntimeState = {
    model: "openai/gpt-5",
    safety: "ask",
    profile: "fake",
    mode: "chat",
    terminalSessions: new Map([["fake", session]]),
  }
  const server = await startTestIdeServer(config, state, { port: 0 })

  await fetch(`${server.url}/api/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile: "alt" }),
  })

  assert.equal(closeCount, 1)
  assert.equal(state.terminalSessions?.size, 0)
})

test("IDE shutdown closes every retained terminal connection", async () => {
  let closeCount = 0
  const session: D3Session = {
    profile: config.profiles[0]!,
    run: async () => ({ command: "WHO", stdout: "DM", stderr: "", exitCode: 0, durationMs: 1 }),
    close: async () => { closeCount += 1 },
  }
  const state: IdeRuntimeState = {
    model: "openai/gpt-5",
    safety: "ask",
    profile: "fake",
    mode: "chat",
    terminalSessions: new Map([["fake", session]]),
  }
  const server = await startTestIdeServer(config, state, { port: 0 })

  await server.close()

  assert.equal(closeCount, 1)
  assert.equal(state.terminalSessions?.size, 0)
})

test("IDE server exposes tool-routing status so tools are not treated as TCL-only", async () => {
  const routeConfig: D3CodeConfig = {
    ...config,
    profiles: [{
      name: "terminal",
      type: "local",
      account: "DM",
      sessionMode: "persistent",
      promptPattern: ":",
    }],
    defaultProfile: "terminal",
  }
  const server = await startTestIdeServer(routeConfig, { model: "openai/gpt-5", safety: "ask", profile: "terminal", mode: "chat" }, { port: 0 })

  const status = await fetch(`${server.url}/api/tool-routing`).then((response) => response.json()) as {
    terminalReady: boolean
    d3pyAvailable: boolean
    routes: Array<{ mechanism: string; status: string; bestFor: string[] }>
  }
  assert.equal(status.terminalReady, true)
  assert.ok(status.routes.some((route) => route.mechanism === "typed-tcl" && route.status === "ready"))
  assert.ok(status.routes.some((route) => route.mechanism === "persistent-pty" && route.status === "ready" && route.bestFor.some((item) => /System Builder/.test(item))))
  assert.ok(status.routes.some((route) => route.mechanism === "d3py-uopy"))
})

test("IDE server exposes D3/SB+ builder capabilities and build endpoints", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const capabilities = await fetch(`${server.url}/api/capabilities`).then((response) => response.json()) as {
    capabilities: Array<{ id: string; tools: string[] }>
  }
  assert.ok(capabilities.capabilities.some((capability) => capability.id === "program-builder" && capability.tools.includes("d3_build_basic_program")))
  assert.ok(capabilities.capabilities.some((capability) => capability.id === "sbplus-builder" && capability.tools.includes("d3_sbplus_discover") && capability.tools.includes("d3_sbplus_plan")))

  const tools = await fetch(`${server.url}/api/tools`).then((response) => response.json()) as { tools: Array<{ name: string }> }
  assert.ok(tools.tools.some((tool) => tool.name === "d3_create_file"))
  assert.ok(tools.tools.some((tool) => tool.name === "d3_write_dict"))
  assert.ok(tools.tools.some((tool) => tool.name === "d3_build_basic_program"))
  assert.ok(tools.tools.some((tool) => tool.name === "d3_sbplus_discover"))

  const built = await fetch(`${server.url}/api/basic/build`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN", compile: true, catalog: true, confirmed: true }),
  }).then((response) => response.json()) as { result: string }
  assert.match(built.result, /BASIC OK|CATALOG OK|OK/)

  const plan = await fetch(`${server.url}/api/sbplus/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system: "SALES", process: "CUSTOMER.MAINT", kind: "input process", file: "CUSTOMERS", fields: ["CUSTOMER.NO", "NAME"] }),
  }).then((response) => response.json()) as { result: string }
  assert.match(plan.result, /SB\+ Builder Plan/)
  assert.match(plan.result, /CUSTOMER\.MAINT/)

  const discovery = await fetch(`${server.url}/api/sbplus/discover`).then((response) => response.json()) as { result: string }
  assert.match(discovery.result, /SB\+ Discovery/)
})

test("IDE server exposes linked Python FastAPI runtime status", async () => {
  const pythonRuntime = createServer((req, res) => {
    if (req.url?.startsWith("/tool-routing")) {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ runtime: "fastapi-python", d3pyAvailable: true, uopyAvailable: false, routes: [{ mechanism: "d3py-uopy" }] }))
      return
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((resolve) => pythonRuntime.listen(0, "127.0.0.1", resolve))
  try {
    const address = pythonRuntime.address()
    assert.ok(address && typeof address === "object")
    const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, {
      port: 0,
      pythonApiUrl: `http://127.0.0.1:${address.port}`,
    })
    const status = await fetch(`${server.url}/api/python-runtime`).then((response) => response.json()) as {
      runtime: string
      available: boolean
      routing: { runtime: string; d3pyAvailable: boolean; routes: Array<{ mechanism: string }> }
    }
    assert.equal(status.runtime, "fastapi-python")
    assert.equal(status.available, true)
    assert.equal(status.routing.d3pyAvailable, true)
    assert.ok(status.routing.routes.some((route) => route.mechanism === "d3py-uopy"))
  } finally {
    await new Promise<void>((resolve, reject) => pythonRuntime.close((error) => error ? reject(error) : resolve()))
  }
})

test("IDE server can switch profile and LOGTO through the guarded D3 layer", async () => {
  const editableConfig: D3CodeConfig = { ...config, profiles: config.profiles.map((profile) => ({ ...profile })) }
  editableConfig.profiles.find((profile) => profile.name === "alt")!.safetyDefault = "trust"
  const server = await startTestIdeServer(editableConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const switched = await fetch(`${server.url}/api/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile: "alt" }),
  }).then((response) => response.json()) as { profile: string; account: string; safety: string }
  assert.equal(switched.profile, "alt")
  assert.equal(switched.account, "SALES")
  assert.equal(switched.safety, "trust")
  assert.equal(editableConfig.defaultProfile, "alt")

  const status = await fetch(`${server.url}/api/status`).then((response) => response.json()) as { profile: string; account: string; safety: string }
  assert.equal(status.profile, "alt")
  assert.equal(status.account, "SALES")
  assert.equal(status.safety, "trust")

  const login = await fetch(`${server.url}/api/account/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account: "SALES", confirmed: true }),
  }).then((response) => response.json()) as { result: string }
  assert.match(login.result, /SALES/)
})

test("IDE server exposes database, BASIC, dictionary, and subroutine workbench APIs", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const files = await fetch(`${server.url}/api/files`).then((response) => response.json()) as { result: string }
  assert.match(files.result, /CUSTOMERS/)

  const locks = await fetch(`${server.url}/api/locks`).then((response) => response.json()) as { result: string }
  assert.match(locks.result, /No locks/)

  const item = await fetch(`${server.url}/api/item?file=BP&item=GET.CUSTOMER`).then((response) => response.json()) as { result: string }
  assert.equal(item.result, "ITEM BODY")
  assert.doesNotMatch(item.result, /exit unknown|completed ·/)

  const aql = await fetch(`${server.url}/api/aql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "LIST CUSTOMERS" }),
  }).then((response) => response.json()) as { result: string }
  assert.match(aql.result, /Alice/)

  const injectedAql = await fetch(`${server.url}/api/aql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "LIST CUSTOMERS\nDELETE CUSTOMERS 100" }),
  })
  assert.equal(injectedAql.status, 400)
  assert.match(await injectedAql.text(), /must be one line/)

  const injectedRead = await fetch(`${server.url}/api/item?file=${encodeURIComponent("BP\nWHO")}&item=GET.CUSTOMER`)
  assert.equal(injectedRead.status, 400)
  assert.match(await injectedRead.text(), /Invalid d3_read_item input/)

  const dict = await fetch(`${server.url}/api/dict?file=CUSTOMERS&item=NAME`).then((response) => response.json()) as { result: string }
  assert.equal(dict.result, "DICT ITEM")
  assert.doesNotMatch(dict.result, /exit unknown|completed ·/)

  const compile = await fetch(`${server.url}/api/basic/compile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file: "BP", item: "GET.CUSTOMER", confirmed: true }),
  }).then((response) => response.json()) as { result: string }
  assert.match(compile.result, /BASIC OK/)

  const catalog = await fetch(`${server.url}/api/basic/catalog`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file: "BP", item: "GET.CUSTOMER", confirmed: true }),
  }).then((response) => response.json()) as { result: string }
  assert.match(catalog.result, /CATALOG OK/)

  const call = await fetch(`${server.url}/api/subroutine/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "GET.CUSTOMER", args: ["100"], confirmed: true }),
  }).then((response) => response.json()) as { result: string }
  assert.match(call.result, /CALL OK/)
})

test("IDE server exposes sessionless manual search without a D3 profile", async () => {
  const noProfileConfig = { ...config, defaultProfile: undefined, profiles: [] }
  const server = await startTestIdeServer(noProfileConfig, { model: "openai/gpt-5", safety: "ask", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/manual-search?query=DICT`)
  const payload = await response.json() as { result: string }

  assert.equal(response.status, 200)
  assert.match(payload.result, /Manual search|No manual matches/)
})

test("IDE server exposes auditable RAG/manual-search status", async () => {
  const noProfileConfig = { ...config, defaultProfile: undefined, profiles: [] }
  const server = await startTestIdeServer(noProfileConfig, { model: "openai/gpt-5", safety: "ask", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/rag/status`)
  const payload = await response.json() as {
    ready: boolean
    chunks: number
    sources: Array<{ title: string; kind: string; present: boolean; chunks?: number }>
  }

  assert.equal(response.status, 200)
  assert.ok(Array.isArray(payload.sources))
  assert.ok(payload.sources.some((source) => source.title.includes("Crystal Logic") && source.present))
})

test("IDE server exposes sessionless routed RAG search without a D3 profile", async () => {
  const noProfileConfig = { ...config, defaultProfile: undefined, profiles: [] }
  const server = await startTestIdeServer(noProfileConfig, { model: "openai/gpt-5", safety: "ask", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/rag-search?query=${encodeURIComponent("System Builder menu template")}&limit=1`)
  const payload = await response.json() as { result: string }

  assert.equal(response.status, 200)
  assert.match(payload.result, /RAG query|SB\/XA|System Builder|no RAG hits/)
})

test("IDE server agent panel runs the guarded D3 agent loop", async () => {
  let calls = 0
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, {
    port: 0,
    agentChatFn: async (_config, _secrets, request) => {
      calls += 1
      assert.match(request.messages[0]?.content ?? "", /D3 Agent Tool Protocol/)
      if (calls === 1) {
        return {
          provider: "test",
          model: "fake",
          content: "<d3_tool>{\"name\":\"d3_list_files\",\"input\":{},\"reason\":\"show the account file pointers first\"}</d3_tool>",
        }
      }
      assert.match(request.messages.at(-1)?.content ?? "", /D3 tool result: d3_list_files/)
      return { provider: "test", model: "fake", content: "I found the account file pointers. In D3, these are entries in the account master dictionary that point at data or program files." }
    },
  })

  const response = await fetch(`${server.url}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "I do not know D3. Show me what is in this account." }),
  })
  const payload = await response.json() as { output: string; tools: Array<{ name: string; result: string }> }

  assert.equal(response.status, 200)
  assert.equal(calls, 2)
  assert.match(payload.output, /master dictionary/)
  assert.equal(payload.tools[0]?.name, "d3_list_files")
  assert.match(payload.tools[0]?.result ?? "", /CUSTOMERS/)
})

test("IDE server keeps agent histories isolated per chat thread", async () => {
  const seen: Array<{ lastUser: string; history: string }> = []
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, {
    port: 0,
    agentChatFn: async (_config, _secrets, request) => {
      const lastUser = request.messages.filter((message) => message.role === "user").at(-1)?.content ?? ""
      const history = request.messages.map((message) => message.content).join("\n")
      seen.push({ lastUser, history })
      if (lastUser.includes("alpha")) return { provider: "test", model: "fake", content: "alpha remembered" }
      if (lastUser.includes("continue")) return { provider: "test", model: "fake", content: history.includes("alpha remembered") ? "alpha is still scoped here" : "lost alpha" }
      return { provider: "test", model: "fake", content: history.includes("alpha remembered") ? "bleed" : "beta clean" }
    },
  })

  const post = async (chatId: string, input: string) => fetch(`${server.url}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, input }),
  }).then((response) => response.json()) as Promise<{ output: string }>

  assert.equal((await post("chat-alpha", "alpha D3 account please")).output, "alpha remembered")
  assert.equal((await post("chat-beta", "beta D3 account please")).output, "beta clean")
  assert.equal((await post("chat-alpha", "continue this D3 account thread")).output, "alpha is still scoped here")
  assert.equal(seen.some((entry) => entry.lastUser.includes("beta") && entry.history.includes("alpha remembered")), false)
})

test("IDE server streams browser agent tokens and D3 tool events", async () => {
  let calls = 0
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, {
    port: 0,
    agentChatFn: async (_config, _secrets, request) => {
      calls += 1
      if (calls === 1) {
        request.onToken?.("<d3_tool>")
        return { provider: "test", model: "fake", content: "<d3_tool>{\"name\":\"d3_list_files\",\"input\":{},\"reason\":\"inspect files\"}</d3_tool>" }
      }
      request.onToken?.("Here ")
      request.onToken?.("are files.")
      return { provider: "test", model: "fake", content: "Here are files." }
    },
  })

  const response = await fetch(`${server.url}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ input: "show D3 account files" }),
  })
  const stream = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/)
  assert.match(stream, /event: assistant_delta/)
  assert.match(stream, /"job_id":"agent-/)
  assert.match(stream, /"seq":0/)
  assert.match(stream, /event: tool_start/)
  assert.match(stream, /"name":"d3_list_files"/)
  assert.match(stream, /event: tool_result/)
  assert.match(stream, /event: done/)
  assert.match(stream, /Here are files/)
})

test("IDE server reports profile online status from WHO probes", async () => {
  const offlineProfile: D3CodeConfig["profiles"][number] = {
    name: "offline",
    type: "local",
    entryCommand: "node -e \"console.log('ssh: Could not resolve hostname missing.example')\"",
    sessionMode: "oneshot",
  }
  const fullProfile: D3CodeConfig["profiles"][number] = {
    name: "full",
    type: "local",
    entryCommand: "node -e \"process.stdin.on('data',()=>console.log('Connected to Virtual Machine pick0:LINUX\\nToo many users'))\"",
    sessionMode: "oneshot",
  }
  const onlineConfig = { ...config, profiles: [...config.profiles, offlineProfile, fullProfile] }
  const server = await startTestIdeServer(onlineConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })
  const response = await fetch(`${server.url}/api/profiles/online`)
  const payload = await response.json() as {
    profiles: Record<string, boolean>
    details: Record<string, { online: boolean; issue?: string }>
  }

  assert.equal(response.status, 200)
  assert.equal(payload.profiles.fake, true)
  assert.equal(payload.profiles.alt, true)
  assert.equal(payload.profiles.offline, false)
  assert.equal(payload.profiles.full, false)
  assert.equal(payload.details.fake.online, true)
  assert.match(payload.details.full.issue ?? "", /D3 login blocked: too many users/i)
  assert.match(payload.details.full.issue ?? "", /server and SSH connection are available/i)
})

test("IDE server agent job survives client disconnect and can be polled", async () => {
  let calls = 0
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, {
    port: 0,
    agentChatFn: async (_config, _secrets, request) => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 80))
      if (calls === 1) {
        request.onToken?.("Working ")
        return { provider: "test", model: "fake", content: "<d3_tool>{\"name\":\"d3_list_files\",\"input\":{},\"reason\":\"inspect\"}</d3_tool>" }
      }
      return { provider: "test", model: "fake", content: "Recovered after refresh." }
    },
  })

  const chatId = "chat-refresh-test"
  const controller = new AbortController()
  const streamPromise = fetch(`${server.url}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ input: "show D3 account files", chat_id: chatId }),
    signal: controller.signal,
  })
  setTimeout(() => controller.abort(), 120)
  await streamPromise.catch(() => {})

  const started = Date.now()
  let finished = false
  while (Date.now() - started < 15_000) {
    const poll = await fetch(`${server.url}/api/agent/job?chat_id=${encodeURIComponent(chatId)}&since=0`)
    const payload = await poll.json() as { job_id: string; status: string; events: Array<{ job_id: string; seq: number; type: string; data: { output?: string } }> }
    if (payload.status === "done") {
      finished = true
      assert.match(payload.job_id, /^agent-/)
      assert.ok(payload.events.every((event) => event.job_id === payload.job_id))
      assert.deepEqual(payload.events.map((event) => event.seq), payload.events.map((_event, index) => index))
      assert.match(payload.events.find((event) => event.type === "done")?.data.output ?? "", /Recovered after refresh/)
      break
    }
    if (payload.status === "error") break
    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  assert.equal(finished, true)
  assert.equal(calls, 2)
})

test("slash /ide starts the IDE server and returns a browser URL", async () => {
  const result = await handleSlashCommand("/ide --port 0", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

  assert.match(result.output, /D3 Code IDE started/)
  assert.match(result.output, /http:\/\/127\.0\.0\.1:\d+/)
  assert.doesNotMatch(result.output, /Browser surfaces/)
  assert.doesNotMatch(result.output, /\/api\/terminal\/send/)
  assert.match(result.output, /Access: local-only/)
  assert.match(result.output, /ssh -L \d+:127\.0\.0\.1:\d+ <user>@<server>/)
  assert.match(result.output, /\/ide public/)
  assert.match(result.output, /\/ide stop/)
})

test("slash /ide explains public network binding when requested", async () => {
  const result = await handleSlashCommand("/ide public --port 0", { ...config, ideAuth: defaultIdeAuth }, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

  assert.match(result.output, /D3 Code IDE started/)
  assert.doesNotMatch(result.output, /http:\/\/0\.0\.0\.0:\d+/)
  assert.match(result.output, /Bound: 0\.0\.0\.0:\d+/)
  assert.match(result.output, /Access: listening on all server interfaces/)
  assert.match(result.output, /Firewall:/)
  assert.match(result.output, /Only expose this on a trusted network/)
})

test("slash /ide stop stops running IDE servers", async () => {
  await handleSlashCommand("/ide --port 0", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
  const result = await handleSlashCommand("/ide stop", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

  assert.match(result.output, /D3 Code IDE stopped/)
})

test("slash /id is an IDE alias", async () => {
  const result = await handleSlashCommand("/id --port 0", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

  assert.match(result.output, /D3 Code IDE started/)
  assert.match(result.output, /http:\/\/127\.0\.0\.1:\d+/)
})
