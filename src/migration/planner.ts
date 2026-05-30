import { extractBasicSymbols } from "../d3/basic.js"
import type { DictionaryItem } from "../audit/dictionary.js"

export interface D3ResourceField {
  name: string
  dictionaryId: string
  attribute?: number
  type: "string" | "number" | "boolean" | "array" | "object"
  required: boolean
  multivalue: boolean
  raw?: string
}

export interface D3ResourceCandidate {
  file: string
  itemCount?: number
  dictionaryItems?: Array<string | DictionaryItem>
  suggestedResource: string
}

export interface D3ProgramCandidate {
  file: string
  item: string
  source: string
}

export interface MigrationPlanInput {
  account: string
  files: D3ResourceCandidate[]
  programs: D3ProgramCandidate[]
}

export interface MigrationPlan {
  account: string
  strategy: "strangler"
  resources: Array<{ file: string; resource: string; endpoints: string[]; fields?: D3ResourceField[] }>
  services: Array<{ program: string; calls: string[]; opens: string[]; suggestedService: string }>
  phases: string[]
  risks: string[]
}

function resourceName(file: string): string {
  return file.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function fieldName(id: string): string {
  const parts = id
    .replace(/^@/, "")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const clean = parts.map((part, index) => index === 0 ? part : part[0]!.toUpperCase() + part.slice(1)).join("")
  return (clean || "field").replace(/^[^a-zA-Z_]+/, "").replace(/[^a-zA-Z0-9_]/g, "") || "field"
}

function fieldType(item: DictionaryItem): D3ResourceField["type"] {
  const source = `${item.id} ${item.conversion ?? ""} ${item.heading ?? ""} ${item.raw ?? ""}`.toUpperCase()
  if (/(AMOUNT|PRICE|TOTAL|QTY|QUANTITY|BALANCE|COUNT|NUMBER|NUM|DEC|MR\d|MD\d)/.test(source)) return "number"
  if (/(FLAG|BOOL|YES\/NO|TRUE|FALSE)/.test(source)) return "boolean"
  return "string"
}

function normalizeDictionaryItem(item: string | DictionaryItem): DictionaryItem {
  return typeof item === "string" ? { id: item } : item
}

export function fieldsFromDictionary(items: Array<string | DictionaryItem> = []): D3ResourceField[] {
  return items
    .map(normalizeDictionaryItem)
    .filter((item) => item.id && !["ID", "@ID", "0"].includes(item.id.toUpperCase()))
    .map((item) => ({
      name: fieldName(item.id),
      dictionaryId: item.id,
      attribute: item.attribute,
      type: item.raw?.includes("\u00fd") || item.raw?.includes("]") ? "array" : fieldType(item),
      required: false,
      multivalue: Boolean(item.raw?.includes("\u00fd") || item.raw?.includes("]")),
      raw: item.raw,
    }))
}

export function createMigrationPlan(input: MigrationPlanInput): MigrationPlan {
  return {
    account: input.account,
    strategy: "strangler",
    resources: input.files.map((file) => {
      const resource = file.suggestedResource || resourceName(file.file)
      return {
        file: file.file,
        resource,
        endpoints: [`GET /${resource}`, `GET /${resource}/{id}`, `POST /${resource}`, `PATCH /${resource}/{id}`],
        fields: fieldsFromDictionary(file.dictionaryItems),
      }
    }),
    services: input.programs.map((program) => {
      const symbols = extractBasicSymbols(program.source)
      const name = (symbols.subroutine ?? program.item).toLowerCase().replace(/[^a-z0-9]+/g, "-")
      return {
        program: `${program.file}/${program.item}`,
        calls: symbols.calls,
        opens: symbols.opens,
        suggestedService: `${name}-service`,
      }
    }),
    phases: [
      "Read-only audit and data dictionary validation",
      "REST API contract and adapter skeleton",
      "Read endpoints against D3 source of truth",
      "Write endpoints with explicit transaction/lock policy",
      "Web UI vertical slice and browser QA",
      "Incremental cutover with fallback to D3",
    ],
    risks: [
      "Multi-valued attributes need explicit JSON shape decisions",
      "READU/lock behavior must be preserved in write APIs",
      "Cataloged subroutine side effects must be mapped before extraction",
      "AQL reports may encode business logic outside BASIC programs",
    ],
  }
}
