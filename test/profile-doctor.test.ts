import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { diagnoseProfile, renderProfileDoctor } from "../src/d3/profile-doctor.js"

test("profile doctor reports read-only D3 smoke check readiness", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-profile-doctor-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *WHO*) printf 'SALES\\n' ;;",
    "  *VERSION*) printf 'D3 10.3 MOCK\\n' ;;",
    "  *'LIST MD'*) printf 'CUSTOMERS\\nBP\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })

  const report = await diagnoseProfile({ name: "local", type: "local", entryCommand: script, account: "SALES" })
  assert.equal(report.profile, "local")
  assert.equal(report.ready, true)
  assert.deepEqual(report.checks.map((check) => check.command), ["WHO", "VERSION", "LIST MD (N"])
  assert.match(renderProfileDoctor(report), /D3 Profile Doctor/)
})
