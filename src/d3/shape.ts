export interface D3RecordShape {
  id: string
  attributeCount: number
  multivalueAttributes: number[]
  subvalueAttributes: number[]
}

export interface ShapeFinding {
  severity: "info" | "warning" | "error"
  message: string
}

export function analyzeD3Record(id: string, raw: string): D3RecordShape {
  const attributes = raw.split("\u00fe")
  return {
    id,
    attributeCount: attributes.length,
    multivalueAttributes: attributes.flatMap((attribute, index) => attribute.includes("\u00fd") ? [index + 1] : []),
    subvalueAttributes: attributes.flatMap((attribute, index) => attribute.includes("\u00fc") ? [index + 1] : []),
  }
}

export function validateShapeConsistency(shapes: D3RecordShape[]): ShapeFinding[] {
  if (shapes.length === 0) return [{ severity: "warning", message: "No records sampled." }]
  const findings: ShapeFinding[] = []
  const counts = new Map<number, number>()
  for (const shape of shapes) counts.set(shape.attributeCount, (counts.get(shape.attributeCount) ?? 0) + 1)
  if (counts.size > 1) findings.push({ severity: "warning", message: `Sampled records have inconsistent attribute counts: ${[...counts.keys()].sort((a, b) => a - b).join(", ")}.` })
  const mv = new Set(shapes.flatMap((shape) => shape.multivalueAttributes))
  const sv = new Set(shapes.flatMap((shape) => shape.subvalueAttributes))
  if (mv.size > 0) findings.push({ severity: "info", message: `Multi-valued attributes observed at positions: ${[...mv].sort((a, b) => a - b).join(", ")}.` })
  if (sv.size > 0) findings.push({ severity: "info", message: `Sub-valued attributes observed at positions: ${[...sv].sort((a, b) => a - b).join(", ")}.` })
  return findings
}
