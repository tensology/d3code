import assert from "node:assert/strict"
import test from "node:test"
import { basicAuthHeader, defaultIdeAuth, isBasicAuthValid, resolveIdeAuth, setIdeAuth } from "../src/ide/auth.js"
import type { D3CodeConfig } from "../src/config/config.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  profiles: [],
  modelSecrets: {},
}

test("IDE auth defaults to requested admin credentials", () => {
  assert.deepEqual(resolveIdeAuth(config), { username: "admin", password: "admin1234" })
})

test("IDE basic auth validates configured credentials", () => {
  const credentials = { username: "paul", password: "secret123" }

  assert.equal(isBasicAuthValid(basicAuthHeader(credentials), credentials), true)
  assert.equal(isBasicAuthValid(basicAuthHeader(defaultIdeAuth), credentials), false)
  assert.equal(isBasicAuthValid(undefined, credentials), false)
})

test("IDE auth setup updates config credentials", () => {
  const editable = { ...config, profiles: [], modelSecrets: {} }

  assert.deepEqual(setIdeAuth(editable, "paul", "secret123"), { username: "paul", password: "secret123" })
  assert.deepEqual(editable.ideAuth, { username: "paul", password: "secret123" })
  assert.throws(() => setIdeAuth(editable, "", "secret123"), /username/)
  assert.throws(() => setIdeAuth(editable, "paul", ""), /password/)
})
