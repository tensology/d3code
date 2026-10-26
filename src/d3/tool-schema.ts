import type { ToolSchema } from "../llm/client.js"
import { d3Tools } from "./tools.js"

/**
 * JSON Schema for every registered D3 tool, used for native provider function
 * calling. Runtime validation still happens in `parseD3ToolInput`; these
 * schemas only tell the model the exact argument shape.
 */
const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
})

const string = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra })
const d3Name = (description: string) => string(description, { pattern: "^[A-Za-z0-9_.:-]+$" })
const limit = (description: string) => ({ type: "integer", minimum: 1, maximum: 1000, description })
const bool = (description: string) => ({ type: "boolean", description })
const confirmation = bool("Operator confirmation. Never set this from the model; only the CLI/IDE can confirm mutations.")

const baseline = object({ profile: string("Profile from the lossless read."), connection: string("Connection fingerprint from the lossless read."), original: string("Exact base64 original from the lossless read.") }, ["profile", "connection", "original"])
const emptyObject = object({})

const parameters: Record<string, Record<string, unknown>> = {
  d3_detect: emptyObject,
  d3_builder_capabilities: emptyObject,
  d3_tcl: object({ command: string("One TCL command to run under the active profile."), confirmed: confirmation }, ["command"]),
  d3_login: object({ account: d3Name("D3 account to LOGTO before proof."), confirmed: confirmation }),
  d3_list_files: emptyObject,
  d3_read_item: object({ file: d3Name("File (master dictionary entry) name."), item: d3Name("Item id to read."), lossless: bool("Return exact bytes and a baseline for replacement.") }, ["file", "item"]),
  d3_write_item: object({ file: d3Name("File name."), item: d3Name("Item id to write."), body: string("Full replacement item body; newlines are attribute marks."), baseline, confirmed: confirmation }, ["file", "item", "body", "baseline"]),
  d3_create_item: object({ file: d3Name("File name."), item: d3Name("New item id."), body: string("Complete new item; newlines are attribute marks."), section: { type: "string", enum: ["data", "dict"] }, confirmed: confirmation }, ["file", "item", "body"]),
  d3_create_file: object(
    {
      file: d3Name("New file name."),
      dictModulo: { type: "integer", minimum: 1, description: "Dictionary modulo." },
      dataModulo: { type: "integer", minimum: 1, description: "Data modulo." },
      dictionaryOnly: bool("Create only the dictionary section."),
      dataOnlyDictionary: d3Name("Existing dictionary to attach a data-only section to."),
      confirmed: confirmation,
    },
    ["file"],
  ),
  d3_read_dict: object({ file: d3Name("File name."), item: d3Name("Dictionary item id."), lossless: bool("Return exact bytes and a baseline for replacement.") }, ["file", "item"]),
  d3_write_dict: object({ file: d3Name("File name."), item: d3Name("Dictionary item id."), body: string("Full replacement dictionary item body; newlines are attribute marks."), baseline, confirmed: confirmation }, ["file", "item", "body", "baseline"]),
  d3_query_aql: object({ query: string("A single read-only LIST/SORT/SELECT/SSELECT/COUNT AQL statement.") }, ["query"]),
  d3_compile_basic: object({ file: d3Name("BASIC source file."), item: d3Name("Program item."), confirmed: confirmation }, ["file", "item"]),
  d3_run_basic: object({ file: d3Name("BASIC source file."), item: d3Name("Compiled program item."), confirmed: confirmation }, ["file", "item"]),
  d3_catalog: object({ file: d3Name("Source file."), item: d3Name("Program item."), global: bool("Catalog globally with (G."), confirmed: confirmation }, ["file", "item"]),
  d3_build_basic_program: object(
    {
      file: d3Name("Target BASIC file."),
      item: d3Name("Program item."),
      source: string("Full BASIC source."),
      baseline,
      compile: bool("Compile after writing."),
      catalog: bool("Catalog after a clean compile."),
      global: bool("Catalog globally."),
      confirmed: confirmation,
    },
    ["file", "item", "source", "baseline"],
  ),
  d3_operations_status: object({ area: { type: "string", enum: ["jobs", "printers", "queue"], description: "Read background jobs, printer devices or print queue entries." } }, ["area"]),
  d3_locks: emptyObject,
  d3_call_subroutine: object({ name: d3Name("Cataloged subroutine name."), args: { type: "array", items: { type: "string" }, maxItems: 100, description: "Positional arguments." }, confirmed: confirmation }, ["name"]),
  d3_index_account: object({ saveAs: d3Name("Optional cache index name to save the account index under.") }),
  d3_search: object({ query: string("Search text."), index: d3Name("Cache index name."), limit: limit("Maximum results.") }, ["query"]),
  d3_manual_search: object({ query: string("Search text."), limit: limit("Maximum results."), paths: { type: "array", items: { type: "string" }, maxItems: 20, description: "Restrict to these reference paths." } }, ["query"]),
  d3_rag_search: object({ query: string("Search text."), limit: limit("Maximum results."), index: d3Name("RAG cache index name.") }, ["query"]),
  d3_sbplus_plan: object({
    system: d3Name("SB+ system."),
    process: d3Name("SB+ process."),
    kind: { type: "string", maxLength: 100, description: "Plan kind." },
    file: d3Name("Target file."),
    fields: { type: "array", items: { type: "string", maxLength: 200 }, maxItems: 200, description: "Field list." },
    notes: { type: "string", maxLength: 4000, description: "Operator notes." },
  }),
  d3_sbplus_discover: object({ limit: limit("Maximum SB+ items to inspect.") }),
  d3_estate_report: object({ limit: limit("Maximum files to report.") }),
}

export const d3ToolSchemas: ToolSchema[] = d3Tools.map((tool) => ({
  name: tool.name,
  description: `${tool.description}${tool.mutates ? " (mutation-gated: the operator must confirm)" : ""}`,
  parameters: parameters[tool.name] ?? emptyObject,
}))
