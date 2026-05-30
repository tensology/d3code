import type { MigrationPlan } from "./planner.js"

export interface OpenApiDocument {
  openapi: "3.1.0"
  info: { title: string; version: string }
  paths: Record<string, Record<string, unknown>>
  components: { schemas: Record<string, unknown> }
}

function schemaName(resource: string): string {
  return resource
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("")
}

function jsonSchemaType(type: string): Record<string, unknown> {
  if (type === "array") return { type: "array", items: { type: "string" } }
  if (type === "number") return { type: "number" }
  if (type === "boolean") return { type: "boolean" }
  if (type === "object") return { type: "object", additionalProperties: true }
  return { type: "string" }
}

export function createOpenApiFromMigrationPlan(plan: MigrationPlan): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {}
  const schemas: Record<string, unknown> = {}

  for (const resource of plan.resources) {
    const name = schemaName(resource.resource)
    const fieldProperties = Object.fromEntries((resource.fields ?? []).map((field) => [
      field.name,
      {
        ...jsonSchemaType(field.multivalue ? "array" : field.type),
        description: `D3 dictionary ${field.dictionaryId}${field.attribute !== undefined ? `, attribute ${field.attribute}` : ""}`,
        "x-d3-dictionary": field.dictionaryId,
        ...(field.attribute !== undefined ? { "x-d3-attribute": field.attribute } : {}),
        ...(field.multivalue ? { "x-d3-multivalue": true } : {}),
      },
    ]))
    schemas[name] = {
      type: "object",
      additionalProperties: true,
      description: `JSON projection of D3 file ${resource.file}. Multi-valued attributes must be normalized during adapter implementation.`,
      properties: {
        id: { type: "string", description: "D3 item-id" },
        ...fieldProperties,
      },
      required: ["id"],
      "x-d3-file": resource.file,
    }
    paths[`/${resource.resource}`] = {
      get: {
        summary: `List ${resource.resource}`,
        tags: [resource.resource],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: `Create ${resource.resource}`,
        tags: [resource.resource],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${name}` } } } },
        responses: { "201": { description: "Created" } },
      },
    }
    paths[`/${resource.resource}/{id}`] = {
      get: {
        summary: `Read ${resource.resource} item`,
        tags: [resource.resource],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
      patch: {
        summary: `Update ${resource.resource} item`,
        tags: [resource.resource],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${name}` } } } },
        responses: { "200": { description: "OK" }, "409": { description: "D3 lock or validation conflict" } },
      },
    }
  }

  return {
    openapi: "3.1.0",
    info: { title: `${plan.account} D3 Migration API`, version: "0.1.0" },
    paths,
    components: { schemas },
  }
}
