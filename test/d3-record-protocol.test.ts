import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { assertRecordNext, assertRecordReady, encodeRecordRequest, parseRecordResponse, recordBytes, recordHelper, recordWriteAllowed, RECORD_CAPABILITIES, RECORD_MAX_BYTES } from "../src/d3/record-protocol.js"

const nonce = "0123456789ABCDEF0123456789ABCDEF"
function response(bytes: Uint8Array, status = "READ", owner = 0): string {
  const hex = Buffer.from(bytes).toString("hex").toUpperCase()
  const chunks = hex.match(/.{1,64}/g) ?? []
  return [
    `D3R1 BEGIN ${nonce} ${status} ${bytes.length} ${owner}`,
    `D3R1 BUILD ${recordHelper.buildId}`,
    ...chunks.map((chunk, index) => `D3R1 DATA ${index + 1} ${chunk}`),
    `D3R1 END ${nonce} ${chunks.length}`,
  ].join("\n")
}

test("CAS request carries exact binary lengths, IDs and record bytes in acknowledged hex frames", () => {
  const expected = Buffer.from([65, 254, 254, 66, 253, 67, 252, 68, 32, 32, 254])
  const replacement = Buffer.from([254, 253, 252, 0, 32, 254, 254])
  const item = recordBytes(" leading ID ")
  const encoded = encodeRecordRequest({ operation: "CAS_EXISTING", nonce, file: "D3CODE.TEST", section: "dict", item, expected, replacement })
  assert.equal(encoded.frames.at(-1), ".")
  for (const frame of encoded.frames.slice(0, -1)) assert.match(frame, /^(?:[0-9A-F]{2}){1,32}$/)
  const packet = Buffer.from(encoded.frames.slice(0, -1).join(""), "hex")
  assert.equal(packet.subarray(0, 4).toString(), "D3R1")
  assert.equal(packet[4], 2)
  assert.equal(packet[5], 1)
  assert.equal(packet.subarray(6, 22).toString("hex").toUpperCase(), nonce)
  assert.equal(packet.readUInt32BE(24), expected.length)
  assert.equal(packet.readUInt32BE(28), replacement.length)
  assert.deepEqual(packet.subarray(32), Buffer.concat([Buffer.from("D3CODE.TEST"), Buffer.from(item), expected, replacement]))
})

test("VERSION is an empty-target request and READ cannot carry write data", () => {
  const encoded = encodeRecordRequest({ operation: "VERSION", nonce })
  assert.equal(encoded.frames.length, 2)
  const packet = Buffer.from(encoded.frames[0]!, "hex")
  assert.equal(packet.length, 32)
  assert.equal(packet[4], 0)
  assert.ok(packet.subarray(22).every(byte => byte === 0))
  assert.throws(() => encodeRecordRequest({ operation: "READ", nonce, file: "bp", item: recordBytes("ONE"), expected: Buffer.alloc(0) }), /write payloads/)
})

test("sandbox BASIC source is writable without allowing compiled objects or existing programs", () => {
  for (const file of ["bp", "BP"]) {
    assert.equal(recordWriteAllowed(file, recordBytes("D3CODE.PROBE")), true)
    assert.equal(recordWriteAllowed(file, recordBytes("D3CODE.PROBE"), "dict"), false)
    assert.equal(recordWriteAllowed(file, recordBytes("B.DAYEND")), false)
    assert.equal(recordWriteAllowed(file, recordBytes("D3CODE.")), false)
    encodeRecordRequest({ operation: "CAS_EXISTING", nonce, file, item: recordBytes("D3CODE.PROBE"), expected: Buffer.alloc(0), replacement: recordBytes("STOP") })
  }
})

test("encoding rejects Unicode truncation, unsafe references, missing bytes and oversized records", () => {
  assert.throws(() => recordBytes("emoji 😀"), /single-byte/)
  assert.throws(() => recordBytes("\u0100"), /single-byte/)
  assert.deepEqual(recordBytes("é"), Buffer.from([233]))
  const base = { operation: "CAS_EXISTING" as const, nonce, file: "D3CODE.TEST", item: recordBytes("ID"), expected: Buffer.alloc(0), replacement: Buffer.alloc(0) }
  for (const file of ["MD", "bp", "D3CODE.", "D3CODE.TEST\nWHO", "OTHER,FILE", "D3CODE.😀"]) assert.throws(() => encodeRecordRequest({ ...base, file }))
  assert.throws(() => encodeRecordRequest({ ...base, replacement: Buffer.alloc(RECORD_MAX_BYTES + 1) }), /at most/)
  assert.throws(() => encodeRecordRequest({ ...base, expected: "lost Unicode" as unknown as Uint8Array }), /must be bytes/)
  assert.throws(() => encodeRecordRequest({ ...base, item: Buffer.from([254]) }), /Item ID/)
  assert.throws(() => encodeRecordRequest({ ...base, nonce: "bad" }), /nonce/)
})

test("response decoding preserves delimiters, empty attributes, trailing spaces and zero-byte records", () => {
  const bytes = Buffer.concat([Buffer.alloc(65, 65), Buffer.from([254, 254, 253, 252, 0, 32, 32, 254])])
  assert.deepEqual(parseRecordResponse(`command echo\r\n${response(bytes).replace(/\n/g, "\r\n")}\r\n\u001b[25;1H:`, nonce), { status: "READ", bytes })
  assert.deepEqual(parseRecordResponse(response(Buffer.alloc(0)), nonce), { status: "READ", bytes: Buffer.alloc(0) })
  assert.deepEqual(parseRecordResponse(response(Buffer.alloc(0), "NOT_FOUND"), nonce), { status: "NOT_FOUND", bytes: Buffer.alloc(0) })
  assert.deepEqual(parseRecordResponse(response(Buffer.alloc(0), "BUSY", 7), nonce), { status: "BUSY", bytes: Buffer.alloc(0), lockOwner: 7 })
  assert.equal(parseRecordResponse(response(recordBytes(RECORD_CAPABILITIES), "VERSION"), nonce).status, "VERSION")
})

test("malformed, truncated, duplicated, wrong-nonce and wrong-build responses fail closed", () => {
  const valid = response(Buffer.alloc(40, 65))
  const lines = valid.split("\n")
  for (const invalid of [
    lines.slice(0, -1).join("\n"),
    [lines[0], lines[1], lines[2], lines[2], ...lines.slice(3)].join("\n"),
    [lines[0], lines[1], lines[3], lines[2], lines[4]].join("\n"),
    valid.replace("D3R1 DATA 1 41", "D3R1 DATA 1 G1"),
    valid.replace("READ 40", "READ 41"),
    valid.replace(nonce, "F".repeat(32)),
    valid.replace(recordHelper.buildId, "F".repeat(64)),
    `${valid}\n${lines.at(-1)}`,
    valid.replace("READ 40", `READ ${RECORD_MAX_BYTES + 1}`),
    response(recordBytes("not capabilities"), "VERSION"),
    response(recordBytes("unexpected"), "NOT_FOUND"),
  ]) assert.throws(() => parseRecordResponse(invalid, nonce))
})

test("READY and NEXT validate identity and exact acknowledgement sequence", () => {
  assertRecordReady(`D3R1 READY ${recordHelper.buildId}\n`)
  assertRecordNext(`hex echo\nD3R1 NEXT ${nonce} 1`, nonce, 1)
  assert.throws(() => assertRecordNext(`D3R1 NEXT ${nonce} 2`, nonce, 1), /acknowledgement/)
  assert.throws(() => assertRecordNext(`D3R1 NEXT ${"F".repeat(32)} 1`, nonce, 1), /acknowledgement/)
  assert.throws(() => assertRecordReady(`D3R1 READY ${recordHelper.buildId}\nD3R1 READY ${recordHelper.buildId}`), /READY/)
})

test("maximum-size requests and responses remain bounded with terminal-width frames", () => {
  const bytes = Buffer.alloc(RECORD_MAX_BYTES, 254)
  const encoded = encodeRecordRequest({ operation: "CAS_EXISTING", nonce, file: "D3CODE." + "F".repeat(93), item: Buffer.alloc(100, 73), expected: bytes, replacement: bytes })
  assert.equal(encoded.frames.length, 521)
  assert.ok(encoded.frames.slice(0, -1).every(frame => frame.length <= 64))
  const output = response(bytes, "OK")
  assert.ok(output.split("\n").every(line => line.length <= 79))
  assert.deepEqual(parseRecordResponse(output, nonce).bytes, bytes)
})

test("immutable deployment identity hashes final source and includes lock-safe sandbox-only operations", () => {
  assert.equal(recordHelper.sourceHash, createHash("sha256").update(recordHelper.source, "ascii").digest("hex").toUpperCase())
  assert.equal(recordHelper.programName, `D3CODE.RECORD.V1.${recordHelper.sourceHash}`)
  assert.ok(recordHelper.programName.length <= 100)
  assert.match(recordHelper.source, /INPUT LINE,65_ FOR 100/)
  assert.ok(recordHelper.source.indexOf('IF LINE = "." THEN EXIT') < recordHelper.source.indexOf("READU CURRENT"))
  assert.match(recordHelper.source, /READU CURRENT FROM TARGET,ITEM.ID LOCKED/)
  assert.match(recordHelper.source, /WRITEU REPLACEMENT ON TARGET,ITEM.ID ON ERROR/)
  assert.match(recordHelper.source, /IF HELD THEN RELEASE TARGET,ITEM.ID/)
  assert.match(recordHelper.source, /SEQ\(LEFT.REC\[POS,1\]\) # SEQ\(RIGHT.REC\[POS,1\]\)/)
  assert.match(recordHelper.source, /PREFIX = "D3CODE\."/)
  assert.doesNotMatch(recordHelper.source, /\bDELETE\b|\bEXECUTE\b|\bCATALOG\b(?! REQUIRED)/)
})

test("creation has a distinct operation and cannot replace an existing zero-byte record", () => {
  const request={operation:"CREATE_ONLY" as const,nonce,file:"D3CODE.TEST",item:recordBytes("NEW"),replacement:recordBytes("A\xfe\xfeB\xfdC\xfcD  \xfe")}
  const encoded=encodeRecordRequest(request)
  const bytes=Buffer.from(encoded.frames.slice(0,-1).join(""),"hex")
  assert.equal(bytes[4],3)
  assert.equal(bytes.readUInt32BE(24),0)
  assert.equal(bytes.readUInt32BE(28),request.replacement.length)
  assert.throws(()=>encodeRecordRequest({...request,expected:Buffer.alloc(0)}),/must not contain an expected record/)
  assert.throws(()=>encodeRecordRequest({...request,replacement:undefined}),/Replacement record must be bytes/)
  assert.throws(()=>encodeRecordRequest({...request,file:"CUSTOMERS"}),/restricted/)
  assert.throws(()=>encodeRecordRequest({...request,file:"bp",section:"dict"}),/restricted/)
  assert.deepEqual(parseRecordResponse(response(Buffer.alloc(0),"ALREADY_EXISTS"),nonce),{status:"ALREADY_EXISTS",bytes:Buffer.alloc(0)})
  assert.throws(()=>parseRecordResponse(response(recordBytes("private existing data"),"ALREADY_EXISTS"),nonce),/Unexpected payload/)
})
