const startLabels: Record<string, string> = {
  d3_detect: "Checking D3 availability",
  d3_tcl: "Running D3 TCL",
  d3_login: "Switching D3 account",
  d3_list_files: "Listing D3 files",
  d3_read_item: "Reading D3 item",
  d3_write_item: "Writing D3 item",
  d3_read_dict: "Reading D3 dictionary",
  d3_query_aql: "Running AQL",
  d3_compile_basic: "Compiling BASIC",
  d3_catalog: "Cataloging BASIC",
  d3_locks: "Inspecting D3 locks",
  d3_call_subroutine: "Calling D3 subroutine",
  d3_index_account: "Indexing D3 account",
  d3_search: "Searching D3 index",
  d3_manual_search: "Searching D3 manuals",
}

const resultLabels: Record<string, string> = {
  d3_detect: "Checked D3 availability",
  d3_tcl: "Ran D3 TCL",
  d3_login: "Switched D3 account",
  d3_list_files: "Listed D3 files",
  d3_read_item: "Read D3 item",
  d3_write_item: "Wrote D3 item",
  d3_read_dict: "Read D3 dictionary",
  d3_query_aql: "Ran AQL",
  d3_compile_basic: "Compiled BASIC",
  d3_catalog: "Cataloged BASIC",
  d3_locks: "Inspected D3 locks",
  d3_call_subroutine: "Called D3 subroutine",
  d3_index_account: "Indexed D3 account",
  d3_search: "Searched D3 index",
  d3_manual_search: "Searched D3 manuals",
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {}
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  return typeof value === "string" ? value : ""
}

function compact(value: string, maxLength = 96): string {
  const oneLine = value.replace(/\s+/g, " ").trim()
  if (oneLine.length <= maxLength) return oneLine
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`
}

export function formatToolTarget(name: string, input: unknown): string {
  const record = asRecord(input)
  if (name === "d3_read_item" || name === "d3_write_item" || name === "d3_read_dict" || name === "d3_compile_basic" || name === "d3_catalog") {
    return compact([stringField(record, "file"), stringField(record, "item")].filter(Boolean).join(" "))
  }
  if (name === "d3_tcl") return compact(stringField(record, "command"))
  if (name === "d3_login") return compact(stringField(record, "account"))
  if (name === "d3_query_aql") return compact(stringField(record, "query"))
  if (name === "d3_call_subroutine") return compact(stringField(record, "name"))
  if (name === "d3_search" || name === "d3_manual_search") return compact(stringField(record, "query"))
  if (name === "d3_index_account") return compact(stringField(record, "saveAs"))
  return ""
}

export function formatToolActivity(input: { name: string; input?: unknown; reason?: string }): string {
  const label = startLabels[input.name] ?? `D3 tool ${input.name}`
  const target = formatToolTarget(input.name, input.input)
  return [
    target ? `${label} ${target}` : label,
    input.reason ? compact(input.reason) : undefined,
  ].filter(Boolean).join("\n")
}

export function formatToolResultTitle(name: string): string {
  return resultLabels[name] ?? `D3 tool ${name}`
}
