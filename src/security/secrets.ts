import { execFile } from "node:child_process"
import { platform } from "node:os"
import { dirname, join } from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { configHome } from "../config/paths.js"

const execFileAsync = promisify(execFile)

export interface SecretStore {
  get(ref: string): Promise<string | undefined>
  set(ref: string, value: string): Promise<void>
}

export class EnvSecretStore implements SecretStore {
  async get(ref: string): Promise<string | undefined> {
    if (ref.startsWith("env:")) return process.env[ref.slice(4)]
    return process.env[ref]
  }

  async set(): Promise<void> {
    throw new Error("EnvSecretStore is read-only")
  }
}

export class KeychainSecretStore implements SecretStore {
  constructor(private readonly service = "d3code") {}

  async get(ref: string): Promise<string | undefined> {
    if (ref.startsWith("env:")) return process.env[ref.slice(4)]
    const key = ref.replace(/^keychain:/, "")
    try {
      if (platform() === "darwin") {
        const { stdout } = await execFileAsync("security", ["find-generic-password", "-s", this.service, "-a", key, "-w"])
        return stdout.trimEnd()
      }
    } catch {
      return undefined
    }
    return undefined
  }

  async set(ref: string, value: string): Promise<void> {
    const key = ref.replace(/^keychain:/, "")
    if (platform() !== "darwin") throw new Error("Writable keychain storage is currently implemented for macOS only")
    await execFileAsync("security", ["add-generic-password", "-U", "-s", this.service, "-a", key, "-w", value])
  }
}

export class FileSecretStore implements SecretStore {
  constructor(private readonly path = join(configHome, "secrets.json")) {}

  async get(ref: string): Promise<string | undefined> {
    if (ref.startsWith("env:")) return process.env[ref.slice(4)]
    if (!ref.startsWith("file:")) return undefined
    try {
      const raw = await readFile(this.path, "utf8")
      const data = JSON.parse(raw) as Record<string, string>
      return data[ref]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
      return undefined
    }
  }

  async set(ref: string, value: string): Promise<void> {
    if (!ref.startsWith("file:")) throw new Error("FileSecretStore can only write file: secret references")
    let data: Record<string, string> = {}
    try {
      data = JSON.parse(await readFile(this.path, "utf8")) as Record<string, string>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    data[ref] = value
    await mkdir(dirname(this.path), { recursive: true })
    await writeFile(this.path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  }
}

export function secretRefForProvider(provider: string, os = platform()): string {
  return os === "darwin" ? `keychain:model:${provider}` : `file:model:${provider}`
}

export function defaultSecretStore(): SecretStore {
  return platform() === "darwin" ? new KeychainSecretStore() : new FileSecretStore()
}
