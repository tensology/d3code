import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("CLI lists saved sessions from isolated D3CODE_HOME", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-sessions-"))
  const env = { ...process.env, D3CODE_HOME: home }
  await execFileAsync("node", [
    "--input-type=module",
    "-e",
    [
      "const store = await import('./dist/src/sessions/store.js')",
      "const session = store.appendEvent(store.newSession('openai/gpt-5-mini', 'ask', 'local'), { type: 'user', content: 'inspect ORDERS' })",
      "await store.saveSession(session)",
    ].join(";"),
  ], { cwd: process.cwd(), env })

  const result = await execFileAsync("node", ["dist/src/cli.js", "sessions"], { cwd: process.cwd(), env })
  assert.match(result.stdout, /openai\/gpt-5-mini/)
  assert.match(result.stdout, /profile=local/)
  assert.match(result.stdout, /inspect ORDERS/)
})
