import type { MigrationPlan } from "./planner.js"

export interface AdapterFile {
  path: string
  content: string
}

function pascal(resource: string): string {
  return resource
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("")
}

function tsType(type: string, multivalue: boolean): string {
  if (multivalue || type === "array") return "string[]"
  if (type === "number") return "number"
  if (type === "boolean") return "boolean"
  if (type === "object") return "Record<string, unknown>"
  return "string"
}

function fieldMap(resource: MigrationPlan["resources"][number]): string {
  return JSON.stringify((resource.fields ?? [])
    .filter((field) => field.attribute !== undefined)
    .map((field) => ({ name: field.name, attribute: field.attribute, multivalue: field.multivalue })), null, 2)
}

export function generateAdapterSkeleton(plan: MigrationPlan): AdapterFile[] {
  return [
    {
      path: "src/d3-record.ts",
      content: [
        "export interface D3FieldMap {",
        "  name: string",
        "  attribute: number",
        "  multivalue?: boolean",
        "}",
        "",
        "const AM = \"\\u00fe\"",
        "const VM = \"\\u00fd\"",
        "const SVM = \"\\u00fc\"",
        "",
        "export function parseD3Record<TAttributes extends Record<string, unknown>>(id: string, raw: string, fields: D3FieldMap[]): { id: string; attributes: TAttributes } {",
        "  const attributes = raw.split(AM)",
        "  const mapped: Record<string, unknown> = {}",
        "  for (const field of fields) {",
        "    const value = attributes[field.attribute - 1] ?? \"\"",
        "    if (field.multivalue) {",
        "      mapped[field.name] = value ? value.split(VM).map((part) => part.includes(SVM) ? part.split(SVM) : part) : []",
        "    } else {",
        "      mapped[field.name] = value",
        "    }",
        "  }",
        "  return { id, attributes: mapped as TAttributes }",
        "}",
        "",
        "function valueToD3(value: unknown, multivalue?: boolean): string {",
        "  if (value === undefined || value === null) return \"\"",
        "  if (Array.isArray(value)) {",
        "    return value.map((entry) => Array.isArray(entry) ? entry.map((part) => String(part)).join(SVM) : String(entry)).join(multivalue ? VM : \"\")",
        "  }",
        "  return String(value)",
        "}",
        "",
        "export function formatD3Record(attributes: Record<string, unknown>, fields: D3FieldMap[]): string {",
        "  const maxAttribute = fields.reduce((max, field) => Math.max(max, field.attribute), 0)",
        "  const values = Array.from({ length: maxAttribute }, () => \"\")",
        "  for (const field of fields) {",
        "    values[field.attribute - 1] = valueToD3(attributes[field.name], field.multivalue)",
        "  }",
        "  return values.join(AM)",
        "}",
        "",
        "export function parseD3Ids(output: string): string[] {",
        "  return output.split(/\\r?\\n/)",
        "    .map((line) => line.trim())",
        "    .filter(Boolean)",
        "    .filter((line) => !/^(LIST|SELECT|SORT)\\b/i.test(line))",
        "    .filter((line) => !/^ID\\b/i.test(line))",
        "    .filter((line) => !/\\b(items?|records?)\\s+(listed|selected)\\b/i.test(line))",
        "    .map((line) => line.split(/\\s+/)[0]!)",
        "}",
        "",
      ].join("\n"),
    },
    ...plan.resources.flatMap((resource) => {
    const name = pascal(resource.resource)
    const base = `src/${resource.resource}`
    return [
      {
        path: `${base}/${resource.resource}.types.ts`,
        content: [
          `export interface ${name}Attributes {`,
          ...(resource.fields ?? []).map((field) => `  ${field.name}?: ${tsType(field.type, field.multivalue)} // D3 ${field.dictionaryId}${field.attribute !== undefined ? ` attr ${field.attribute}` : ""}`),
          "  [key: string]: unknown",
          "}",
          "",
          `export interface ${name}Record {`,
          "  id: string",
          `  attributes: ${name}Attributes`,
          "}",
          "",
        ].join("\n"),
      },
      {
        path: `${base}/${resource.resource}.repository.ts`,
        content: [
          "import { formatD3Record, parseD3Ids, parseD3Record, type D3FieldMap } from \"../d3-record.js\"",
          `import type { ${name}Record } from "./${resource.resource}.types.js"`,
          "",
          `const fields: D3FieldMap[] = ${fieldMap(resource)}`,
          "",
          `export interface ${name}Repository {`,
          `  list(): Promise<${name}Record[]>`,
          `  get(id: string): Promise<${name}Record | undefined>`,
          `  create(input: ${name}Record): Promise<${name}Record>`,
          `  update(id: string, input: Partial<${name}Record>): Promise<${name}Record>`,
          "}",
          "",
          `export class D3${name}Repository implements ${name}Repository {`,
          "  constructor(private readonly d3: { tcl(command: string): Promise<string> }) {}",
          "",
          `  async list(): Promise<${name}Record[]> {`,
          `    const selected = await this.d3.tcl("SELECT ${resource.file}")`,
          "    const records = await Promise.all(parseD3Ids(selected).map((id) => this.get(id)))",
          `    return records.filter((record): record is ${name}Record => Boolean(record))`,
          "  }",
          "",
          `  async get(id: string): Promise<${name}Record | undefined> {`,
          `    const raw = await this.d3.tcl(\`CT ${resource.file} \${id}\`)`,
          "    return raw.trim() ? parseD3Record(id, raw.trim(), fields) : undefined",
          "  }",
          "",
          `  async create(input: ${name}Record): Promise<${name}Record> {`,
          "    const raw = formatD3Record(input.attributes, fields)",
          `    await this.d3.tcl(\`ED ${resource.file} \${input.id}\\nI\\n\${raw}\\nFI\`)`,
          "    return input",
          "  }",
          "",
          `  async update(id: string, input: Partial<${name}Record>): Promise<${name}Record> {`,
          "    const current = await this.get(id)",
          "    const next = { id, attributes: { ...(current?.attributes ?? {}), ...(input.attributes ?? {}) } }",
          "    const raw = formatD3Record(next.attributes, fields)",
          `    await this.d3.tcl(\`ED ${resource.file} \${id}\\nI\\n\${raw}\\nFI\`)`,
          "    return next",
          "  }",
          "}",
          "",
        ].join("\n"),
      },
      {
        path: `${base}/${resource.resource}.routes.ts`,
        content: [
          `import type { ${name}Repository } from "./${resource.resource}.repository.js"`,
          "",
          `export function create${name}Routes(repository: ${name}Repository) {`,
          "  return {",
          "    async list() { return repository.list() },",
          "    async get(id: string) { return repository.get(id) },",
          "    async create(body: any) { return repository.create(body) },",
          "    async update(id: string, body: any) { return repository.update(id, body) },",
          "  }",
          "}",
          "",
        ].join("\n"),
      },
    ]
  }),
  ]
}
