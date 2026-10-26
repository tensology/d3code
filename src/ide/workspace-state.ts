export function workspaceStatusHtml(): string {
  return '<div class="workspace-status" data-workspace-status data-state="loading" role="status" aria-live="polite"><span>Loading workspace...</span><button type="button" data-workspace-retry hidden>Retry</button></div>'
}

export function workspaceStatusStyles(): string {
  return '.workspace-status{display:flex;align-items:center;gap:8px;padding:8px;font-size:12px;line-height:1.4;color:var(--soft)}.workspace-status[hidden]{display:none}.workspace-status span{flex:1;min-width:0;overflow-wrap:anywhere}.workspace-status[data-state=error]{color:var(--warn)}.workspace-status button{flex:none}@media(max-width:760px){.workspace-status button{min-height:44px}}'
}

export function workspaceStateClientScript(): string {
  return String.raw`
let workspaceState='loading',workspaceLoad=0;
function setWorkspaceState(state){
  workspaceState=state;
  document.querySelectorAll('[data-workspace-status]').forEach(node=>{
    node.hidden=state==='ready';node.dataset.state=state;
    node.querySelector('span').textContent=state==='error'?'Workspace could not load. Your draft is kept.':'Loading workspace...';
    const retry=node.querySelector('[data-workspace-retry]');retry.hidden=state!=='error';retry.onclick=()=>boot().catch(()=>{});
  });
  ['chatPrompt','agentPrompt','terminalAgentPrompt'].forEach(id=>$(id)?.setAttribute('aria-busy',String(state==='loading')));
  syncAgentSendButtons();applyChatInputPlaceholders();
}
`
}
