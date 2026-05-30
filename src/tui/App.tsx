import React, { useEffect, useMemo, useState } from "react"
import { Box, Text, useApp, useInput } from "ink"
import type { D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { chat, type ChatMessage } from "../llm/client.js"
import { defaultSecretStore } from "../security/secrets.js"
import { handleSlashCommand } from "./commands.js"
import { handleNaturalIntent } from "./intent.js"
import { appendEvent, newSession, saveSession, type StoredSession } from "../sessions/store.js"
import { createCockpitReport, renderCockpitReport } from "../quality/cockpit.js"
import { createChatSystemPrompt, type ChatRuntimeContext } from "./context.js"

export interface AppProps {
  model: string
  safety: SafetyMode
  profile?: string
  mode?: string
  config: D3CodeConfig
  session?: StoredSession
}

function messagesFromSession(config: D3CodeConfig, session: StoredSession | undefined, context: ChatRuntimeContext): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: createChatSystemPrompt(config, context) }]
  for (const event of session?.events ?? []) {
    if (event.type === "user" || event.type === "assistant") messages.push({ role: event.type, content: event.content })
  }
  return messages
}

function transcriptFromSession(session: StoredSession | undefined) {
  if (!session) return [{ role: "system", content: "D3 Code ready. Tell me what to inspect or build; use /help for exact controls." }]
  return [
    { role: "system", content: `Resumed ${session.id}. Tell me what to inspect or build; use /help for exact controls.` },
    ...session.events.map((event) => ({ role: event.type, content: event.content })),
  ]
}

export function App(props: AppProps) {
  const app = useApp()
  const [input, setInput] = useState("")
  const initialMode = props.mode ?? "chat"
  const initialSession = props.session ?? newSession(props.model, props.safety, props.profile)
  const initialContext = { model: props.session?.model ?? props.model, safety: props.session?.safety ?? props.safety, profile: props.session?.profile ?? props.profile, mode: initialMode }
  const [session, setSession] = useState(initialSession)
  const [model, setModel] = useState(props.session?.model ?? props.model)
  const [safety, setSafety] = useState(props.session?.safety ?? props.safety)
  const [profile, setProfile] = useState(props.session?.profile ?? props.profile)
  const [mode, setMode] = useState(props.mode ?? "chat")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(messagesFromSession(props.config, props.session, initialContext))
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>(transcriptFromSession(props.session))
  const secrets = useMemo(() => defaultSecretStore(), [])

  useEffect(() => {
    let cancelled = false
    void createCockpitReport(props.config, { model, safety, profile, mode }).then((report) => {
      if (!cancelled) setTranscript((current) => [...current, { role: "system", content: renderCockpitReport(report) }])
    }).catch((error) => {
      if (!cancelled) setTranscript((current) => [...current, { role: "error", content: `Could not load cockpit: ${(error as Error).message}` }])
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function record(event: Parameters<typeof appendEvent>[1]) {
    const next = appendEvent(session, event)
    setSession({ ...next, events: [...next.events] })
    await saveSession(next)
  }

  useInput((value, key) => {
    if (busy) return
    if (key.return) {
      const line = input.trim()
      setInput("")
      if (!line) return
      void submit(line)
      return
    }
    if (key.backspace || key.delete) {
      setInput((current) => current.slice(0, -1))
      return
    }
    if (key.ctrl && value === "c") {
      app.exit()
      return
    }
    if (value) setInput((current) => current + value)
  })

  async function submit(line: string) {
    setBusy(true)
    setTranscript((current) => [...current, { role: "user", content: line }])
    try {
      await record({ type: "user", content: line, metadata: { mode, model, safety, profile } })
      if (line.startsWith("/")) {
        const result = await handleSlashCommand(line, props.config, { model, safety, profile, mode })
        if (result.clear) setTranscript([])
        const nextModel = result.state?.model ?? model
        const nextSafety = result.state?.safety ?? safety
        const nextProfile = "profile" in (result.state ?? {}) ? result.state?.profile : profile
        const nextMode = result.state?.mode ?? mode
        if (result.state?.model) setModel(result.state.model)
        if (result.state?.safety) setSafety(result.state.safety)
        if (result.state?.mode) {
          setMode(result.state.mode)
        }
        if ("profile" in (result.state ?? {})) setProfile(result.state?.profile)
        if (result.state) setMessages([{ role: "system", content: createChatSystemPrompt(props.config, { model: nextModel, safety: nextSafety, profile: nextProfile, mode: nextMode }) }])
        if (result.output) {
          setTranscript((current) => [...current, { role: "system", content: result.output }])
          await record({ type: "system", content: result.output, metadata: { command: line } })
        }
        if (result.exit) app.exit()
        return
      }
      const intentResult = await handleNaturalIntent(line, props.config, { model, safety, profile, mode })
      if (intentResult) {
        if (intentResult.output) {
          setTranscript((current) => [...current, { role: "assistant", content: intentResult.output }])
          await record({ type: "assistant", content: intentResult.output, metadata: { intent: line, model, safety, profile, mode } })
        }
        return
      }
      const nextMessages = [...messages, { role: "user" as const, content: line }]
      setMessages(nextMessages)
      const response = await chat(props.config, secrets, { modelRef: model, messages: nextMessages })
      setMessages((current) => [...current, { role: "assistant", content: response.content }])
      setTranscript((current) => [...current, { role: "assistant", content: response.content || "(empty response)" }])
      await record({ type: "assistant", content: response.content || "", metadata: { model, provider: response.provider } })
    } catch (error) {
      setTranscript((current) => [...current, { role: "error", content: (error as Error).message }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan">D3 Code</Text>
      <Text dimColor>model={model} safety={safety} profile={profile ?? "none"} mode={mode}</Text>
      <Box flexDirection="column" marginTop={1}>
        {transcript.slice(-18).map((entry, index) => (
          <Text key={`${entry.role}-${index}`} color={entry.role === "error" ? "red" : entry.role === "assistant" ? "green" : entry.role === "user" ? "white" : "gray"}>
            {entry.role === "user" ? "> " : entry.role === "assistant" ? "d3code: " : entry.role === "error" ? "error: " : ""}
            {entry.content}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="cyan">{busy ? "..." : "d3code"} </Text>
        <Text>{input}</Text>
      </Box>
    </Box>
  )
}
