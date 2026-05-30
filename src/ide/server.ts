import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { d3Tools } from "../d3/tools.js"
import { defaultSecretStore } from "../security/secrets.js"
import { runToolByName } from "../tools/runner.js"
import { runD3AgentTurn, type AgentChatFunction } from "../tui/agent.js"
import type { ChatMessage } from "../llm/client.js"

export interface IdeRuntimeState {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
  agentHistory?: ChatMessage[]
}

export interface IdeServerOptions {
  host?: string
  port?: number
  agentChatFn?: AgentChatFunction
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
    ".layout{display:grid;grid-template-columns:300px minmax(420px,1fr) 360px;grid-template-rows:minmax(360px,1fr) 300px;min-height:calc(100vh - 52px)}aside,.right{background:#fff;padding:14px;overflow:auto}aside{grid-row:1/3;border-right:1px solid #d8dee5}.right{border-left:1px solid #d8dee5}.runtime{grid-column:2/4;border-top:1px solid #d8dee5;background:#fff;padding:14px;overflow:auto}",
    "main{padding:14px;overflow:auto}.panel{background:#fff;border:1px solid #d8dee5;border-radius:8px;margin-bottom:12px}.panel h2{font-size:15px;margin:0;padding:12px;border-bottom:1px solid #e5e9ee}.panel .body{padding:12px}",
    "button,input,select,textarea{font:inherit}button{border:1px solid #b9c3cf;background:#fff;border-radius:6px;padding:7px 10px;cursor:pointer}button.primary{background:#1769aa;color:#fff;border-color:#1769aa}",
    "input,select,textarea{border:1px solid #b9c3cf;border-radius:6px;padding:8px;width:100%;box-sizing:border-box}textarea{min-height:160px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
    ".row{display:flex;gap:8px;align-items:center;margin-bottom:8px}.row>*{flex:1}.list{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;white-space:pre-wrap;background:#f1f4f6;border-radius:6px;padding:10px;min-height:80px}",
    ".terminal{background:#0f1720;color:#d9f99d;border-radius:8px;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:170px;white-space:pre-wrap}.label{font-size:12px;font-weight:700;color:#5c6b7a;margin:10px 0 5px}.muted{font-size:12px;color:#687789}.split{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tabs{display:grid;grid-template-columns:1fr;gap:6px;margin-bottom:10px}.tab{padding:7px 8px;text-align:left}.tab.active{background:#1769aa;color:#fff;border-color:#1769aa}.pane{display:none}.pane.active{display:block}.agentbox{min-height:360px}.editor{min-height:420px}",
    "</style>",
    "</head>",
    "<body>",
    "<div class=\"top\"><div class=\"brand\">D3 Code IDE</div><div class=\"meta\" id=\"meta\">loading...</div></div>",
    "<div class=\"layout\">",
    "<aside><div class=\"tabs\"><button class=\"tab active\" data-pane=\"profilesPane\">Profiles / Accounts</button><button class=\"tab\" data-pane=\"dataPane\">Data Files / Items</button><button class=\"tab\" data-pane=\"dictPane\">Dictionaries</button><button class=\"tab\" data-pane=\"basicPane\">BASIC / Subroutines</button><button class=\"tab\" data-pane=\"indexPane\">Indexes / References</button></div><div id=\"profilesPane\" class=\"pane active\"><div class=\"panel\"><h2>Profiles / Accounts</h2><div class=\"body\"><select id=\"profileSelect\"></select><div class=\"row\"><button id=\"useProfile\">Use profile</button><button id=\"refreshStatus\">Refresh</button></div><div class=\"label\">LOGTO account</div><div class=\"row\"><input id=\"account\" placeholder=\"DM, SALES\" /><button id=\"loginAccount\">Login</button></div><label><input id=\"confirmLogin\" type=\"checkbox\" /> confirm account switch</label><div id=\"profileList\" class=\"list\"></div></div></div></div><div id=\"dataPane\" class=\"pane\"><div class=\"panel\"><h2>Data Files / Items</h2><div class=\"body\"><div class=\"row\"><button id=\"listFiles\">List MD file pointers</button><button id=\"locks\">Locks</button></div><div id=\"files\" class=\"list\"></div><div class=\"label\">AQL / TCL query</div><div class=\"row\"><input id=\"aql\" placeholder=\"LIST CUSTOMERS NAME\" /><button id=\"runAql\">Run</button></div></div></div></div><div id=\"dictPane\" class=\"pane\"><div class=\"panel\"><h2>Dictionaries</h2><div class=\"body\"><input id=\"dictFile\" placeholder=\"data file, e.g. CUSTOMERS\" /><div class=\"row\"><input id=\"dictItem\" placeholder=\"dictionary item, e.g. NAME\" /><button id=\"readDictPanel\">Read DICT</button></div><div id=\"dictResults\" class=\"list\"></div></div></div></div><div id=\"basicPane\" class=\"pane\"><div class=\"panel\"><h2>BASIC / Subroutines</h2><div class=\"body\"><div class=\"row\"><input id=\"basicFile\" placeholder=\"program file, e.g. BP\" /><input id=\"basicItem\" placeholder=\"program item\" /></div><div class=\"row\"><button id=\"compileBasicPanel\">Compile BASIC</button><button id=\"catalogBasicPanel\">Catalog BASIC</button></div><div class=\"label\">Subroutine call</div><div class=\"row\"><input id=\"subroutine\" placeholder=\"GET.CUSTOMER\" /><button id=\"callSubroutine\">Call</button></div><input id=\"subArgs\" placeholder=\"arguments separated by spaces\" /><label><input id=\"confirmCall\" type=\"checkbox\" /> confirm BASIC/subroutine action</label></div></div></div><div id=\"indexPane\" class=\"pane\"><div class=\"panel\"><h2>Indexes / References</h2><div class=\"body\"><button id=\"indexAccount\">Index account evidence</button><div class=\"label\">Search indexed account evidence</div><div class=\"row\"><input id=\"search\" placeholder=\"CUSTOMERS NAME\" /><button id=\"searchBtn\">Search</button></div><div class=\"label\">Manual search</div><div class=\"row\"><input id=\"manual\" placeholder=\"D-pointer, dictionary, READU\" /><button id=\"manualBtn\">Manual</button></div><div id=\"searchResults\" class=\"list\"></div></div></div></div></aside>",
    "<main>",
    "<div class=\"panel\"><h2>Item / BASIC Editor</h2><div class=\"body\"><div class=\"row\"><input id=\"file\" placeholder=\"D3 file, e.g. CUSTOMERS or BP\" /><input id=\"item\" placeholder=\"item-ID, record, program, or subroutine\" /><button id=\"readItem\">Read item</button></div><textarea id=\"itemBody\" class=\"editor\" spellcheck=\"false\"></textarea><label><input id=\"confirmWrite\" type=\"checkbox\" /> confirm D3 item write / compile / catalog</label><div class=\"row\"><button id=\"writeItem\">Write item with safety gate</button><button id=\"readDict\">Read dictionary item</button></div><div class=\"row\"><button id=\"compileBasic\">Compile BASIC</button><button id=\"catalogBasic\">Catalog BASIC</button></div></div></div>",
    "</main>",
    "<section class=\"right\"><div class=\"panel\"><h2>Agent</h2><div class=\"body\"><textarea id=\"agentPrompt\" class=\"agentbox\" placeholder=\"Ask D3 Code about the selected account, data file, dictionary, BASIC item, or change.\"></textarea><button id=\"agentSend\">Ask agent</button><div id=\"agentOutput\" class=\"list\"></div></div></div></section>",
    "<section class=\"runtime\"><div class=\"panel\"><h2>D3 Runtime</h2><div class=\"body\"><div class=\"row\"><input id=\"command\" placeholder=\"WHO, LIST MD, CT CUSTOMERS 100\" /><button class=\"primary\" id=\"send\">Send</button></div><label><input id=\"confirmTerminal\" type=\"checkbox\" /> confirm mutation-risk runtime command</label><div id=\"terminal\" class=\"terminal\"></div></div></div></section>",
    "</div>",
    "<script>",
    "const $=id=>document.getElementById(id);",
    "async function api(path, options){const r=await fetch(path,options);const t=await r.text();try{return JSON.parse(t)}catch{return {text:t,status:r.status}}}",
    "function show(id,v){$(id).textContent=typeof v==='string'?v:JSON.stringify(v,null,2)}",
    "document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$(btn.dataset.pane).classList.add('active')});",
    "async function boot(){const status=await api('/api/status');$('meta').textContent=`profile=${status.profile||'none'} account=${status.account||'none'} safety=${status.safety} mode=${status.mode}`;const profiles=await api('/api/profiles');$('profileSelect').innerHTML=(profiles.profiles||[]).map(p=>`<option value=\"${p.name}\" ${p.name===status.profile?'selected':''}>${p.name} (${p.account||'no account'})</option>`).join('');show('profileList',profiles)}",
    "$('refreshStatus').onclick=boot;",
    "$('useProfile').onclick=async()=>{show('terminal',await api('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile:$('profileSelect').value})}));await boot();};",
    "$('loginAccount').onclick=async()=>{show('terminal',await api('/api/account/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account:$('account').value,confirmed:$('confirmLogin').checked})}));await boot();};",
    "$('send').onclick=async()=>show('terminal',await api('/api/terminal/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:$('command').value,confirmed:$('confirmTerminal').checked})}));",
    "$('listFiles').onclick=async()=>show('files',await api('/api/files'));",
    "$('locks').onclick=async()=>show('files',await api('/api/locks'));",
    "$('indexAccount').onclick=async()=>show('files',await api('/api/index',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));",
    "$('readItem').onclick=async()=>{const q=new URLSearchParams({file:$('file').value,item:$('item').value});const v=await api('/api/item?'+q);$('itemBody').value=v.result||JSON.stringify(v,null,2)};",
    "$('readDict').onclick=async()=>{const q=new URLSearchParams({file:$('file').value,item:$('item').value});show('terminal',await api('/api/dict?'+q));};",
    "$('readDictPanel').onclick=async()=>{const q=new URLSearchParams({file:$('dictFile').value,item:$('dictItem').value});show('dictResults',await api('/api/dict?'+q));};",
    "$('writeItem').onclick=async()=>show('terminal',await api('/api/item',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,item:$('item').value,body:$('itemBody').value,confirmed:$('confirmWrite').checked})}));",
    "$('compileBasic').onclick=async()=>show('terminal',await api('/api/basic/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,item:$('item').value,confirmed:$('confirmWrite').checked})}));",
    "$('catalogBasic').onclick=async()=>show('terminal',await api('/api/basic/catalog',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,item:$('item').value,confirmed:$('confirmWrite').checked})}));",
    "$('compileBasicPanel').onclick=async()=>show('terminal',await api('/api/basic/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('basicFile').value,item:$('basicItem').value,confirmed:$('confirmCall').checked})}));",
    "$('catalogBasicPanel').onclick=async()=>show('terminal',await api('/api/basic/catalog',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('basicFile').value,item:$('basicItem').value,confirmed:$('confirmCall').checked})}));",
    "$('runAql').onclick=async()=>show('searchResults',await api('/api/aql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:$('aql').value})}));",
    "$('searchBtn').onclick=async()=>show('searchResults',await api('/api/search?query='+encodeURIComponent($('search').value)));",
    "$('manualBtn').onclick=async()=>show('searchResults',await api('/api/manual-search?query='+encodeURIComponent($('manual').value)));",
    "$('callSubroutine').onclick=async()=>show('searchResults',await api('/api/subroutine/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:$('subroutine').value,args:$('subArgs').value.split(/\\s+/).filter(Boolean),confirmed:$('confirmCall').checked})}));",
    "$('agentSend').onclick=async()=>show('agentOutput',await api('/api/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:$('agentPrompt').value})}));",
    "boot().catch(e=>show('terminal',String(e.stack||e)));",
    "</script>",
    "</body></html>",
  ].join("")
}

function toolResultPayload(result: { compact: string; raw: unknown }): { result: string; raw: unknown } {
  return { result: result.compact, raw: result.raw }
}

async function route(req: IncomingMessage, res: ServerResponse, config: D3CodeConfig, state: IdeRuntimeState, options: IdeServerOptions): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1")
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, html(), "text/html; charset=utf-8")
  if (req.method === "GET" && url.pathname === "/api/status") {
    const profile = selectProfile(config, state.profile)
    return sendJson(res, 200, { ...state, profile: profile?.name, account: profile?.account })
  }
  if (req.method === "GET" && url.pathname === "/api/profiles") {
    return sendJson(res, 200, { profiles: config.profiles.map((profile) => ({ name: profile.name, type: profile.type, account: profile.account, host: profile.host, sessionMode: profile.sessionMode })) })
  }
  if (req.method === "POST" && url.pathname === "/api/profile") {
    const body = await readJson(req) as { profile?: string }
    if (!body.profile) return sendJson(res, 400, { error: "profile is required" })
    const profile = selectProfile(config, body.profile)
    if (!profile) return sendJson(res, 404, { error: `unknown profile: ${body.profile}` })
    state.profile = profile.name
    return sendJson(res, 200, { profile: profile.name, account: profile.account })
  }
  if (req.method === "POST" && url.pathname === "/api/account/login") {
    const body = await readJson(req) as { account?: string; confirmed?: boolean }
    if (!body.account) return sendJson(res, 400, { error: "account is required" })
    const result = await runToolByName(config, { name: "d3_login", input: { account: body.account, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/tools") {
    return sendJson(res, 200, { tools: d3Tools.map((tool) => ({ name: tool.name, description: tool.description, mutates: tool.mutates })) })
  }
  if (req.method === "POST" && url.pathname === "/api/agent") {
    const body = await readJson(req) as { input?: string }
    if (!body.input) return sendJson(res, 400, { error: "input is required" })
    const turn = await runD3AgentTurn(config, defaultSecretStore(), {
      ...state,
      input: body.input,
      history: state.agentHistory,
      chatFn: options.agentChatFn,
    })
    state.agentHistory = turn.messages
    return sendJson(res, 200, {
      output: turn.output,
      tools: turn.toolEvents.map((event) => ({ name: event.name, input: event.input, reason: event.reason, result: event.result.compact })),
    })
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
  if (req.method === "GET" && url.pathname === "/api/locks") {
    const result = await runToolByName(config, { name: "d3_locks", safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/index") {
    const body = await readJson(req) as { saveAs?: string }
    const result = await runToolByName(config, { name: "d3_index_account", input: { saveAs: body.saveAs }, safety: state.safety, profile: state.profile })
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
  if (req.method === "POST" && url.pathname === "/api/aql") {
    const body = await readJson(req) as { query?: string }
    if (!body.query) return sendJson(res, 400, { error: "query is required" })
    const result = await runToolByName(config, { name: "d3_query_aql", input: { query: body.query }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/basic/compile") {
    const body = await readJson(req) as { file?: string; item?: string; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_compile_basic", input: { file: body.file, item: body.item, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/basic/catalog") {
    const body = await readJson(req) as { file?: string; item?: string; global?: boolean; confirmed?: boolean }
    const result = await runToolByName(config, { name: "d3_catalog", input: { file: body.file, item: body.item, global: body.global, confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "POST" && url.pathname === "/api/subroutine/call") {
    const body = await readJson(req) as { name?: string; args?: string[]; confirmed?: boolean }
    if (!body.name) return sendJson(res, 400, { error: "subroutine name is required" })
    const result = await runToolByName(config, { name: "d3_call_subroutine", input: { name: body.name, args: body.args ?? [], confirmed: body.confirmed }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/search") {
    const result = await runToolByName(config, { name: "d3_search", input: { query: url.searchParams.get("query") ?? "" }, safety: state.safety, profile: state.profile })
    return sendJson(res, 200, toolResultPayload(result))
  }
  if (req.method === "GET" && url.pathname === "/api/manual-search") {
    const result = await runToolByName(config, { name: "d3_manual_search", input: { query: url.searchParams.get("query") ?? "" }, safety: state.safety, profile: state.profile })
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
    route(req, res, config, state, options).catch((error) => sendJson(res, 500, { error: (error as Error).message }))
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
