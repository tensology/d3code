import React, { useEffect, useMemo, useRef, useState } from "react"
import { Box, Text, useApp, useInput } from "ink"
import { selectProfile } from "../config/config.js"
import { assertD3Allowed } from "../core/permissions.js"
import { createD3Session } from "../d3/adapter.js"
import { captureD3Terminal } from "../d3/terminal-capture.js"
import type { D3ScreenBuffer } from "../d3/screen-buffer.js"
import type { D3CodeConfig } from "../config/config.js"
import type { D3Session, SafetyMode } from "../domain/types.js"
import type { ChatMessage, ChatUsage } from "../llm/client.js"
import { defaultSecretStore } from "../security/secrets.js"
import { handleSlashCommand } from "./commands.js"
import { handleNaturalIntent } from "./intent.js"
import { appendEvent, newSession, saveSession, type StoredSession } from "../sessions/store.js"
import type { ChatRuntimeContext } from "./context.js"
import { createD3AgentSystemPrompt, runD3AgentTurn } from "./agent.js"
import { createWelcomeSummary, type WelcomeSummary } from "./welcome.js"
import { loadProjectContext, type ProjectContext } from "./project-context.js"
import { backspace, deleteForward, insertText, moveEnd, moveHome, moveLeft, moveRight, renderPromptDraft, type PromptDraft } from "./prompt-state.js"
import { appendPromptHistory, loadPromptHistory } from "./prompt-history.js"
import { renderWorkspaceChangeSummary, snapshotWorkspace, summarizeWorkspaceChanges, type WorkspaceChangeSummary } from "./workspace-changes.js"
import { formatBusyStatus, formatPromptMeta } from "./session-surface.js"
import { TranscriptEntryView, type TranscriptEntry } from "./transcript.js"
import { renderLocalShellResult, runLocalShellCommand } from "./local-shell.js"
import { nextPacedText } from "./paced-text.js"

const terminalLink = (label: string, url: string) => `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`
const logoLines = [
  "██████╗ ██████╗   ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔══██╗╚════██╗ ██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "██║  ██║ █████╔╝ ██║     ██║   ██║██║  ██║█████╗  ",
  "██║  ██║ ╚═══██╗ ██║     ██║   ██║██║  ██║██╔══╝  ",
  "██████╔╝██████╔╝ ╚██████╗╚██████╔╝██████╔╝███████╗",
  "╚═════╝ ╚═════╝   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
]

function renderTuiD3Screen(buffer: D3ScreenBuffer): string {
  const visibleEnd = Math.max(1, ...buffer.lines.map((line, index) => line.trim().length ? index + 1 : 0))
  return [
    `D3 screen ${buffer.width}x${buffer.height} cursor row=${buffer.row} col=${buffer.col}`,
    ...buffer.lines.slice(0, visibleEnd).map((line) => `|${line.trimEnd()}|`),
  ].join("\n")
}

function usePacedText(source: string, live: boolean, delayMs = 24) {
  const [shown, setShown] = useState(source)
  useEffect(() => {
    if (!live) {
      setShown(source)
      return
    }
    setShown((current) => source.startsWith(current) && current.length <= source.length ? current : source)
  }, [source, live])
  useEffect(() => {
    if (!live) return
    if (shown.length >= source.length) return
    const timer = setTimeout(() => setShown((current) => nextPacedText(source, current.length)), delayMs)
    return () => clearTimeout(timer)
  }, [source, shown, live, delayMs])
  return live ? shown : source
}

export interface AppProps {
  model: string
  safety: SafetyMode
  profile?: string
  mode?: string
  config: D3CodeConfig
  session?: StoredSession
}

function messagesFromSession(config: D3CodeConfig, session: StoredSession | undefined, context: ChatRuntimeContext): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: createD3AgentSystemPrompt(config, context) }]
  for (const event of session?.events ?? []) {
    if (event.type === "user" || event.type === "assistant" || event.type === "tool") messages.push({ role: event.type, content: event.content })
  }
  return messages
}

function transcriptFromSession(session: StoredSession | undefined) {
  if (!session) return []
  return [
    { role: "system", content: `Resumed ${session.id}. Tell me what to inspect or build; use /help for exact controls.` },
    ...session.events.map((event) => ({ role: event.type, content: event.content })),
  ]
}

function initialTaskForLine(line: string, mode: string): string {
  if (line.startsWith("!")) {
    const command = line.slice(1).trim().split(/\s+/)[0]
    return `running ! ${command || "shell"}`
  }
  if (line === "/d3" || line.startsWith("/d3 ")) return "attaching D3 terminal"
  if (mode === "d3" && !line.startsWith("/")) {
    const command = line.trim().split(/\s+/)[0]
    return `running D3 ${command || "command"}`
  }
  if (line.startsWith("/")) return `running ${line.split(/\s+/)[0]}`
  return "asking model"
}

export function App(props: AppProps) {
  const app = useApp()
  const [draft, setDraft] = useState<PromptDraft>({ text: "", cursor: 0 })
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
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(transcriptFromSession(props.session))
  const [welcome, setWelcome] = useState<WelcomeSummary | undefined>()
  const [streamingAssistant, setStreamingAssistant] = useState("")
  const [streamingShellOutput, setStreamingShellOutput] = useState("")
  const [streamingD3Output, setStreamingD3Output] = useState("")
  const [project, setProject] = useState<ProjectContext | undefined>()
  const [caretOn, setCaretOn] = useState(true)
  const [busyFrame, setBusyFrame] = useState(0)
  const [busySeconds, setBusySeconds] = useState(0)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | undefined>()
  const [abortMessage, setAbortMessage] = useState("")
  const [activeTask, setActiveTask] = useState("")
  const [usage, setUsage] = useState<ChatUsage | undefined>()
  const [workspaceChanges, setWorkspaceChanges] = useState<WorkspaceChangeSummary | undefined>()
  const d3Session = useRef<D3Session | undefined>()
  const abortRef = useRef<AbortController | undefined>()
  const streamSuppressRef = useRef(false)
  const streamIterationRef = useRef<number | undefined>()
  const secrets = useMemo(() => defaultSecretStore(), [])
  const spinnerFrames = ["·", "✢", "✣", "✦"]
  const pacedAssistant = usePacedText(streamingAssistant, busy && Boolean(streamingAssistant))
  const pacedShellOutput = usePacedText(streamingShellOutput, busy && Boolean(streamingShellOutput), 16)
  const pacedD3Output = usePacedText(streamingD3Output, busy && Boolean(streamingD3Output), 16)

  useEffect(() => {
    let cancelled = false
    if (props.session) return
    void createWelcomeSummary(props.config, secrets, { model, safety, profile, mode }).then((summary) => {
      if (!cancelled) setWelcome(summary)
    }).catch((error) => {
      if (!cancelled) setTranscript([{ role: "error", content: `Could not load launch summary: ${(error as Error).message}` }])
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadProjectContext().then((context) => {
      if (cancelled) return
      setProject(context)
      setMessages(messagesFromSession(props.config, props.session, { model, safety, profile, mode, project: context }))
    }).catch((error) => {
      if (!cancelled) setTranscript((current) => [...current, { role: "error", content: `Could not load folder instructions: ${(error as Error).message}` }])
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadPromptHistory().then((entries) => {
      if (!cancelled) setHistory(entries.map((entry) => entry.input))
    }).catch((error) => {
      if (!cancelled) setTranscript((current) => [...current, { role: "error", content: `Could not load prompt history: ${(error as Error).message}` }])
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      void d3Session.current?.close()
      d3Session.current = undefined
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCaretOn((current) => !current), 520)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setBusyFrame((current) => current + 1), 140)
    return () => clearInterval(timer)
  }, [busy])

  useEffect(() => {
    if (!busy) return
    setBusySeconds(0)
    const started = Date.now()
    const timer = setInterval(() => setBusySeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [busy])

  async function record(event: Parameters<typeof appendEvent>[1]) {
    const next = appendEvent(session, event)
    setSession({ ...next, events: [...next.events] })
    await saveSession(next)
  }

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      if (busy) {
        abortRef.current?.abort()
        setAbortMessage("Interrupted. Finishing any already-returned cleanup.")
        setBusy(false)
        setStreamingAssistant("")
        setStreamingShellOutput("")
        setStreamingD3Output("")
        return
      }
      app.exit()
      return
    }
    if (key.escape && busy) {
      abortRef.current?.abort()
      setAbortMessage("Interrupted. Press Enter for the next instruction.")
      setBusy(false)
      setStreamingAssistant("")
      setStreamingShellOutput("")
      setStreamingD3Output("")
      return
    }
    if (busy) return
    if (key.return || value === "\r" || value === "\n") {
      submitDraft()
      return
    }
    if (key.upArrow) {
      recallHistory("up")
      return
    }
    if (key.downArrow) {
      recallHistory("down")
      return
    }
    if (key.leftArrow) {
      setDraft(moveLeft)
      return
    }
    if (key.rightArrow) {
      setDraft(moveRight)
      return
    }
    if (key.ctrl && value === "a") {
      setDraft(moveHome)
      return
    }
    if (key.ctrl && value === "e") {
      setDraft(moveEnd)
      return
    }
    if (key.ctrl && value === "u") {
      setDraft({ text: "", cursor: 0 })
      setHistoryIndex(undefined)
      return
    }
    if (key.backspace || key.delete) {
      setDraft(key.delete ? deleteForward : backspace)
      setHistoryIndex(undefined)
      return
    }
    if (value) {
      const newlineIndex = value.search(/[\r\n]/)
      if (newlineIndex !== -1) {
        const beforeReturn = value.slice(0, newlineIndex)
        const afterReturn = value.slice(newlineIndex).replace(/^[\r\n]+/, "")
        const nextDraft = beforeReturn ? insertText(draft, beforeReturn) : draft
        submitLine(nextDraft.text.trim())
        setDraft({ text: afterReturn, cursor: afterReturn.length })
        setHistoryIndex(undefined)
        return
      }
      if (value.includes("\u001B")) {
        applyRawTerminalInput(value)
        return
      }
      setDraft((current) => insertText(current, value))
      setHistoryIndex(undefined)
    }
  })

  function submitDraft() {
    const line = draft.text.trim()
    setDraft({ text: "", cursor: 0 })
    setHistoryIndex(undefined)
    submitLine(line)
  }

  function submitLine(line: string) {
    if (!line) return
    setHistory((current) => [...current.filter((entry) => entry !== line), line].slice(-80))
    void appendPromptHistory(line, { mode, profile }).catch((error) => {
      setTranscript((current) => [...current, { role: "error", content: `Could not save prompt history: ${(error as Error).message}` }])
    })
    void submit(line)
  }

  function recallHistory(direction: "up" | "down") {
    setHistoryIndex((current) => {
      if (history.length === 0) return undefined
      if (direction === "up") {
        const next = current === undefined ? history.length - 1 : Math.max(0, current - 1)
        const text = history[next] ?? ""
        setDraft({ text, cursor: text.length })
        return next
      }
      if (current === undefined) return undefined
      const next = current + 1
      if (next >= history.length) {
        setDraft({ text: "", cursor: 0 })
        return undefined
      }
      const text = history[next] ?? ""
      setDraft({ text, cursor: text.length })
      return next
    })
  }

  function applyRawTerminalInput(value: string) {
    let index = 0
    while (index < value.length) {
      const rest = value.slice(index)
      if (rest.startsWith("\u001B[D")) {
        setDraft(moveLeft)
        index += 3
      } else if (rest.startsWith("\u001B[C")) {
        setDraft(moveRight)
        index += 3
      } else if (rest.startsWith("\u001B[A")) {
        recallHistory("up")
        index += 3
      } else if (rest.startsWith("\u001B[B")) {
        recallHistory("down")
        index += 3
      } else if (rest.startsWith("\u001B[H") || rest.startsWith("\u001B[1~")) {
        setDraft(moveHome)
        index += rest.startsWith("\u001B[1~") ? 4 : 3
      } else if (rest.startsWith("\u001B[F") || rest.startsWith("\u001B[4~")) {
        setDraft(moveEnd)
        index += rest.startsWith("\u001B[4~") ? 4 : 3
      } else {
        const char = value[index]!
        if (char !== "\u001B") {
          setDraft((current) => insertText(current, char))
          setHistoryIndex(undefined)
        }
        index += 1
      }
    }
  }

  async function submit(line: string) {
    setAbortMessage("")
    setActiveTask(initialTaskForLine(line, mode))
    setBusy(true)
    setStreamingShellOutput("")
    setStreamingD3Output("")
    streamSuppressRef.current = false
    streamIterationRef.current = undefined
    const abortController = new AbortController()
    abortRef.current = abortController
    const beforeWorkspace = await snapshotWorkspace()
    setTranscript((current) => [...current, { role: line.startsWith("!") ? "shell-input" : "user", content: line.startsWith("!") ? line.slice(1).trim() : line }])
    try {
      await record({ type: "user", content: line, metadata: { mode, model, safety, profile } })
      if (line === "/d3" || line.startsWith("/d3 ")) {
        await enterD3Terminal(line.split(/\s+/)[1])
        return
      }
      if (line === "/chat") {
        await d3Session.current?.close()
        d3Session.current = undefined
        setMode("chat")
        setTranscript((current) => [...current, { role: "system", content: "Back in agent chat. Use /d3 to attach to the D3 runtime again." }])
        return
      }
      if (line.startsWith("!")) {
        await submitLocalShellLine(line.slice(1).trim(), abortController.signal)
        return
      }
      if (mode === "d3" && !line.startsWith("/")) {
        await submitD3TerminalLine(line)
        return
      }
      if (line.startsWith("/")) {
        setActiveTask(`running ${line.split(/\s+/)[0]}`)
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
        if (result.state) setMessages([{ role: "system", content: createD3AgentSystemPrompt(props.config, { model: nextModel, safety: nextSafety, profile: nextProfile, mode: nextMode, project }) }])
        if (result.output) {
          setTranscript((current) => [...current, { role: "system", content: result.output }])
          await record({ type: "system", content: result.output, metadata: { command: line } })
        }
        if (result.exit) {
          setActiveTask("")
          setBusy(false)
          app.exit()
        }
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
      const response = await runD3AgentTurn(props.config, secrets, {
        input: line,
        history: messages,
        model,
        safety,
        profile,
        mode,
        project,
        onEvent: (event) => {
          if (event.type === "assistant_delta") {
            if (streamIterationRef.current !== event.iteration) {
              streamIterationRef.current = event.iteration
              streamSuppressRef.current = false
              setActiveTask("streaming response")
              setStreamingAssistant("")
            }
            if (streamSuppressRef.current) return
            setStreamingAssistant((current) => {
              const next = current + event.token
              const toolIndex = next.search(/<d3_tool>/i)
              if (toolIndex === -1) return next
              streamSuppressRef.current = true
              return next.slice(0, toolIndex).trimEnd()
            })
          }
          if (event.type === "tool_start") {
            setStreamingAssistant("")
            setActiveTask(`running ${event.name}`)
            setTranscript((current) => [
              ...current,
              {
                role: "tool-start",
                content: `${event.name}${event.reason ? `: ${event.reason}` : ""}`,
              },
            ])
          }
          if (event.type === "tool_result") {
            setActiveTask("reading result")
            streamSuppressRef.current = false
            setTranscript((current) => [...current, { role: "tool", content: `${event.name}\n${event.compact}` }])
          }
        },
        signal: abortController.signal,
      })
      setStreamingAssistant("")
      setMessages(response.messages)
      setUsage(response.usage)
      for (const event of response.toolEvents) {
        const content = `${event.name}\n${event.result.compact}`
        await record({ type: "tool", content, metadata: { tool: event.name, input: event.input, reason: event.reason } })
      }
      setTranscript((current) => [...current, { role: "assistant", content: response.output || "(empty response)" }])
      await record({ type: "assistant", content: response.output || "", metadata: { model, usage: response.usage, toolEvents: response.toolEvents.map((event) => event.name) } })
    } catch (error) {
      setStreamingAssistant("")
      setStreamingShellOutput("")
      setStreamingD3Output("")
      setTranscript((current) => [...current, { role: abortController.signal.aborted ? "system" : "error", content: abortController.signal.aborted ? "Interrupted." : (error as Error).message }])
    } finally {
      const afterWorkspace = await snapshotWorkspace()
      const summary = summarizeWorkspaceChanges(beforeWorkspace, afterWorkspace)
      setWorkspaceChanges(summary)
      if (summary) {
        const rendered = renderWorkspaceChangeSummary(summary)
        setTranscript((current) => [...current, { role: "file-change", content: rendered }])
        await record({ type: "system", content: rendered, metadata: { workspaceChanges: summary } })
      }
      if (abortRef.current === abortController) abortRef.current = undefined
      setActiveTask("")
      setBusy(false)
    }
  }

  async function enterD3Terminal(profileName?: string) {
    const selected = selectProfile(props.config, profileName ?? profile)
    if (!selected) {
      setTranscript((current) => [...current, { role: "error", content: "No D3 profile configured. Run /setup for the setup path, then use /profile to select it." }])
      return
    }
    await d3Session.current?.close()
    d3Session.current = createD3Session(selected)
    setProfile(selected.name)
    setMode("d3")
    const loginCommand = selected.account ? `LOGTO ${selected.account}\nWHO\nVERSION` : "WHO\nVERSION"
    const capture = await captureD3Terminal(d3Session.current, loginCommand, { width: 80, height: 18 })
    setTranscript((current) => [
      ...current,
      {
        role: "system",
        content: [
          `D3 terminal attached to ${selected.name}${selected.account ? ` / ${selected.account}` : ""}.`,
          "Manual grounding: D3 logon lands at a TCL ':' prompt or inside an application/menu screen after user and master dictionary/account are accepted.",
          "Type D3/TCL commands directly. Use /chat to return to the agent.",
          "",
          renderTuiD3Screen(capture.screen),
        ].join("\n"),
      },
    ])
  }

  async function submitLocalShellLine(command: string, signal: AbortSignal) {
    if (!command) {
      setTranscript((current) => [...current, { role: "error", content: "Usage: ! <unix command>" }])
      return
    }
    setActiveTask(`running ! ${command.split(/\s+/)[0]}`)
    const result = await runLocalShellCommand(command, {
      signal,
      onStdout: (chunk) => setStreamingShellOutput((current) => `${current}${chunk}`),
      onStderr: (chunk) => setStreamingShellOutput((current) => `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}stderr: ${chunk}`),
    })
    const output = renderLocalShellResult(result)
    setStreamingShellOutput("")
    setTranscript((current) => [...current, { role: "shell-output", content: output || "exit 0" }])
    await record({ type: "tool", content: `shell\n$ ${command}\n${output}`, metadata: { tool: "local_shell", command, exitCode: result.exitCode, signal: result.signal } })
  }

  async function submitD3TerminalLine(line: string) {
    const selected = selectProfile(props.config, profile)
    if (!selected) {
      setTranscript((current) => [...current, { role: "error", content: "No D3 profile selected. Use /profile <name> or /setup first." }])
      return
    }
    if (!d3Session.current) d3Session.current = createD3Session(selected)
    assertD3Allowed(safety, line, safety === "trust")
    setActiveTask(`running D3 ${line.split(/\s+/)[0] ?? "command"}`)
    const capture = await captureD3Terminal(d3Session.current, line, {
      width: 80,
      height: 18,
      onStdout: (chunk) => setStreamingD3Output((current) => `${current}${chunk}`),
      onStderr: (chunk) => setStreamingD3Output((current) => `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}stderr: ${chunk}`),
    })
    const output = capture.screen.events.length > 0
      ? renderTuiD3Screen(capture.screen)
      : capture.result.stdout || capture.result.stderr || "(no D3 output)"
    setStreamingD3Output("")
    setTranscript((current) => [...current, { role: "tool", content: output }])
  }

  const renderedDraft = renderPromptDraft(draft, caretOn)
  const promptMeta = formatPromptMeta({ model, profile, mode, safety, usage, workspaceChanges, project })

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1} flexDirection="column">
        <Box flexDirection="column" marginBottom={1}>
          {logoLines.map((line) => <Text key={line} color="cyan" bold>{line}</Text>)}
        </Box>
        <Box flexDirection="row">
        <Box width="38%" flexDirection="column" paddingRight={2}>
          <Box flexDirection="column">
            <Text color="cyan" bold>D3 Code</Text>
          </Box>
          <Text dimColor>Rocket D3 agent shell</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={welcome?.providerStatus === "connected" ? "green" : "yellow"}>{welcome?.providerStatus === "connected" ? "●" : "○"} AI {welcome?.providerStatus ?? "checking"}</Text>
            <Text color={welcome?.d3Status === "connected" ? "green" : "yellow"}>{welcome?.d3Status === "connected" ? "●" : "○"} D3 {welcome?.d3Status ?? "checking"}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>{welcome?.providerName ?? "Checking provider"}</Text>
            <Text dimColor>{welcome?.providerModel ?? model}</Text>
            <Text dimColor>{welcome?.d3Detail ?? "Checking D3 profile"}</Text>
          </Box>
        </Box>
        <Box width="62%" borderStyle="single" borderColor="gray" borderTop={false} borderBottom={false} borderRight={false} paddingLeft={2} flexDirection="column">
          <Text color="cyan" bold>Getting Started</Text>
          <Text>{welcome?.primaryAction ?? "Loading connection state..."}</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="cyan">/help <Text dimColor>controls and slash commands</Text></Text>
            <Text color="cyan">/setup <Text dimColor>configure AI provider and D3 profile</Text></Text>
            <Text color="cyan">/profile <Text dimColor>show or switch D3 profiles</Text></Text>
            <Text color="cyan">/d3 <Text dimColor>attach to the D3 runtime terminal</Text></Text>
            <Text color="cyan">/ide <Text dimColor>open the browser workbench</Text></Text>
            <Text color="cyan">! <Text dimColor>run a local Unix command in this session</Text></Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              Built with ♥ by {terminalLink("Tensology", "https://www.tensology.com")} & {terminalLink("Crystal Logic", "https://www.crystallogic.co.za")}
            </Text>
          </Box>
        </Box>
        </Box>
      </Box>
      <Box marginTop={1} borderStyle="single" borderColor="gray" borderLeft={false} borderRight={false} borderBottom={false} />
      <Box flexDirection="column" marginTop={1}>
        {transcript.slice(-18).map((entry, index) => (
          <TranscriptEntryView key={`${entry.role}-${index}`} entry={entry} />
        ))}
        {streamingAssistant ? <TranscriptEntryView entry={{ role: "assistant-stream", content: pacedAssistant }} /> : null}
        {streamingShellOutput ? <TranscriptEntryView entry={{ role: "shell-output", content: `running\n${pacedShellOutput.trimEnd()}` }} /> : null}
        {streamingD3Output ? <TranscriptEntryView entry={{ role: "tool", content: `D3 running\n${pacedD3Output.trimEnd()}` }} /> : null}
        {abortMessage ? <Text color="yellow">{abortMessage}</Text> : null}
      </Box>
      <Box marginTop={1} borderStyle="single" borderColor={busy ? "cyan" : "gray"} borderLeft={false} borderRight={false} paddingY={0} flexDirection="column">
        <Box flexDirection="row">
          <Text color={busy ? "yellow" : "cyan"} bold>{busy ? spinnerFrames[busyFrame % spinnerFrames.length] : "›"} </Text>
          {busy ? (
            <Text>{formatBusyStatus(activeTask, busySeconds)}</Text>
          ) : (
            <>
              <Text>{renderedDraft.before}</Text>
              <Text inverse={caretOn} dimColor={!caretOn}>{renderedDraft.cursor}</Text>
              <Text>{renderedDraft.after}</Text>
            </>
          )}
        </Box>
        <Box flexDirection="row">
          <Text dimColor>{promptMeta}</Text>
        </Box>
      </Box>
    </Box>
  )
}
