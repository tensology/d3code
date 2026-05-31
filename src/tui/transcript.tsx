import React from "react"
import { Box, Text } from "ink"

export interface TranscriptEntry {
  role: string
  content: string
}

export function wrapTranscriptLine(line: string, width = 74): string[] {
  if (line.length <= width) return [line]
  const wrapped: string[] = []
  let rest = line
  while (rest.length > width) {
    const breakAt = rest.slice(0, width + 1).lastIndexOf(" ")
    const index = breakAt > 16 ? breakAt : width
    wrapped.push(rest.slice(0, index).trimEnd())
    rest = rest.slice(index).trimStart()
  }
  if (rest.length) wrapped.push(rest)
  return wrapped
}

export function compactTranscriptContent(content: string, maxLines = 8): string[] {
  const lines = content.split(/\r?\n/).flatMap((line) => wrapTranscriptLine(line))
  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, Math.max(1, maxLines - 1))
  return [...visible, `... ${lines.length - visible.length} more lines`]
}

export function transcriptPrefix(role: string): string {
  if (role === "user") return "› "
  if (role === "shell-input") return "› ! "
  if (role === "assistant") return "d3code: "
  if (role === "assistant-stream") return "  ⎿ "
  if (role === "assistant-interrupted") return "  ⎿ "
  if (role === "pending") return "  ⎿ "
  if (role === "queued") return "queued › "
  if (role === "error") return "error: "
  if (role === "system") return "  ⎿ "
  if (role === "tool-start") return "⏺ "
  if (role === "tool") return "  ⎿ "
  if (role === "shell-output") return "  ⎿ "
  if (role === "file-change") return "  ◆ "
  return "  "
}

export function transcriptColor(role: string): string {
  if (role === "error") return "red"
  if (role === "assistant" || role === "assistant-stream") return "green"
  if (role === "assistant-interrupted") return "yellow"
  if (role === "pending") return "yellow"
  if (role === "queued") return "cyan"
  if (role === "shell-input") return "white"
  if (role === "user") return "white"
  if (role === "tool-start" || role === "file-change" || role === "shell-output") return "cyan"
  return "gray"
}

function ResponseBlock({ content, titleColor = "cyan", maxLines = 8 }: { content: string; titleColor?: string; maxLines?: number }) {
  const [title = "output", ...rest] = compactTranscriptContent(content, maxLines)
  return (
    <Box flexDirection="row">
      <Text dimColor>{transcriptPrefix("tool")}</Text>
      <Box flexDirection="column">
        <Text color={titleColor}>{title}</Text>
        {rest.map((line, index) => <Text key={`${index}-${line}`} dimColor>{line}</Text>)}
      </Box>
    </Box>
  )
}

function FileChangeBlock({ content }: { content: string }) {
  const [summary = "Changed files", ...files] = compactTranscriptContent(content, 9)
  return (
    <Box flexDirection="row">
      <Text color="cyan">{transcriptPrefix("file-change")}</Text>
      <Box flexDirection="column">
        <Text color="cyan">{summary}</Text>
        {files.map((line, index) => <Text key={`${index}-${line}`} dimColor>{line}</Text>)}
      </Box>
    </Box>
  )
}

function PendingBlock({ content }: { content: string }) {
  return (
    <Box flexDirection="row">
      <Text color="yellow">{transcriptPrefix("pending")}</Text>
      <Text color="yellow">{content}</Text>
    </Box>
  )
}

function QueuedBlock({ content }: { content: string }) {
  return (
    <Text color="cyan">
      {transcriptPrefix("queued")}
      <Text dimColor>{content}</Text>
    </Text>
  )
}

export function TranscriptEntryView({ entry }: { entry: TranscriptEntry }) {
  if (entry.role === "pending") return <PendingBlock content={entry.content} />
  if (entry.role === "queued") return <QueuedBlock content={entry.content} />
  if (entry.role === "assistant" || entry.role === "assistant-stream") return <ResponseBlock content={`d3code\n${entry.content}`} titleColor="green" maxLines={14} />
  if (entry.role === "assistant-interrupted") return <ResponseBlock content={`d3code interrupted\n${entry.content}`} titleColor="yellow" maxLines={14} />
  if (entry.role === "tool") return <ResponseBlock content={entry.content} />
  if (entry.role === "shell-output") return <ResponseBlock content={entry.content} />
  if (entry.role === "system") return <ResponseBlock content={entry.content} titleColor="gray" maxLines={14} />
  if (entry.role === "file-change") return <FileChangeBlock content={entry.content} />
  return (
    <Text color={transcriptColor(entry.role)}>
      {transcriptPrefix(entry.role)}
      {entry.content}
    </Text>
  )
}
