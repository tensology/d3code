import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { checkLiveProofArtifacts, renderLiveProofArtifactReport, renderLiveProofScaffold, writeLiveProofScaffold } from "../src/d3/live-proof-artifacts.js"

export async function writePassingLiveProofFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "d3code-live-proof-"))
  await writeFile(join(dir, "live-proof-manifest.json"), `${JSON.stringify({
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
  }, null, 2)}\n`)
  await writeFile(join(dir, "profile-doctor.json"), `${JSON.stringify({
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
  }, null, 2)}\n`)
  await writeFile(join(dir, "terminal-transcript.txt"), "@(-1)MENU@(5,2)Choice:")
  await writeFile(join(dir, "screen-buffer.json"), `${JSON.stringify({
    width: 24,
    height: 6,
    row: 2,
    col: 12,
    events: [{ type: "text", value: "M", row: 0, col: 0 }],
    lines: ["MENU", "", "     Choice:"],
  }, null, 2)}\n`)
  await writeFile(join(dir, "terminal-capture.json"), `${JSON.stringify({
    profile: "prod",
    account: "SALES",
    command: "RUN BP MENU",
    risk: "read",
    result: { stdout: "@(-1)MENU@(5,2)Choice:", stderr: "", exitCode: 0, durationMs: 2 },
    screen: { width: 24, height: 6, row: 2, col: 12, events: [{ type: "text", value: "M", row: 0, col: 0 }], lines: ["MENU", "", "     Choice:"] },
  }, null, 2)}\n`)
  await writeFile(join(dir, "operator-notes.md"), "D3 operator verified and approved PowerTerm parity for this disposable screen flow.\n")
  await writeFile(join(dir, "compile-catalog-transcript.txt"), "BASIC BP TEST.ITEM\nBASIC OK\nCATALOG BP TEST.ITEM\nCATALOG OK\n")
  await writeFile(join(dir, "rollback.md"), "Rollback: restore from before backup for disposable TEST.ITEM.\n")
  return dir
}

test("live proof artifact checker validates operator-collected D3 evidence", async () => {
  const dir = await writePassingLiveProofFixture()
  const report = await checkLiveProofArtifacts(dir)
  assert.equal(report.ready, true)
  assert.ok(report.checks.every((check) => check.status === "ok"))
  assert.equal(report.checks.find((check) => check.id === "manifest")?.status, "ok")
  assert.match(renderLiveProofArtifactReport(report), /D3 Live Proof Artifact Check/)
  assert.match(renderLiveProofArtifactReport(report), /manifest/)
  assert.match(renderLiveProofArtifactReport(report), /compile-catalog/)
})

test("live proof artifact checker names missing proof", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-live-proof-missing-"))
  const report = await checkLiveProofArtifacts(dir)
  assert.equal(report.ready, false)
  assert.equal(report.checks.find((check) => check.id === "manifest")?.status, "missing")
  assert.equal(report.checks.find((check) => check.id === "profile-doctor")?.status, "missing")
  assert.equal(report.checks.find((check) => check.id === "rollback")?.status, "missing")
})

test("live proof artifact checker rejects manifest mismatch", async () => {
  const dir = await writePassingLiveProofFixture()
  await writeFile(join(dir, "live-proof-manifest.json"), `${JSON.stringify({
    profile: "prod",
    account: "OTHER",
    screenCommand: "RUN BP MENU",
    basicFile: "BP",
    basicItem: "TEST.ITEM",
    requiredArtifacts: ["profile-doctor.json", "terminal-capture.json", "screen-buffer.json", "operator-notes.md", "compile-catalog-transcript.txt", "rollback.md"],
    safety: {
      terminalSends: "blocked-until-D3CODE_TERMINAL_ENABLED",
      mutations: "blocked-until-D3CODE_ALLOW_WRITES",
      transcriptRecording: "redacted-unless-D3CODE_TERMINAL_RECORD_TRANSCRIPT",
    },
  }, null, 2)}\n`)
  const report = await checkLiveProofArtifacts(dir)
  assert.equal(report.ready, false)
  assert.equal(report.checks.find((check) => check.id === "manifest")?.status, "failed")
})

test("live proof scaffold writes operator collection files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-live-proof-scaffold-"))
  const result = await writeLiveProofScaffold(dir, { profile: "prod", account: "SALES", screenCommand: "RUN BP MENU", basicFile: "BP", basicItem: "TEST.ITEM" })
  assert.ok(result.written.some((file) => file.endsWith("README.md")))
  assert.ok(result.written.some((file) => file.endsWith("live-proof-manifest.json")))
  assert.ok(result.written.some((file) => file.endsWith("profile-doctor.json")))
  assert.match(await readFile(join(dir, "live-proof-manifest.json"), "utf8"), /D3CODE_TERMINAL_ENABLED/)
  assert.match(await readFile(join(dir, "README.md"), "utf8"), /live-proof-check/)
  assert.match(await readFile(join(dir, "compile-catalog-transcript.txt"), "utf8"), /BASIC BP TEST\.ITEM/)
  assert.match(renderLiveProofScaffold(result), /D3 Live Proof Scaffold/)

  const report = await checkLiveProofArtifacts(dir)
  assert.equal(report.ready, false)
  assert.equal(report.checks.find((check) => check.id === "profile-doctor")?.status, "failed")
})
