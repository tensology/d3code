export type D3Scope =
  | "d3-runtime"
  | "d3-code"
  | "d3-reference"
  | "d3code-ops"
  | "out-of-scope"

export interface D3ScopeDecision {
  scope: D3Scope
  allowed: boolean
  confidence: "high" | "medium" | "low"
  reasons: string[]
  requiredAnchor?: string
}

export interface D3ScopeGuardRequest {
  mode: string
  toolName?: string
  input?: unknown
  text?: string
}

const d3RuntimeTerms = [
  "d3",
  "rocket",
  "tcl",
  "account",
  "logto",
  "list md",
  "dict",
  "dictionary",
  "aql",
  "select",
  "locks",
  "phantom",
  "spooler",
  "print queue",
  "printer status",
  "background jobs",
  "indexes",
  "d-pointer",
  "q-pointer",
  "vme",
  "fsi",
  "osfi",
]

const d3CodeTerms = [
  "basic",
  "flashbasic",
  "mv basic",
  "subroutine",
  "catalog",
  "compile",
  "bp",
  "program",
  "attribute",
  "multivalue",
  "multi-value",
  "value mark",
  "screen",
  "sb+",
  "system builder",
  "migration",
  "bundle",
]

const d3ReferenceTerms = [
  "manual",
  "reference",
  "user guide",
  "rocket d3",
  "mvbasic",
  "system builder",
  "sb+",
  "create-file",
  "create file",
]

const d3CodeOpsTerms = [
  "d3code",
  "harness-doctor",
  "profile-doctor",
  "sidecar",
  "rag",
  "reference-skill",
  "skill-coverage",
  "model-proof",
  "session",
  "resume",
  "hermes",
  "ecc",
]

const genericEngineeringTerms = [
  "react",
  "next.js",
  "todo app",
  "landing page",
  "stripe",
  "supabase",
  "aws",
  "kubernetes",
  "docker",
  "browser automation",
  "gmail",
  "calendar",
]

const d3OperatorIntentPatterns: Array<[RegExp, string]> = [
  [/\btry\s+(?:to\s+)?connect\b/, "try connect"],
  [/\bcan\s+you\s+connect\b/, "can you connect"],
  [/\bcheck\s+(?:the\s+)?connection\b/, "check connection"],
  [/\bconnect\s+to\s+(?:the\s+)?server\b/, "connect to server"],
  [/\bserver\s+(?:(?:back\s+)?up|online|reachable|available)\b/, "server reachable"],
  [/\bvm\s+(?:back|up|online|running)\b/, "vm reachable"],
  [/\b(?:login|session)\s+(?:check|proof|test)\b/, "session proof"],
]

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function matches(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(term))
}

function inputText(input: unknown): string {
  if (input === undefined || input === null) return ""
  if (typeof input === "string") return input
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

export function classifyD3Scope(text: string): D3ScopeDecision {
  const value = normalized(text)
  const runtime = [
    ...matches(value, d3RuntimeTerms),
    ...(/\bct\s+[a-z0-9_.:-]+\s+[a-z0-9_.:-]+/.test(value) ? ["ct"] : []),
  ]
  const code = matches(value, d3CodeTerms)
  const reference = matches(value, d3ReferenceTerms)
  const ops = matches(value, d3CodeOpsTerms)
  const operatorIntent = d3OperatorIntentPatterns
    .filter(([pattern]) => pattern.test(value))
    .map(([, reason]) => reason)
  const generic = matches(value, genericEngineeringTerms)

  if (ops.length > 0) return { scope: "d3code-ops", allowed: true, confidence: "high", reasons: ops.map((term) => `D3Code operation term: ${term}`) }
  if (operatorIntent.length > 0) return { scope: "d3code-ops", allowed: true, confidence: "medium", reasons: operatorIntent.map((term) => `D3Code operator intent: ${term}`) }
  if (reference.length > 0) return { scope: "d3-reference", allowed: true, confidence: "high", reasons: reference.map((term) => `D3 reference term: ${term}`) }
  if (code.length > 0) return { scope: "d3-code", allowed: true, confidence: "high", reasons: code.map((term) => `D3 coding term: ${term}`) }
  if (runtime.length > 0) return { scope: "d3-runtime", allowed: true, confidence: "high", reasons: runtime.map((term) => `D3 runtime term: ${term}`) }
  if (/^(hi|hello|hey|thanks|thank you)\b/.test(value)) {
    return { scope: "d3code-ops", allowed: true, confidence: "low", reasons: ["neutral operator chat"] }
  }
  return {
    scope: "out-of-scope",
    allowed: false,
    confidence: generic.length > 0 ? "high" : "medium",
    reasons: generic.length > 0 ? generic.map((term) => `generic engineering term: ${term}`) : ["no D3 account, file, program, bundle, manual, reference, or D3Code operation anchor found"],
    requiredAnchor: "Which D3 account, file, program, bundle, manual section, or migration artifact is this attached to?",
  }
}

const modeToolAllowlist: Record<string, Set<string>> = {
  chat: new Set(["d3_detect", "d3_tcl", "d3_login", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_locks", "d3_operations_status", "d3_index_account", "d3_search", "d3_manual_search", "d3_rag_search", "d3_sbplus_discover", "d3_estate_report", "d3_builder_capabilities", "d3_sbplus_plan"]),
  audit: new Set(["d3_detect", "d3_tcl", "d3_login", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_locks", "d3_operations_status", "d3_index_account", "d3_search", "d3_manual_search", "d3_rag_search", "d3_sbplus_discover", "d3_estate_report", "d3_builder_capabilities", "d3_sbplus_plan"]),
  modernize: new Set(["d3_detect", "d3_tcl", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_locks", "d3_operations_status", "d3_search", "d3_manual_search", "d3_rag_search", "d3_compile_basic", "d3_run_basic", "d3_catalog", "d3_build_basic_program", "d3_builder_capabilities", "d3_sbplus_plan"]),
  migrate: new Set(["d3_detect", "d3_tcl", "d3_login", "d3_list_files", "d3_read_item", "d3_write_item", "d3_create_item", "d3_create_file", "d3_read_dict", "d3_write_dict", "d3_query_aql", "d3_compile_basic", "d3_run_basic", "d3_catalog", "d3_build_basic_program", "d3_locks", "d3_operations_status", "d3_call_subroutine", "d3_index_account", "d3_search", "d3_manual_search", "d3_rag_search", "d3_sbplus_plan", "d3_sbplus_discover", "d3_estate_report", "d3_builder_capabilities"]),
  api: new Set(["d3_detect", "d3_tcl", "d3_login", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_index_account", "d3_search", "d3_manual_search", "d3_rag_search", "d3_estate_report", "d3_builder_capabilities", "d3_sbplus_plan"]),
  qa: new Set(["d3_detect", "d3_tcl", "d3_login", "d3_list_files", "d3_read_item", "d3_read_dict", "d3_query_aql", "d3_locks", "d3_operations_status", "d3_search", "d3_manual_search", "d3_rag_search", "d3_estate_report", "d3_builder_capabilities", "d3_sbplus_plan"]),
  gsd: new Set(["d3_detect", "d3_manual_search", "d3_rag_search", "d3_search", "d3_builder_capabilities", "d3_sbplus_plan"]),
  plan: new Set(["d3_detect", "d3_manual_search", "d3_rag_search", "d3_search", "d3_builder_capabilities", "d3_sbplus_plan"]),
}

export function assertD3Scope(request: D3ScopeGuardRequest): D3ScopeDecision {
  const decision = classifyD3Scope([request.toolName, inputText(request.input), request.text].filter(Boolean).join(" "))
  if (!decision.allowed) throw new Error(renderD3ScopeDecision(decision))
  if (request.toolName) {
    const mode = request.mode || "chat"
    const allowedTools = modeToolAllowlist[mode] ?? modeToolAllowlist.chat
    if (!allowedTools?.has(request.toolName)) {
      throw new Error(`Tool ${request.toolName} is blocked in ${mode} mode. Use a D3 mode whose contract permits this operation, or attach the work to an audit/modernize/migrate evidence path.`)
    }
  }
  return decision
}

export function renderD3ScopeDecision(decision: D3ScopeDecision): string {
  const lines = [
    `D3 scope: ${decision.scope}`,
    `Allowed: ${decision.allowed ? "yes" : "no"}`,
    `Confidence: ${decision.confidence}`,
    `Reasons: ${decision.reasons.join("; ")}`,
  ]
  if (decision.requiredAnchor) lines.push(decision.requiredAnchor)
  return lines.join("\n")
}
