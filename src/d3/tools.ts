import { assertD3Allowed } from "../core/permissions.js"
import type { D3CommandResult, ToolContext, ToolDefinition } from "../domain/types.js"
import { indexD3Account, loadIndex, saveIndex, searchDocuments } from "../indexing/indexer.js"
import { detectLocalD3 } from "./detect.js"

function requireSession(context: ToolContext) {
  if (!context.session) throw new Error("No active D3 session. Run /login or configure a profile.")
  return context.session
}

async function runTcl(context: ToolContext, command: string, confirmed = false): Promise<D3CommandResult> {
  assertD3Allowed(context.safety, command, confirmed)
  return requireSession(context).run(command)
}

function quoteTclArg(value: string): string {
  return /^[A-Za-z0-9_.:-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`
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
      return runTcl(context, `CT ${args.file} ${args.item}`, true)
    },
  },
  {
    name: "d3_write_item",
    description: "Write a D3 item through ED batch input.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; body: string; confirmed?: boolean }
      const escaped = args.body.replace(/\n/g, "\n")
      return runTcl(context, `ED ${args.file} ${args.item}\nI\n${escaped}\nFI`, args.confirmed)
    },
  },
  {
    name: "d3_read_dict",
    description: "Read a D3 dictionary item using CT DICT.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string }
      return runTcl(context, `CT DICT ${args.file} ${args.item}`, true)
    },
  },
  {
    name: "d3_query_aql",
    description: "Run an AQL query.",
    mutates: false,
    execute: async (input: unknown, context) => {
      const args = input as { query: string }
      return runTcl(context, args.query, true)
    },
  },
  {
    name: "d3_compile_basic",
    description: "Compile a BASIC/FlashBASIC program.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; confirmed?: boolean }
      return runTcl(context, `BASIC ${args.file} ${args.item}`, args.confirmed)
    },
  },
  {
    name: "d3_catalog",
    description: "Catalog a compiled BASIC program.",
    mutates: true,
    execute: async (input: unknown, context) => {
      const args = input as { file: string; item: string; global?: boolean; confirmed?: boolean }
      return runTcl(context, `CATALOG ${args.file} ${args.item}${args.global ? " (G" : ""}`, args.confirmed)
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
      return runTcl(context, `CALL ${args.name}${callArgs ? ` ${callArgs}` : ""}`, args.confirmed)
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
]

export function getTool(name: string): ToolDefinition | undefined {
  return d3Tools.find((tool) => tool.name === name)
}
