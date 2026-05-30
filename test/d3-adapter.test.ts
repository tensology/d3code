import assert from "node:assert/strict"
import test from "node:test"
import { createD3Session, PersistentLocalD3Session } from "../src/d3/adapter.js"

test("persistent local D3 session preserves shell state across commands", async () => {
  const session = new PersistentLocalD3Session({ name: "persistent", type: "local", sessionMode: "persistent" })
  try {
    await session.run("D3CODE_STATE=kept")
    const result = await session.run("printf %s \"$D3CODE_STATE\"")
    assert.equal(result.stdout, "kept")
    assert.equal(result.exitCode, 0)
  } finally {
    await session.close()
  }
})

test("factory selects persistent local session when profile requests it", () => {
  const session = createD3Session({ name: "persistent", type: "local", sessionMode: "persistent" })
  assert.ok(session instanceof PersistentLocalD3Session)
})

test("persistent local D3 session fails when entry exits before prompt", async () => {
  const session = new PersistentLocalD3Session({
    name: "bad-entry",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"process.exit(7)\"",
    promptPattern: "D3>",
  })
  await assert.rejects(() => session.run("WHO", 500), /Persistent D3 session exited before the prompt was seen/)
})

test("persistent local D3 session ignores startup prompt before first command", async () => {
  const session = new PersistentLocalD3Session({
    name: "prompted",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"process.stdout.write('D3>');process.stdin.on('data',d=>process.stdout.write('RESULT\\\\nD3>'))\"",
    promptPattern: "D3>",
  })
  try {
    const result = await session.run("WHO")
    assert.match(result.stdout, /RESULT/)
  } finally {
    await session.close()
  }
})
