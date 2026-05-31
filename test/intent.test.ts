import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { D3CodeConfig } from "../src/config/config.js"
import { handleNaturalIntent } from "../src/tui/intent.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  profiles: [],
  modelSecrets: {},
}

test("natural app build intent writes a runnable app slice from a bundle", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-intent-"))
  const bundleFile = join(dir, "bundle.json")
  const outDir = join(dir, "app")
  await writeFile(bundleFile, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "CUSTOMERS",
      suggestedResource: "customers",
      dictionary: [{ id: "@ID", type: "A", attribute: 0 }, { id: "NAME", type: "A", attribute: 1 }],
      records: [{ id: "100", raw: "Alice" }],
    }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  }))

  const result = await handleNaturalIntent(`build an app from bundle ${bundleFile} to ${outDir}`, config, { model: "openai/gpt-5", safety: "ask", mode: "chat" })

  assert.ok(result)
  assert.match(result.output, /D3 application slice generated/)
  assert.match(result.output, /webapp-check/)
  assert.match(await readFile(join(outDir, "web-ui-plan.md"), "utf8"), /Customers/)
  assert.match(await readFile(join(outDir, "openapi.json"), "utf8"), /customers/)
})

test("natural app build intent asks for a profile when live capture is requested without one", async () => {
  const result = await handleNaturalIntent("build an application from files CUSTOMERS programs BP", config, { model: "openai/gpt-5", safety: "ask", mode: "chat" })

  assert.ok(result)
  assert.match(result.output, /No D3 profile is selected/)
  assert.match(result.output, /d3code setup/)
})

test("plain greetings stay in chat and do not trigger D3 tools", async () => {
  const result = await handleNaturalIntent("hello", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "chat" })

  assert.ok(result)
  assert.match(result.output, /Hello/)
  assert.doesNotMatch(result.output, /D3 TCL|VERSION/)
})
