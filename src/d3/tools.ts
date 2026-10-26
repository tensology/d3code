import { assertD3Allowed, classifyD3Command } from "../core/permissions.js"
import type { D3CommandResult, ToolContext, ToolDefinition } from "../domain/types.js"
import { indexD3Account, loadIndex, saveIndex, searchDocuments } from "../indexing/indexer.js"
import { formatRagSearchResult, loadFreshRagIndex, searchRagIndex } from "../rag/reference-rag.js"
import { d3Capabilities, renderD3Capabilities } from "./capabilities.js"
import { detectLocalD3 } from "./detect.js"
import { inspectD3Estate, listD3Files, dataFileListCommand } from "./estate.js"
import { formatManualSearchResult, searchDefaultManuals } from "./manual-search.js"
import { EditorRecordError, createEditorRecord, readEditorRecord, recordConnection, saveEditorRecord } from "./records.js"
import { runRecordOperation } from "./record-session.js"
import { analyzeD3Record } from "./shape.js"
import { recordBytes } from "./record-protocol.js"
import { discoverSbplus } from "./sbplus.js"

function requireSession(context: ToolContext) {
  if (!context.session) throw new Error("No active D3 session. Run /login or configure a profile.")
  return context.session
}

async function runTcl(context: ToolContext, command: string, confirmed = false): Promise<D3CommandResult> {
  assertD3Allowed(context.safety, command, confirmed, (context.profile ?? context.session?.profile)?.allowedAccounts, context.profile ?? context.session?.profile)
  return requireSession(context).run(command, context.commandTimeoutMs, { signal: context.signal })
}

interface RecordBaseline { profile: string; connection: string; original: string }

async function runReplaceWrite(context: ToolContext, options: { kind: "item" | "dict"; file: string; item: string; body: string; baseline?: RecordBaseline; confirmed?: boolean }) {
  const profile = context.profile ?? context.session?.profile
  assertD3Allowed(context.safety, `UPDATE ${options.file}`, options.confirmed === true, profile?.allowedAccounts, profile)
  if (!profile) throw new Error("Select a D3 profile before writing.")
  if (!options.baseline) throw new EditorRecordError(409, "Read this item with lossless:true and supply its baseline before replacing it. No record was changed.")
  if (/[\r\n]/.test(Buffer.from(options.baseline.original, "base64").toString("latin1"))) throw new EditorRecordError(422, "This text tool cannot replace a record containing literal CR or LF bytes. Use the byte-exact record API.")
  const replacement = Buffer.from(recordBytes(options.body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\xfe"))).toString("base64")
  return saveEditorRecord(profile, context.safety, {
    profile: options.baseline.profile, connection: options.baseline.connection,
    file: options.file, item: options.item, section: options.kind === "dict" ? "dict" : "data",
    expected: options.baseline.original, replacement, confirmed: options.confirmed,
  }, (profile, request) => runRecordOperation(profile, request, { signal: context.signal, timeoutMs: context.commandTimeoutMs }))
}

async function readLossless(context: ToolContext, file: string, item: string, section: "data" | "dict") {
  const profile = context.profile ?? context.session?.profile
  if (!profile) throw new Error("Select a D3 profile before reading.")
  assertD3Allowed(context.safety, `CT ${file} ${item}`, false, profile.allowedAccounts, profile)
  const value = await readEditorRecord(profile, { profile: profile.name, file, item, section }, (profile, request) => runRecordOperation(profile, request, { signal: context.signal, timeoutMs: context.commandTimeoutMs }))
  const raw = Buffer.from(value.original, "base64").toString("latin1")
  return { file, item, section, shape: analyzeD3Record(item, raw), body: raw.replace(/\xfe/g, "\n"), baseline: { profile: value.profile, connection: value.connection, original: value.original }, writable: value.writable && !/[\r\n]/.test(Buffer.from(value.original, "base64").toString("latin1")) }
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

function requireReadOnlyAql(value: unknown, profile: ToolContext["profile"]): string {
  const query = requireSingleLine(value, "AQL query")
  if (!/^(?:LIST|SORT|SELECT|SSELECT|COUNT)\b/i.test(query)) {
    throw new Error("AQL query must begin with LIST, SORT, SELECT, SSELECT, or COUNT. Use d3_tcl for other TCL commands so the safety policy can classify them.")
  }
  if (classifyD3Command(query, profile) !== "read") {
    throw new Error("AQL query must be read-only without printer output, command chaining, or shell syntax. Use d3_tcl for explicitly approved operations.")
  }
  return query
}

function requireModulo(value: unknown, label: string): number {
  const modulo = Number(value)
  if (!Number.isInteger(modulo) || modulo <= 0) throw new Error(`${label} must be a positive integer modulo.`)
  return modulo
}

function assertAllowedAccount(context: ToolContext, account: string): void {
  const allowed = (context.profile ?? context.session?.profile)?.allowedAccounts
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
    description: "Verify or switch into a D3 account, then run read-only WHO proof.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { account?: string; confirmed?: boolean }
      if (args.account) {
        assertAllowedAccount(context, args.account)
        return runTcl(context, `LOGTO ${args.account}\nWHO`, args.confirmed)
      }
      return runTcl(context, "WHO")
    },
  },
  {
    name: "d3_list_files",
    description: "List file pointers in the active account master dictionary.",
    mutates: false,
    execute: async (_input, context) => {
      const profile = context.profile ?? context.session?.profile
      assertD3Allowed(context.safety, dataFileListCommand(), false, profile?.allowedAccounts, profile)
      return (await listD3Files(requireSession(context), { signal: context.signal, timeoutMs: context.commandTimeoutMs })).result
    },
  },
  {
    name: "d3_read_item",
    description: "Read a D3 item. Use lossless:true to obtain exact bytes and the baseline required for a replacement.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; lossless?: boolean }
      if (args.lossless) return readLossless(context, requireName(args.file, "file"), requireName(args.item, "item"), "data")
      return runTcl(context, `CT ${requireName(args.file, "file")} ${readItemReference(args.item, "item")} (N`)
    },
  },
  {
    name: "d3_write_item",
    description: "Replace an existing sandbox item using the baseline returned by d3_read_item with lossless:true. Newlines represent attribute marks.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; body: string; baseline?: RecordBaseline; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const item = requireName(args.item, "item")
      return runReplaceWrite(context, { kind: "item", file, item, body: args.body ?? "", baseline: args.baseline, confirmed: args.confirmed })
    },
  },
  {
    name: "d3_create_item",
    description: "Create a missing sandbox data or dictionary item. Refuses existing items, including empty records. Newlines represent attribute marks; creation requires approval.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; body: string; section?: "data" | "dict"; confirmed?: boolean }
      const profile = context.profile ?? context.session?.profile
      if (!profile) throw new Error("Select a D3 profile before writing.")
      const file = requireName(args.file, "file"), item = requireName(args.item, "item")
      const replacement = Buffer.from(recordBytes(args.body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\xfe"))).toString("base64")
      return createEditorRecord(profile, context.safety, {
        profile: profile.name, connection: recordConnection(profile), file, item,
        section: args.section ?? "data", replacement, confirmed: args.confirmed,
      }, (profile, request) => runRecordOperation(profile, request, { signal: context.signal, timeoutMs: context.commandTimeoutMs }))
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
    description: "Read a D3 dictionary. Use lossless:true to obtain the baseline required for a replacement.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; lossless?: boolean }
      if (args.lossless) return readLossless(context, requireName(args.file, "file"), requireName(args.item, "dictionary item"), "dict")
      return runTcl(context, `CT DICT ${requireName(args.file, "file")} ${readItemReference(args.item, "dictionary item")} (N`)
    },
  },
  {
    name: "d3_write_dict",
    description: "Replace an existing sandbox dictionary using the baseline returned by d3_read_dict with lossless:true. Newlines represent attribute marks.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; body: string; baseline?: RecordBaseline; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const item = requireName(args.item, "dictionary item")
      return runReplaceWrite(context, { kind: "dict", file, item, body: args.body ?? "", baseline: args.baseline, confirmed: args.confirmed })
    },
  },
  {
    name: "d3_query_aql",
    description: "Run an AQL query.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { query: string }
      return runTcl(context, requireReadOnlyAql(args.query, context.profile ?? context.session?.profile))
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
    name: "d3_run_basic",
    description: "Run a compiled, non-interactive BASIC program and capture its output. Runtime effects require operator approval.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; confirmed?: boolean }
      return runTcl(context, `RUN ${requireName(args.file, "file")} ${requireName(args.item, "item")} (AN`, args.confirmed)
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
    description: "Replace existing sandbox BASIC source using a lossless read baseline, then optionally compile and catalog after a successful compile.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; source: string; baseline?: RecordBaseline; compile?: boolean; catalog?: boolean; global?: boolean; confirmed?: boolean }
      const file = requireName(args.file, "file")
      const item = requireName(args.item, "item")
      if (args.catalog && !args.compile) throw new Error("Catalog requires compile:true so the newly saved source is compiled first.")
      const commands: string[] = []
      if (args.compile) commands.push(`BASIC ${file} ${item}`)
      if (args.catalog) commands.push(`CATALOG ${file} ${item}${args.global ? " (G" : ""}`)
      for (const command of commands) assertD3Allowed(context.safety, command, args.confirmed === true, context.profile?.allowedAccounts, context.profile)
      const saved = await runReplaceWrite(context, { kind: "item", file, item, body: args.source, baseline: args.baseline, confirmed: args.confirmed })
      const results: D3CommandResult[] = []
      for (const command of commands) {
        const result = await runTcl(context, command, args.confirmed)
        results.push(result)
        if (command.startsWith("BASIC ") && ((result.exitCode !== null && result.exitCode !== 0) || !/\[241\].*Successful compile/i.test(result.stdout))) return { ...saved, results, status: "warning", message: "BASIC compilation was not successful. Source was saved; catalog was not run." }
      }
      return { ...saved, results }
    },
  },
  {
    name: "d3_locks",
    description: "Inspect D3 locks.",
    mutates: false,
    execute: async (_input, context) => runTcl(context, "LIST-LOCKS"),
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
    description: "Find candidate SB+ definition files in the active account. File names do not verify an SB+ installation.",
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
