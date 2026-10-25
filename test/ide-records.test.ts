import assert from "node:assert/strict"
import test from "node:test"
import { Script } from "node:vm"
import { readEditorRecord, saveEditorRecord, recordConnection, EditorRecordError } from "../src/d3/records.js"
import { startIdeServer } from "../src/ide/server.js"
import type { runRecordOperation } from "../src/d3/record-session.js"
import type { ConnectionProfile } from "../src/domain/types.js"

const profile: ConnectionProfile = { name: "office", type: "ssh", host: "example.invalid", account: "dm", allowedAccounts: ["dm"] }
const original = Buffer.from([65, 254, 254, 253, 252, 32, 32, 254])
const input = { profile: "office", file: "D3CODE.TEST", item: " leading ID ", section: "data", connection: recordConnection(profile), expected: original.toString("base64"), replacement: Buffer.from([254, 254, 66, 32, 32, 254]).toString("base64"), confirmed: true }

test("record read returns exact bytes, connection identity and sandbox scope", async () => {
  const result = await readEditorRecord(profile, input, async (selected, request) => {
    assert.equal(selected, profile);assert.equal(request.operation, "READ")
    assert.equal(Buffer.from(request.item).toString(), " leading ID ")
    return { status: "READ", bytes: original }
  })
  assert.equal(result.original, original.toString("base64"))
  assert.equal(result.connection, recordConnection(profile))
  assert.equal(result.writable, true)
})

test("record save requires approval and unchanged target before the native operation", async () => {
  let calls = 0
  const operation: typeof runRecordOperation = async () => { calls++;return { status: "OK", bytes: Buffer.from(input.replacement, "base64") } }
  for (const [mode, changed, status] of [
    ["ask", { confirmed: false }, 409], ["plan", {}, 403], ["ask", { profile: "other" }, 409],
    ["ask", { connection: "wrong" }, 409], ["ask", { expected: "@@@" }, 400],
    ["ask", { replacement: Buffer.alloc(8193).toString("base64") }, 400], ["ask", { file: "CUSTOMERS" }, 403],
    ["ask", { file: "bp", item: "D3CODE.PROBE", section: "dict" }, 403],
  ] as const) {
    await assert.rejects(saveEditorRecord(profile, mode, { ...input, ...changed }, operation), error => error instanceof EditorRecordError && error.status === status)
  }
  assert.equal(calls, 0)
  const saved = await saveEditorRecord(profile, "ask", input, operation)
  assert.equal(calls, 1);assert.deepEqual(saved, { saved: true, original: input.replacement })
})

test("conflict and lock responses preserve the client baseline and report recovery", async () => {
  for (const status of ["CONFLICT", "BUSY"] as const) {
    await assert.rejects(saveEditorRecord(profile, "ask", input, async () => ({ status, bytes: Buffer.alloc(0), lockOwner: 7 })), error => error instanceof EditorRecordError && error.status === 409 && /draft is kept/.test(error.message))
  }
  await assert.rejects(saveEditorRecord(profile, "ask", input, async () => ({ status: "OK", bytes: original })), /readback differs/)
  await assert.rejects(saveEditorRecord(profile, "ask", input, async () => { throw Error("private record bytes") }), error => error instanceof EditorRecordError && /may have been written/.test(error.message) && !error.message.includes("private"))
  assert.equal(input.expected, original.toString("base64"))
})

test("read errors distinguish unavailable bridge from missing or unsupported records", async () => {
  await assert.rejects(readEditorRecord(profile, input, async () => { throw Error("helper absent") }), error => error instanceof EditorRecordError && error.bridgeUnavailable && error.status === 503)
  for (const [status, code] of [["NOT_FOUND", 404], ["TOO_LARGE", 422], ["UNSUPPORTED_BINARY", 422]] as const) await assert.rejects(readEditorRecord(profile, input, async () => ({ status, bytes: Buffer.alloc(0) })), error => error instanceof EditorRecordError && error.status === code && !error.bridgeUnavailable)
  for (const changed of [{ file: "BAD\nWHO" }, { item: "😀" }, { section: "object" }]) await assert.rejects(readEditorRecord(profile, { ...input, ...changed }, async () => { throw Error("must not run") }), error => error instanceof EditorRecordError && error.status === 400)
})

test("IDE record API enforces the active connection, approval and native conflict response", async () => {
  let stored = Buffer.from(original), writes = 0
  const handle = await startIdeServer({ version: 1, defaultModel: "openai/gpt-5", defaultSafety: "ask", defaultProfile: "office", profiles: [profile], modelSecrets: {} }, { model: "openai/gpt-5", safety: "ask", profile: "office", mode: "chat" }, {
    port: 0, host: "127.0.0.1", requireAuth: false,
    recordOperation: async (_profile, request) => {
      assert.notEqual(request.operation, "VERSION")
      if (request.operation === "VERSION") throw Error("unexpected")
      if (request.operation === "READ") return { status: "READ", bytes: stored }
      writes++
      if (!stored.equals(Buffer.from(request.expected!))) return { status: "CONFLICT", bytes: stored }
      stored = Buffer.from(request.replacement!);return { status: "OK", bytes: stored }
    },
  })
  try {
    const html = await (await fetch(handle.url)).text()
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Script(script[1]!))
    const query = new URLSearchParams({ profile: "office", file: input.file, item: input.item, section: "data" })
    assert.equal((await fetch(handle.url + "/api/record?" + query)).status, 200)
    const put = (payload: unknown) => fetch(handle.url + "/api/record", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
    assert.equal((await put({ ...input, confirmed: false })).status, 409);assert.equal(writes, 0)
    assert.equal((await put(input)).status, 200);assert.equal(writes, 1)
    const conflict = await put(input);assert.equal(conflict.status, 409);assert.match((await conflict.json() as { error: string }).error, /draft is kept/)
    query.set("profile", "other");assert.equal((await fetch(handle.url + "/api/record?" + query)).status, 409)
    assert.equal((await put([])).status, 400)
  } finally { await handle.close() }
})
