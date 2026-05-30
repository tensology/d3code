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
    entryCommand: "node -e \"process.stdin.on('data',d=>{const s=d.toString(); if(s.includes('LIST MD')) console.log('CUSTOMERS D Customer file'); else if(s.includes('WHO')) console.log('DM'); else if(s.includes('CT DICT')) console.log('DICT ITEM'); else if(s.includes('CT')) console.log('ITEM BODY'); else console.log('OK')})\"",
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
  assert.match(html, /Database Manager/)
  assert.match(html, /D3 Terminal/)

  const status = await fetch(`${server.url}/api/status`).then((response) => response.json()) as { profile: string; account: string; mode: string }
  assert.equal(status.profile, "fake")
  assert.equal(status.account, "DM")
  assert.equal(status.mode, "chat")

  const profiles = await fetch(`${server.url}/api/profiles`).then((response) => response.json()) as { profiles: Array<{ name: string }> }
  assert.deepEqual(profiles.profiles.map((profile) => profile.name), ["fake"])
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

test("slash /ide starts the IDE server and returns a browser URL", async () => {
  const result = await handleSlashCommand("/ide --port 0", config, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })

  assert.match(result.output, /D3 Code IDE running/)
  assert.match(result.output, /http:\/\/127\.0\.0\.1:\d+/)
  assert.match(result.output, /\/api\/terminal\/send/)
})
