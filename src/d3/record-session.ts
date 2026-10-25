import { createD3Session } from "./adapter.js"
import type { ConnectionProfile, D3Session } from "../domain/types.js"
import { assertRecordNext, assertRecordReady, encodeRecordRequest, parseRecordResponse, recordHelper, type RecordRequest, type RecordResponse } from "./record-protocol.js"

/** The helper must already be installed and verified. Each operation owns its session. */
export async function runRecordOperation(profile: ConnectionProfile, request: RecordRequest, options: {
  signal?: AbortSignal
  timeoutMs?: number
  createSession?: (profile: ConnectionProfile) => D3Session
} = {}): Promise<RecordResponse> {
  const encoded = encodeRecordRequest(request)
  if (profile.entryCommand && !/^(?:\S*\/)?d3(?:\s|$)/i.test(profile.entryCommand.trim())) throw new Error("Record operations require a native D3 connection.")
  if (profile.type === "local" && !profile.entryCommand) throw new Error("Record operations require a native D3 connection.")
  const timeoutMs = options.timeoutMs ?? 120_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("Record operation timeout must be a positive integer.")
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(options.signal ? [options.signal] : [])])
  signal.throwIfAborted()
  const session = (options.createSession ?? createD3Session)({
    ...profile,
    sessionMode: "persistent",
    // Include TCL so a failed helper returns immediately and fails identity validation.
    promptPattern: "(?:^|\\n)(?:D3R1 (?:READY [0-9A-F]{64}|NEXT [0-9A-F]{32} [1-9][0-9]*)|[:>])\\s*$",
  })
  const run = async (command: string): Promise<string> => {
    let output = ""
    try {
      await session.run(command, Math.min(timeoutMs, 20_000), { signal, onStdout: chunk => { output += chunk } })
    } catch {
      // Adapter timeout messages contain the command, which here may be record bytes.
      throw new Error("Record transport failed. Reload the item before retrying a replacement.")
    }
    // The session's normalized result removes matching READY/NEXT prompt lines.
    return output
  }
  try {
    assertRecordReady(await run(recordHelper.runCommand))
    for (let index = 0; index < encoded.frames.length - 1; index++) {
      signal.throwIfAborted()
      assertRecordNext(await run(encoded.frames[index]!), encoded.nonce, index + 1)
    }
    return parseRecordResponse(await run("."), encoded.nonce)
  } finally {
    await session.close()
  }
}
