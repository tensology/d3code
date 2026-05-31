import { hostname, networkInterfaces, platform, type NetworkInterfaceInfo } from "node:os"

export type NetworkMap = NodeJS.Dict<NetworkInterfaceInfo[]>
export interface IdeDisplayOptions {
  publicHost?: string
}

export function terminalLink(label: string, url: string): string {
  return `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`
}

export function isPublicIdeHost(host: string): boolean {
  return host === "0.0.0.0" || host === "::"
}

export function localNetworkAddress(interfaces: NetworkMap = networkInterfaces()): string | undefined {
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== "IPv4") continue
      return entry.address
    }
  }
  return undefined
}

export function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [first, second] = parts as [number, number, number, number]
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first === 127
}

function cleanPublicHost(publicHost?: string): string | undefined {
  if (!publicHost) return undefined
  const trimmed = publicHost.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
  return trimmed || undefined
}

export function displayHostForIdeBind(host: string, interfaces: NetworkMap = networkInterfaces(), options: IdeDisplayOptions = {}): string {
  const publicHost = cleanPublicHost(options.publicHost)
  if (isPublicIdeHost(host) && publicHost) return publicHost
  if (host === "0.0.0.0" || host === "::") return localNetworkAddress(interfaces) ?? hostname()
  return host
}

export function displayUrlForIdeBind(host: string, port: number, interfaces: NetworkMap = networkInterfaces(), options: IdeDisplayOptions = {}): string {
  return `http://${displayHostForIdeBind(host, interfaces, options)}:${port}`
}

export function displayUrlLabelForIdeBind(host: string, interfaces: NetworkMap = networkInterfaces(), options: IdeDisplayOptions = {}): string {
  if (!isPublicIdeHost(host)) return "URL"
  if (cleanPublicHost(options.publicHost)) return "Public URL"
  return isPrivateIpv4(displayHostForIdeBind(host, interfaces)) ? "LAN/VPN URL" : "Interface URL"
}

export function shouldPromptForPublicIde(options: { hostExplicit: boolean; visibility?: string; stdinIsTTY?: boolean; stdoutIsTTY?: boolean; platformName?: NodeJS.Platform }): boolean {
  if (options.hostExplicit || options.visibility) return false
  if (!options.stdinIsTTY || !options.stdoutIsTTY) return false
  return (options.platformName ?? platform()) !== "win32"
}

export function ideAccessNotes(host: string, port: number, interfaces: NetworkMap = networkInterfaces(), options: { publicCommand?: string; publicHost?: string } = {}): string[] {
  const displayUrl = displayUrlForIdeBind(host, port, interfaces, options)
  const publicCommand = options.publicCommand ?? "d3code ide public"
  if (host === "127.0.0.1" || host === "localhost") {
    return [
      "Access: local-only on this machine.",
      `Open: ${terminalLink(displayUrl, displayUrl)}`,
      `From your laptop, use an SSH tunnel: ssh -L ${port}:127.0.0.1:${port} <user>@<server>`,
      `Then open: ${terminalLink(`http://127.0.0.1:${port}`, `http://127.0.0.1:${port}`)}`,
      `For a deliberate network bind, restart with: ${publicCommand}`,
    ]
  }
  if (isPublicIdeHost(host)) {
    const displayHost = displayHostForIdeBind(host, interfaces, options)
    const privateLan = isPrivateIpv4(displayHost)
    const hasConfiguredPublicHost = Boolean(cleanPublicHost(options.publicHost))
    return [
      "Access: listening on all server interfaces.",
      `${displayUrlLabelForIdeBind(host, interfaces, options)}: ${terminalLink(displayUrl, displayUrl)}`,
      ...(privateLan && !hasConfiguredPublicHost ? [
        "Public/WAN URL: not known from inside this server. 192.168/10/172.16-31 addresses are private LAN addresses.",
        `If you need internet access, use your public DNS/IP with this port, or use an SSH/VPN tunnel instead.`,
      ] : []),
      ...(hasConfiguredPublicHost ? [
        "Network note: this server is still on a LAN/private address; public DNS also needs router/NAT forwarding for this port.",
      ] : []),
      "Only expose this on a trusted network or behind an SSH/VPN tunnel.",
    ]
  }
  return [`Access: listening on ${host}.`, `Open: ${terminalLink(displayUrl, displayUrl)}`]
}
