export interface BasicScreenOperation {
  line: number
  kind: "cursor" | "clear" | "input" | "display" | "screen-utility" | "proc"
  snippet: string
}

export interface BasicScreenAudit {
  operations: BasicScreenOperation[]
  risk: "none" | "low" | "medium" | "high"
  recommendations: string[]
}

function kindFor(line: string): BasicScreenOperation["kind"] | undefined {
  if (/@\(-?[0-9]+\)|@\(\s*\d+\s*,\s*\d+\s*\)/i.test(line)) {
    if (/@\(-[1-4]\)/.test(line)) return "clear"
    return "cursor"
  }
  if (/\bINPUT\b/i.test(line)) return "input"
  if (/\b(CRT|DISPLAY|PRINT)\b/i.test(line)) return "display"
  if (/\bscreen\.(display|erase|init|input)\b/i.test(line)) return "screen-utility"
  if (/\b(PROC|PQN|PQ)\b|^\s*[A-Z]\s*:/i.test(line)) return "proc"
  return undefined
}

export function auditBasicScreen(source: string): BasicScreenAudit {
  const operations: BasicScreenOperation[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    const kind = kindFor(line)
    if (!kind) return
    operations.push({
      line: index + 1,
      kind,
      snippet: line.trim().slice(0, 160),
    })
  })
  const hasInput = operations.some((operation) => operation.kind === "input")
  const hasCursor = operations.some((operation) => operation.kind === "cursor" || operation.kind === "clear" || operation.kind === "screen-utility")
  const hasDisplay = operations.some((operation) => operation.kind === "display")
  const risk = operations.length === 0 ? "none" : hasInput && hasCursor ? "high" : hasInput || hasCursor || hasDisplay ? "medium" : "low"
  const recommendations = operations.length === 0
    ? ["No legacy screen operations found in sampled source."]
    : [
        "Capture a terminal transcript for this program before rewriting the screen.",
        "Use screen-parse to normalize cursor-control output into an inspectable buffer.",
        "Map every INPUT field to a named UI field and preserve validation/default behavior.",
        "Keep D3 writes and cataloged side effects behind safety gates while modernizing the screen.",
      ]
  return { operations, risk, recommendations }
}
