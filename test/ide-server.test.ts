import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { startIdeServer, stopIdeServers } from "../src/ide/server.js"
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

test.afterEach(async () => {
  await stopIdeServers()
})

test("IDE server serves browser shell and D3 profile APIs", async () => {
  const server = await startIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

  const html = await fetch(server.url).then((response) => response.text())
  assert.match(html, /D3 Code IDE/)
  assert.match(html, /Data Files \/ Items/)
  assert.match(html, /Dictionaries/)
  assert.match(html, /BASIC \/ Subroutines/)
  assert.match(html, /D3 Runtime/)
  assert.match(html, /Terminal emulation/)
  assert.match(html, /Startup input/)
  assert.match(html, /Item \/ BASIC Editor/)
  assert.match(html, /Agent/)
  assert.match(html, /Compile BASIC/)
  assert.match(html, /Subroutine call/)

  const status = await fetch(`${server.url}/api/status`).then((response) => response.json()) as { profile: string; account: string; mode: string }
  assert.equal(status.profile, "fake")
  assert.equal(status.account, "DM")
  assert.equal(status.mode, "chat")

  const profiles = await fetch(`${server.url}/api/profiles`).then((response) => response.json()) as { profiles: Array<{ name: string }> }
  assert.deepEqual(profiles.profiles.map((profile) => profile.name), ["fake", "alt"])
})

test("IDE server normalizes browser-created D3 profiles for terminal emulation", async () => {
  const server = await startIdeServer({ ...config, profiles: [...config.profiles] }, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

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
  assert.equal(saved?.startupInput, "dm\ndm\n")
  assert.equal(saved?.promptPattern, "(^|\\n):\\s*$")
})

test("IDE server exposes terminal send through guarded D3 tool layer", async () => {
  const server = await startIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

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
  const server = await startIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

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
  const server = await startIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, { port: 0 })

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
  const server = await startIdeServer(noProfileConfig, { model: "openai/gpt-5", safety: "ask", mode: "chat" }, { port: 0 })

  const response = await fetch(`${server.url}/api/manual-search?query=DICT`)
  const payload = await response.json() as { result: string }

  assert.equal(response.status, 200)
  assert.match(payload.result, /Manual search|No manual matches/)
})

test("IDE server agent panel runs the guarded D3 agent loop", async () => {
  let calls = 0
  const server = await startIdeServer(config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }, {
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

test("slash /ide starts the IDE server and returns a browser URL", async () => {
  const result = await handleSlashCommand("/ide --port 0", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

  assert.match(result.output, /D3 Code IDE started/)
  assert.match(result.output, /http:\/\/127\.0\.0\.1:\d+/)
  assert.doesNotMatch(result.output, /Browser surfaces/)
  assert.doesNotMatch(result.output, /\/api\/terminal\/send/)
  assert.match(result.output, /\/ide stop/)
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
