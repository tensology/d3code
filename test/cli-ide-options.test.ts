import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

test("IDE command flags reach the actual server runtime instead of root defaults", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3-ide-options-"))
  const child = spawn(process.execPath, ["dist/src/cli.js", "ide", "--host", "127.0.0.1", "--port", "0", "--mode", "migrate", "--safety", "plan", "--model", "openrouter/test-model"], {
    env: { ...process.env, D3CODE_HOME: home, D3CODE_STORAGE_NAMESPACE: "", D3CODE_REQUIRE_AUTH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const exited = new Promise<void>(resolve => child.once("close", () => resolve()))
  let output = ""
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("IDE startup timed out: " + output)), 10_000)
      child.stdout.on("data", chunk => {
        output += chunk.toString()
        const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
        if (address) { clearTimeout(timer); resolve(address) }
      })
      child.stderr.on("data", chunk => { output += chunk.toString() })
      child.once("error", error => { clearTimeout(timer); reject(error) })
      child.once("exit", () => { clearTimeout(timer); reject(new Error("IDE exited: " + output)) })
    })
    const response = await fetch(url + "/api/status")
    assert.equal(response.status, 200)
    const state = await response.json() as { mode: string; safety: string; model: string }
    assert.equal(state.mode, "migrate")
    assert.equal(state.safety, "plan")
    assert.equal(state.model, "openrouter/test-model")
  } finally {
    child.kill("SIGTERM")
    await exited
    await rm(home, { recursive: true, force: true })
  }
})
