import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { sessionsDir } from "../config/paths.js"
import type { SafetyMode } from "../domain/types.js"

export interface SessionEvent {
  time: string
  type: "user" | "assistant" | "tool" | "system"
  content: string
  metadata?: Record<string, unknown>
}

export interface StoredSession {
  id: string
  createdAt: string
  updatedAt: string
  model: string
  safety: SafetyMode
  profile?: string
  account?: string
  events: SessionEvent[]
}

export function newSession(model: string, safety: SafetyMode, profile?: string, account?: string): StoredSession {
  const now = new Date().toISOString()
  return {
    id: `ses_${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    model,
    safety,
    profile,
    account,
    events: [],
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await mkdir(sessionsDir, { recursive: true })
  session.updatedAt = new Date().toISOString()
  await writeFile(join(sessionsDir, `${session.id}.json`), `${JSON.stringify(session, null, 2)}\n`)
}

export async function loadSession(id: string): Promise<StoredSession> {
  return JSON.parse(await readFile(join(sessionsDir, `${id}.json`), "utf8")) as StoredSession
}

export async function listSessions(): Promise<StoredSession[]> {
  try {
    const files = (await readdir(sessionsDir)).filter((file) => file.endsWith(".json"))
    const sessions = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(sessionsDir, file), "utf8")) as StoredSession))
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

export function appendEvent(session: StoredSession, event: Omit<SessionEvent, "time">): StoredSession {
  session.events.push({ time: new Date().toISOString(), ...event })
  session.updatedAt = new Date().toISOString()
  return session
}
