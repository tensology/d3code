import type { D3Session } from "../domain/types.js"
import { humanD3SessionError } from "./connection-message.js"

export interface D3ItemListing {
  file: string
  section: "data" | "dict"
  items: string[]
  limit: number
  mayHaveMore: boolean
}

export async function listD3Items(session: D3Session, file: string, options: {
  section?: "data" | "dict"
  limit?: number
  timeoutMs?: number
  signal?: AbortSignal
  prefix?: string
} = {}): Promise<D3ItemListing> {
  if (!/^[A-Za-z0-9_.:$-]+$/.test(file)) throw new Error("Invalid file name: use letters, numbers, underscore, dot, colon, dollar, or hyphen.")
  const section = options.section ?? "data"
  if (section !== "data" && section !== "dict") throw new Error("Item section must be data or dict.")
  const requestedLimit = options.limit ?? 100
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new Error("Item limit must be a positive integer.")
  const limit = Math.min(requestedLimit, 200)
  const prefix=options.prefix??""
  if(prefix && (prefix.length>100 || !/^[A-Za-z0-9_.:$-]+$/.test(prefix))) throw new Error("Item prefix must use letters, numbers, underscore, dot, colon, dollar, or hyphen, up to 100 characters.")
  // D3 Reference 10.3.4: SAMPLING p129, A0 p162, CONV p109, MX p1021,
  // FMT p116, C/I/N/E p71. Hex preserves all 100 ID bytes without column wrapping.
  // D3 Reference pp76-77: ] ends a prefix match. A deliberate search can scan
  // more rows than it returns; session timeout bounds that work.
  const filter=prefix?` WITH A0 = "${prefix}]"`:""
  const command = `LIST ${section === "dict" ? "DICT " : ""}${file}${filter} A0 CONV "MX" FMT "L#200" SAMPLING ${limit} (CINE`
  const result = await session.run(command, options.timeoutMs ?? 15_000, { signal: options.signal })
  if (result.exitCode !== null && result.exitCode !== 0) {
    throw new Error(humanD3SessionError(result.stdout, result.stderr) ?? `D3 item listing failed with exit code ${result.exitCode}.`)
  }
  const lines = result.stdout.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\0/g, "").split(/\r\n?|\n/).map(line => line.trim())
  const items: string[] = []
  let count: number | undefined
  for (const line of lines) {
    const summary = line.match(/^(?:\[4052?\]\s*)?(\d+)\s+items?\s+listed\b/i)
    if (summary || /^\[401\]\s*no items present\.?$/i.test(line)) {
      count = summary ? Number(summary[1]) : 0
      break
    }
    if (/^(?:[0-9a-f]{2}){1,100}$/i.test(line)) items.push(Buffer.from(line, "hex").toString("latin1"))
  }
  if (count === undefined) {
    throw new Error(humanD3SessionError(result.stdout, result.stderr) ?? `D3 item listing did not return a completion summary: ${(result.stderr || result.stdout).slice(-240)}`)
  }
  if (count !== items.length || count > limit) throw new Error("D3 item listing was incomplete or exceeded its requested limit.")
  return { file, section, items, limit, mayHaveMore: items.length === limit }
}
