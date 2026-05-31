import React from "react"
import { Box, Text } from "ink"

export interface TranscriptEntry {
  role: string
  content: string
}

export function visibleTranscriptEntries(
  entries: TranscriptEntry[],
  activeInput?: Pick<TranscriptEntry, "role" | "content">,
  activeToolLabel?: string,
): TranscriptEntry[] {
  let visible = entries
  if (activeInput) {
    let index = -1
    for (let position = visible.length - 1; position >= 0; position--) {
      const entry = visible[position]!
      if (entry.role === activeInput.role && entry.content === activeInput.content) {
        index = position
        break
      }
    }
    if (index !== -1) visible = [...visible.slice(0, index), ...visible.slice(index + 1)]
  }
  if (activeToolLabel) {
    let index = -1
    for (let position = visible.length - 1; position >= 0; position--) {
      const entry = visible[position]!
      if (entry.role === "tool-start" && entry.content === activeToolLabel) {
        index = position
        break
      }
    }
    if (index !== -1) {
      visible = [...visible.slice(0, index), ...visible.slice(index + 1)]
    }
  }
  return visible
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

export function transcriptMaxLines(role: string): number {
  if (role === "assistant" || role === "assistant-stream" || role === "assistant-interrupted") return Number.POSITIVE_INFINITY
  if (role === "system") return 14
  if (role === "file-change") return 9
  if (role === "file-change-live") return 6
  if (role === "tool-live") return 10
  return 8
}

export function transcriptPrefix(role: string): string {
  if (role === "user") return "› "
  if (role === "shell-input") return "› ! "
  if (role === "d3-input") return "› : "
  if (role === "assistant") return "d3code: "
  if (role === "assistant-stream") return "  ⎿ "
  if (role === "assistant-interrupted") return "  ⎿ "
  if (role === "pending") return "  ⎿ "
  if (role === "queued") return "QUEUED "
  if (role === "error") return "error: "
  if (role === "system") return "  ⎿ "
  if (role === "tool-start") return "⏺ "
  if (role === "tool-live") return "⏺ "
  if (role === "tool") return "  ⎿ "
  if (role === "shell-output") return "  ⎿ "
  if (role === "file-change-live") return "  ◆ "
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
  if (role === "d3-input") return "white"
  if (role === "user") return "white"
  if (role === "file-change-live") return "yellow"
  if (role === "tool-live") return "yellow"
  if (role === "tool-start" || role === "file-change" || role === "shell-output") return "cyan"
  return "gray"
}

function InputBlock({ content, role }: { content: string; role: "user" | "shell-input" | "d3-input" }) {
  const prefix = transcriptPrefix(role)
  const lines = content.split(/\r?\n/).flatMap((line) => wrapTranscriptLine(line, 72 - prefix.length))
  const prefixColor = role === "shell-input" ? "cyan" : role === "d3-input" ? "yellow" : "white"
  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Box key={`${index}-${line}`} flexDirection="row">
          <Text color={prefixColor}>{index === 0 ? prefix : " ".repeat(prefix.length)}</Text>
          <Text color="white">{line}</Text>
        </Box>
      ))}
    </Box>
  )
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

function LiveFileChangeBlock({ content }: { content: string }) {
  const [summary = "Files changing", ...files] = compactTranscriptContent(content, 6)
  return (
    <Box flexDirection="row">
      <Text color="yellow">{transcriptPrefix("file-change-live")}</Text>
      <Box flexDirection="column">
        <Text color="yellow">{summary}</Text>
        {files.map((line, index) => <Text key={`${index}-${line}`} dimColor>{line}</Text>)}
      </Box>
    </Box>
  )
}

function LiveToolBlock({ content }: { content: string }) {
  const [title = "Tool running", ...rest] = compactTranscriptContent(content, 10)
  return (
    <Box flexDirection="row">
      <Text color="yellow">{transcriptPrefix("tool-live")}</Text>
      <Box flexDirection="column">
        <Text color="yellow">{title}</Text>
        {rest.map((line, index) => <Text key={`${index}-${line}`} dimColor>{line}</Text>)}
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

function queuedInputPrefix(content: string): string {
  if (content.startsWith("!")) return transcriptPrefix("shell-input")
  if (content.startsWith(":")) return transcriptPrefix("d3-input")
  return transcriptPrefix("user")
}

function queuedInputContent(content: string): string {
  if (content.startsWith("!")) return content.slice(1).trim()
  if (content.startsWith(":")) return content.slice(1).trim()
  return content
}

function QueuedBlock({ content }: { content: string }) {
  const inputPrefix = queuedInputPrefix(content)
  const inputContent = queuedInputContent(content)
  return (
    <Box flexDirection="row">
      <Text color="cyan" inverse bold>{transcriptPrefix("queued")}</Text>
      <Text> </Text>
      <Text color={inputPrefix === transcriptPrefix("d3-input") ? "yellow" : "cyan"}>{inputPrefix}</Text>
      <Text dimColor>{inputContent}</Text>
    </Box>
  )
}

export function TranscriptEntryView({ entry }: { entry: TranscriptEntry }) {
  if (entry.role === "user" || entry.role === "shell-input" || entry.role === "d3-input") return <InputBlock content={entry.content} role={entry.role} />
  if (entry.role === "pending") return <PendingBlock content={entry.content} />
  if (entry.role === "queued") return <QueuedBlock content={entry.content} />
  if (entry.role === "assistant" || entry.role === "assistant-stream") return <ResponseBlock content={`d3code\n${entry.content}`} titleColor="green" maxLines={transcriptMaxLines(entry.role)} />
  if (entry.role === "assistant-interrupted") return <ResponseBlock content={`d3code interrupted\n${entry.content}`} titleColor="yellow" maxLines={transcriptMaxLines(entry.role)} />
  if (entry.role === "tool-live") return <LiveToolBlock content={entry.content} />
  if (entry.role === "tool") return <ResponseBlock content={entry.content} />
  if (entry.role === "shell-output") return <ResponseBlock content={entry.content} />
  if (entry.role === "system") return <ResponseBlock content={entry.content} titleColor="gray" maxLines={14} />
  if (entry.role === "file-change-live") return <LiveFileChangeBlock content={entry.content} />
  if (entry.role === "file-change") return <FileChangeBlock content={entry.content} />
  return (
    <Text color={transcriptColor(entry.role)}>
      {transcriptPrefix(entry.role)}
      {entry.content}
    </Text>
  )
}
