import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { createD3Session } from "../src/d3/adapter.js"
import { compactText } from "../src/tools/compact.js"
import { runToolByName } from "../src/tools/runner.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  defaultProfile: "local",
  profiles: [{ name: "local", type: "local" }],
  modelSecrets: {},
}

test("compactText truncates noisy output by line count", () => {
  const text = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join("\n")
  const compact = compactText(text, { maxLines: 10, maxChars: 10_000 })
  assert.match(compact, /lines omitted/)
  assert.match(compact, /line 100/)
})

test("tool runner executes local TCL through shell-backed profile", async () => {
  const result = await runToolByName(config, {
    name: "d3_tcl",
    input: { command: "printf D3CODE_OK" },
    safety: "ask",
    profile: "local",
  })
  assert.match(result.compact, /D3CODE_OK/)
  assert.equal((result.raw as { exitCode: number }).exitCode, 0)
})

test("D3 session timeout 0 leaves the command running until completion", async () => {
  const session = createD3Session({ name: "local", type: "local" })
  const result = await session.run("sleep 0.05; printf D3CODE_STILL_RUNNING", 0)

  assert.match(result.stdout, /D3CODE_STILL_RUNNING/)
})

test("D3 session timeout 0 can still be interrupted by AbortSignal", async () => {
  const session = createD3Session({ name: "local", type: "local" })
  const controller = new AbortController()
  const run = session.run("sleep 5; printf SHOULD_NOT_PRINT", 0, { signal: controller.signal })
  setTimeout(() => controller.abort(), 25)

  await assert.rejects(run, /Interrupted/)
})
