import { analyzeD3Record, validateShapeConsistency, type D3RecordShape, type ShapeFinding } from "../d3/shape.js"
import { validateDictionary, type DictionaryItem, type DictionaryValidationFinding } from "./dictionary.js"

export interface DatabaseFileSample {
  file: string
  dictionary: DictionaryItem[]
  records: Array<{ id: string; raw: string }>
  expectedIndexes?: string[]
  observedIndexes?: string[]
}

export interface DatabaseAuditReport {
  files: Array<{
    file: string
    recordShapes: D3RecordShape[]
    dictionaryFindings: DictionaryValidationFinding[]
    shapeFindings: ShapeFinding[]
    indexFindings: Array<{ severity: "info" | "warning" | "error"; message: string }>
  }>
}

type IndexFinding = DatabaseAuditReport["files"][number]["indexFindings"][number]

export function auditDatabaseSamples(samples: DatabaseFileSample[]): DatabaseAuditReport {
  return {
    files: samples.map((sample) => {
      const recordShapes = sample.records.map((record) => analyzeD3Record(record.id, record.raw))
      const expected = new Set(sample.expectedIndexes ?? [])
      const observed = new Set(sample.observedIndexes ?? [])
      const dictionaryIDs = new Set(sample.dictionary.map((item) => item.id.toUpperCase()))
      const indexFindings: IndexFinding[] = [...expected]
        .filter((index) => !observed.has(index))
        .map((index) => ({ severity: "warning" as const, message: `Expected index not observed: ${index}` }))
      for (const index of observed) {
        if (!dictionaryIDs.has(index.toUpperCase())) {
          indexFindings.push({ severity: "info", message: `Observed index has no sampled dictionary item: ${index}` })
        }
      }
      for (const index of expected) {
        if (!dictionaryIDs.has(index.toUpperCase())) {
          indexFindings.push({ severity: "warning", message: `Expected index has no sampled dictionary item: ${index}` })
        }
      }
      if (observed.size === 0 && expected.size === 0) {
        indexFindings.push({ severity: "info", message: "No index expectations supplied; verify AQL performance-sensitive fields manually." })
      }
      return {
        file: sample.file,
        recordShapes,
        dictionaryFindings: validateDictionary(sample.file, sample.dictionary),
        shapeFindings: validateShapeConsistency(recordShapes),
        indexFindings,
      }
    }),
  }
}
