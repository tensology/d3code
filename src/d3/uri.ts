export type D3UriKind = "data" | "dict" | "catalog"

export interface D3Uri {
  kind: D3UriKind
  profile: string
  account: string
  file?: string
  item: string
}

export function parseD3Uri(input: string): D3Uri {
  const url = new URL(input)
  const parts = [url.hostname, ...url.pathname.split("/").filter(Boolean)].map(decodeURIComponent)
  if (url.protocol === "d3:") {
    const [profile, account, file, item] = parts
    if (!profile || !account || !file || !item) throw new Error(`Invalid d3 URI: ${input}`)
    return { kind: "data", profile, account, file, item }
  }
  if (url.protocol === "d3dict:") {
    const [profile, account, file, item] = parts
    if (!profile || !account || !file || !item) throw new Error(`Invalid d3dict URI: ${input}`)
    return { kind: "dict", profile, account, file, item }
  }
  if (url.protocol === "d3catalog:") {
    const [profile, account, item] = parts
    if (!profile || !account || !item) throw new Error(`Invalid d3catalog URI: ${input}`)
    return { kind: "catalog", profile, account, item }
  }
  throw new Error(`Unsupported D3 URI protocol: ${url.protocol}`)
}

export function formatD3Uri(uri: D3Uri): string {
  const enc = (value: string) => encodeURIComponent(value)
  if (uri.kind === "catalog") return `d3catalog://${enc(uri.profile)}/${enc(uri.account)}/${enc(uri.item)}`
  const scheme = uri.kind === "dict" ? "d3dict" : "d3"
  if (!uri.file) throw new Error("D3 data/dict URIs require a file")
  return `${scheme}://${enc(uri.profile)}/${enc(uri.account)}/${enc(uri.file)}/${enc(uri.item)}`
}
