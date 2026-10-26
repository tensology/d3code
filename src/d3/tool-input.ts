import { z } from "zod"

const empty = z.object({}).strict()
const name = z.string().min(1).regex(/^[A-Za-z0-9_.:-]+$/)
const baseline = z.object({ profile: z.string().min(1), connection: z.string().regex(/^[a-f0-9]{64}$/), original: z.string().max(10924) }).strict().optional()
const optionalConfirmation = { confirmed: z.boolean().optional() }
const positiveLimit = z.number().int().positive().max(1000).optional()
const singleLine = z.string().min(1).refine((value) => !/[\r\n\u0000-\u001f\u007f]/.test(value), "must be one line without control characters")

const schemas: Record<string, z.ZodTypeAny> = {
  d3_detect: empty,
  d3_builder_capabilities: empty,
  d3_tcl: z.object({ command: z.string().min(1), ...optionalConfirmation }).strict(),
  d3_login: z.object({ account: name.optional(), ...optionalConfirmation }).strict(),
  d3_list_files: empty,
  d3_read_item: z.object({ file: name, item: name, lossless: z.boolean().optional() }).strict(),
  d3_write_item: z.object({ file: name, item: name, body: z.string(), baseline, ...optionalConfirmation }).strict(),
  d3_create_item: z.object({ file: name, item: name, body: z.string(), section: z.enum(["data", "dict"]).optional(), ...optionalConfirmation }).strict(),
  d3_create_file: z.object({
    file: name,
    dictModulo: z.number().int().positive().optional(),
    dataModulo: z.number().int().positive().optional(),
    dictionaryOnly: z.boolean().optional(),
    dataOnlyDictionary: name.optional(),
    ...optionalConfirmation,
  }).strict(),
  d3_read_dict: z.object({ file: name, item: name, lossless: z.boolean().optional() }).strict(),
  d3_write_dict: z.object({ file: name, item: name, body: z.string(), baseline, ...optionalConfirmation }).strict(),
  d3_query_aql: z.object({ query: singleLine }).strict(),
  d3_compile_basic: z.object({ file: name, item: name, ...optionalConfirmation }).strict(),
  d3_run_basic: z.object({ file: name, item: name, ...optionalConfirmation }).strict(),
  d3_catalog: z.object({ file: name, item: name, global: z.boolean().optional(), ...optionalConfirmation }).strict(),
  d3_build_basic_program: z.object({ file: name, item: name, source: z.string(), baseline, compile: z.boolean().optional(), catalog: z.boolean().optional(), global: z.boolean().optional(), ...optionalConfirmation }).strict(),
  d3_locks: empty,
  d3_call_subroutine: z.object({ name, args: z.array(z.string()).max(100).optional(), ...optionalConfirmation }).strict(),
  d3_index_account: z.object({ saveAs: name.optional() }).strict(),
  d3_search: z.object({ query: z.string().min(1), index: name.optional(), limit: positiveLimit }).strict(),
  d3_manual_search: z.object({ query: z.string().min(1), limit: positiveLimit, paths: z.array(z.string().min(1)).max(20).optional() }).strict(),
  d3_rag_search: z.object({ query: z.string().min(1), limit: positiveLimit, index: name.optional() }).strict(),
  d3_sbplus_plan: z.object({ system: name.optional(), process: name.optional(), kind: z.string().max(100).optional(), file: name.optional(), fields: z.array(z.string().max(200)).max(200).optional(), notes: z.string().max(4000).optional() }).strict(),
  d3_sbplus_discover: z.object({ limit: positiveLimit }).strict(),
  d3_estate_report: z.object({ limit: positiveLimit }).strict(),
}

export const toolInputContracts: Record<string, string> = {
  d3_detect: "{}",
  d3_builder_capabilities: "{}",
  d3_tcl: "{command:string}",
  d3_login: "{account?:name}",
  d3_list_files: "{}",
  d3_read_item: "{file:name, item:name, lossless?:boolean}",
  d3_write_item: "{file:name, item:name, body:string, baseline:{profile,connection,original}}",
  d3_create_item: "{file:name, item:name, body:string, section?:data|dict}",
  d3_create_file: "{file:name, dictModulo?:positive-int, dataModulo?:positive-int, dictionaryOnly?:boolean, dataOnlyDictionary?:name}",
  d3_read_dict: "{file:name, item:name, lossless?:boolean}",
  d3_write_dict: "{file:name, item:name, body:string, baseline:{profile,connection,original}}",
  d3_query_aql: "{query:single read-only LIST|SORT|SELECT|SSELECT|COUNT statement}",
  d3_compile_basic: "{file:name, item:name, lossless?:boolean}",
  d3_run_basic: "{file:name, item:name}",
  d3_catalog: "{file:name, item:name, global?:boolean}",
  d3_build_basic_program: "{file:name, item:name, source:string, baseline:{profile,connection,original}, compile?:boolean, catalog?:boolean, global?:boolean}",
  d3_locks: "{}",
  d3_call_subroutine: "{name:name, args?:string[]}",
  d3_index_account: "{saveAs?:name}",
  d3_search: "{query:string, index?:name, limit?:positive-int}",
  d3_manual_search: "{query:string, limit?:positive-int, paths?:string[]}",
  d3_rag_search: "{query:string, limit?:positive-int, index?:name}",
  d3_sbplus_plan: "{system?:name, process?:name, kind?:string, file?:name, fields?:string[], notes?:string}",
  d3_sbplus_discover: "{limit?:positive-int<=1000}",
  d3_estate_report: "{limit?:positive-int<=1000}",
}

export function parseD3ToolInput(toolName: string, input: unknown): unknown {
  const schema = schemas[toolName]
  if (!schema) throw new Error(`No input schema registered for D3 tool: ${toolName}`)
  const parsed = schema.safeParse(input ?? {})
  if (parsed.success) return parsed.data
  const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")
  throw Object.assign(new Error(`Invalid ${toolName} input. ${detail}`), { statusCode: 400 })
}
