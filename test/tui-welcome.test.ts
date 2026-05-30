import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import type { SecretStore } from "../src/security/secrets.js"
import { renderWelcome } from "../src/tui/welcome.js"

const secrets: SecretStore = {
  async get(ref: string) {
    return ref === "keychain:model:kilocode" ? "secret" : undefined
  },
  async set() {},
}

test("welcome renders compact connected model and missing D3 profile", async () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "kilocode/kilo-auto/free",
    defaultSafety: "ask",
    profiles: [],
    modelSecrets: { kilocode: "keychain:model:kilocode" },
  }

  const rendered = await renderWelcome(config, secrets, { model: config.defaultModel, safety: "ask", mode: "chat" })

  assert.match(rendered, /AI provider: connected \(Kilo Code Gateway, kilo-auto\/free\)/)
  assert.match(rendered, /D3 profile: not connected/)
  assert.match(rendered, /\/status shows exact setup commands/)
  assert.doesNotMatch(rendered, /Active Goals/)
  assert.doesNotMatch(rendered, /Live D3 Proof/)
})

test("welcome renders D3 profile session state", async () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "ollama/llama3.1",
    defaultSafety: "ask",
    defaultProfile: "prod",
    profiles: [{ name: "prod", type: "local", account: "DM", sessionMode: "persistent" }],
    modelSecrets: {},
  }

  const rendered = await renderWelcome(config, secrets, { model: config.defaultModel, safety: "ask", mode: "chat", profile: "prod" })

  assert.match(rendered, /AI provider: connected \(Ollama, llama3\.1\)/)
  assert.match(rendered, /D3 profile: prod \(local, account DM, persistent session\)/)
})
