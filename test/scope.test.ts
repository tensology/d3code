import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import test from "node:test"
import { promisify } from "node:util"
import {
  assertD3Scope,
  classifyD3Scope,
  isD3ConnectionQuestion,
  renderD3ScopeDecision,
} from "../src/scope/d3-scope.js"
import { runD3AgentTurn } from "../src/tui/agent.js"
import { getTool } from "../src/d3/tools.js"
import type { D3CodeConfig } from "../src/config/config.js"

const execFileAsync = promisify(execFile)

test("D3 scope classifier accepts runtime, code, reference, and D3Code operations", () => {
  assert.equal(classifyD3Scope("LIST MD in the SALES D3 account").scope, "d3-runtime")
  assert.equal(classifyD3Scope("Modernize this BP BASIC program and compile it").scope, "d3-code")
  assert.equal(classifyD3Scope("What does the Rocket D3 manual say about CREATE-FILE?").scope, "d3-reference")
  assert.equal(classifyD3Scope("Run harness-doctor and check the sidecar profile context").scope, "d3code-ops")
  assert.equal(classifyD3Scope("try connect").scope, "d3code-ops")
  assert.equal(classifyD3Scope("can you connect to the server?").scope, "d3code-ops")
  assert.equal(classifyD3Scope("is the server back up?").scope, "d3code-ops")
})

test("D3 scope classifier fails closed for unrelated work and asks for a D3 anchor", () => {
  const decision = classifyD3Scope("Build me a generic React todo app")

  assert.equal(decision.scope, "out-of-scope")
  assert.equal(decision.allowed, false)
  assert.match(renderD3ScopeDecision(decision), /Which D3 account, file, program, bundle, manual section, or migration artifact/)
})

test("connection status questions are operator requests without allowing unrelated connections", () => {
  for (const text of ["are you connected", "Are you connected?", "are we still connected?", "am I connected?", "is it connected?", "are you connected to the server?"]) {
    assert.equal(classifyD3Scope(text).scope, "d3code-ops", text)
  }
  for (const text of ["are you connected to Gmail?", "is it connected to Stripe?", "build a connected React app"]) {
    assert.equal(classifyD3Scope(text).allowed, false, text)
  }
})

const connectionQuestions = [
  "are you connected", "Are we still connected?", "am I connected to D3?", "is it connected?",
  "Hello, are you online?", "Please check the connection.", "can you connect?", "could you reconnect to the server please?",
  "check connection status", "test the database", "verify our connection", "connection status?", "what's the connection status?",
  "is the server down?", "is D3 back up?", "is the database reachable?", "is my D3 server running?",
  "can you check if you are connected?", "connected?", "still connected?",
]

test("connection intent handles ordinary wording without swallowing compound or unrelated work", () => {
  for (const text of connectionQuestions) {
    assert.equal(isD3ConnectionQuestion(text), true, text)
    assert.equal(classifyD3Scope(text).allowed, true, text)
  }
  for (const text of ["are you connected to Gmail?", "connect to Stripe", "check the connection and delete all records", "are you connected; SHUTDOWN", "is D3 up? Then compile BP TEST", "connect to another account", "explain how a connection works"]) {
    assert.equal(isD3ConnectionQuestion(text), false, text)
  }
})

test("connection questions use only guarded WHO, without a model, account switch or approval", async () => {
  const config: D3CodeConfig = { version: 1, defaultModel: "unavailable/model", defaultSafety: "ask", profiles: [{ name: "office", type: "ssh", host: "example.invalid", username: "test", account: "dm", allowedAccounts: ["dm"] }], modelSecrets: {} }
  const tool = getTool("d3_login")!, execute = tool.execute
  const commands: string[] = []
  let stdout = "WHO\n7 dm dm", stderr = "", exitCode: number | null = 0, calls = 0
  let hang = false
  const secrets = { get: async () => undefined, set: async () => undefined }
  tool.execute = (input, context) => execute(input, { ...context, session: {
    profile: context.profile!,
    run: async (command, _timeout, options) => {
      commands.push(command)
      if (hang) await new Promise<void>((_resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Mock connection did not stop")), 1000)
        options!.signal!.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Interrupted.")) }, { once: true })
      })
      return { command, stdout, stderr, exitCode, durationMs: 1 }
    },
    close: async () => {},
  } })
  const run = (input: string, overrides = {}) => runD3AgentTurn(config, secrets, {
    input, model: "unavailable/model", safety: "ask", profile: "office", mode: "chat",
    chatFn: async () => { calls++; throw new Error("Provider unavailable") },
    approveTool: async () => { throw new Error("Unexpected approval") }, ...overrides,
  })
  try {
    for (const input of connectionQuestions) {
      const events: string[] = []
      const result = await run(input, { onEvent: (event: { type: string }) => events.push(event.type) })
      assert.match(result.output, /D3 is reachable through office\. Fresh WHO: 7 dm dm/)
      assert.match(result.output, /Terminal connection is managed separately/)
      assert.deepEqual(result.toolEvents[0]?.input, {})
      assert.deepEqual(events, ["tool_start", "tool_result"])
    }
    assert.ok(commands.every(command => command === "WHO"))
    for (const [body, errorOutput, code] of [
      ["Too many users", "", 0], ["Virtual Machine pick0:LINUX is not running", "", 0],
      ["", "", 0], ["welcome to Linux", "", 0], ["7 dm dm", "ssh: connection failed", 1],
      ["7 dm dm", "", 1], ["7 dm OTHER", "", 0],
    ] as const) {
      stdout = body; stderr = errorOutput; exitCode = code
      const result = await run("are you connected?")
      assert.match(result.output, /could not be verified/)
      assert.equal(result.toolEvents[0]?.result.status, "error")
      assert.doesNotMatch(result.output, /D3 is reachable/)
    }
    const before = commands.length
    for (const overrides of [{ profile: "missing" }, { mode: "plan" }, { mode: "gsd" }, { signal: AbortSignal.abort() }]) {
      assert.match((await run("connection status", overrides)).output, /could not be verified/)
    }
    assert.equal(commands.length, before)
    assert.equal(calls, 0)
    config.profiles[0]!.entryCommand = "sh"
    assert.match((await run("connection status")).output, /Confirmation required/)
    assert.equal(commands.length, before)
    delete config.profiles[0]!.entryCommand
    hang = true
    assert.match((await run("connection status", { turnTimeoutMs: 10 })).output, /could not be verified.*Interrupted/)
    hang = false
    assert.match((await run("is D3 up? Then compile BP TEST")).output, /Provider unavailable/)
    assert.equal(calls, 1)
  } finally { tool.execute = execute }
})

test("native operations requests reach only modes that already permit runtime inspection", () => {
  for (const text of ["Show background jobs", "Inspect the phantom status", "Check the spooler", "Show the print queue", "Check printer status"]) assert.equal(classifyD3Scope(text).allowed, true, text)
  for (const mode of ["chat", "audit", "modernize", "migrate", "qa"]) assert.doesNotThrow(() => assertD3Scope({ mode, toolName: "d3_operations_status", input: { area: "jobs" } }))
  for (const mode of ["plan", "gsd", "api"]) assert.throws(() => assertD3Scope({ mode, toolName: "d3_operations_status", input: { area: "jobs" } }), /blocked/)
})

test("D3 scope guard applies mode-specific tool boundaries", () => {
  assert.doesNotThrow(() => assertD3Scope({ mode: "audit", toolName: "d3_read_item", input: { file: "CUSTOMERS", item: "100" } }))
  assert.doesNotThrow(() => assertD3Scope({ mode: "chat", toolName: "d3_manual_search", input: { query: "D3 CREATE-FILE syntax" } }))
  assert.doesNotThrow(() => assertD3Scope({ mode: "chat", toolName: "d3_list_files", input: {}, text: "show D3 account files" }))
  assert.doesNotThrow(() => assertD3Scope({ mode: "chat", toolName: "d3_tcl", input: { command: "WHO" }, text: "check the active D3 account" }))
  assert.doesNotThrow(() => assertD3Scope({ mode: "chat", toolName: "d3_login", input: {}, text: "verify active D3 account connection" }))
  assert.doesNotThrow(() => assertD3Scope({ mode: "modernize", toolName: "d3_build_basic_program", input: { file: "BP", item: "CALC.TAX" } }))

  assert.throws(
    () => assertD3Scope({ mode: "chat", toolName: "d3_write_item", input: { file: "CUSTOMERS", item: "100" } }),
    /Tool d3_write_item is blocked in chat mode/,
  )
  assert.throws(
    () => assertD3Scope({ mode: "qa", toolName: "d3_catalog", input: { file: "BP", item: "CALC.TAX" } }),
    /Tool d3_catalog is blocked in qa mode/,
  )
})

test("CLI scope-check emits machine-readable D3 scope decisions", async () => {
  const allowed = await execFileAsync("node", ["dist/src/cli.js", "scope-check", "Compile BP CALC.TAX in D3", "--mode", "modernize", "--json"], { cwd: process.cwd() })
  const allowedJson = JSON.parse(allowed.stdout) as { allowed: boolean; scope: string }
  assert.equal(allowedJson.allowed, true)
  assert.equal(allowedJson.scope, "d3-code")

  const blocked = await execFileAsync("node", ["dist/src/cli.js", "scope-check", "Build a generic React todo app", "--mode", "chat", "--json"], { cwd: process.cwd() })
  const blockedJson = JSON.parse(blocked.stdout) as { allowed: boolean; scope: string; requiredAnchor?: string }
  assert.equal(blockedJson.allowed, false)
  assert.equal(blockedJson.scope, "out-of-scope")
  assert.match(blockedJson.requiredAnchor ?? "", /Which D3 account/)
})
