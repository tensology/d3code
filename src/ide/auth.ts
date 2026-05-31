import type { D3CodeConfig } from "../config/config.js"

export interface IdeAuthCredentials {
  username: string
  password: string
}

export const defaultIdeAuth: IdeAuthCredentials = {
  username: "admin",
  password: "admin1234",
}

export function resolveIdeAuth(config: D3CodeConfig): IdeAuthCredentials {
  return config.ideAuth ?? defaultIdeAuth
}

export function setIdeAuth(config: D3CodeConfig, username: string, password: string): IdeAuthCredentials {
  const credentials = { username: username.trim(), password }
  if (!credentials.username) throw new Error("IDE auth username is required.")
  if (!credentials.password) throw new Error("IDE auth password is required.")
  config.ideAuth = credentials
  return credentials
}

export function basicAuthHeader(credentials: IdeAuthCredentials): string {
  return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`, "utf8").toString("base64")}`
}

export function isBasicAuthValid(header: string | string[] | undefined, credentials: IdeAuthCredentials): boolean {
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith("Basic ")) return false
  try {
    const decoded = Buffer.from(value.slice("Basic ".length), "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator === -1) return false
    const username = decoded.slice(0, separator)
    const password = decoded.slice(separator + 1)
    return username === credentials.username && password === credentials.password
  } catch {
    return false
  }
}
