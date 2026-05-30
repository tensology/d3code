import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir } from "../src/config/paths.js"
import { runMockAcceptance } from "../src/quality/acceptance.js"
import { createInstallProofReport } from "../src/quality/install-proof.js"
import { createProductCompletionAudit, renderProductCompletionAudit } from "../src/quality/product-audit.js"
import { EnvSecretStore } from "../src/security/secrets.js"

async function writeLiveProofDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "d3code-product-live-proof-"))
  await writeFile(join(dir, "live-proof-manifest.json"), JSON.stringify({
    profile: "prod",
    account: "SALES",
    screenCommand: "RUN BP MENU",
    basicFile: "BP",
    basicItem: "TEST.ITEM",
    requiredArtifacts: ["profile-doctor.json", "terminal-capture.json", "screen-buffer.json", "operator-notes.md", "compile-catalog-transcript.txt", "rollback.md"],
    safety: {
      terminalSends: "blocked-until-D3CODE_TERMINAL_ENABLED",
      mutations: "blocked-until-D3CODE_ALLOW_WRITES",
      transcriptRecording: "redacted-unless-D3CODE_TERMINAL_RECORD_TRANSCRIPT",
    },
  }))
  await writeFile(join(dir, "profile-doctor.json"), JSON.stringify({
    profile: "prod",
    type: "local",
    account: "SALES",
    sessionMode: "persistent",
    ready: true,
    checks: [
      { name: "who", command: "WHO", ok: true, exitCode: 0, durationMs: 1, output: "SALES" },
      { name: "version", command: "VERSION", ok: true, exitCode: 0, durationMs: 1, output: "D3 10.3" },
      { name: "md-list", command: "LIST MD (N", ok: true, exitCode: 0, durationMs: 1, output: "MD" },
    ],
  }))
  await writeFile(join(dir, "terminal-transcript.txt"), "@(-1)MENU@(5,2)Choice:")
  await writeFile(join(dir, "screen-buffer.json"), JSON.stringify({ width: 24, height: 6, row: 2, col: 12, events: [{ type: "text", value: "M", row: 0, col: 0 }], lines: ["MENU", "", "     Choice:"] }))
  await writeFile(join(dir, "terminal-capture.json"), JSON.stringify({ profile: "prod", account: "SALES", command: "RUN BP MENU", risk: "read", result: { stdout: "@(-1)MENU@(5,2)Choice:", stderr: "", exitCode: 0, durationMs: 2 }, screen: { width: 24, height: 6, row: 2, col: 12, events: [{ type: "text", value: "M", row: 0, col: 0 }], lines: ["MENU", "", "     Choice:"] } }))
  await writeFile(join(dir, "operator-notes.md"), "D3 operator verified and approved PowerTerm parity for this disposable screen flow.\n")
  await writeFile(join(dir, "compile-catalog-transcript.txt"), "BASIC BP TEST.ITEM\nBASIC OK\nCATALOG BP TEST.ITEM\nCATALOG OK\n")
  await writeFile(join(dir, "rollback.md"), "Rollback: restore from before backup for disposable TEST.ITEM.\n")
  return dir
}

test("product completion audit covers full objective and keeps live D3 proof explicit", async () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  try {
    const config: D3CodeConfig = {
      version: 1,
      defaultModel: "openai/gpt-5",
      defaultSafety: "ask",
      defaultProfile: "prod",
      profiles: [{ name: "prod", type: "local", account: "SALES", sessionMode: "persistent", promptPattern: ">" }],
      modelSecrets: { openai: "env:OPENAI_API_KEY" },
    }
    const report = await createProductCompletionAudit(config, new EnvSecretStore(), {
      referenceDir: defaultReferenceDir,
      manualPath: defaultD3ReferenceManual,
      userGuidePath: defaultD3UserGuide,
      installProof: await createInstallProofReport(),
      acceptance: await runMockAcceptance(),
    })

    assert.equal(report.complete, false)
    assert.equal(report.requirements.find((item) => item.id === "reference-skills-baked")?.status, "proven")
    assert.equal(report.requirements.find((item) => item.id === "migration-mode-webapp")?.status, "proven")
    assert.equal(report.requirements.find((item) => item.id === "d3-code-database-audit")?.status, "proven")
    assert.equal(report.requirements.find((item) => item.id === "model-and-install-readiness")?.status, "proven")
    assert.ok(report.requirements.find((item) => item.id === "model-and-install-readiness")?.proof.some((item) => item.includes("interactive-default-launch:ok")))
    assert.ok(report.requirements.find((item) => item.id === "model-and-install-readiness")?.proof.some((item) => item.includes("ink-app-render:yes")))
    assert.equal(report.requirements.find((item) => item.id === "d3-manual-scope")?.status, "proven")
    assert.equal(report.requirements.find((item) => item.id === "d3-command-capability-matrix")?.status, "partial")
    assert.ok(report.requirements.find((item) => item.id === "d3-command-capability-matrix")?.proof.some((item) => item.includes("known-command-support")))
    assert.ok(report.requirements.find((item) => item.id === "d3-command-capability-matrix")?.gaps.some((item) => item.includes("backup-restore:raw-tcl-only")))
    assert.equal(report.requirements.find((item) => item.id === "offline-regression-acceptance")?.status, "proven")
    assert.equal(report.requirements.find((item) => item.id === "live-d3-proof")?.status, "partial")
    assert.match(renderProductCompletionAudit(report), /D3 Code Product Completion Audit/)
    assert.match(renderProductCompletionAudit(report), /interactive-default-launch:ok/)
    assert.match(renderProductCompletionAudit(report), /no real D3 profile\/account proof/)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test("product completion audit requires interactive d3code launch proof", async () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  try {
    const config: D3CodeConfig = {
      version: 1,
      defaultModel: "openai/gpt-5",
      defaultSafety: "ask",
      defaultProfile: "prod",
      profiles: [{ name: "prod", type: "local", account: "SALES", sessionMode: "persistent", promptPattern: ">" }],
      modelSecrets: { openai: "env:OPENAI_API_KEY" },
    }
    const installProof = await createInstallProofReport()
    const report = await createProductCompletionAudit(config, new EnvSecretStore(), {
      installProof: {
        ...installProof,
        ready: true,
        checks: installProof.checks.filter((check) => check.id !== "interactive-default-launch"),
      },
      acceptance: await runMockAcceptance(),
    })

    const install = report.requirements.find((item) => item.id === "model-and-install-readiness")
    assert.equal(install?.status, "partial")
    assert.ok(install?.gaps.includes("interactive default `d3code` launch path is not proven"))
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test("product completion audit can consume a live proof artifact directory", async () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  try {
    const config: D3CodeConfig = {
      version: 1,
      defaultModel: "openai/gpt-5",
      defaultSafety: "ask",
      defaultProfile: "prod",
      profiles: [{ name: "prod", type: "local", account: "SALES", sessionMode: "persistent", promptPattern: ">" }],
      modelSecrets: { openai: "env:OPENAI_API_KEY" },
    }
    const report = await createProductCompletionAudit(config, new EnvSecretStore(), {
      referenceDir: defaultReferenceDir,
      manualPath: defaultD3ReferenceManual,
      userGuidePath: defaultD3UserGuide,
      installProof: await createInstallProofReport(),
      liveProofDir: await writeLiveProofDir(),
      acceptance: {
        ready: true,
        root: "mock",
        steps: [
          { id: "agent-migration-slice", ok: true, evidence: ["ready:yes"] },
          { id: "agent-file-audit", ok: true, evidence: ["ready:yes"] },
          { id: "agent-basic-check", ok: true, evidence: ["ready:yes"] },
        ],
      },
    })

    assert.equal(report.requirements.find((item) => item.id === "live-d3-proof")?.status, "proven")
    assert.match(renderProductCompletionAudit(report), /live-proof-artifacts:ready/)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})
