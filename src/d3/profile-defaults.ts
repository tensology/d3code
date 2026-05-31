import type { ConnectionProfile, SafetyMode } from "../domain/types.js"
import { detectLocalD3 } from "./detect.js"
import { D3_TCL_PROMPT_PATTERN, normalizeD3PromptPattern } from "./prompts.js"

export const DEFAULT_D3_PROFILE_NAME = "prod"
export const DEFAULT_D3_ACCOUNT = "DM"
export const DEFAULT_D3_STARTUP_INPUT = "dm\ndm\n"

export interface LocalD3ProfileInput {
  name?: string
  account?: string
  entry?: string
  startupInput?: string
  prompt?: string
  session?: "oneshot" | "persistent"
  safety?: SafetyMode
  allowedAccounts?: string[]
}

export interface LocalD3ProfileDefaults {
  detectionDetails: string
  entryCommand?: string
  account: string
  startupInput?: string
  promptPattern: string
  sessionMode: "persistent"
}

function isD3EntryCommand(entry?: string): boolean {
  return Boolean(entry && /(^|[\/\s])d3(\s|$)/i.test(entry))
}

export async function inferLocalD3ProfileDefaults(): Promise<LocalD3ProfileDefaults> {
  const detection = await detectLocalD3()
  const entryCommand = detection.command
  const shouldUseLoginDefaults = isD3EntryCommand(entryCommand)
  return {
    detectionDetails: detection.details,
    entryCommand,
    account: DEFAULT_D3_ACCOUNT,
    startupInput: shouldUseLoginDefaults ? DEFAULT_D3_STARTUP_INPUT : undefined,
    promptPattern: D3_TCL_PROMPT_PATTERN,
    sessionMode: "persistent",
  }
}

export async function createLocalD3Profile(input: LocalD3ProfileInput): Promise<ConnectionProfile> {
  const defaults = await inferLocalD3ProfileDefaults()
  const entryCommand = input.entry ?? defaults.entryCommand
  const shouldUseLoginDefaults = isD3EntryCommand(entryCommand)
  const promptPattern = normalizeD3PromptPattern(input.prompt)
    ?? (input.entry ? defaultD3PromptPattern(input.entry) : defaults.entryCommand ? defaults.promptPattern : undefined)
  const sessionMode = input.session
    ?? (input.entry ? defaultD3SessionMode(input.entry) : defaults.entryCommand ? defaults.sessionMode : undefined)
  const startupInput = input.startupInput?.replace(/\\n/g, "\n") ?? (shouldUseLoginDefaults ? defaults.startupInput : undefined)
  return {
    name: input.name ?? DEFAULT_D3_PROFILE_NAME,
    type: "local",
    account: input.account ?? defaults.account,
    entryCommand,
    startupInput,
    promptPattern,
    sessionMode,
    safetyDefault: input.safety,
    allowedAccounts: input.allowedAccounts?.length ? input.allowedAccounts : undefined,
  }
}

export function defaultD3PromptPattern(entry?: string, prompt?: string): string | undefined {
  return normalizeD3PromptPattern(prompt) ?? (isD3EntryCommand(entry) ? D3_TCL_PROMPT_PATTERN : undefined)
}

export function defaultD3SessionMode(entry?: string, session?: "oneshot" | "persistent"): "oneshot" | "persistent" | undefined {
  return session ?? (isD3EntryCommand(entry) ? "persistent" : undefined)
}
