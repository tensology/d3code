import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import test from "node:test"
import { promisify } from "node:util"
import {
  assertD3Scope,
  classifyD3Scope,
  renderD3ScopeDecision,
} from "../src/scope/d3-scope.js"

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
