import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { createChatSystemPrompt } from "../src/tui/context.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  defaultProfile: "prod",
  profiles: [{ name: "prod", type: "ssh", host: "d3.example", username: "d3", account: "SALES", sessionMode: "persistent", promptPattern: ">", allowedAccounts: ["SALES", "DM"] }],
  modelSecrets: { openai: "env:OPENAI_API_KEY" },
}

test("chat system prompt includes mode skills and active D3 runtime context", () => {
  const prompt = createChatSystemPrompt(config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(prompt, /strangler migration/i)
  assert.match(prompt, /Baked-in skills/)
  assert.match(prompt, /Runtime D3 Code Context/)
  assert.match(prompt, /model: openai\/gpt-5/)
  assert.match(prompt, /safety: ask/)
  assert.match(prompt, /profile: prod \(ssh, account=SALES, session=persistent\)/)
  assert.match(prompt, /allowed accounts: SALES, DM/)
  assert.match(prompt, /D3 files, dictionaries, BASIC programs, indexes, locks/)
  assert.match(prompt, /interactive coding-agent harness/)
  assert.match(prompt, /build an application from files CUSTOMERS,ORDERS programs BP/)
  assert.match(prompt, /\/agent-run file-audit/)
  assert.match(prompt, /\/bundle-completion-audit/)
})

test("chat system prompt carries explicit no-profile context", () => {
  const prompt = createChatSystemPrompt(config, { model: "local/local/default", safety: "plan", mode: "audit" })
  assert.match(prompt, /profile: none/)
  assert.match(prompt, /allowed accounts: none/)
  assert.match(prompt, /In plan safety/)
})
