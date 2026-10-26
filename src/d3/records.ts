import { createHash, randomBytes } from "node:crypto"
import type { ConnectionProfile, SafetyMode } from "../domain/types.js"
import { assertD3Allowed } from "../core/permissions.js"
import { recordBytes, recordWriteAllowed, RECORD_MAX_BYTES, type RecordResponse } from "./record-protocol.js"
import { runRecordOperation } from "./record-session.js"

export class EditorRecordError extends Error {
  get statusCode(): number { return this.status }
  constructor(readonly status: number, message: string, readonly bridgeUnavailable = false, cause?: unknown) { super(message, { cause }) }
}

export const recordConnection = (profile: ConnectionProfile): string => createHash("sha256").update(JSON.stringify(profile)).digest("hex")

function target(profile: ConnectionProfile, input: Record<string, unknown>) {
  if (input.profile !== profile.name) throw new EditorRecordError(409, "Connection changed. Reopen the item before saving. Your draft is kept.")
  if (typeof input.file !== "string" || !/^[A-Za-z0-9_.:$-]{1,100}$/.test(input.file)) throw new EditorRecordError(400, "Invalid D3 file name.")
  if (typeof input.item !== "string" || !input.item.length) throw new EditorRecordError(400, "An item ID is required.")
  const section = input.section ?? "data"
  if (section !== "data" && section !== "dict") throw new EditorRecordError(400, "Section must be data or dict.")
  let item: Uint8Array
  try { item = recordBytes(input.item) } catch { throw new EditorRecordError(400, "Item ID contains unsupported characters.") }
  if (item.length > 100 || item.some(byte => byte >= 247)) throw new EditorRecordError(400, "Item ID must contain 1-100 bytes below 247.")
  return { file: input.file, item, section: section as "data" | "dict", nonce: randomBytes(16).toString("hex") }
}

function decodeBytes(value: unknown): Buffer {
  if (typeof value !== "string" || value.length > Math.ceil(RECORD_MAX_BYTES / 3) * 4) throw new EditorRecordError(400, "Record exceeds the 8 KiB limit or is not encoded.")
  const bytes = Buffer.from(value, "base64")
  if (bytes.length > RECORD_MAX_BYTES || bytes.toString("base64") !== value) throw new EditorRecordError(400, "Record encoding is invalid.")
  return bytes
}

function responseError(response: RecordResponse): EditorRecordError {
  if (response.status === "ALREADY_EXISTS") return new EditorRecordError(409, "This item already exists. Your draft is kept. Open the existing item before changing it.")
  if (response.status === "CONFLICT") return new EditorRecordError(409, "Record changed on D3. Your draft is kept. Read the item again to review the current record.")
  if (response.status === "BUSY") return new EditorRecordError(409, `Record is locked by D3 session ${response.lockOwner}. Your draft is kept. Try again after the lock is released.`)
  if (response.status === "NOT_FOUND" || response.status === "OPEN_FAILED") return new EditorRecordError(404, "D3 file or item was not found. No record was created.")
  if (response.status === "WRITE_DENIED") return new EditorRecordError(403, "This item is outside the verified sandbox write scope.")
  if (response.status === "UNSUPPORTED_BINARY" || response.status === "TOO_LARGE") return new EditorRecordError(422, "This editor supports nonbinary records up to 8 KiB.")
  return new EditorRecordError(502, "D3 could not verify the operation. A replacement may have been written. Read the item again before retrying; your draft is kept.")
}

export async function readEditorRecord(profile: ConnectionProfile, input: Record<string, unknown>, operation = runRecordOperation) {
  const selected = target(profile, input)
  const connection = recordConnection(profile)
  let response: RecordResponse
  try { response = await operation(profile, { operation: "READ", ...selected }) }
  catch { throw new EditorRecordError(503, "Lossless record access is unavailable on this account. A read-only preview may still be available.", true) }
  if (response.status !== "READ") throw responseError(response)
  return { profile: profile.name, connection, original: Buffer.from(response.bytes).toString("base64"), writable: recordWriteAllowed(selected.file, selected.item, selected.section) }
}

async function writeEditorRecord(profile: ConnectionProfile, safety: SafetyMode, input: Record<string, unknown>, kind: "CAS_EXISTING" | "CREATE_ONLY", operation = runRecordOperation) {
  const selected = target(profile, input)
  if (input.connection !== recordConnection(profile)) throw new EditorRecordError(409, "Connection settings changed. Reopen the item before saving. Your draft is kept.")
  if (kind === "CREATE_ONLY" && input.expected !== undefined) throw new EditorRecordError(400, "Creation cannot include an existing-record baseline.")
  const expected = kind === "CAS_EXISTING" ? decodeBytes(input.expected) : undefined
  const replacement = decodeBytes(input.replacement)
  if (!recordWriteAllowed(selected.file, selected.item, selected.section)) throw new EditorRecordError(403, "This item is outside the verified sandbox write scope.")
  try { assertD3Allowed(safety, `UPDATE ${selected.file}`, input.confirmed === true, profile.allowedAccounts, profile) }
  catch (error) { throw new EditorRecordError(safety === "plan" ? 403 : 409, (error as Error).message, false, error) }
  let response: RecordResponse
  try { response = await operation(profile, { operation: kind, ...selected, ...(expected === undefined ? {} : { expected }), replacement }) }
  catch { throw new EditorRecordError(503, kind === "CREATE_ONLY" ? "Record transport failed. The new item may have been created. Read it before retrying; your draft is kept." : "Record transport failed. A replacement may have been written. Read the item again before retrying; your draft is kept.") }
  if (response.status !== "OK") throw responseError(response)
  if (!Buffer.from(response.bytes).equals(replacement)) throw new EditorRecordError(502, "D3 readback differs from the draft. Read the item again before retrying; your draft is kept.")
  return { saved: true, original: Buffer.from(response.bytes).toString("base64") }
}

export function saveEditorRecord(profile: ConnectionProfile, safety: SafetyMode, input: Record<string, unknown>, operation = runRecordOperation) {
  return writeEditorRecord(profile, safety, input, "CAS_EXISTING", operation)
}

export function createEditorRecord(profile: ConnectionProfile, safety: SafetyMode, input: Record<string, unknown>, operation = runRecordOperation) {
  return writeEditorRecord(profile, safety, input, "CREATE_ONLY", operation)
}

export async function prepareEditorRecord(profile: ConnectionProfile, input: Record<string, unknown>, operation = runRecordOperation) {
  const selected = target(profile, input), connection = recordConnection(profile)
  if (!recordWriteAllowed(selected.file, selected.item, selected.section)) throw new EditorRecordError(403, "This item is outside the verified sandbox write scope.")
  let response: RecordResponse
  try { response = await operation(profile, { operation: "READ", ...selected }) }
  catch { throw new EditorRecordError(503, "Lossless record access is unavailable. No item was created.") }
  if (response.status === "READ") throw responseError({ status: "ALREADY_EXISTS", bytes: Buffer.alloc(0) })
  if (response.status !== "NOT_FOUND") throw responseError(response)
  return { profile: profile.name, connection, file: selected.file, item: input.item, section: selected.section, missing: true }
}
