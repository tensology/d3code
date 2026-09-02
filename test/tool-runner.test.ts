import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { createD3Session, d3StackedInput } from "../src/d3/adapter.js"
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
  assert.equal(result.status, "success")
  assert.ok((result.summary ?? "").length > 0)
  assert.deepEqual(result.nextActions, [])
})

test("tool runner enforces D3 scope when a mode contract is supplied", async () => {
  await assert.rejects(
    runToolByName({ ...config, profiles: [] }, {
      name: "d3_write_item",
      input: { file: "CUSTOMERS", item: "100", body: "X" },
      safety: "ask",
      mode: "chat",
    }),
    /Tool d3_write_item is blocked in chat mode/,
  )
})

test("tool runner keeps raw TCL writes behind ask confirmation in chat mode", async () => {
  await assert.rejects(
    runToolByName(config, {
      name: "d3_tcl",
      input: { command: "DELETE MD X" },
      safety: "ask",
      profile: "local",
      mode: "chat",
    }),
    /Confirmation required by ask safety policy/,
  )
})

test("tool runner ignores confirmation supplied by model-originated input", async () => {
  await assert.rejects(
    runToolByName(config, {
      name: "d3_tcl",
      input: { command: "DELETE MD X", confirmed: true },
      safety: "ask",
      profile: "local",
      mode: "chat",
      acceptInputConfirmation: false,
    }),
    /Confirmation required by ask safety policy/,
  )
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

test("D3 stacked input logs in, runs the command, and releases the account", () => {
  assert.equal(d3StackedInput("dm\ndm\n", "WHO"), "dm\\rdm\\rWHO\\rOFF\\r")
  assert.equal(d3StackedInput("dm\rdm\r", "LIST MD\nWHO"), "dm\\rdm\\rLIST MD\\rWHO\\rOFF\\r")
})
