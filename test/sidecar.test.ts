import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"
import type { D3CodeConfig } from "../src/config/config.js"
import {
  createSidecarProfileContext,
  createSidecarStatus,
  ensureSidecarStarted,
  renderSidecarStatus,
} from "../src/sidecar/client.js"

const execFileAsync = promisify(execFile)

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  defaultProfile: "prod",
  profiles: [{
    name: "prod",
    type: "ssh",
    host: "d3.example.com",
    port: 22,
    username: "d3admin",
    account: "SALES",
    entryCommand: "d3",
    promptPattern: "(^|\\n):\\s*$",
    sessionMode: "persistent",
    allowedAccounts: ["SALES", "DM"],
  }],
  modelSecrets: {},
  sidecar: { enabled: true, autoStart: true },
}

test("sidecar profile context passes profile identity without secrets", () => {
  const context = createSidecarProfileContext(config, "prod", "migrate")

  assert.equal(context.enabled, true)
  assert.equal(context.profile?.name, "prod")
  assert.equal(context.profile?.type, "ssh")
  assert.equal(context.profile?.account, "SALES")
  assert.equal(context.profile?.host, "d3.example.com")
  assert.equal(Object.prototype.hasOwnProperty.call(context.profile, "username"), false)
  assert.equal(context.profile?.allowedAccounts?.join(","), "SALES,DM")
  assert.equal(context.model, "openai/gpt-5")
  assert.equal(context.mode, "migrate")
})

test("sidecar status reports missing binary as fallback-ready", async () => {
  const report = await createSidecarStatus(config, { binary: join(tmpdir(), "missing-d3code-sidecar") })

  assert.equal(report.ready, false)
  assert.equal(report.fallback, true)
  assert.equal(report.checks.some((check) => check.id === "binary" && check.status === "missing"), true)
  assert.match(renderSidecarStatus(report), /TypeScript fallback: yes/)
})

test("sidecar start sends profile context to the sidecar process", async () => {
  const root = await mkdtemp(join(tmpdir(), "d3code-sidecar-"))
  const bin = join(root, "d3code-sidecar")
  const capture = join(root, "context.json")
  await writeFile(bin, [
    "#!/bin/sh",
    "if [ \"$1\" = \"serve\" ]; then",
    `  printf '%s' "$D3CODE_SIDECAR_CONTEXT" > ${JSON.stringify(capture)}`,
    "  printf '{\"type\":\"ready\",\"engine\":\"d3code-sidecar\",\"version\":\"test\"}\\n'",
    "  while read line; do",
    "    [ \"$line\" = \"__quit__\" ] && exit 0",
    "  done",
    "fi",
    "if [ \"$1\" = \"health\" ]; then",
    "  printf '{\"ready\":true,\"engine\":\"d3code-sidecar\",\"version\":\"test\"}\\n'",
    "fi",
    "",
  ].join("\n"), { mode: 0o755 })

  const result = await ensureSidecarStarted(config, { profileName: "prod", mode: "migrate", binary: bin, timeoutMs: 1000 })

  assert.equal(result.started, true)
  assert.equal(result.ready, true)
  result.process?.stdin.write("__quit__\n")
  const captured = JSON.parse(await readFile(capture, "utf8")) as { profile?: { name?: string; account?: string } }
  assert.equal(captured.profile?.name, "prod")
  assert.equal(captured.profile?.account, "SALES")
})

test("sidecar can fast-prefilter obvious D3 scope requests", async () => {
  const binary = join(process.cwd(), "sidecar", "target", "release", "d3code-sidecar")
  const d3 = await execFileAsync(binary, ["scope-check", "Compile BP CALC.TAX in D3"])
  assert.equal((JSON.parse(d3.stdout) as { allowed: boolean; scope: string }).scope, "d3-code")

  const generic = await execFileAsync(binary, ["scope-check", "Build a generic React todo app"])
  const parsedGeneric = JSON.parse(generic.stdout) as { allowed: boolean; scope: string }
  assert.equal(parsedGeneric.allowed, false)
  assert.equal(parsedGeneric.scope, "out-of-scope")
})
