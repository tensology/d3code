import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import type { D3CodeConfig } from "../config/config.js"
import { saveConfig, selectProfile } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { d3Tools } from "../d3/tools.js"
import { defaultSecretStore } from "../security/secrets.js"
import { runToolByName } from "../tools/runner.js"
import { runD3AgentTurn, type AgentChatFunction } from "../tui/agent.js"
import type { ChatMessage } from "../llm/client.js"
import { normalizeD3PromptPattern } from "../d3/prompts.js"
import { createLocalD3Profile } from "../d3/profile-defaults.js"
import { isPublicIdeHost } from "./access.js"
import { isBasicAuthValid, resolveIdeAuth } from "./auth.js"

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
  requireAuth?: boolean
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

function sendAuthRequired(res: ServerResponse): void {
  res.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "www-authenticate": "Basic realm=\"D3 Code IDE\"",
  })
  res.end("Authentication required.\n")
}

function startSse(res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
  })
}

function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
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
    ":root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#081019;color:#dbe7f3;--bg:#081019;--chrome:#0c1520;--rail:#0f1b27;--panel:#121f2d;--panel2:#172635;--editor:#0a121b;--line:#243448;--line2:#304256;--text:#dbe7f3;--muted:#8293a7;--soft:#aebed0;--accent:#4f8cff;--accent2:#35c49a;--warn:#f4b860;--danger:#ff6b6b;--bubble:#18293a;--bubble-user:#1d3f5f}",
    "body[data-theme='light']{color-scheme:light;--bg:#f6f8fb;--chrome:#ffffff;--rail:#eef2f7;--panel:#ffffff;--panel2:#f7f9fc;--editor:#ffffff;--line:#d7dee8;--line2:#c3cedb;--text:#142033;--muted:#687789;--soft:#405166;--accent:#1f6feb;--accent2:#008b6a;--warn:#a15c00;--danger:#c24141;--bubble:#ffffff;--bubble-user:#e7f0ff}",
    "*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text)}button,input,select,textarea{font:inherit}button{min-height:32px;border:1px solid var(--line2);background:var(--panel2);color:var(--text);border-radius:5px;padding:0 10px;cursor:pointer;font-size:12px;font-weight:650;letter-spacing:0;line-height:1.12;white-space:nowrap}button:hover{background:var(--panel);border-color:var(--accent)}button.primary{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 0 0 1px rgba(79,140,255,.18)}input,select,textarea{width:100%;border:1px solid var(--line2);background:var(--editor);color:var(--text);border-radius:5px;padding:8px 9px;font-size:12px;outline:none}input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(79,140,255,.14)}textarea{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical}",
    ".top{height:44px;display:grid;grid-template-columns:220px 1fr auto;align-items:center;border-bottom:1px solid var(--line);background:var(--chrome);padding:0 12px;gap:14px}.brand{font-weight:760;font-size:14px}.meta{font-size:12px;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.profile-wrap{position:relative}.profile-button{display:flex;align-items:center;gap:8px;min-width:156px;justify-content:space-between}.profile-menu{position:absolute;right:0;top:38px;width:360px;background:var(--panel);border:1px solid var(--line);box-shadow:0 18px 42px rgba(0,0,0,.28);border-radius:8px;padding:12px;z-index:10;display:none}.profile-menu.open{display:grid;gap:10px}.profile-list{display:grid;gap:6px}.profile-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px}.profile-choice{height:auto;display:grid;gap:2px;text-align:left;padding:9px 10px;white-space:normal}.profile-choice.active{background:var(--accent);border-color:var(--accent);color:#fff}.profile-choice.active span{color:rgba(255,255,255,.78)}.profile-choice span{font-size:11px;color:var(--muted);font-weight:500}.profile-action{min-width:48px}.modal-backdrop{position:fixed;inset:0;background:rgba(2,8,15,.62);display:none;place-items:center;z-index:30;padding:18px}.modal-backdrop.open{display:grid}.profile-form{width:min(680px,100%);border:1px solid var(--line);border-radius:9px;padding:14px;background:var(--panel);box-shadow:0 24px 80px rgba(0,0,0,.38);display:grid;gap:12px}.profile-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.profile-form-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{display:grid;gap:4px}.field.wide{grid-column:1/3}.field span{font-size:11px;color:var(--muted);font-weight:700}.field em{font-style:normal;font-size:11px;line-height:1.35;color:var(--muted)}.theme-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.theme-choice.active{background:var(--accent);border-color:var(--accent);color:#fff}.menu-title{font-size:12px;font-weight:760}.menu-muted{font-size:11px;color:var(--muted);line-height:1.4}",
    ".layout{display:grid;grid-template-columns:300px minmax(380px,1fr) 340px;grid-template-rows:minmax(420px,1fr) 248px;height:calc(100vh - 44px);min-height:720px}.sidebar{grid-row:1/3;background:var(--rail);border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.right{grid-column:3;grid-row:1/3;background:var(--rail);border-left:1px solid var(--line);min-width:0;min-height:0}.runtime{grid-column:2;grid-row:2;background:var(--rail);border-top:1px solid var(--line);min-width:0;min-height:0}main{grid-column:2;grid-row:1;min-width:0;background:var(--editor);display:flex;flex-direction:column}.dock{height:100%;display:flex;flex-direction:column;min-height:0}.dock-head{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line);padding:0 12px;background:var(--panel2)}.dock-title{font-size:12px;font-weight:760;text-transform:uppercase;color:var(--text);letter-spacing:.02em}.dock-sub{font-size:11px;color:var(--muted);white-space:nowrap}.dock-body{padding:12px;overflow:auto;min-height:0;flex:1}.panel{border-bottom:1px solid var(--line);background:transparent}.panel:last-child{border-bottom:0}.panel h2{font-size:12px;line-height:1;margin:0 0 10px;color:var(--text);text-transform:uppercase;letter-spacing:.02em}.panel .body{padding:0}",
    ".tabs{display:grid;grid-template-columns:1fr;gap:4px;padding:10px;border-bottom:1px solid var(--line);background:var(--rail)}.tab{height:auto;text-align:left;display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;border-color:transparent;background:transparent;padding:9px 8px;color:var(--soft)}.tab b{display:block;font-size:12px;color:inherit}.tab span{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:2px}.tab.active{background:var(--panel);color:var(--text);border-color:var(--line2);box-shadow:inset 3px 0 0 var(--accent)}.tab.active span{color:var(--muted)}.glyph{width:18px;height:18px;display:grid;place-items:center;color:var(--accent2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.pane{display:none}.pane.active{display:block}",
    ".row{display:flex;gap:8px;align-items:center;margin-bottom:8px}.row>*{flex:1}.row button{flex:0 0 auto}.stack{display:grid;gap:8px}.label{font-size:11px;font-weight:750;color:var(--muted);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.04em}.hint{font-size:11px;color:var(--muted);line-height:1.45;margin:6px 0 10px}.list{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;background:var(--editor);border:1px solid var(--line);border-radius:6px;padding:10px;min-height:92px;color:var(--text)}.mini{min-height:70px}.check{display:flex;gap:7px;align-items:center;color:var(--muted);font-size:12px;margin:8px 0}.check input{width:auto}.toolbar{min-height:38px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line);background:var(--panel2);padding:0 10px}.editor-actions{height:auto;min-height:44px;flex-wrap:wrap;padding:6px 10px}.editor-actions .check{flex:1 1 185px;margin:0}.tool-chip{height:24px;border:1px solid var(--line);border-radius:4px;padding:4px 7px;color:var(--muted);font-size:11px;background:var(--panel)}.tool-chip.hot{color:#fff;background:var(--accent2);border-color:var(--accent2)}",
    ".editor-wrap{display:grid;grid-template-columns:44px 1fr;min-height:0;flex:1}.gutter{background:var(--panel2);border-right:1px solid var(--line);color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:22px;padding:12px 8px;text-align:right;user-select:none}.editor{border:0;border-radius:0;background:var(--editor);min-height:430px;height:100%;padding:12px 14px;line-height:22px;font-size:13px;color:var(--text);tab-size:2}.editor:focus{box-shadow:none;border:0}.editor-fields{display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.3fr) auto;gap:8px;padding:10px;border-bottom:1px solid var(--line);background:var(--panel2)}",
    ".agent-shell{height:100%;display:flex;flex-direction:column}.agent-chat{padding:0;display:grid;grid-template-rows:1fr auto;height:100%;overflow:hidden}.agent-thread{overflow:auto;padding:14px;display:grid;align-content:start;gap:10px;background:var(--rail)}.chat-bubble{max-width:92%;border:1px solid var(--line);border-radius:10px;padding:10px 11px;background:var(--bubble);font-size:13px;line-height:1.45;white-space:pre-wrap}.chat-bubble.user{justify-self:end;background:var(--bubble-user);border-color:rgba(79,140,255,.45)}.chat-bubble.assistant{justify-self:start}.tool-event{max-width:92%;justify-self:start;border:1px solid var(--line);background:var(--panel2);border-radius:7px;padding:8px}.tool-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--accent2);font-weight:750}.agent-composer{border-top:1px solid var(--line);padding:10px;background:var(--panel)}.agentbox{min-height:72px;max-height:140px;line-height:1.45;background:var(--editor)}.agent-actions{display:flex;justify-content:flex-end;margin-top:8px}",
    ".runtime .dock-body{padding:10px 12px}.terminal-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px}.terminal{background:#02070c;color:#b7f7c5;border:1px solid #193324;border-radius:6px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:136px;white-space:pre-wrap;line-height:1.5;font-size:12px;outline:none;cursor:text}.terminal:focus{border-color:#35c49a;box-shadow:0 0 0 2px rgba(53,196,154,.18)}.terminal:empty:before{content:'D3 runtime output will appear here';color:#4e665a}.command-label{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent);font-size:11px}",
    "@media(max-width:1100px){.layout{grid-template-columns:280px 1fr;grid-template-rows:minmax(420px,1fr) 240px 320px;height:auto;min-height:calc(100vh - 44px)}main{grid-column:2;grid-row:1}.runtime{grid-column:2;grid-row:2}.right{grid-column:1/3;grid-row:3;border-left:0;border-top:1px solid var(--line)}.sidebar{grid-row:1/3}.top{grid-template-columns:1fr auto}.meta{display:none}}@media(max-width:760px){.layout{display:block;height:auto}.sidebar,.right,.runtime{border:0;border-top:1px solid var(--line);min-height:320px}.editor-fields{grid-template-columns:1fr}.editor-wrap{grid-template-columns:34px 1fr}.top{height:44px;padding:0 10px}.tabs{grid-template-columns:1fr 1fr}.tab{grid-template-columns:1fr}.glyph{display:none}.profile-button{min-width:132px}.profile-menu{right:0;width:min(320px,calc(100vw - 20px))}}",
    "</style>",
    "</head>",
    "<body data-theme=\"light\">",
    "<div class=\"top\"><div class=\"brand\">D3 Code IDE</div><div class=\"meta\" id=\"meta\">No profile selected</div><div class=\"profile-wrap\"><button id=\"profileMenuButton\" class=\"profile-button\"><span id=\"profileButtonLabel\">Profiles</span><span>v</span></button><div id=\"profileMenu\" class=\"profile-menu\"><div><div class=\"menu-title\">Profiles</div><div class=\"menu-muted\">Add, edit, remove, or select a D3 connection profile.</div></div><div id=\"profileChoices\" class=\"profile-list\"></div><button id=\"addProfile\">Add profile</button><div class=\"theme-row\" id=\"themeRow\"><button class=\"theme-choice\" data-theme-choice=\"dark\">Dark mode</button><button class=\"theme-choice active\" data-theme-choice=\"light\">Light mode</button><button class=\"theme-choice\" data-theme-choice=\"system\">System</button></div></div></div></div>",
    "<div class=\"layout\">",
    "<aside class=\"sidebar\"><div class=\"tabs\"><button class=\"tab active\" data-pane=\"profilesPane\"><span class=\"glyph\">@</span><span><b>Profiles / Accounts</b><span>D3 host, account, LOGTO context</span></span></button><button class=\"tab\" data-pane=\"dataPane\"><span class=\"glyph\">F</span><span><b>Data Files / Items</b><span>MD pointers, records, locks, AQL</span></span></button><button class=\"tab\" data-pane=\"dictPane\"><span class=\"glyph\">D</span><span><b>Dictionaries</b><span>DICT items and field definitions</span></span></button><button class=\"tab\" data-pane=\"basicPane\"><span class=\"glyph\">B</span><span><b>BASIC / Subroutines</b><span>Program items, compile, catalog, CALL</span></span></button><button class=\"tab\" data-pane=\"indexPane\"><span class=\"glyph\">#</span><span><b>Indexes / References</b><span>Account evidence and manuals</span></span></button></div><div class=\"dock\"><div class=\"dock-head\"><div class=\"dock-title\">D3 Navigator</div><div class=\"dock-sub\">account scoped</div></div><div class=\"dock-body\"><div id=\"profilesPane\" class=\"pane active\"><div class=\"panel\"><h2>Accounts</h2><div class=\"body stack\"><div class=\"hint\">Use the profile menu in the top right for connection profiles. This panel is for switching the active D3 account inside the selected profile.</div><div class=\"label\">LOGTO account</div><div class=\"row\"><input id=\"account\" placeholder=\"DM, SALES\" /><button id=\"loginAccount\">Login</button></div><label class=\"check\"><input id=\"confirmLogin\" type=\"checkbox\" /> confirm account switch</label></div></div></div><div id=\"dataPane\" class=\"pane\"><div class=\"panel\"><h2>Data Files / Items</h2><div class=\"body stack\"><div class=\"hint\">D3 files are account-level file pointers. Items are records inside those files, including program source in program files.</div><div class=\"row\"><button id=\"listFiles\">List MD file pointers</button><button id=\"locks\">Locks</button></div><div id=\"files\" class=\"list\"></div><div class=\"label\">AQL / TCL query</div><div class=\"row\"><input id=\"aql\" placeholder=\"LIST CUSTOMERS NAME\" /><button id=\"runAql\">Run</button></div></div></div></div><div id=\"dictPane\" class=\"pane\"><div class=\"panel\"><h2>Dictionaries</h2><div class=\"body stack\"><div class=\"hint\">Dictionary items describe how fields are named, derived, converted, and displayed for a data file.</div><input id=\"dictFile\" placeholder=\"data file, e.g. CUSTOMERS\" /><div class=\"row\"><input id=\"dictItem\" placeholder=\"dictionary item, e.g. NAME\" /><button id=\"readDictPanel\">Read DICT</button></div><div id=\"dictResults\" class=\"list\"></div></div></div></div><div id=\"basicPane\" class=\"pane\"><div class=\"panel\"><h2>BASIC / Subroutines</h2><div class=\"body stack\"><div class=\"row\"><input id=\"basicFile\" placeholder=\"program file, e.g. BP\" /><input id=\"basicItem\" placeholder=\"program item\" /></div><div class=\"row\"><button id=\"compileBasicPanel\">Compile BASIC</button><button id=\"catalogBasicPanel\">Catalog BASIC</button></div><div class=\"label\">Subroutine call</div><div class=\"row\"><input id=\"subroutine\" placeholder=\"GET.CUSTOMER\" /><button id=\"callSubroutine\">Call</button></div><input id=\"subArgs\" placeholder=\"arguments separated by spaces\" /><label class=\"check\"><input id=\"confirmCall\" type=\"checkbox\" /> confirm BASIC/subroutine action</label></div></div></div><div id=\"indexPane\" class=\"pane\"><div class=\"panel\"><h2>Indexes / References</h2><div class=\"body stack\"><button id=\"indexAccount\">Index account evidence</button><div class=\"label\">Search indexed account evidence</div><div class=\"row\"><input id=\"search\" placeholder=\"CUSTOMERS NAME\" /><button id=\"searchBtn\">Search</button></div><div class=\"label\">Manual search</div><div class=\"row\"><input id=\"manual\" placeholder=\"D-pointer, dictionary, READU\" /><button id=\"manualBtn\">Manual</button></div><div id=\"searchResults\" class=\"list\"></div></div></div></div></div></div></aside>",
    "<main>",
    "<div class=\"dock\"><div class=\"dock-head\"><div class=\"dock-title\">Item / BASIC Editor</div><div class=\"dock-sub\">Rocket MV BASIC / item record</div></div><div class=\"toolbar\"><span class=\"tool-chip hot\">READ</span><span class=\"tool-chip\">WRITE guarded</span><span class=\"tool-chip\">DICT</span><span class=\"tool-chip\">BASIC</span><span class=\"tool-chip\">CATALOG</span></div><div class=\"editor-fields\"><input id=\"file\" placeholder=\"D3 file, e.g. CUSTOMERS or BP\" /><input id=\"item\" placeholder=\"item-ID, record, program, or subroutine\" /><button id=\"readItem\">Read item</button></div><div class=\"editor-wrap\"><div class=\"gutter\">1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>10<br>11<br>12<br>13<br>14<br>15<br>16<br>17<br>18<br>19<br>20</div><textarea id=\"itemBody\" class=\"editor\" spellcheck=\"false\" placeholder=\"Read a D3 item or BASIC program into this editor. Mutating actions stay behind confirmation gates.\"></textarea></div><div class=\"toolbar editor-actions\"><label class=\"check\"><input id=\"confirmWrite\" type=\"checkbox\" /> confirm D3 item write / compile / catalog</label><button id=\"writeItem\">Write item with safety gate</button><button id=\"readDict\">Read dictionary item</button><button id=\"compileBasic\">Compile BASIC</button><button id=\"catalogBasic\">Catalog BASIC</button></div></div>",
    "</main>",
    "<section class=\"right\"><div class=\"dock agent-shell\"><div class=\"dock-head\"><div class=\"dock-title\">Agent</div><div class=\"dock-sub\" id=\"agentSafety\">Safety: ask</div></div><div class=\"dock-body agent-chat\"><div id=\"agentOutput\" class=\"agent-thread\"><div class=\"chat-bubble assistant\">Tell me what you want to inspect or change in this D3 account. I can read items, explain dictionaries, inspect BASIC, and keep risky actions behind confirmation.</div></div><div class=\"agent-composer\"><textarea id=\"agentPrompt\" class=\"agentbox\" placeholder=\"Message D3 Code...\"></textarea><div class=\"agent-actions\"><button class=\"primary\" id=\"agentSend\">Send</button></div></div></div></div></section>",
    "<section class=\"runtime\"><div class=\"dock\"><div class=\"dock-head\"><div class=\"dock-title\">D3 Runtime</div><div class=\"dock-sub\">Terminal emulation / TCL session</div></div><div class=\"dock-body\"><div class=\"terminal-row\"><input id=\"command\" placeholder=\"WHO, LIST MD, CT CUSTOMERS 100\" /><button class=\"primary\" id=\"send\">Send</button></div><label class=\"check\"><input id=\"confirmTerminal\" type=\"checkbox\" /> confirm mutation-risk runtime command</label><div id=\"terminal\" class=\"terminal\" tabindex=\"0\" role=\"textbox\" aria-label=\"D3 runtime terminal\"></div></div></div></section>",
    "</div>",
    "<div id=\"profileModal\" class=\"modal-backdrop\"><div id=\"profileForm\" class=\"profile-form\"><div><div class=\"menu-title\" id=\"profileFormTitle\">Add D3 connection</div><div class=\"menu-muted\">This tells D3 Code how to reach a Rocket D3 account. It is separate from the AI model provider.</div></div><div class=\"profile-form-grid\"><label class=\"field\"><span>Profile name</span><input id=\"profileName\" placeholder=\"Production, Test, Local DM\" /><em>A friendly name for this saved connection.</em></label><label class=\"field\"><span>Connection</span><select id=\"profileType\"><option value=\"local\">This machine</option><option value=\"ssh\">SSH server</option></select><em>Choose SSH when D3 lives on another server.</em></label><label class=\"field\"><span>SSH host</span><input id=\"profileHost\" placeholder=\"d3.example.com\" /><em>Only needed for SSH connections.</em></label><label class=\"field\"><span>SSH user</span><input id=\"profileUser\" /><em>Only needed for SSH connections.</em></label><label class=\"field\"><span>Starting D3 account</span><input id=\"profileAccount\" placeholder=\"DM\" /><em>The account to use after connecting, such as DM or SALES.</em></label><label class=\"field\"><span>Runtime session</span><select id=\"profileSession\"><option value=\"persistent\">Keep connected</option><option value=\"oneshot\">Run one command at a time</option></select><em>Keep connected is best for the IDE and agent.</em></label><label class=\"field wide\"><span>Command that opens D3</span><input id=\"profileEntry\" placeholder=\"d3, ap, or your server login command\" /><em>Leave blank if the shell or SSH login already lands inside D3/TCL.</em></label><label class=\"field wide\"><span>Startup input</span><textarea id=\"profileStartup\" rows=\"3\" placeholder=\"dm\\ndm\\n\"></textarea><em>Keys sent after D3 opens, before D3 Code waits for the ready prompt. Use this for user/account/master-dictionary prompts.</em></label><label class=\"field\"><span>Ready prompt</span><input id=\"profilePrompt\" placeholder=\":\" /><em>Normal TCL is a standalone :. The > prompt means an active select list.</em></label><label class=\"field\"><span>Approval mode</span><select id=\"profileSafety\"><option value=\"ask\">Ask before risky actions</option><option value=\"plan\">Read and plan only</option><option value=\"trust\">Allow normal guarded work</option></select><em>Controls writes, compile, catalog, LOGTO, and runtime commands.</em></label></div><div class=\"profile-form-actions\"><button id=\"saveProfile\">Save profile</button><button id=\"cancelProfile\">Cancel</button></div></div></div>",
    "<script>",
    "const $=id=>document.getElementById(id);",
    "async function api(path, options){const r=await fetch(path,options);const t=await r.text();try{return JSON.parse(t)}catch{return {text:t,status:r.status}}}",
    "function escapeHtml(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}",
    "let terminalDraft='';",
    "function terminalText(v){return typeof v==='string'?v:JSON.stringify(v,null,2)}",
    "function renderTerminal(){const out=$('terminal').dataset.output||'';$('terminal').textContent=(out?out.replace(/\\s*$/,'')+'\\n':'')+'> '+terminalDraft;$('command').value=terminalDraft;$('terminal').scrollTop=$('terminal').scrollHeight}",
    "function show(id,v){if(id==='terminal'){$('terminal').dataset.output=terminalText(v);renderTerminal();return}$(id).textContent=terminalText(v)}",
    "function addBubble(role,text){const div=document.createElement('div');div.className='chat-bubble '+role;div.textContent=text;$('agentOutput').appendChild(div);$('agentOutput').scrollTop=$('agentOutput').scrollHeight;return div}",
    "function addToolEvent(t){const div=document.createElement('div');div.className='tool-event';div.innerHTML='<div class=\"tool-name\">'+escapeHtml(t.name||'tool')+'</div><div class=\"chat-tool-result\">'+escapeHtml(t.result||t.compact||t.reason||'running')+'</div>';$('agentOutput').appendChild(div);$('agentOutput').scrollTop=$('agentOutput').scrollHeight;return div}",
    "function showAgent(v){if(v.error){addBubble('assistant',v.error);return}addBubble('assistant',v.output||JSON.stringify(v,null,2));(v.tools||[]).forEach(t=>{const div=document.createElement('div');div.className='tool-event';div.innerHTML='<div class=\"tool-name\">'+escapeHtml(t.name||'tool')+'</div><div class=\"chat-tool-result\">'+escapeHtml(t.result||'')+'</div>';$('agentOutput').appendChild(div)});$('agentOutput').scrollTop=$('agentOutput').scrollHeight}",
    "function parseSseEvent(block){let event='message';let data='';block.split(/\\r?\\n/).forEach(line=>{if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trim()});try{return {event,data:JSON.parse(data||'{}')}}catch{return {event,data:{}}}}",
    "function removeIfEmpty(node){if(node&&!node.textContent.trim())node.remove()}",
    "async function streamAgent(input){addBubble('user',input);let assistant=null;let buffer='';let suppress=false;const response=await fetch('/api/agent',{method:'POST',headers:{'content-type':'application/json','accept':'text/event-stream'},body:JSON.stringify({input})});if(!response.ok||!response.body){showAgent(await response.json());return}const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';while(true){const read=await reader.read();if(read.done)break;pending+=decoder.decode(read.value,{stream:true});let boundary;while((boundary=pending.indexOf('\\n\\n'))!==-1){const block=pending.slice(0,boundary);pending=pending.slice(boundary+2);if(!block.trim())continue;const msg=parseSseEvent(block);if(msg.event==='assistant_delta'){if(!assistant)assistant=addBubble('assistant','');if(suppress)continue;buffer+=msg.data.token||'';const toolIndex=buffer.search(/<(d3_tool|tool_call)>/i);if(toolIndex!==-1){suppress=true;buffer=buffer.slice(0,toolIndex).trimEnd()}assistant.textContent=buffer;$('agentOutput').scrollTop=$('agentOutput').scrollHeight}if(msg.event==='tool_start'){suppress=true;removeIfEmpty(assistant);assistant=null;buffer='';addToolEvent({name:msg.data.name,reason:msg.data.reason,result:'running...'})}if(msg.event==='tool_result'){suppress=false;addToolEvent({name:msg.data.name,result:msg.data.compact})}if(msg.event==='done'){if(msg.data.output&&(!assistant||assistant.textContent.trim()!==msg.data.output.trim()))addBubble('assistant',msg.data.output);if(assistant)assistant.textContent=assistant.textContent||msg.data.output||''}if(msg.event==='error'){addBubble('assistant',msg.data.error||'Agent failed')}}}}",
    "document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$(btn.dataset.pane).classList.add('active')});",
    "$('profileMenuButton').onclick=()=>$('profileMenu').classList.toggle('open');",
    "document.addEventListener('click',e=>{if(!$('profileMenu').contains(e.target)&&!$('profileMenuButton').contains(e.target))$('profileMenu').classList.remove('open')});",
    "function systemTheme(){return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}",
    "function setTheme(choice){const actual=choice==='system'?systemTheme():choice;document.body.dataset.theme=actual;document.body.dataset.themeChoice=choice;try{localStorage.setItem('d3code.theme',choice)}catch{}document.querySelectorAll('.theme-choice').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeChoice===choice))}",
    "document.querySelectorAll('.theme-choice').forEach(btn=>btn.onclick=()=>setTheme(btn.dataset.themeChoice));",
    "try{setTheme(localStorage.getItem('d3code.theme')||'light')}catch{setTheme('light')}",
    "if(window.matchMedia)window.matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{if(document.body.dataset.themeChoice==='system')setTheme('system')});",
    "let profileCache=[];",
    "let selectedProfile='';",
    "async function switchProfile(profile){if(!profile)return;show('terminal',await api('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile})}));await boot();}",
    "function defaultProfile(){return {name:'new-profile',type:'local',account:'DM',entryCommand:'d3',startupInput:'dm\\ndm\\n',promptPattern:':',sessionMode:'persistent',safetyDefault:'ask'}}",
    "function setValue(id,value){$(id).value=value||''}",
    "function openProfileForm(profile){const p=profile||defaultProfile();$('profileFormTitle').textContent=profile?'Edit profile':'Add profile';$('profileModal').classList.add('open');$('profileMenu').classList.remove('open');setValue('profileName',p.name);setValue('profileType',p.type||'local');setValue('profileHost',p.host);setValue('profileUser',p.username);setValue('profileAccount',p.account);setValue('profileEntry',p.entryCommand);setValue('profileStartup',p.startupInput);setValue('profilePrompt',p.promptPattern||':');setValue('profileSession',p.sessionMode||'oneshot');setValue('profileSafety',p.safetyDefault||'ask')}",
    "function closeProfileForm(){$('profileModal').classList.remove('open')}",
    "function collectProfileForm(){const type=$('profileType').value;const profile={name:$('profileName').value.trim(),type,account:$('profileAccount').value.trim()||undefined,entryCommand:$('profileEntry').value.trim()||undefined,startupInput:$('profileStartup').value.replace(/\\\\n/g,'\\n')||undefined,promptPattern:$('profilePrompt').value.trim()||undefined,sessionMode:$('profileSession').value,safetyDefault:$('profileSafety').value};if(type==='ssh'){profile.host=$('profileHost').value.trim()||undefined;profile.username=$('profileUser').value.trim()||undefined}return profile}",
    "async function saveProfileForm(){const profile=collectProfileForm();if(!profile.name){alert('Profile name is required.');return}const result=await api('/api/profile/manage',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({profile,confirmed:true})});if(result.error){alert(result.error);return}closeProfileForm();await boot()}",
    "$('addProfile').onclick=()=>openProfileForm(undefined);",
    "$('saveProfile').onclick=saveProfileForm;",
    "$('cancelProfile').onclick=closeProfileForm;",
    "async function removeProfile(profile){if(!profile)return;if(!confirm(`Remove profile ${profile}?`))return;const result=await api('/api/profile/manage',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({profile,confirmed:true})});if(result.error){alert(result.error);return}await boot();}",
    "function renderProfiles(active){if(profileCache.length===0){$('profileChoices').innerHTML='';return}$('profileChoices').innerHTML=profileCache.map((p,i)=>`<div class=\"profile-row\"><button class=\"profile-choice ${p.name===active?'active':''}\" data-profile-index=\"${i}\"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.type)}${p.account?' / '+escapeHtml(p.account):''}${p.host?' / '+escapeHtml(p.host):''}</span></button><button class=\"profile-action\" data-edit-profile-index=\"${i}\">Edit</button><button class=\"profile-action\" data-remove-profile-index=\"${i}\">Remove</button></div>`).join('');document.querySelectorAll('[data-profile-index]').forEach(btn=>btn.onclick=()=>switchProfile(profileCache[Number(btn.dataset.profileIndex)]?.name));document.querySelectorAll('[data-edit-profile-index]').forEach(btn=>btn.onclick=()=>openProfileForm(profileCache[Number(btn.dataset.editProfileIndex)]));document.querySelectorAll('[data-remove-profile-index]').forEach(btn=>btn.onclick=()=>removeProfile(profileCache[Number(btn.dataset.removeProfileIndex)]?.name));}",
    "async function boot(){const status=await api('/api/status');selectedProfile=status.profile||'';$('meta').textContent=status.profile?`Profile ${status.profile} / Account ${status.account||'none'}`:'No D3 profile selected';$('profileButtonLabel').textContent=status.profile||'Profiles';$('agentSafety').textContent=`Safety: ${status.safety||'ask'} / Mode: ${status.mode||'chat'}`;const profiles=await api('/api/profiles');profileCache=profiles.profiles||[];renderProfiles(status.profile||'')}",
    "$('loginAccount').onclick=async()=>{show('terminal',await api('/api/account/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account:$('account').value,confirmed:$('confirmLogin').checked})}));await boot();};",
    "async function sendTerminalCommand(command){const line=(command??$('command').value).trim();if(!line)return;$('terminal').dataset.output=(($('terminal').dataset.output||'').replace(/\\s*$/,'')+'\\n> '+line+'\\nRunning...').trim();terminalDraft='';renderTerminal();show('terminal',await api('/api/terminal/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:line,confirmed:$('confirmTerminal').checked})}))}",
    "$('send').onclick=async()=>sendTerminalCommand();",
    "$('command').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendTerminalCommand()}});",
    "$('command').addEventListener('input',()=>{terminalDraft=$('command').value;renderTerminal()});",
    "$('terminal').addEventListener('click',()=>$('terminal').focus());",
    "$('terminal').addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='Backspace'){e.preventDefault();terminalDraft=terminalDraft.slice(0,-1);renderTerminal();return}if(e.key==='Delete'||e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End'||e.key==='Tab'){e.preventDefault();return}if(e.key==='Enter'){e.preventDefault();sendTerminalCommand(terminalDraft);return}if(e.key.length===1){e.preventDefault();terminalDraft+=e.key;renderTerminal()}});",
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
    "$('agentSend').onclick=async()=>{const input=$('agentPrompt').value.trim();if(!input)return;$('agentPrompt').value='';try{await streamAgent(input)}catch(error){addBubble('assistant',error.message||String(error))}};",
    "$('agentPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('agentSend').click()}});",
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
    return sendJson(res, 200, { profiles: config.profiles.map((profile) => ({ ...profile })) })
  }
  if (req.method === "POST" && url.pathname === "/api/profile") {
    const body = await readJson(req) as { profile?: string }
    if (!body.profile) return sendJson(res, 400, { error: "profile is required" })
    const profile = selectProfile(config, body.profile)
    if (!profile) return sendJson(res, 404, { error: `unknown profile: ${body.profile}` })
    state.profile = profile.name
    return sendJson(res, 200, { profile: profile.name, account: profile.account })
  }
  if (req.method === "PUT" && url.pathname === "/api/profile/manage") {
    const body = await readJson(req) as { profile?: D3CodeConfig["profiles"][number]; confirmed?: boolean }
    if (!body.confirmed) return sendJson(res, 409, { error: "profile edit requires confirmation" })
    if (!body.profile?.name) return sendJson(res, 400, { error: "profile.name is required" })
    const nextProfile = body.profile.type === "local"
      ? await createLocalD3Profile({
        name: body.profile.name,
        account: body.profile.account,
        entry: body.profile.entryCommand,
        startupInput: body.profile.startupInput,
        prompt: body.profile.promptPattern,
        session: body.profile.sessionMode,
        safety: body.profile.safetyDefault,
        allowedAccounts: body.profile.allowedAccounts,
      })
      : {
          ...body.profile,
          startupInput: body.profile.startupInput?.replace(/\\n/g, "\n"),
          promptPattern: normalizeD3PromptPattern(body.profile.promptPattern),
        }
    config.profiles = [...config.profiles.filter((profile) => profile.name !== nextProfile.name), nextProfile]
    config.defaultProfile ??= nextProfile.name
    state.profile = nextProfile.name
    await saveConfig(config)
    return sendJson(res, 200, { profile: nextProfile.name, saved: true })
  }
  if (req.method === "DELETE" && url.pathname === "/api/profile/manage") {
    const body = await readJson(req) as { profile?: string; confirmed?: boolean }
    if (!body.confirmed) return sendJson(res, 409, { error: "profile removal requires confirmation" })
    if (!body.profile) return sendJson(res, 400, { error: "profile is required" })
    const before = config.profiles.length
    config.profiles = config.profiles.filter((profile) => profile.name !== body.profile)
    if (before === config.profiles.length) return sendJson(res, 404, { error: `unknown profile: ${body.profile}` })
    if (config.defaultProfile === body.profile) config.defaultProfile = config.profiles[0]?.name
    if (state.profile === body.profile) state.profile = config.defaultProfile
    await saveConfig(config)
    return sendJson(res, 200, { profile: body.profile, removed: true, defaultProfile: config.defaultProfile })
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
    if ((req.headers.accept ?? "").includes("text/event-stream") || url.searchParams.get("stream") === "1") {
      startSse(res)
      try {
        const turn = await runD3AgentTurn(config, defaultSecretStore(), {
          ...state,
          input: body.input,
          history: state.agentHistory,
          chatFn: options.agentChatFn,
          onEvent: (event) => writeSse(res, event.type, event),
        })
        state.agentHistory = turn.messages
        writeSse(res, "done", {
          output: turn.output,
          tools: turn.toolEvents.map((event) => ({ name: event.name, input: event.input, reason: event.reason, result: event.result.compact })),
          usage: turn.usage,
        })
      } catch (error) {
        writeSse(res, "error", { error: (error as Error).message })
      } finally {
        res.end()
      }
      return
    }
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
  const requireAuth = options.requireAuth ?? isPublicIdeHost(host)
  const credentials = resolveIdeAuth(config)
  const server = createServer((req, res) => {
    if (requireAuth && !isBasicAuthValid(req.headers.authorization, credentials)) {
      sendAuthRequired(res)
      return
    }
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
