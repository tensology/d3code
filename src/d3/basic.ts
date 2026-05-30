export interface BasicSymbols {
  subroutine?: string
  labels: string[]
  calls: string[]
  chains: string[]
  opens: string[]
  reads: string[]
  writes: string[]
  executes: string[]
  commons: string[]
}

export interface LintFinding {
  severity: "info" | "warning" | "error"
  code: string
  message: string
  line: number
}

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]?.replace(/['"]/g, "").trim()).filter(Boolean)
}

export function extractBasicSymbols(source: string): BasicSymbols {
  const subroutine = source.match(/^\s*SUBROUTINE\s+([A-Z0-9_.-]+)/im)?.[1]
  return {
    subroutine,
    labels: matches(source, /^\s*([A-Z0-9_.-]+):/gim),
    calls: matches(source, /\bCALL\s+([A-Z0-9_.-]+)/gim),
    chains: matches(source, /\bCHAIN\s+['"]?([^'"\r\n]+)['"]?/gim),
    opens: matches(source, /\bOPEN\s+['"]?([^'",\r\n]+)['"]?/gim),
    reads: matches(source, /\bREAD(?:U|V|VU)?\s+.+?\s+FROM\s+([A-Z0-9_.-]+)/gim),
    writes: matches(source, /\bWRITE(?:U|V|VU)?\s+.+?\s+ON\s+([A-Z0-9_.-]+)/gim),
    executes: matches(source, /\bEXECUTE\s+['"]([^'"]+)['"]/gim),
    commons: matches(source, /\bCOMMON\s*\/?([A-Z0-9_.-]*)\/?/gim),
  }
}

export function lintBasic(source: string): LintFinding[] {
  const findings: LintFinding[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    const number = index + 1
    if (/\bEXECUTE\s+['"].*\bCLEAR-FILE\b/i.test(line)) {
      findings.push({ severity: "error", code: "D3_EXEC_CLEAR_FILE", message: "EXECUTE can clear a file; require explicit confirmation.", line: number })
    }
    if (/\bWRITE(?:U|V|VU)?\b/i.test(line) && !/\bLOCKED\b|\bON ERROR\b/i.test(line)) {
      findings.push({ severity: "warning", code: "D3_WRITE_NO_ERROR_PATH", message: "Write statement has no visible LOCKED or ON ERROR path.", line: number })
    }
    if (/\bREADU\b/i.test(line) && !/\bRELEASE\b/i.test(source)) {
      findings.push({ severity: "warning", code: "D3_READU_NO_RELEASE", message: "READU appears without any RELEASE in the program.", line: number })
    }
    if (/\bTRANSACTION\s+START\b/i.test(line) && !/\bTRANSACTION\s+(COMMIT|ABORT)\b/i.test(source)) {
      findings.push({ severity: "error", code: "D3_TRANSACTION_UNCLOSED", message: "Transaction start has no visible commit or abort.", line: number })
    }
  })
  return findings
}

export function parseCompileErrors(output: string): LintFinding[] {
  const findings: LintFinding[] = []
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/\b(?:LINE|Line)\s+(\d+).*(ERROR|WARNING)[:\s-]+(.+)/)
    if (match) {
      findings.push({
        severity: match[2].toLowerCase() === "error" ? "error" : "warning",
        code: "D3_COMPILE",
        message: match[3].trim(),
        line: Number(match[1]),
      })
    }
  }
  return findings
}
