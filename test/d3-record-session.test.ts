import assert from "node:assert/strict"
import test from "node:test"
import { runRecordOperation } from "../src/d3/record-session.js"
import { recordHelper, RECORD_CAPABILITIES } from "../src/d3/record-protocol.js"
import type { ConnectionProfile, D3Session } from "../src/domain/types.js"

const nonce = "0123456789ABCDEF0123456789ABCDEF"
const profile: ConnectionProfile = { name: "office", type: "ssh", account: "dm" }

function fixture(failAt = -1) {
  const commands: string[] = []
  let closed = 0
  const createSession = (selected: ConnectionProfile): D3Session => ({
    profile: selected,
    async run(command, _timeout, options) {
      commands.push(command)
      assert.equal(selected.sessionMode, "persistent")
      assert.match(selected.promptPattern!, /D3R1/)
      if (commands.length === failAt) throw Error("Transport failed")
      const hex = Buffer.from(RECORD_CAPABILITIES).toString("hex").toUpperCase()
      const chunks = hex.match(/.{1,64}/g)!
      const output = commands.length === 1 ? `D3R1 READY ${recordHelper.buildId}\n` : command === "."
        ? [`D3R1 BEGIN ${nonce} VERSION ${RECORD_CAPABILITIES.length} 0`, `D3R1 BUILD ${recordHelper.buildId}`, ...chunks.map((chunk, n) => `D3R1 DATA ${n + 1} ${chunk}`), `D3R1 END ${nonce} ${chunks.length}`, ":"].join("\n")
        : `D3R1 NEXT ${nonce} ${commands.length - 1}\n`
      options?.onStdout?.(output)
      return { command, stdout: "stripped prompt", stderr: "", exitCode: null, durationMs: 1 }
    },
    async close() { closed++ },
  })
  return { commands, createSession, closed: () => closed }
}

test("record exchange uses raw prompt acknowledgements and closes its dedicated session", async () => {
  const f = fixture()
  const result = await runRecordOperation(profile, { operation: "VERSION", nonce }, { createSession: f.createSession })
  assert.equal(result.status, "VERSION")
  assert.equal(Buffer.from(result.bytes).toString(), RECORD_CAPABILITIES)
  assert.equal(f.commands[0], recordHelper.runCommand)
  assert.equal(f.commands.at(-1), ".")
  assert.equal(f.closed(), 1)
})

test("transport failures never send later frames and always close", async () => {
  const f = fixture(2)
  await assert.rejects(runRecordOperation(profile, { operation: "VERSION", nonce }, { createSession: f.createSession }), /Record transport failed.*Reload/)
  assert.equal(f.commands.length, 2)
  assert.equal(f.closed(), 1)
})

test("wrong acknowledgement fails closed before the next frame", async () => {
  const f = fixture()
  const factory = (p: ConnectionProfile) => {
    const session = f.createSession(p)
    const original = session.run.bind(session)
    session.run = (command, timeout, options) => original(command, timeout, { ...options, onStdout: chunk => options?.onStdout?.(chunk.replace(`NEXT ${nonce} 1`, `NEXT ${nonce} 2`)) })
    return session
  }
  await assert.rejects(runRecordOperation(profile, { operation: "VERSION", nonce }, { createSession: factory }), /acknowledgement/)
  assert.equal(f.commands.length, 2)
  assert.equal(f.closed(), 1)
})

test("a helper returning to TCL without its identity never receives record frames", async () => {
  const f = fixture()
  const factory = (p: ConnectionProfile) => {
    const session = f.createSession(p)
    const original = session.run.bind(session)
    session.run = (command, timeout, options) => original(command, timeout, { ...options, onStdout: () => options?.onStdout?.("[401] Program not found\n:") })
    return session
  }
  await assert.rejects(runRecordOperation(profile, { operation: "VERSION", nonce }, { createSession: factory }), /identity/)
  assert.equal(f.commands.length, 1)
  assert.equal(f.closed(), 1)
})

test("non-native, invalid or cancelled requests never create a session", async () => {
  const f = fixture()
  for (const p of [{ ...profile, entryCommand: "sh" }, { ...profile, type: "local" as const }]) await assert.rejects(runRecordOperation(p, { operation: "VERSION", nonce }, { createSession: f.createSession }), /native D3/)
  await assert.rejects(runRecordOperation(profile, { operation: "VERSION", nonce }, { createSession: f.createSession, timeoutMs: 0 }), /positive/)
  await assert.rejects(runRecordOperation(profile, { operation: "VERSION", nonce }, { createSession: f.createSession, signal: AbortSignal.abort() }))
  assert.equal(f.commands.length, 0)
})
