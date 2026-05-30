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
