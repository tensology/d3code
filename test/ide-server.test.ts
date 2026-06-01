import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
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
    entryCommand: "node -e \"process.stdin.on('data',d=>{const s=d.toString(); if(s.includes('LIST MD')) console.log('CUSTOMERS D Customer file'); else if(s.includes('LIST-LOCKS')) console.log('No locks'); else if(s.includes('BASIC')) console.log('BASIC OK'); else if(s.includes('CATALOG')) console.log('CATALOG OK'); else if(s.includes('CALL')) console.log('CALL OK'); else if(s.includes('LIST CUSTOMERS')) console.log('100 Alice'); else if(s.includes('LOGTO SALES')) console.log('SALES'); else if(s.includes('WHO')) console.log('DM'); else if(s.includes('CT DICT')) console.log('DICT ITEM'); else if(s.includes('CT')) console.log('ITEM BODY'); else console.log('OK')})\"",
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

  const html = await fetch(server.url).then((response) => response.text())
  assert.match(html, /D3 Code IDE/)
  assert.match(html, /Data Files \/ Items/)
  assert.match(html, /Dictionaries/)
  assert.match(html, /BASIC \/ Subroutines/)
  assert.match(html, /D3 Runtime/)
  assert.match(html, /Terminal emulation/)
  assert.match(html, /tabindex="0"/)
  assert.match(html, /terminalDraft=terminalDraft\.slice\(0,-1\)/)
  assert.match(html, /sendTerminalCommand\(terminalDraft\)/)
  assert.match(html, /Startup input/)
  assert.match(html, /Item \/ BASIC Editor/)
  assert.match(html, /Agent/)
  assert.match(html, /Compile BASIC/)
  assert.match(html, /Subroutine call/)
  assert.match(html, /id="actionPopover"/)
  assert.match(html, /id="fileUpload"/)
  assert.match(html, /id="photoUpload"/)
  assert.match(html, /id="planModeAction"/)
  assert.match(html, /attachmentPromptPrefix/)

  const status = await fetch(`${server.url}/api/status`).then((response) => response.json()) as { profile: string; account: string; mode: string }
  assert.equal(status.profile, "fake")
  assert.equal(status.account, "DM")
  assert.equal(status.mode, "chat")

  const profiles = await fetch(`${server.url}/api/profiles`).then((response) => response.json()) as { profiles: Array<{ name: string }> }
  assert.deepEqual(profiles.profiles.map((profile) => profile.name), ["fake", "alt"])
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
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { host: "0.0.0.0", port: 0 })
  const url = `http://127.0.0.1:${server.port}`

  const denied = await fetch(url)
  assert.equal(denied.status, 401)
  assert.match(denied.headers.get("www-authenticate") ?? "", /Basic realm="D3 Code IDE"/)

  const allowed = await fetch(url, { headers: { authorization: basicAuthHeader(defaultIdeAuth) } })
  assert.equal(allowed.status, 200)
  assert.match(await allowed.text(), /D3 Code IDE/)
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

test("IDE server exposes terminal send through guarded D3 tool layer", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/terminal/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: "WHO" }),
  })
  const payload = await response.json() as { result: string }

  assert.equal(response.status, 200)
  assert.match(payload.result, /DM|OK/)
})

test("IDE server can switch profile and LOGTO through the guarded D3 layer", async () => {
  const server = await startTestIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const switched = await fetch(`${server.url}/api/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile: "alt" }),
  }).then((response) => response.json()) as { profile: string; account: string }
  assert.equal(switched.profile, "alt")
  assert.equal(switched.account, "SALES")

  const status = await fetch(`${server.url}/api/status`).then((response) => response.json()) as { profile: string; account: string }
  assert.equal(status.profile, "alt")
  assert.equal(status.account, "SALES")

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

  const aql = await fetch(`${server.url}/api/aql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "LIST CUSTOMERS" }),
  }).then((response) => response.json()) as { result: string }
  assert.match(aql.result, /Alice/)

  const dict = await fetch(`${server.url}/api/dict?file=CUSTOMERS&item=NAME`).then((response) => response.json()) as { result: string }
  assert.match(dict.result, /DICT ITEM/)

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
    body: JSON.stringify({ input: "show files" }),
  })
  const stream = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/)
  assert.match(stream, /event: assistant_delta/)
  assert.match(stream, /event: tool_start/)
  assert.match(stream, /"name":"d3_list_files"/)
  assert.match(stream, /event: tool_result/)
  assert.match(stream, /event: done/)
  assert.match(stream, /Here are files/)
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
  const result = await handleSlashCommand("/ide public --port 0", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

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
