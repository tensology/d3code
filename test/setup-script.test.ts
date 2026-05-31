import assert from "node:assert/strict"
import { stat, readFile } from "node:fs/promises"
import test from "node:test"

test("setup.sh is executable and documents D3 Code server setup steps", async () => {
  const info = await stat("setup.sh")
  const content = await readFile("setup.sh", "utf8")

  assert.equal(Boolean(info.mode & 0o111), true)
  assert.match(content, /Node\.js 20/)
  assert.match(content, /npm install/)
  assert.match(content, /npm run build/)
  assert.match(content, /npm link/)
  assert.match(content, /d3 -V/)
  assert.match(content, /d3code setup/)
  assert.match(content, /profile-add-local/)
})
