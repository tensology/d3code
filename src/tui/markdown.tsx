import React from "react"
import { Box, Text, useStdout } from "ink"

export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language?: string; text: string }
  | { type: "quote"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "rule" }

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim())
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let index = 0

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() })
    paragraph = []
  }

  while (index < lines.length) {
    const line = lines[index] ?? ""
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      index += 1
      continue
    }

    const fence = trimmed.match(/^```\s*([^\s`]*)/)
    if (fence) {
      flushParagraph()
      const body: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test((lines[index] ?? "").trim())) {
        body.push(lines[index] ?? "")
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: "code", language: fence[1] || undefined, text: body.join("\n") })
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() })
      index += 1
      continue
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph()
      blocks.push({ type: "rule" })
      index += 1
      continue
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      flushParagraph()
      const rows = [tableCells(line)]
      index += 2
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim()) {
        rows.push(tableCells(lines[index] ?? ""))
        index += 1
      }
      blocks.push({ type: "table", rows })
      continue
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/)
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      const items: string[] = []
      while (index < lines.length) {
        const candidate = (lines[index] ?? "").trim()
        const match = isOrdered ? candidate.match(/^\d+[.)]\s+(.+)$/) : candidate.match(/^[-*+]\s+(.+)$/)
        if (!match) break
        items.push(match[1]!.trim())
        index += 1
      }
      blocks.push({ type: "list", ordered: isOrdered, items })
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph()
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test((lines[index] ?? "").trim())) {
        quote.push((lines[index] ?? "").trim().replace(/^>\s?/, ""))
        index += 1
      }
      blocks.push({ type: "quote", text: quote.join(" ") })
      continue
    }

    paragraph.push(trimmed)
    index += 1
  }
  flushParagraph()
  return blocks
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_([^_]+)_|\[[^\]]+\]\([^)]+\))/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push(text.slice(cursor, start))
    const token = match[0]
    if (token.startsWith("`")) parts.push(<Text key={start} color="yellow">{token.slice(1, -1)}</Text>)
    else if (token.startsWith("**") || token.startsWith("__")) parts.push(<Text key={start} bold>{token.slice(2, -2)}</Text>)
    else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      parts.push(<Text key={start} color="cyan" underline>{link?.[1] ?? token}</Text>)
    } else parts.push(<Text key={start} italic>{token.slice(1, -1)}</Text>)
    cursor = start + token.length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <Text wrap="wrap">{parts}</Text>
}

export function renderMarkdownTable(rows: string[][], maxWidth: number): { lines: string[]; width: number } {
  const widths = rows.reduce<number[]>((current, row) => row.map((cell, index) => Math.max(current[index] ?? 0, cell.length)), [])
  const separators = Math.max(0, widths.length - 1) * 3
  while (widths.reduce((sum, width) => sum + width, separators) > maxWidth) {
    const widest = widths.reduce((best, width, index) => width > (widths[best] ?? 0) ? index : best, 0)
    if ((widths[widest] ?? 0) <= 4) break
    widths[widest] = (widths[widest] ?? 0) - 1
  }
  const renderCell = (cell: string, width: number) => cell.length > width ? `${cell.slice(0, Math.max(1, width - 1))}…` : cell.padEnd(width)
  const renderRow = (row: string[]) => row.map((cell, index) => renderCell(cell, widths[index] ?? cell.length)).join(" | ").trimEnd()
  const lines = rows.flatMap((row, index) => index === 0
    ? [renderRow(row), widths.map((width) => "-".repeat(width)).join("-+-")]
    : [renderRow(row)])
  return { lines, width: widths.reduce((sum, width) => sum + width, separators) }
}

function TableBlock({ rows, maxWidth }: { rows: string[][]; maxWidth: number }) {
  const table = renderMarkdownTable(rows, maxWidth)
  return (
    <Box flexDirection="column">
      {table.lines.map((line, index) => <Text key={`${index}-${line}`} bold={index === 0} dimColor={index === 1}>{line}</Text>)}
    </Box>
  )
}

export function MarkdownView({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content)
  const { stdout } = useStdout()
  const maxTableWidth = Math.max(24, (stdout.columns ?? 100) - 4)
  return (
    <Box flexDirection="column">
      {blocks.map((block, index) => {
        if (block.type === "heading") return <Text key={index} bold color={block.level <= 2 ? "cyan" : undefined}>{block.text}</Text>
        if (block.type === "paragraph") return <InlineMarkdown key={index} text={block.text} />
        if (block.type === "quote") return <Box key={index} flexDirection="row"><Text color="gray">│ </Text><Text italic>{block.text}</Text></Box>
        if (block.type === "rule") return <Text key={index} dimColor>{"─".repeat(48)}</Text>
        if (block.type === "code") return (
          <Box key={index} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
            {block.language ? <Text dimColor>{block.language}</Text> : null}
            <Text color="yellow">{block.text}</Text>
          </Box>
        )
        if (block.type === "table") return <TableBlock key={index} rows={block.rows} maxWidth={maxTableWidth} />
        return (
          <Box key={index} flexDirection="column">
            {block.items.map((item, itemIndex) => (
              <Box key={`${itemIndex}-${item}`} flexDirection="row">
                <Text color="cyan">{block.ordered ? `${itemIndex + 1}. ` : "• "}</Text>
                <InlineMarkdown text={item} />
              </Box>
            ))}
          </Box>
        )
      })}
    </Box>
  )
}
