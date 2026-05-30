import { z } from "zod"
import { auditD3Application, type D3AuditReport } from "../audit/audit.js"
import { createD3CodeMap, type D3CodeMap } from "../audit/code-map.js"
import type { DatabaseFileSample } from "../audit/database.js"
import type { IndexedDocument } from "../indexing/indexer.js"
import { generateAdapterSkeleton, type AdapterFile } from "../migration/adapter.js"
import { createOpenApiFromMigrationPlan, type OpenApiDocument } from "../migration/openapi.js"
import { createMigrationPlan, type MigrationPlan } from "../migration/planner.js"
import { parseD3Uri } from "../d3/uri.js"

const DictionaryItemSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  attribute: z.number().int().optional(),
  conversion: z.string().optional(),
  heading: z.string().optional(),
  raw: z.string().optional(),
})

const BundleSchema = z.object({
  account: z.string(),
  profile: z.string().default("bundle"),
  users: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    roles: z.array(z.string()).default([]),
  })).default([]),
  files: z.array(z.object({
    name: z.string(),
    suggestedResource: z.string().optional(),
    dictionary: z.array(DictionaryItemSchema).default([]),
    records: z.array(z.object({ id: z.string(), raw: z.string() })).default([]),
    expectedIndexes: z.array(z.string()).optional(),
    observedIndexes: z.array(z.string()).optional(),
  })).default([]),
  programs: z.array(z.object({
    file: z.string(),
    item: z.string(),
    source: z.string(),
  })).default([]),
})

export type D3ApplicationBundle = z.infer<typeof BundleSchema>

export interface BundleArtifacts {
  audit: D3AuditReport
  migrationPlan: MigrationPlan
  openapi: OpenApiDocument
  adapters: AdapterFile[]
  index: IndexedDocument[]
  codeMap: D3CodeMap
}

export function parseBundle(input: unknown): D3ApplicationBundle {
  return BundleSchema.parse(input)
}

export function bundleToDatabaseSamples(bundle: D3ApplicationBundle): DatabaseFileSample[] {
  return bundle.files.map((file) => ({
    file: file.name,
    dictionary: file.dictionary,
    records: file.records,
    expectedIndexes: file.expectedIndexes,
    observedIndexes: file.observedIndexes,
  }))
}

export function bundleToIndex(bundle: D3ApplicationBundle): IndexedDocument[] {
  const docs: IndexedDocument[] = []
  for (const file of bundle.files) {
    docs.push({
      uri: `d3://${bundle.profile}/${bundle.account}/${file.name}/__records__`,
      title: `${bundle.account}/${file.name} sampled records`,
      body: file.records.map((record) => `${record.id}\n${record.raw}`).join("\n\n"),
      metadata: { kind: "records", account: bundle.account, file: file.name },
    })
    docs.push({
      uri: `d3dict://${bundle.profile}/${bundle.account}/${file.name}/__dictionary__`,
      title: `${bundle.account}/${file.name} dictionary`,
      body: file.dictionary.map((item) => JSON.stringify(item)).join("\n"),
      metadata: { kind: "dictionary", account: bundle.account, file: file.name },
    })
  }
  for (const program of bundle.programs) {
    docs.push({
      uri: `d3://${bundle.profile}/${bundle.account}/${program.file}/${program.item}`,
      title: `${bundle.account}/${program.file}/${program.item}`,
      body: program.source,
      metadata: { kind: "program", account: bundle.account, file: program.file, item: program.item },
    })
  }
  return docs
}

export function createBundleArtifacts(bundle: D3ApplicationBundle): BundleArtifacts {
  const migrationPlan = createMigrationPlan({
    account: bundle.account,
    files: bundle.files.map((file) => ({
      file: file.name,
      itemCount: file.records.length,
      dictionaryItems: file.dictionary,
      suggestedResource: file.suggestedResource ?? file.name.toLowerCase(),
    })),
    programs: bundle.programs,
  })
  return {
    audit: auditD3Application({
      account: bundle.account,
      dictionaries: bundle.files.map((file) => ({ file: file.name, items: file.dictionary.map((item) => item.id) })),
      programs: bundle.programs,
      databaseSamples: bundleToDatabaseSamples(bundle),
    }),
    migrationPlan,
    openapi: createOpenApiFromMigrationPlan(migrationPlan),
    adapters: generateAdapterSkeleton(migrationPlan),
    index: bundleToIndex(bundle),
    codeMap: createD3CodeMap(bundle.programs),
  }
}

export function validateBundleUris(bundle: D3ApplicationBundle): void {
  for (const doc of bundleToIndex(bundle)) parseD3Uri(doc.uri)
}
