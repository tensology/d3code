import { assertD3Allowed } from "../core/permissions.js"
import type { D3CommandResult, ToolContext, ToolDefinition } from "../domain/types.js"
import { indexD3Account, loadIndex, saveIndex, searchDocuments } from "../indexing/indexer.js"
import { formatRagSearchResult, loadFreshRagIndex, searchRagIndex } from "../rag/reference-rag.js"
import { d3Capabilities, renderD3Capabilities } from "./capabilities.js"
import { detectLocalD3 } from "./detect.js"
import { inspectD3Estate } from "./estate.js"
import { formatManualSearchResult, searchDefaultManuals } from "./manual-search.js"
import { discoverSbplus } from "./sbplus.js"

function requireSession(context: ToolContext) {
  if (!context.session) throw new Error("No active D3 session. Run /login or configure a profile.")
  return context.session
}

async function runTcl(context: ToolContext, command: string, confirmed = false): Promise<D3CommandResult> {
  assertD3Allowed(context.safety, command, confirmed, context.profile?.allowedAccounts)
  return requireSession(context).run(command, context.commandTimeoutMs, { signal: context.signal })
}

// D3's line editor inserts before the current line, so writing over an existing
// item would prepend instead of replace. Gate the write first, clear the item,
// then write it in chunks (`I` creates, `9999` + `I` appends).
async function runReplaceWrite(
  context: ToolContext,
  options: { kind: "item" | "dict"; file: string; item: string; body: string; confirmed?: boolean },
): Promise<D3CommandResult> {
  const target = options.kind === "dict" ? `DICT ${options.file}` : options.file
  const buildCommand = options.kind === "dict" ? edWriteDictCommand : edWriteCommand
  const chunks = chunkForEditor(options.body ?? "")
  assertD3Allowed(context.safety, buildCommand(options.file, options.item, chunks[0] ?? ""), options.confirmed)
  const session = requireSession(context)
  await session.run(`DELETE ${target} ${options.item}`, context.commandTimeoutMs, { signal: context.signal }).catch(() => undefined)
  let result: D3CommandResult | undefined
  for (let index = 0; index < chunks.length; index += 1) {
    const command = buildCommand(options.file, options.item, chunks[index]!, index > 0)
    assertD3Allowed(context.safety, command, options.confirmed)
    result = await session.run(command, context.commandTimeoutMs, { signal: context.signal })
  }
  return result ?? session.run(buildCommand(options.file, options.item, ""), context.commandTimeoutMs, { signal: context.signal })
}

function quoteTclArg(value: string): string {
  return /^[A-Za-z0-9_.:-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`
}

function readItemReference(value: unknown, label: string): string {
  const item = String(value ?? "")
  if (!item || Buffer.byteLength(item, "latin1") > 100 || /["\\\u0000-\u001f\u007f]/.test(item)) {
    throw new Error(`${label} must contain only printable characters without quotes or backslashes, up to 100 bytes.`)
  }
  return quoteTclArg(item)
}

function requireName(value: unknown, label: string): string {
  const text = String(value ?? "").trim()
  if (!/^[A-Za-z0-9_.:-]+$/.test(text)) throw new Error(`${label} must contain only letters, numbers, underscore, dot, colon, or hyphen.`)
  return text
}

function requireSingleLine(value: unknown, label: string): string {
  const text = String(value ?? "").trim()
  if (!text) throw new Error(`${label} is required.`)
  if (/[\r\n\u0000-\u001f\u007f]/.test(text)) throw new Error(`${label} must be one line without control characters.`)
  return text
}

function requireReadOnlyAql(value: unknown): string {
  const query = requireSingleLine(value, "AQL query")
  if (!/^(?:LIST|SORT|SELECT|SSELECT|COUNT)\b/i.test(query)) {
    throw new Error("AQL query must begin with LIST, SORT, SELECT, SSELECT, or COUNT. Use d3_tcl for other TCL commands so the safety policy can classify them.")
  }
  return query
}

function requireModulo(value: unknown, label: string): number {
  const modulo = Number(value)
  if (!Number.isInteger(modulo) || modulo <= 0) throw new Error(`${label} must be a positive integer modulo.`)
  return modulo
}

// D3's line editor ends insert mode on a blank line, then `FI` files the item.
// Without the blank line the editor stays open and the session never returns to
// the TCL prompt. `append` positions at a high line number first, which appends.
function edWriteCommand(file: string, item: string, body: string, append = false): string {
  const payload = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return append
    ? `ED ${file} ${item}\n9999\nI\n${payload}\n\nFI`
    : `ED ${file} ${item}\nI\n${payload}\n\nFI`
}

function edWriteDictCommand(file: string, item: string, body: string, append = false): string {
  const payload = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return append
    ? `ED DICT ${file} ${item}\n9999\nI\n${payload}\n\nFI`
    : `ED DICT ${file} ${item}\nI\n${payload}\n\nFI`
}

// A single ED write stops the session returning to its prompt above roughly
// 5 KB of payload, so a large item is written in chunks.
const EDIT_CHUNK_BYTES = 2800

export function chunkForEditor(body: string, maxBytes = EDIT_CHUNK_BYTES): string[] {
  const lines = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
  // A blank line ends ED insert mode, so a body with one would be silently
  // truncated (and any empty attributes lost). Fail loudly instead.
  if (lines.slice(0, -1).some((line) => line.trim() === "")) {
    throw new Error("Cannot write a body with a blank line: D3's editor ends insert mode on a blank line, which would silently truncate the item. Build empty attributes with a BASIC writer instead.")
  }
  const chunks: string[] = []
  let current: string[] = []
  let size = 0
  for (const line of lines) {
    const lineSize = line.length + 1
    if (current.length > 0 && size + lineSize > maxBytes) {
      chunks.push(current.join("\n"))
      current = []
      size = 0
    }
    current.push(line)
    size += lineSize
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current.join("\n"))
  return chunks
}

function assertAllowedAccount(context: ToolContext, account: string): void {
  const allowed = context.profile?.allowedAccounts
  if (allowed && allowed.length > 0 && !allowed.includes(account)) {
    throw new Error(`Account ${account} is not allowed for profile ${context.profile?.name}. Allowed: ${allowed.join(", ")}`)
  }
}

export const d3Tools: ToolDefinition[] = [
  {
    name: "d3_detect",
    description: "Detect a local Rocket D3 command.",
    mutates: false,
    execute: async () => detectLocalD3(),
  },
  {
    name: "d3_builder_capabilities",
    description: "List the shared D3/SB+ coding capabilities used by the agent, CLI, and IDE.",
    mutates: false,
    execute: async () => ({ capabilities: d3Capabilities, compact: renderD3Capabilities() }),
  },
  {
    name: "d3_tcl",
    description: "Run a TCL command in the active D3 account.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { command: string; confirmed?: boolean }
      return runTcl(context, args.command, args.confirmed)
    },
  },
  {
    name: "d3_login",
    description: "Verify or switch into a D3 account, then run read-only WHO and VERSION proof.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { account?: string; confirmed?: boolean }
      if (args.account) {
        assertAllowedAccount(context, args.account)
        return runTcl(context, `LOGTO ${args.account}\nWHO\nVERSION`, args.confirmed)
      }
      return runTcl(context, "WHO\nVERSION", true)
    },
  },
  {
    name: "d3_list_files",
    description: "List file pointers in the active account master dictionary.",
    mutates: false,
    execute: async (_input, context) => runTcl(context, "LIST MD WITH A1 = \"D\" A0 A1 A2 (N", true),
  },
  {
    name: "d3_read_item",
    description: "Read a D3 item using CT.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string }
      return runTcl(context, `CT ${requireName(args.file, "file")} ${readItemReference(args.item, "item")} (N`, true)
    },
  },
  {
    name: "d3_write_item",
    description: "Write a D3 item through ED batch input (replaces any existing item).",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; body: string; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const item = requireName(args.item, "item")
      return runReplaceWrite(context, { kind: "item", file, item, body: args.body ?? "", confirmed: args.confirmed })
    },
  },
  {
    name: "d3_create_file",
    description: "Create a D3 file using documented create-file syntax.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; dictModulo?: number; dataModulo?: number; dictionaryOnly?: boolean; dataOnlyDictionary?: string; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const command = args.dataOnlyDictionary
        ? `create-file data ${requireName(args.dataOnlyDictionary, "dictionary reference")},${file} ${requireModulo(args.dataModulo ?? args.dictModulo, "data modulo")}`
        : args.dictionaryOnly
          ? `create-file dict ${file} ${requireModulo(args.dictModulo, "dictionary modulo")}`
          : `create-file ${file} ${requireModulo(args.dictModulo, "dictionary modulo")} ${requireModulo(args.dataModulo, "data modulo")}`
      return runTcl(context, command, args.confirmed)
    },
  },
  {
    name: "d3_read_dict",
    description: "Read a D3 dictionary item using CT DICT.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string }
      return runTcl(context, `CT DICT ${requireName(args.file, "file")} ${readItemReference(args.item, "dictionary item")} (N`, true)
    },
  },
  {
    name: "d3_write_dict",
    description: "Write a D3 dictionary item through ED DICT batch input (replaces any existing item).",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; body: string; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const item = requireName(args.item, "dictionary item")
      return runReplaceWrite(context, { kind: "dict", file, item, body: args.body ?? "", confirmed: args.confirmed })
    },
  },
  {
    name: "d3_query_aql",
    description: "Run an AQL query.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { query: string }
      return runTcl(context, requireReadOnlyAql(args.query), true)
    },
  },
  {
    name: "d3_compile_basic",
    description: "Compile a BASIC/FlashBASIC program.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; confirmed?: boolean }
      return runTcl(context, `BASIC ${requireName(args.file, "file")} ${requireName(args.item, "item")}`, args.confirmed)
    },
  },
  {
    name: "d3_catalog",
    description: "Catalog a compiled BASIC program.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; global?: boolean; confirmed?: boolean }
      return runTcl(context, `CATALOG ${requireName(args.file, "file")} ${requireName(args.item, "item")}${args.global ? " (G" : ""}`, args.confirmed)
    },
  },
  {
    name: "d3_build_basic_program",
    description: "Write BASIC source through ED, then optionally compile and catalog it.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; source: string; compile?: boolean; catalog?: boolean; global?: boolean; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const item = requireName(args.item, "item")
      const commands = [edWriteCommand(file, item, args.source ?? "")]
      if (args.compile) commands.push(`BASIC ${file} ${item}`)
      if (args.catalog) commands.push(`CATALOG ${file} ${item}${args.global ? " (G" : ""}`)
      return runTcl(context, commands.join("\n"), args.confirmed)
    },
  },
  {
    name: "d3_locks",
    description: "Inspect D3 locks.",
    mutates: false,
    execute: async (_input, context) => runTcl(context, "LIST-LOCKS", true),
  },
  {
    name: "d3_call_subroutine",
    description: "Call a D3 BASIC subroutine from TCL with explicit mutation safety.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { name: string; args?: string[]; confirmed?: boolean }
      const callArgs = (args.args ?? []).map(quoteTclArg).join(" ")
      return runTcl(context, `CALL ${requireName(args.name, "subroutine name")}${callArgs ? ` ${callArgs}` : ""}`, args.confirmed)
    },
  },
  {
    name: "d3_index_account",
    description: "Index active-account file pointers into the local searchable D3 Code cache.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { saveAs?: string }
      const session = requireSession(context)
      const profile = context.profile ?? session.profile
      const documents = await indexD3Account(session, profile)
      const indexName = args.saveAs ?? `profile-${profile.name}`
      await saveIndex(indexName, documents)
      return { index: indexName, documents }
    },
  },
  {
    name: "d3_search",
    description: "Search a local D3 Code index created from a D3 account or bundle.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { query: string; index?: string; limit?: number }
      const indexName = args.index ?? (context.profile ? `profile-${context.profile.name}` : "manual")
      const hits = searchDocuments(await loadIndex(indexName), args.query).slice(0, args.limit ?? 20)
      return { index: indexName, query: args.query, hits }
    },
  },
  {
    name: "d3_manual_search",
    description: "Search repo-local Rocket D3 manuals and reference notes for D3 behavior grounding.",
    mutates: false,
    execute: async (input: unknown) => {
      const args = input as { query: string; limit?: number; paths?: string[] }
      const result = await searchDefaultManuals(args.query, args.limit, args.paths)
      return { ...result, compact: formatManualSearchResult(result) }
    },
  },
  {
    name: "d3_rag_search",
    description: "Search the local routed D3Code RAG index across D3, MV BASIC, System Builder, operator notes, and learned memory.",
    mutates: false,
    execute: async (input: unknown) => {
      const args = input as { query: string; limit?: number; index?: string }
      const indexName = args.index ?? "reference-rag"
      const index = await loadFreshRagIndex(indexName)
      const result = searchRagIndex(index, args.query, { limit: args.limit })
      return { ...result, compact: formatRagSearchResult(result) }
    },
  },
  {
    name: "d3_sbplus_plan",
    description: "Create a reference-grounded SB+ screen/process builder plan without writing SB+ definition records.",
    mutates: false,
    execute: async (input: unknown) => {
      const args = input as { system?: string; process?: string; kind?: string; file?: string; fields?: string[]; notes?: string }
      const query = [
        "SB+",
        args.kind ?? "input process",
        args.process ?? "screen definition",
        args.file ?? "",
        (args.fields ?? []).join(" "),
        "validation F1 F3 help process definition drivers",
      ].join(" ")
      const index = await loadFreshRagIndex("reference-rag")
      const result = searchRagIndex(index, query, { limit: 5 })
      const lines = [
        "# SB+ Builder Plan",
        `System: ${args.system ?? "(discover in account)"}`,
        `Process: ${args.process ?? "(name required)"}`,
        `Type: ${args.kind ?? "input process"}`,
        `Primary file: ${args.file ?? "(discover/confirm)"}`,
        `Fields: ${(args.fields ?? []).join(", ") || "(not supplied)"}`,
        "",
        "Steps:",
        "1. Confirm the SB+ system, process name, primary file, and local SB+ definition files in the target account.",
        "2. Define the screen fields first, including defaults, validations, required flags, and F1/F3 help.",
        "3. Use SB+ screen/process tools to create or update the screen definition and process definition.",
        "4. Run the process once so SB+ can build or refresh drivers, then capture the terminal/screen proof.",
        "5. Only after discovery, write definition records through account-specific tools or normal SB+ maintenance screens.",
        args.notes ? `\nOperator notes: ${args.notes}` : "",
        "",
        formatRagSearchResult(result),
      ].filter(Boolean)
      return { plan: lines.join("\n"), references: result.hits, compact: lines.join("\n") }
    },
  },
  {
    name: "d3_sbplus_discover",
    description: "Discover likely SB+ systems, process, screen, menu, and driver definition files in the active account.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { limit?: number }
      return discoverSbplus(requireSession(context), { limit: args.limit, signal: context.signal, timeoutMs: context.commandTimeoutMs })
    },
  },
  {
    name: "d3_estate_report",
    description: "Explain the active D3 account estate: login, visible files, likely file types, and next investigation steps.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { limit?: number }
      return inspectD3Estate(requireSession(context), { limit: args.limit, signal: context.signal, timeoutMs: context.commandTimeoutMs })
    },
  },
]

export function getTool(name: string): ToolDefinition | undefined {
  return d3Tools.find((tool) => tool.name === name)
}
