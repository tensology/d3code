export type D3CapabilityKind = "d3" | "sbplus" | "ide" | "reference"

export interface D3Capability {
  id: string
  kind: D3CapabilityKind
  label: string
  purpose: string
  tools: string[]
  cli: string[]
  ide: string[]
  referenceGrounding: string[]
  safety: "read" | "mutates" | "plan-only"
}

export const d3Capabilities: D3Capability[] = [
  {
    id: "account-estate",
    kind: "d3",
    label: "Account Estate Discovery",
    purpose: "Inspect the active account before changing code: WHO/VERSION, visible file pointers, likely data/program/screen files, locks, and searchable account cache.",
    tools: ["d3_login", "d3_estate_report", "d3_list_files", "d3_locks", "d3_operations_status", "d3_index_account", "d3_search"],
    cli: ["login", "estate", "files", "locks", "index-account", "search-account"],
    ide: ["Sessions tree", "D3 Browser", "Terminal", "Agent tool events"],
    referenceGrounding: ["Rocket D3 account, master dictionary, file pointer, and TCL behavior"],
    safety: "read",
  },
  {
    id: "program-builder",
    kind: "d3",
    label: "BASIC Program Builder",
    purpose: "Edit BASIC source through guarded record writes, compile with BASIC, and optionally catalog or run the module.",
    tools: ["d3_write_item", "d3_create_item", "d3_build_basic_program", "d3_compile_basic", "d3_run_basic", "d3_catalog", "d3_call_subroutine"],
    cli: ["write-item", "build-basic", "compile-basic", "catalog-basic", "call-subroutine"],
    ide: ["Item / BASIC Editor", "Compile", "Catalog", "Run", "Agent builder loop"],
    referenceGrounding: ["Rocket D3 BASIC source, ED editor filing, BASIC command, CATALOG command, RUN command"],
    safety: "mutates",
  },
  {
    id: "file-dictionary-builder",
    kind: "d3",
    label: "File and Dictionary Builder",
    purpose: "Create D3 files with documented create-file syntax, write dictionary items, inspect dictionary definitions, and validate data shape against sampled records.",
    tools: ["d3_create_file", "d3_read_dict", "d3_write_dict", "d3_query_aql"],
    cli: ["create-file", "read-dict", "write-dict", "query-aql"],
    ide: ["D3 Browser", "Dictionary inspector", "Agent tool events"],
    referenceGrounding: ["Rocket D3 create-file forms, DICT modifier, attribute-defining items, AQL"],
    safety: "mutates",
  },
  {
    id: "sbplus-builder",
    kind: "sbplus",
    label: "SB+ Screen and Process Builder",
    purpose: "Ground screen/process work in SB+ concepts before writing: systems, starting processes, input/output processes, screen definitions, menu definitions, drivers, validation, and F1/F3 help.",
    tools: ["d3_sbplus_discover", "d3_sbplus_plan"],
    cli: ["sbplus-discover", "sbplus-plan"],
    ide: ["SB+ discovery panel", "Agent SB+ planning", "Reference/RAG panel"],
    referenceGrounding: ["SB+ Solutions legacy guide (edition unverified): screen definitions, process definitions, drivers, validation, help; match the connected installation before applying layouts"],
    safety: "plan-only",
  },
  {
    id: "reference-memory",
    kind: "reference",
    label: "Reference and Hermes Memory",
    purpose: "Search D3, MV BASIC, SB+, local operator notes, Hermes memory, and ECC harness skills before proposing code or terminal actions.",
    tools: ["d3_manual_search", "d3_rag_search", "d3_builder_capabilities"],
    cli: ["manual-search", "rag-search", "capabilities", "hermes-status"],
    ide: ["Agent runtime context", "RAG status", "Tool routing status"],
    referenceGrounding: ["Rocket manuals, SB+ guide, operator memory, Hermes/ECC skill imports"],
    safety: "read",
  },
  {
    id: "terminal-screen-work",
    kind: "ide",
    label: "Terminal and Legacy Screen Work",
    purpose: "Operate persistent D3 terminal sessions, capture raw terminal/screen evidence, parse screen buffers, and preserve legacy screen behavior while modernizing.",
    tools: ["d3_tcl"],
    cli: ["tcl", "terminal-capture", "screen-parse", "terminal-plan"],
    ide: ["Live terminal / screen output", "Agent terminal actions"],
    referenceGrounding: ["D3 TCL, terminal behavior, SB+ process execution, local operator lessons"],
    safety: "mutates",
  },
]

export function renderD3Capabilities(capabilities = d3Capabilities): string {
  return [
    "# D3/SB+ Coding Capabilities",
    "",
    ...capabilities.flatMap((capability) => [
      `## ${capability.label}`,
      `Kind: ${capability.kind} · Safety: ${capability.safety}`,
      capability.purpose,
      `Tools: ${capability.tools.join(", ")}`,
      `CLI: ${capability.cli.join(", ")}`,
      `IDE: ${capability.ide.join(", ")}`,
      `Grounding: ${capability.referenceGrounding.join("; ")}`,
      "",
    ]),
  ].join("\n").trimEnd()
}
