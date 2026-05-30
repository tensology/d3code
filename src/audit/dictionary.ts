export interface DictionaryItem {
  id: string
  type?: string
  attribute?: number
  conversion?: string
  heading?: string
  raw?: string
}

export interface DictionaryValidationFinding {
  file: string
  item: string
  severity: "info" | "warning" | "error"
  message: string
}

export function validateDictionary(file: string, items: DictionaryItem[]): DictionaryValidationFinding[] {
  const findings: DictionaryValidationFinding[] = []
  if (items.length === 0) {
    findings.push({ file, item: "*", severity: "warning", message: "Dictionary has no sampled items." })
    return findings
  }
  const ids = new Set(items.map((item) => item.id.toUpperCase()))
  if (!ids.has("@ID") && !ids.has("ID") && !ids.has("0")) {
    findings.push({ file, item: "*", severity: "info", message: "No obvious ID dictionary item in sample." })
  }
  for (const item of items) {
    if (item.attribute !== undefined && (!Number.isInteger(item.attribute) || item.attribute < 0)) {
      findings.push({ file, item: item.id, severity: "error", message: "Dictionary attribute number must be a non-negative integer." })
    }
    if (!item.type && !item.raw) {
      findings.push({ file, item: item.id, severity: "warning", message: "Dictionary item has no type/code information in sample." })
    }
    if (item.conversion && /\bCALL\b|\bSUBR\b|\bU[0-9]/i.test(item.conversion)) {
      findings.push({ file, item: item.id, severity: "info", message: "Dictionary conversion appears to call procedural logic; include in migration mapping." })
    }
  }
  return findings
}
