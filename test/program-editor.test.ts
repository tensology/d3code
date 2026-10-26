import assert from "node:assert/strict"
import test from "node:test"
import { startIdeServer } from "../src/ide/server.js"
import { basicAuthHeader } from "../src/ide/auth.js"

test("bundled code editor uses the IDE authentication boundary and fixed asset path", async () => {
  const ideAuth = { username: "editor-test", password: "test-only-password" }
  const server = await startIdeServer({ version: 1, profiles: [], defaultModel: "openai/test", defaultSafety: "ask", modelSecrets: {}, ideAuth }, { model: "openai/test", safety: "ask", mode: "chat" }, { host: "0.0.0.0", port: 0 })
  const url = `http://127.0.0.1:${server.port}`, headers = { authorization: basicAuthHeader(ideAuth) }
  try {
    assert.equal((await fetch(url + "/assets/program-editor.js")).status, 401)
    const response = await fetch(url + "/assets/program-editor.js", { headers })
    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type")!, /^text\/javascript/)
    assert.equal(response.headers.get("cache-control"), "no-store")
    const script = await response.text()
    assert.match(script, /Third-party licenses/)
    assert.match(script, /Permission is hereby granted/)
    assert.doesNotMatch(script, /https:\/\/(?:cdn|unpkg|esm\.sh)/)
    assert.equal((await fetch(url + "/assets/package.json", { headers })).status, 404)
    const html = await fetch(url, { headers }).then(r => r.text())
    assert.match(html, /IDE_BASE_PATH\+'\/assets\/program-editor\.js'/)
    assert.match(html, /Plain text editing is available/)
  } finally { await server.close() }
})
