import React from "react"
import { Box, Text } from "ink"

export interface TranscriptEntry {
  role: string
  content: string
}

export function compactTranscriptContent(content: string, maxLines = 8): string[] {
  const lines = content.split(/\r?\n/)
  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, Math.max(1, maxLines - 1))
  return [...visible, `... ${lines.length - visible.length} more lines`]
}

export function transcriptPrefix(role: string): string {
  if (role === "user") return "› "
  if (role === "assistant") return "d3code: "
  if (role === "error") return "error: "
  if (role === "tool-start") return "⏺ "
  if (role === "tool") return "  ⎿ "
  if (role === "file-change") return "  ◆ "
  return "  "
}

export function transcriptColor(role: string): string {
  if (role === "error") return "red"
  if (role === "assistant") return "green"
  if (role === "user") return "white"
  if (role === "tool-start" || role === "file-change") return "cyan"
  return "gray"
}

function ToolBlock({ content }: { content: string }) {
  const [title = "tool", ...rest] = compactTranscriptContent(content)
  return (
    <Box flexDirection="row">
      <Text dimColor>{transcriptPrefix("tool")}</Text>
      <Box flexDirection="column">
        <Text color="cyan">{title}</Text>
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

export function TranscriptEntryView({ entry }: { entry: TranscriptEntry }) {
  if (entry.role === "tool") return <ToolBlock content={entry.content} />
  if (entry.role === "file-change") return <FileChangeBlock content={entry.content} />
  return (
    <Text color={transcriptColor(entry.role)}>
      {transcriptPrefix(entry.role)}
      {entry.content}
    </Text>
  )
}
