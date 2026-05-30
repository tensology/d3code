import { homedir } from "node:os"
import { join } from "node:path"

export const configHome = process.env.D3CODE_HOME ?? join(homedir(), ".d3code")
export const configPath = join(configHome, "config.jsonc")
export const sessionsDir = join(configHome, "sessions")
export const cacheDir = join(configHome, "cache")
export const memoryPath = join(configHome, "MEMORY.md")
export const goalsDir = join(configHome, "goals")
export const promptHistoryPath = join(configHome, "prompt-history.jsonl")

export const defaultReferenceDir = "reference"
export const defaultD3ReferenceManual = join(defaultReferenceDir, "d3_reference_manual_10.3.4_5-28-2026.pdf")
export const defaultD3UserGuide = join(defaultReferenceDir, "d3_user_guide_version_10_3_4_2026-05-28-20-56-09.pdf")
export const defaultRocketMvBasicDir = join(defaultReferenceDir, "rocket-mvbasic")
