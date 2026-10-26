import { mkdir, readFile, writeFile } from "node:fs/promises"
import { parse } from "jsonc-parser"
import { z } from "zod"
import { configHome, configPath } from "./paths.js"
import type { ConnectionProfile, SafetyMode } from "../domain/types.js"

const SafetySchema = z.enum(["ask", "plan", "trust"])

const ProfileSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["local", "ssh"]),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  username: z.string().optional(),
  account: z.string().optional(),
  entryCommand: z.string().optional(),
  startupInput: z.string().optional(),
  promptPattern: z.string().optional(),
  sessionMode: z.enum(["oneshot", "persistent"]).optional(),
  safetyDefault: SafetySchema.optional(),
  allowedAccounts: z.array(z.string()).optional(),
  passwordSecretRef: z.string().optional(),
  sshKeySecretRef: z.string().optional(),
  d3PasswordSecretRef: z.string().optional(),
})

const ConfigSchema = z.object({
  version: z.literal(1),
  defaultModel: z.string().default("ollama/muse-glimmer:30b-mlx"),
  defaultSafety: SafetySchema.default("ask"),
  defaultProfile: z.string().optional(),
  profiles: z.array(ProfileSchema).default([]),
  modelSecrets: z.record(z.string(), z.string()).default({}),
  hermes: z.object({
    enabled: z.boolean().default(true),
    eccRoot: z.string().optional(),
    memoryEnabled: z.boolean().default(true),
  }).optional(),
  sidecar: z.object({
    enabled: z.boolean().default(true),
    autoStart: z.boolean().default(true),
    binary: z.string().optional(),
  }).optional(),
  ideBindHost: z.string().optional(),
  idePublicHost: z.string().optional(),
  ideAuth: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }).optional(),
})

export type D3CodeConfig = z.infer<typeof ConfigSchema>

export const defaultConfig: D3CodeConfig = {
  version: 1,
  defaultModel: "ollama/muse-glimmer:30b-mlx",
  defaultSafety: "ask",
  profiles: [],
  modelSecrets: {},
  hermes: { enabled: true, memoryEnabled: true },
  sidecar: { enabled: true, autoStart: true },
}

export async function loadConfig(): Promise<D3CodeConfig> {
  try {
    const raw = await readFile(configPath, "utf8")
    return ConfigSchema.parse(parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultConfig
    throw error
  }
}

export async function saveConfig(config: D3CodeConfig): Promise<void> {
  await mkdir(configHome, { recursive: true })
  await writeFile(configPath, `${JSON.stringify(ConfigSchema.parse(config), null, 2)}\n`)
}

export function selectProfile(config: D3CodeConfig, name?: string): ConnectionProfile | undefined {
  const selected = name ?? config.defaultProfile
  if (!selected) return config.profiles[0]
  return config.profiles.find((profile) => profile.name === selected)
}

export function effectiveSafety(config: D3CodeConfig, cliSafety?: SafetyMode, profile?: ConnectionProfile): SafetyMode {
  return cliSafety ?? profile?.safetyDefault ?? config.defaultSafety ?? "ask"
}
