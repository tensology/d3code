import assert from "node:assert/strict"
import { runInNewContext } from "node:vm"
import test from "node:test"
import { embeddedClientScript } from "../src/ide/embedding.js"

test("embedded client prefixes API calls, supplies CSRF and isolates stored chats", async () => {
  const stored = new Map<string, string>()
  const requests: Array<{ path: string; options: RequestInit }> = []
  const window = {
    localStorage: { getItem: (key: string) => stored.get(key), setItem: (key: string, value: string) => stored.set(key, value) },
    fetch: async (path: string, options: RequestInit) => { requests.push({ path, options }); return {} },
  }
  for (const scope of ["customer-51.user-5.", "customer-77.user-8."]) {
    await runInNewContext(embeddedClientScript("/api/d3code", scope) +
      ";localStorage.setItem('chats','private');ideFetch('/api/agent',{method:'POST',headers:{'content-type':'application/json'}})",
    { window, document: { cookie: "other=value; csrftoken=csrf-token" }, Headers })
  }
  assert.deepEqual([...stored.keys()], ["customer-51.user-5.chats", "customer-77.user-8.chats"])
  assert.equal(requests[0]!.path, "/api/d3code/api/agent")
  assert.equal(new Headers(requests[0]!.options.headers).get("X-CSRFToken"), "csrf-token")
  assert.equal(new Headers(requests[0]!.options.headers).get("content-type"), "application/json")
  assert.equal(requests[0]!.options.credentials, "same-origin")
})

test("embedding rejects unsafe paths and escapes script delimiters", () => {
  for (const path of ["//evil.test", "/api/../admin", "/api/d3code/", "https://evil.test"]) {
    assert.throws(() => embeddedClientScript(path, ""), /D3CODE_BASE_PATH/)
  }
  assert.doesNotMatch(embeddedClientScript("", "</script>"), /<\/script>/)
})
