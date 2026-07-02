from __future__ import annotations

import os
from dataclasses import asdict
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from . import __version__
from .config import config_path, load_config, select_profile
from .connectors import connector_statuses
from .routing import tool_routing_status


app = FastAPI(title="D3 Code Python Runtime", version=__version__)


class ToolRequest(BaseModel):
    tool: str
    input: dict | None = None
    profile: str | None = None
    confirmed: bool = False


class TerminalRequest(BaseModel):
    command: str
    confirmed: bool = False


class BasicBuildRequest(BaseModel):
    file: str | None = None
    item: str | None = None
    source: str | None = None
    compile: bool = False
    catalog: bool = False
    confirmed: bool = False


class FileCreateRequest(BaseModel):
    file: str | None = None
    dictModulo: int | None = None
    dataModulo: int | None = None
    confirmed: bool = False


class DictWriteRequest(BaseModel):
    file: str | None = None
    item: str | None = None
    body: str | None = None
    confirmed: bool = False


class SbplusPlanRequest(BaseModel):
    system: str | None = None
    process: str | None = None
    kind: str | None = "input process"
    file: str | None = None
    fields: list[str] | None = None
    notes: str | None = None


D3_CAPABILITIES = [
    {
        "id": "program-builder",
        "label": "BASIC Program Builder",
        "tools": ["d3_build_basic_program", "d3_compile_basic", "d3_catalog"],
        "safety": "mutates",
    },
    {
        "id": "file-dictionary-builder",
        "label": "File and Dictionary Builder",
        "tools": ["d3_create_file", "d3_write_dict"],
        "safety": "mutates",
    },
    {
        "id": "sbplus-builder",
        "label": "SB+ Screen and Process Builder",
        "tools": ["d3_sbplus_discover", "d3_sbplus_plan"],
        "safety": "plan-only",
    },
    {
        "id": "reference-memory",
        "label": "Reference and Hermes Memory",
        "tools": ["d3_rag_search", "d3_manual_search"],
        "safety": "read",
    },
]


def runtime_state() -> dict:
    return {
        "model": os.environ.get("D3CODE_IDE_MODEL", "openai/gpt-5"),
        "safety": os.environ.get("D3CODE_IDE_SAFETY", "ask"),
        "profile": os.environ.get("D3CODE_IDE_PROFILE") or None,
        "mode": os.environ.get("D3CODE_IDE_MODE", "chat"),
    }


def ide_html() -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>D3 Code IDE</title>
  <style>
    :root{color-scheme:dark;--bg:#101114;--panel:#181a20;--line:#2a2d36;--text:#f4f5f7;--muted:#a8adba;--accent:#63d297;--warn:#e6b450}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .shell{display:grid;grid-template-columns:320px 1fr;min-height:100vh}.side{border-right:1px solid var(--line);background:var(--panel);padding:18px;overflow:auto}
    .main{padding:22px;display:grid;grid-template-rows:auto auto 1fr auto;gap:16px}.brand{font-weight:700;font-size:18px}.sub{color:var(--muted);font-size:12px;margin-top:2px}
    .profile{border:1px solid var(--line);border-radius:8px;padding:12px;margin-top:12px}.profile.active{border-color:var(--accent);box-shadow:inset 3px 0 0 var(--accent)}
    .profile h3{margin:0 0 4px;font-size:14px}.meta{color:var(--muted);font-size:12px}.selected{display:inline-block;margin-top:8px;color:#0b1510;background:var(--accent);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700}
    .card{border:1px solid var(--line);border-radius:8px;padding:14px;background:#14161b}.status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
    .label{color:var(--muted);font-size:12px}.value{font-weight:650;margin-top:2px}.routes{display:grid;gap:10px}.route{border-top:1px solid var(--line);padding-top:10px}.route:first-child{border-top:0;padding-top:0}
    .terminal{background:#08090b;border:1px solid var(--line);border-radius:8px;min-height:260px;padding:12px;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#d9f6e5}
    .tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.tools button{width:100%;min-height:38px}.tools input{min-width:0}
    form{display:flex;gap:10px}input{flex:1;border:1px solid var(--line);border-radius:7px;background:#0d0f13;color:var(--text);padding:10px}button{border:0;border-radius:7px;background:var(--accent);color:#07110c;font-weight:750;padding:10px 14px}
    .warning{color:var(--warn)}
  </style>
</head>
<body>
  <div class="shell">
    <aside class="side">
      <div class="brand">D3 Code IDE</div>
      <div class="sub">FastAPI backend · JavaScript frontend</div>
      <div id="profiles"></div>
    </aside>
    <main class="main">
      <section class="card status-grid" id="status"></section>
      <section class="card"><h2 style="margin:0 0 10px;font-size:16px">Tool Routing</h2><div class="routes" id="routes"></div></section>
      <section class="card"><h2 style="margin:0 0 10px;font-size:16px">D3/SB+ Workbench</h2><div class="meta" id="capabilitiesPanel">BASIC builder · file/dictionary builder · SB+ discovery/planning · RAG/manual search</div><div class="tools" style="margin-top:10px"><input id="file" placeholder="File, e.g. BP or CUSTOMERS" /><input id="item" placeholder="Item/process/field" /><button id="buildBasic" type="button">Build BASIC</button><button id="writeDict" type="button">Write Dict</button><button id="createFile" type="button">Create File</button><button id="ragSearchEditor" type="button">RAG</button><button id="sbplusDiscover" type="button">SB+ Discover</button><button id="sbplusPlan" type="button">SB+ Plan</button></div></section>
      <section class="terminal" id="terminal">Loading terminal state...</section>
      <form id="terminalForm"><input id="command" autocomplete="off" placeholder="D3 command or terminal input" /><button type="submit">Send</button></form>
    </main>
  </div>
  <script>
    const $=id=>document.getElementById(id);
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function api(path,opts){const r=await fetch(path,opts);const j=await r.json();if(!r.ok)throw new Error(j.detail||j.error||r.statusText);return j}
    function profileMeta(p,runtime){const bits=[p.type||'local'];if(p.account)bits.push(p.account);if(p.host)bits.push(p.host);bits.push(runtime?.routing?.d3pyAvailable||runtime?.routing?.uopyAvailable?'D3PY/UOPY spike':'D3PY/UOPY blocked');return bits.join(' · ')}
    async function boot(){
      const [status,profiles,runtime,terminal]=await Promise.all([api('/api/status'),api('/api/profiles'),api('/api/python-runtime'),api('/api/terminal/state')]);
      $('status').innerHTML=[
        ['Backend','FastAPI Python'],['Model',status.model],['Safety',status.safety],['Profile',status.profile||'none'],['Mode',status.mode],['Runtime',runtime.available?'online':'offline']
      ].map(([k,v])=>`<div><div class="label">${esc(k)}</div><div class="value">${esc(v)}</div></div>`).join('');
      $('profiles').innerHTML=(profiles.profiles||[]).map(p=>`<section class="profile ${p.name===status.profile?'active':''}"><h3>${esc(p.name)}</h3><div class="meta">${esc(profileMeta(p,runtime))}</div>${p.name===status.profile?'<span class="selected">Selected</span>':''}</section>`).join('')||'<div class="meta">No D3 profiles configured.</div>';
      const routing=runtime.routing||await api('/api/tool-routing');
      $('routes').innerHTML=(routing.routes||[]).map(r=>`<div class="route"><b>${esc(r.mechanism)}</b> <span class="${r.status==='blocked'?'warning':''}">${esc(r.status)}</span><div class="meta">${esc(r.why)}</div></div>`).join('');
      $('terminal').textContent=terminal.transcript||'No terminal transcript yet. FastAPI is the backend; D3PY/UOPY execution is gated until configured and parity-proven.';
    }
    async function showResult(promise){
      try{$('terminal').textContent=JSON.stringify(await promise,null,2)}
      catch(err){$('terminal').textContent=err.message||String(err)}
    }
    $('terminalForm').onsubmit=async e=>{e.preventDefault();const command=$('command').value.trim();if(!command)return;$('command').value='';try{const r=await api('/api/terminal/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command,confirmed:true})});$('terminal').textContent=r.transcript||JSON.stringify(r,null,2)}catch(err){$('terminal').textContent+='\\n> '+command+'\\n'+(err.message||String(err))}};
    $('buildBasic').onclick=()=>showResult(api('/api/basic/build',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,item:$('item').value,source:'',compile:true,confirmed:true})}));
    $('writeDict').onclick=()=>showResult(api('/api/dict',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,item:$('item').value,body:'',confirmed:true})}));
    $('createFile').onclick=()=>showResult(api('/api/file/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:$('file').value,dictModulo:3,dataModulo:11,confirmed:true})}));
    $('ragSearchEditor').onclick=()=>showResult(api('/api/manual-search?query='+encodeURIComponent($('item').value||$('file').value||'SB+ screen definition')));
    $('sbplusDiscover').onclick=()=>showResult(api('/api/sbplus/discover'));
    $('sbplusPlan').onclick=()=>showResult(api('/api/sbplus/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({process:$('item').value,kind:'input process',file:$('file').value,fields:[]})}));
    boot().catch(err=>$('terminal').textContent=err.message||String(err));
  </script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    return ide_html()


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "runtime": "fastapi-python",
        "version": __version__,
        "configPath": str(config_path()),
    }


@app.get("/api/status")
def api_status() -> dict:
    loaded = load_config()
    state = runtime_state()
    profile = select_profile(loaded, state["profile"])
    return {
        "model": state["model"],
        "safety": state["safety"],
        "profile": profile.name if profile else None,
        "mode": state["mode"],
        "backend": "fastapi-python",
        "account": profile.account if profile else None,
    }


@app.get("/config")
def config() -> dict:
    loaded = load_config()
    return {
        "version": loaded.version,
        "defaultModel": loaded.default_model,
        "defaultSafety": loaded.default_safety,
        "defaultProfile": loaded.default_profile,
        "profiles": [asdict(profile) for profile in loaded.profiles],
    }


@app.get("/api/config")
def api_config() -> dict:
    return config()


@app.get("/profiles")
def profiles() -> dict:
    loaded = load_config()
    return {
        "profiles": [asdict(profile) for profile in loaded.profiles],
        "defaultProfile": loaded.default_profile,
    }


@app.get("/api/profiles")
def api_profiles() -> dict:
    return profiles()


@app.get("/connectors")
def connectors() -> dict:
    return {"connectors": [asdict(connector) for connector in connector_statuses()]}


@app.get("/api/connectors")
def api_connectors() -> dict:
    return connectors()


@app.get("/d3py/status")
def d3py_status() -> dict:
    return asdict(next(connector for connector in connector_statuses() if connector.name == "d3py"))


@app.get("/uopy/status")
def uopy_status() -> dict:
    return asdict(next(connector for connector in connector_statuses() if connector.name == "uopy"))


@app.get("/tool-routing")
def routing(profile: Annotated[str | None, Query()] = None) -> dict:
    loaded = load_config()
    return tool_routing_status(select_profile(loaded, profile))


@app.get("/api/tool-routing")
def api_routing(profile: Annotated[str | None, Query()] = None) -> dict:
    state = runtime_state()
    return routing(profile or state["profile"])


@app.get("/api/python-runtime")
def api_python_runtime() -> dict:
    return {
        "runtime": "fastapi-python",
        "available": True,
        "url": None,
        "routing": api_routing(),
    }


@app.get("/api/capabilities")
def api_capabilities() -> dict:
    return {"capabilities": D3_CAPABILITIES, "backend": "fastapi-python"}


@app.get("/api/tools")
def api_tools() -> dict:
    tools = []
    for capability in D3_CAPABILITIES:
        for tool in capability["tools"]:
            tools.append({
                "name": tool,
                "description": f"{capability['label']} ({capability['safety']})",
                "mutates": capability["safety"] == "mutates",
            })
    return {"tools": tools, "backend": "fastapi-python"}


@app.get("/api/terminal/state")
def terminal_state() -> dict:
    loaded = load_config()
    state = runtime_state()
    profile = select_profile(loaded, state["profile"])
    return {
        "profile": profile.name if profile else None,
        "account": profile.account if profile else None,
        "transcript": "",
        "connected": False,
        "mechanism": "fastapi-python",
    }


@app.post("/api/terminal/send")
def terminal_send(request: TerminalRequest) -> dict:
    route = api_routing()
    if not (route.get("d3pyAvailable") or route.get("uopyAvailable")):
        raise HTTPException(
            status_code=501,
            detail="FastAPI is the active backend, but D3PY/UOPY is not configured yet. Configure the Python connector before terminal commands are executed through the backend.",
        )
    raise HTTPException(
        status_code=501,
        detail="D3PY/UOPY is detected, but terminal execution remains gated until connector parity tests are configured for this D3 host.",
    )


@app.post("/api/terminal/reset")
def terminal_reset() -> dict:
    return {"reset": True, "backend": "fastapi-python"}


@app.post("/api/basic/build")
def basic_build(request: BasicBuildRequest) -> dict:
    raise HTTPException(
        status_code=501,
        detail="FastAPI IDE shows the BASIC builder, but D3 mutation execution is gated until D3PY/UOPY parity is configured. Use --server node or the typed CLI builder for live ED/BASIC/CATALOG work.",
    )


@app.post("/api/file/create")
def file_create(request: FileCreateRequest) -> dict:
    raise HTTPException(
        status_code=501,
        detail="FastAPI IDE shows create-file, but D3 mutation execution is gated until D3PY/UOPY parity is configured. Use --server node or d3code create-file for live account changes.",
    )


@app.put("/api/dict")
def dict_write(request: DictWriteRequest) -> dict:
    raise HTTPException(
        status_code=501,
        detail="FastAPI IDE shows dictionary writes, but D3 mutation execution is gated until D3PY/UOPY parity is configured. Use --server node or d3code write-dict for live account changes.",
    )


@app.get("/api/sbplus/discover")
def sbplus_discover() -> dict:
    return {
        "result": "SB+ Discovery is available in the typed Node bridge. FastAPI can display this workbench, but account discovery requires the guarded D3 session layer until D3PY/UOPY parity is configured.",
        "backend": "fastapi-python",
    }


@app.post("/api/sbplus/plan")
def sbplus_plan(request: SbplusPlanRequest) -> dict:
    fields = ", ".join(request.fields or []) or "(not supplied)"
    return {
        "result": "\n".join([
            "# SB+ Builder Plan",
            f"System: {request.system or '(discover in account)'}",
            f"Process: {request.process or '(name required)'}",
            f"Type: {request.kind or 'input process'}",
            f"Primary file: {request.file or '(discover/confirm)'}",
            f"Fields: {fields}",
            "Steps:",
            "1. Confirm the SB+ system, process name, primary file, and local SB+ definition files.",
            "2. Define screen fields, defaults, validations, required flags, and F1/F3 help.",
            "3. Use SB+ maintenance screens or the typed Node D3 bridge for account-specific writes.",
            "4. Run the process once to refresh drivers and capture terminal/screen proof.",
        ]),
        "backend": "fastapi-python",
    }


@app.get("/api/rag/status")
def rag_status() -> dict:
    return {
        "backend": "fastapi-python",
        "available": True,
        "sources": ["reference/operations", "reference"],
        "note": "Python FastAPI is the default server; full manual index parity is the next migration surface.",
    }


@app.get("/api/manual-search")
def manual_search(query: Annotated[str, Query()] = "") -> dict:
    return {
        "query": query,
        "results": [],
        "backend": "fastapi-python",
        "note": "Manual search endpoint is served by FastAPI. Full reference-index parity is pending migration from the legacy Node implementation.",
    }


@app.post("/tools/run")
def run_tool(request: ToolRequest) -> dict:
    route = request.tool.lower()
    if route in {"d3py", "uopy", "d3py-uopy"}:
        available = [connector for connector in connector_statuses() if connector.available]
        if not available:
            raise HTTPException(
                status_code=501,
                detail="D3PY/UOPY is not configured. Set D3CODE_D3PY_* or D3CODE_UOPY_* after installing the connector.",
            )
        raise HTTPException(
            status_code=501,
            detail="Python connector is detected but execution is gated until parity tests are configured for this D3 host.",
        )
    raise HTTPException(status_code=404, detail=f"unknown Python D3 tool route: {request.tool}")
