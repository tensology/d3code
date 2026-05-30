import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { d3Tools } from "../d3/tools.js"
import { runToolByName } from "../tools/runner.js"

export interface IdeRuntimeState {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
}

export interface IdeServerOptions {
  host?: string
  port?: number
}

export interface IdeServerHandle {
  host: string
  port: number
  url: string
  server: Server
}

const running = new Map<string, IdeServerHandle>()

function send(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "content-type": contentType, "cache-control": "no-store" })
  res.end(body)
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, `${JSON.stringify(value, null, 2)}\n`, "application/json; charset=utf-8")
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const body = Buffer.concat(chunks).toString("utf8")
  return body ? JSON.parse(body) : {}
}

function html(): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<title>D3 Code IDE</title>",
    "<style>",
    ":root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#17202a;background:#f5f7f8}",
    "body{margin:0}.top{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:#111820;color:#fff}.brand{font-weight:700}.meta{font-size:13px;color:#b9c3cf}",
    ".layout{display:grid;grid-template-columns:260px 1fr 360px;min-height:calc(100vh - 52px)}aside,.right{background:#fff;border-right:1px solid #d8dee5;padding:14px;overflow:auto}.right{border-right:0;border-left:1px solid #d8dee5}",
    "main{padding:14px;overflow:auto}.panel{background:#fff;border:1px solid #d8dee5;border-radius:8px;margin-bottom:12px}.panel h2{font-size:15px;margin:0;padding:12px;border-bottom:1px solid #e5e9ee}.panel .body{padding:12px}",
    "button,input,select,textarea{font:inherit}button{border:1px solid #b9c3cf;background:#fff;border-radius:6px;padding:7px 10px;cursor:pointer}button.primary{background:#1769aa;color:#fff;border-color:#1769aa}",
    "input,select,textarea{border:1px solid #b9c3cf;border-radius:6px;padding:8px;width:100%;box-sizing:border-box}textarea{min-height:160px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
    ".row{display:flex;gap:8px;align-items:center;margin-bottom:8px}.row>*{flex:1}.list{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;white-space:pre-wrap;background:#f1f4f6;border-radius:6px;padding:10px;min-height:80px}",
    ".terminal{background:#0f1720;color:#d9f99d;border-radius:8px;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:240px;white-space:pre-wrap}.label{font-size:12px;font-weight:700;color:#5c6b7a;margin:10px 0 5px}",
    "</style>",
    "</head>",
    "<body>",
    "<div class=\"top\"><div class=\"brand\">D3 Code IDE</div><div class=\"meta\" id=\"meta\">loading...</div></div>",
    "<div class=\"layout\">",
    "<aside><div class=\"panel\"><h2>Profile</h2><div class=\"body\"><div id=\"profileList\" class=\"list\"></div></div></div><div class=\"panel\"><h2>D3 Tools</h2><div class=\"body\"><div id=\"toolList\" class=\"list\"></div></div></div></aside>",
    "<main>",
    "<div class=\"panel\"><h2>D3 Terminal</h2><div class=\"body\"><div class=\"row\"><input id=\"command\" placeholder=\"WHO, LIST MD, CT CUSTOMERS 100\" /><button class=\"primary\" id=\"send\">Send</button></div><label><input id=\"confirmTerminal\" type=\"checkbox\" /> confirm mutation-risk terminal command</label><div id=\"terminal\" class=\"terminal\"></div></div></div>",
    "<div class=\"panel\"><h2>Hashed File Editor</h2><div class=\"body\"><div class=\"row\"><input id=\"file\" placeholder=\"File\" /><input id=\"item\" placeholder=\"Item\" /><button id=\"readItem\">Read</button></div><textarea id=\"itemBody\" spellcheck=\"false\"></textarea><label><input id=\"confirmWrite\" type=\"checkbox\" /> confirm D3 item write</label><div class=\"row\"><button id=\"writeItem\">Write with safety gate</button><button id=\"readDict\">Read DICT</button></div></div></div>",
    "</main>",
    "<section class=\"right\"><div class=\"panel\"><h2>Database Manager</h2><div class=\"body\"><button id=\"listFiles\">List files</button><div id=\"files\" class=\"list\"></div><div class=\"label\">Search indexed D3 evidence</div><div class=\"row\"><input id=\"search\" placeholder=\"CUSTOMERS NAME\" /><button id=\"searchBtn\">Search</button></div><div id=\"searchResults\" class=\"list\"></div></div></div></section>",
    "</div>",
    "<script>",
    "const $=id=>document.getElementById(id);",
    "async function api(path, options){const r=await fetch(path,options);const t=await r.text();try{return JSON.parse(t)}catch{return {text:t,status:r.status}}}",
    "function show(id,v){$(id).textContent=typeof v==='string'?v:JSON.stringify(v,null,2)}",
    "async function boot(){const status=await api('/api/status');$('meta').textContent=`profile=${status.profile||'none'} account=${status.account||'none'} safety=${status.safety} mode=${status.mode}`;show('profileList',await api('/api/profiles'));show('toolList',await api('/api/tools'))}",
    "$('send').onclick=async()=>show('terminal',await api('/api/terminal/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:$('command').value,confirmed:$('confirmTerminal').checked})}));",
    "$('listFiles').onclick=async()=>show('files',await api('/api/files'));",
    "$('readItem').onclick=async()=>{const q=new URLSearchParams({file:$('file').value,item:$('item').value});const v=await api('/api/item?'+q);$('itemBody').value=v.result||JSON.stringify(v,null,2)};",
    "$('readDict').onclick=async()=>{const q=new URLSearchParams({file:$('file').value,item:$('item').value});show('terminal',await api('/api/dict?'+q));};",
    "$('writeItem').onclick=async()=>show('terminal',await api('/api/item',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,item:$('item').value,body:$('itemBody').value,confirmed:$('confirmWrite').checked})}));",
    "$('searchBtn').onclick=async()=>show('searchResults',await api('/api/search?query='+encodeURIComponent($('search').value)));",
    "boot().catch(e=>show('terminal',String(e.stack||e)));",
    "</script>",
    "</body></html>",
  ].join("")
}

function toolResultPayload(result: { compact: string; raw: unknown }): { result: string; raw: unknown } {
  return { result: result.compact, raw: result.raw }
}

async function route(req: IncomingMessage, res: ServerResponse, config: D3CodeConfig, state: IdeRuntimeState): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1")
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, html(), "text/html; charset=utf-8")
  if (req.method === "GET" && url.pathname === "/api/status") {
    const profile = selectProfile(config, state.profile)
    return sendJson(res, 200, { ...state, profile: profile?.name, account: profile?.account })
  }
  if (req.method === "GET" && url.pathname === "/api/profiles") {
    return sendJson(res, 200, { profiles: config.profiles.map((profile) => ({ name: profile.name, type: profile.type, account: profile.account, host: profile.host, sessionMode: profile.sessionMode })) })
  }
  if (req.method === "GET" && url.pathname === "/api/tools") {
    return sendJson(res, 200, { tools: d3Tools.map((tool) => ({ name: tool.name, description: tool.description, mutates: tool.mutates })) })
  }
  if (req.method === "POST" && url.pathname === "/api/terminal/send") {
    const body = await readJson(req) as { command?: string; confirmed?: boolean }
    if (!body.command) return sendJson(res, 400, { error: "command is required" })
    const result = await runToolByName(config, { name: "d3_tcl", input: { command: body.command, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/files") {
    const result = await runToolByName(config, { name: "d3_list_files", safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/item") {
    const result = await runToolByName(config, { name: "d3_read_item", input: { file: url.searchParams.get("file"), item: url.searchParams.get("item") }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "PUT" && url.pathname === "/api/item") {
    const body = await readJson(req) as { file?: string; item?: string; body?: string; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_write_item", input: { file: body.file, item: body.item, body: body.body ?? "", confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/dict") {
    const result = await runToolByName(config, { name: "d3_read_dict", input: { file: url.searchParams.get("file"), item: url.searchParams.get("item") }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/search") {
    const result = await runToolByName(config, { name: "d3_search", input: { query: url.searchParams.get("query") ?? "" }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  return sendJson(res, 404, { error: "not found" })
}

export async function startIdeServer(config: D3CodeConfig, state: IdeRuntimeState, options: IdeServerOptions = {}): Promise<IdeServerHandle> {
  const host = options.host ?? "127.0.0.1"
  const requestedPort = options.port ?? 3737
  const key = `${host}:${requestedPort}:${state.profile ?? config.defaultProfile ?? "default"}`
  const existing = running.get(key)
  if (existing) return existing
  const server = createServer((req, res) => {
    route(req, res, config, state).catch((error) => sendJson(res, 500, { error: (error as Error).message }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(requestedPort, host, () => {
      server.off("error", reject)
      resolve()
    })
  })
  const address = server.address() as AddressInfo
  const handle = { host, port: address.port, url: `http://${host}:${address.port}`, server }
  running.set(key, handle)
  return handle
}

export async function stopIdeServers(): Promise<void> {
  const handles = [...running.values()]
  running.clear()
  await Promise.all(handles.map((handle) => new Promise<void>((resolve, reject) => handle.server.close((error) => error ? reject(error) : resolve()))))
}
