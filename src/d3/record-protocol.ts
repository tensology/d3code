import { createHash } from "node:crypto"

export const RECORD_MAX_BYTES = 8192
export const RECORD_FRAME_HEX_CHARS = 64
export const RECORD_CAPABILITIES = "D3CODE.RECORD/1;MAX_BYTES=8192;READ;CAS_EXISTING;WRITE_PREFIX=D3CODE."
const maxRequestBytes = 32 + 200 + 2 * RECORD_MAX_BYTES

export type RecordRequest = { operation: "VERSION"; nonce: string } | {
  operation: "READ" | "CAS_EXISTING"
  nonce: string
  file: string
  section?: "data" | "dict"
  item: Uint8Array
  expected?: Uint8Array
  replacement?: Uint8Array
}

// Explicit legacy-byte conversion: Buffer.from(text, "latin1") alone truncates Unicode.
export function recordBytes(text: string): Uint8Array {
  if ([...text].some(character => character.codePointAt(0)! > 255)) throw new Error("Record text contains characters outside the single-byte encoding.")
  return Buffer.from(text, "latin1")
}

function nonceOf(nonce: string): string {
  if (!/^[0-9a-f]{32}$/i.test(nonce)) throw new Error("Record nonce must be 16 bytes encoded as hexadecimal.")
  return nonce.toUpperCase()
}

function checkedBytes(value: unknown, max: number, label: string): Buffer {
  if (!(value instanceof Uint8Array) || value.length > max) throw new Error(`${label} must be bytes, at most ${max}.`)
  return Buffer.from(value)
}

/** Send frames sequentially, waiting for NEXT after each hex frame. Send '.' last.
 * Never queue frames or reuse the session after timeout, unexpected ACK, or malformed output.
 * D3 INPUT pp418-420: the underscore waits for CR instead of ending at the length limit.
 */
export function encodeRecordRequest(request: RecordRequest): { nonce: string; frames: string[] } {
  const nonce = nonceOf(request.nonce)
  const header = Buffer.alloc(32)
  header.write("D3R1", 0, "ascii")
  Buffer.from(nonce, "hex").copy(header, 6)
  let fields: Buffer[] = []
  if (request.operation !== "VERSION") {
    if (request.operation !== "READ" && request.operation !== "CAS_EXISTING") throw new Error("Unknown record operation.")
    if (!/^[A-Za-z0-9_.:$-]{1,100}$/.test(request.file)) throw new Error("Invalid record file name.")
    const section = request.section ?? "data"
    if (section !== "data" && section !== "dict") throw new Error("Record section must be data or dict.")
    const item = checkedBytes(request.item, 100, "Item ID")
    if (!item.length || item.some(byte => byte >= 247)) throw new Error("Item ID must contain 1-100 bytes below 247.")
    const file = Buffer.from(request.file, "ascii")
    const expected = request.operation === "CAS_EXISTING" ? checkedBytes(request.expected, RECORD_MAX_BYTES, "Expected record") : Buffer.alloc(0)
    const replacement = request.operation === "CAS_EXISTING" ? checkedBytes(request.replacement, RECORD_MAX_BYTES, "Replacement record") : Buffer.alloc(0)
    if (request.operation === "READ" && (request.expected !== undefined || request.replacement !== undefined)) throw new Error("READ must not contain write payloads.")
    if (request.operation === "CAS_EXISTING" && (!request.file.startsWith("D3CODE.") || request.file.length < 8)) throw new Error("Record writes are restricted to D3CODE. sandbox files.")
    header[4] = request.operation === "READ" ? 1 : 2
    header[5] = section === "dict" ? 1 : 0
    header[22] = file.length
    header[23] = item.length
    header.writeUInt32BE(expected.length, 24)
    header.writeUInt32BE(replacement.length, 28)
    fields = [file, item, expected, replacement]
  }
  const hex = Buffer.concat([header, ...fields]).toString("hex").toUpperCase()
  return { nonce, frames: [...hex.match(/.{1,64}/g)!, "."] }
}

const statuses = ["VERSION", "READ", "OK", "NOT_FOUND", "BUSY", "CONFLICT", "WRITE_DENIED", "WRITE_ERROR", "VERIFY_FAILED", "OPEN_FAILED", "UNSUPPORTED_BINARY", "TOO_LARGE", "BAD_REQUEST", "INPUT_TIMEOUT"] as const
export type RecordStatus = typeof statuses[number]
export interface RecordResponse { status: RecordStatus; bytes: Uint8Array; lockOwner?: number }

function protocolLines(output: string): string[] {
  return output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\0/g, "").split(/\r\n?|\n/).map(line => line.trim()).filter(line => line.startsWith("D3R"))
}

export function assertRecordReady(output: string): void {
  const lines = protocolLines(output)
  if (lines.length !== 1 || lines[0] !== `D3R1 READY ${recordHelper.buildId}`) throw new Error("Unexpected record helper identity or READY frame.")
}

export function assertRecordNext(output: string, nonce: string, frameNumber: number): void {
  const lines = protocolLines(output)
  if (!Number.isSafeInteger(frameNumber) || frameNumber < 1 || lines.length !== 1 || lines[0] !== `D3R1 NEXT ${nonceOf(nonce)} ${frameNumber}`) throw new Error("Unexpected record upload acknowledgement; close the session.")
}

export function parseRecordResponse(output: string, nonce: string): RecordResponse {
  const lines = protocolLines(output)
  if (lines.length > 3 + Math.ceil(RECORD_MAX_BYTES / 32)) throw new Error("Record response exceeded its frame limit.")
  const first = lines[0]?.match(/^D3R1 BEGIN ([0-9A-F]{32}) ([A-Z_]+) (0|[1-9]\d*) (0|[1-9]\d*)$/)
  if (!first || first[1] !== nonceOf(nonce) || lines[1] !== `D3R1 BUILD ${recordHelper.buildId}` || !statuses.includes(first[2] as RecordStatus)) throw new Error("Invalid record response identity or header.")
  const length = Number(first[3])
  const owner = Number(first[4])
  if (!Number.isSafeInteger(length) || length > RECORD_MAX_BYTES || !Number.isSafeInteger(owner)) throw new Error("Invalid record response size or lock owner.")
  const chunks: Buffer[] = []
  for (let index = 2; index < lines.length - 1; index++) {
    const frame = lines[index]!.match(/^D3R1 DATA ([1-9]\d*) ((?:[0-9A-F]{2}){1,32})$/)
    if (!frame || Number(frame[1]) !== index - 1 || (index < lines.length - 2 && frame[2]!.length !== RECORD_FRAME_HEX_CHARS)) throw new Error("Malformed, duplicate or out-of-order record data frame.")
    chunks.push(Buffer.from(frame[2]!, "hex"))
  }
  if (lines.at(-1) !== `D3R1 END ${nonceOf(nonce)} ${chunks.length}`) throw new Error("Missing or invalid record response end frame.")
  const bytes = Buffer.concat(chunks)
  if (bytes.length !== length) throw new Error("Truncated record response or incorrect byte length.")
  if (first[2] !== "BUSY" && owner !== 0) throw new Error("Unexpected lock owner in record response.")
  if (first[2] === "VERSION" && bytes.toString("ascii") !== RECORD_CAPABILITIES) throw new Error("Unexpected record helper capabilities.")
  if (!["VERSION", "READ", "OK", "CONFLICT", "VERIFY_FAILED"].includes(first[2]!) && bytes.length) throw new Error("Unexpected payload in record error response.")
  return { status: first[2] as RecordStatus, bytes, ...(first[2] === "BUSY" ? { lockOwner: owner } : {}) }
}

// Provision explicitly after checking ownership and native locking; never install automatically.
const helperTemplate = `* D3CODE RECORD PROTOCOL 1. IMMUTABLE BUILD. NO CATALOG REQUIRED.
BUILD.ID = "@BUILD@"
HEX.DIGITS = "0123456789ABCDEF"
MAX.BYTES = 8192
MAX.WIRE = ${maxRequestBytes * 2}
MAX.FRAMES = ${Math.ceil(maxRequestBytes * 2 / RECORD_FRAME_HEX_CHARS) + 1}
PROMPT ""
WIRE = ""
NONCE = STR("0",32)
FRAMES = 0
BAD.INPUT = 0
HELD = 0
RESP = ""
OWNER = 0
STATUS = "BAD_REQUEST"
CRT "D3R1 READY ":BUILD.ID
LOOP
  LINE = ""
  INPUT LINE,65_ FOR 100 ELSE STATUS = "INPUT_TIMEOUT"; GOTO FINISH
  IF LINE = "." THEN EXIT
  FRAMES = FRAMES + 1
  IF FRAMES > MAX.FRAMES THEN GOTO FINISH
  IF LEN(LINE) = 0 OR LEN(LINE) > 64 OR MOD(LEN(LINE),2) # 0 THEN BAD.INPUT = 1
  FOR POS = 1 TO LEN(LINE)
    IF INDEX(HEX.DIGITS,LINE[POS,1],1) = 0 THEN BAD.INPUT = 1
  NEXT POS
  IF FRAMES = 1 THEN
    IF LEN(LINE) # 64 THEN BAD.INPUT = 1
    IF BAD.INPUT = 0 THEN NONCE = LINE[13,32]
  END
  IF LEN(WIRE) + LEN(LINE) > MAX.WIRE THEN BAD.INPUT = 1
  IF BAD.INPUT = 0 THEN WIRE = WIRE:LINE
  CRT "D3R1 NEXT ":NONCE:" ":FRAMES
REPEAT
IF BAD.INPUT OR LEN(WIRE) < 64 THEN GOTO FINISH
IF WIRE[1,8] # "44335231" THEN GOTO FINISH
VALUE.HEX = WIRE[9,2]; GOSUB HEX.NUMBER; MODE = NUMBER
VALUE.HEX = WIRE[11,2]; GOSUB HEX.NUMBER; SECTION = NUMBER
VALUE.HEX = WIRE[45,2]; GOSUB HEX.NUMBER; FILE.LEN = NUMBER
VALUE.HEX = WIRE[47,2]; GOSUB HEX.NUMBER; ID.LEN = NUMBER
VALUE.HEX = WIRE[49,8]; GOSUB HEX.NUMBER; OLD.LEN = NUMBER
VALUE.HEX = WIRE[57,8]; GOSUB HEX.NUMBER; NEW.LEN = NUMBER
IF OLD.LEN > MAX.BYTES OR NEW.LEN > MAX.BYTES THEN STATUS = "TOO_LARGE"; GOTO FINISH
IF LEN(WIRE) # 64+2*(FILE.LEN+ID.LEN+OLD.LEN+NEW.LEN) THEN GOTO FINISH
IF MODE = 0 THEN
  IF LEN(WIRE) # 64 OR SECTION # 0 THEN GOTO FINISH
  STATUS = "VERSION"
  RESP = "${RECORD_CAPABILITIES}"
  GOTO FINISH
END
IF MODE # 1 AND MODE # 2 THEN GOTO FINISH
IF SECTION > 1 OR FILE.LEN < 1 OR FILE.LEN > 100 OR ID.LEN < 1 OR ID.LEN > 100 THEN GOTO FINISH
RAW = ""
FOR POS = 65 TO LEN(WIRE) STEP 2
  HI = INDEX(HEX.DIGITS,WIRE[POS,1],1)-1
  LO = INDEX(HEX.DIGITS,WIRE[POS+1,1],1)-1
  RAW = RAW:CHAR(HI*16+LO)
NEXT POS
IF LEN(RAW)*2 # LEN(WIRE)-64 THEN GOTO FINISH
FILE.NAME = RAW[1,FILE.LEN]
ITEM.ID = RAW[1+FILE.LEN,ID.LEN]
ALLOWED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.:$-"
FOR POS = 1 TO FILE.LEN
  IF INDEX(ALLOWED,FILE.NAME[POS,1],1) = 0 THEN GOTO FINISH
NEXT POS
FOR POS = 1 TO ID.LEN
  IF SEQ(ITEM.ID[POS,1]) > 246 THEN GOTO FINISH
NEXT POS
IF MODE = 1 AND (OLD.LEN # 0 OR NEW.LEN # 0) THEN GOTO FINISH
IF MODE = 2 THEN
  PREFIX = "D3CODE."
  IF FILE.LEN < 8 THEN STATUS = "WRITE_DENIED"; GOTO FINISH
  FOR POS = 1 TO 7
    IF SEQ(FILE.NAME[POS,1]) # SEQ(PREFIX[POS,1]) THEN STATUS = "WRITE_DENIED"; GOTO FINISH
  NEXT POS
END
IF SECTION = 1 THEN
  OPEN "DICT",FILE.NAME TO TARGET ELSE STATUS = "OPEN_FAILED"; GOTO FINISH
END ELSE
  OPEN FILE.NAME TO TARGET ELSE STATUS = "OPEN_FAILED"; GOTO FINISH
END
CURRENT = ""
FOUND = 0
IF MODE = 1 THEN
  READ CURRENT FROM TARGET,ITEM.ID THEN FOUND = 1
END ELSE
  READU CURRENT FROM TARGET,ITEM.ID LOCKED
    OWNER = SYSTEM(0)
    STATUS = "BUSY"
    GOTO FINISH
  END THEN FOUND = 1
  HELD = 1
END
IF SYSTEM(0) = 10 THEN STATUS = "UNSUPPORTED_BINARY"; GOTO FINISH
IF FOUND = 0 THEN STATUS = "NOT_FOUND"; GOTO FINISH
IF LEN(CURRENT) > MAX.BYTES THEN STATUS = "TOO_LARGE"; GOTO FINISH
RESP = CURRENT
IF MODE = 1 THEN STATUS = "READ"; GOTO FINISH
EXPECTED = ""
REPLACEMENT = ""
IF OLD.LEN > 0 THEN EXPECTED = RAW[1+FILE.LEN+ID.LEN,OLD.LEN]
IF NEW.LEN > 0 THEN REPLACEMENT = RAW[1+FILE.LEN+ID.LEN+OLD.LEN,NEW.LEN]
LEFT.REC = CURRENT
RIGHT.REC = EXPECTED
GOSUB COMPARE.BYTES
IF SAME = 0 THEN STATUS = "CONFLICT"; GOTO FINISH
WRITEU REPLACEMENT ON TARGET,ITEM.ID ON ERROR
  STATUS = "WRITE_ERROR"
  RESP = ""
  GOTO FINISH
END
RESP = ""
READ RESP FROM TARGET,ITEM.ID ELSE STATUS = "VERIFY_FAILED"; GOTO FINISH
IF SYSTEM(0) = 10 OR LEN(RESP) > MAX.BYTES THEN STATUS = "VERIFY_FAILED"; RESP = ""; GOTO FINISH
LEFT.REC = RESP
RIGHT.REC = REPLACEMENT
GOSUB COMPARE.BYTES
STATUS = "OK"
IF SAME = 0 THEN STATUS = "VERIFY_FAILED"
GOTO FINISH
HEX.NUMBER:
NUMBER = 0
FOR DIGIT.POS = 1 TO LEN(VALUE.HEX)
  NUMBER = NUMBER*16+INDEX(HEX.DIGITS,VALUE.HEX[DIGIT.POS,1],1)-1
NEXT DIGIT.POS
RETURN
COMPARE.BYTES:
SAME = 0
IF LEN(LEFT.REC) # LEN(RIGHT.REC) THEN RETURN
IF LEN(LEFT.REC) = 0 THEN SAME = 1; RETURN
FOR POS = 1 TO LEN(LEFT.REC)
  IF SEQ(LEFT.REC[POS,1]) # SEQ(RIGHT.REC[POS,1]) THEN RETURN
NEXT POS
SAME = 1
RETURN
FINISH:
IF HELD THEN RELEASE TARGET,ITEM.ID
CRT "D3R1 BEGIN ":NONCE:" ":STATUS:" ":LEN(RESP):" ":OWNER
CRT "D3R1 BUILD ":BUILD.ID
CHUNK = ""
CHUNKS = 0
IF LEN(RESP) > 0 THEN
  FOR POS = 1 TO LEN(RESP)
    BYTE = SEQ(RESP[POS,1])
    CHUNK = CHUNK:HEX.DIGITS[INT(BYTE/16)+1,1]:HEX.DIGITS[MOD(BYTE,16)+1,1]
    IF LEN(CHUNK) = 64 THEN
      CHUNKS = CHUNKS+1
      CRT "D3R1 DATA ":CHUNKS:" ":CHUNK
      CHUNK = ""
    END
  NEXT POS
END
IF CHUNK # "" THEN
  CHUNKS = CHUNKS+1
  CRT "D3R1 DATA ":CHUNKS:" ":CHUNK
END
CRT "D3R1 END ":NONCE:" ":CHUNKS
STOP
`

const sha256 = (text: string): string => createHash("sha256").update(text, "ascii").digest("hex").toUpperCase()
const buildId = sha256(helperTemplate)
const source = helperTemplate.replace("@BUILD@", buildId)
const sourceHash = sha256(source)
export const recordHelper = Object.freeze({
  source,
  buildId,
  sourceHash,
  programName: `D3CODE.RECORD.V1.${sourceHash}`,
  sourceFile: "bp",
  // BASIC p1207 writes the object into DICT bp. Both namespaces must be absent.
  compileCommand: `BASIC bp D3CODE.RECORD.V1.${sourceHash}`,
  runCommand: `RUN bp D3CODE.RECORD.V1.${sourceHash} (AN`,
})
