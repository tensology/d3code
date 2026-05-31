import { hostname, networkInterfaces, platform, type NetworkInterfaceInfo } from "node:os"

export type NetworkMap = NodeJS.Dict<NetworkInterfaceInfo[]>

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

export function displayHostForIdeBind(host: string, interfaces: NetworkMap = networkInterfaces()): string {
  if (host === "0.0.0.0" || host === "::") return localNetworkAddress(interfaces) ?? hostname()
  return host
}

export function displayUrlForIdeBind(host: string, port: number, interfaces: NetworkMap = networkInterfaces()): string {
  return `http://${displayHostForIdeBind(host, interfaces)}:${port}`
}

export function displayUrlLabelForIdeBind(host: string, interfaces: NetworkMap = networkInterfaces()): string {
  if (!isPublicIdeHost(host)) return "URL"
  return isPrivateIpv4(displayHostForIdeBind(host, interfaces)) ? "LAN/VPN URL" : "Interface URL"
}

export function shouldPromptForPublicIde(options: { hostExplicit: boolean; visibility?: string; stdinIsTTY?: boolean; stdoutIsTTY?: boolean; platformName?: NodeJS.Platform }): boolean {
  if (options.hostExplicit || options.visibility) return false
  if (!options.stdinIsTTY || !options.stdoutIsTTY) return false
  return (options.platformName ?? platform()) !== "win32"
}

export function ideAccessNotes(host: string, port: number, interfaces: NetworkMap = networkInterfaces(), options: { publicCommand?: string } = {}): string[] {
  const displayUrl = displayUrlForIdeBind(host, port, interfaces)
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
    const displayHost = displayHostForIdeBind(host, interfaces)
    const privateLan = isPrivateIpv4(displayHost)
    return [
      "Access: listening on all server interfaces.",
      `${displayUrlLabelForIdeBind(host, interfaces)}: ${terminalLink(displayUrl, displayUrl)}`,
      ...(privateLan ? [
        "Public/WAN URL: not known from inside this server. 192.168/10/172.16-31 addresses are private LAN addresses.",
        `If you need internet access, use your public DNS/IP with this port, or use an SSH/VPN tunnel instead.`,
      ] : []),
      "Only expose this on a trusted network or behind an SSH/VPN tunnel.",
    ]
  }
  return [`Access: listening on ${host}.`, `Open: ${terminalLink(displayUrl, displayUrl)}`]
}
