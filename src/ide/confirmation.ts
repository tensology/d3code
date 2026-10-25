export function confirmationHtml(): string {
  return `<div id="d3ApprovalModal" class="modal-backdrop"><div class="settings-form" role="dialog" aria-modal="true" aria-labelledby="d3ApprovalTitle"><div id="d3ApprovalTitle" class="menu-title"></div><pre id="d3ApprovalDetail" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:40vh;overflow:auto"></pre><div class="settings-form-actions"><button id="cancelD3Approval" type="button">Cancel</button><button id="approveD3Action" class="primary" type="button">Approve</button></div></div></div>`
}

export function confirmationClientScript(): string {
  return String.raw`
async function confirmD3Action(title,detail,label='Approve'){
  const modal=$('d3ApprovalModal'),cancel=$('cancelD3Approval'),approve=$('approveD3Action'),previous=document.activeElement;
  $('d3ApprovalTitle').textContent=title;$('d3ApprovalDetail').textContent=detail;approve.textContent=label;
  modal.classList.add('open');cancel.focus();
  return new Promise(resolve=>{
    const finish=value=>{modal.classList.remove('open');document.removeEventListener('keydown',onKey);previous?.focus();resolve(value)};
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();finish(false)}
      if(event.key==='Tab'){
        if(event.shiftKey&&document.activeElement===cancel){event.preventDefault();approve.focus()}
        else if(!event.shiftKey&&document.activeElement===approve){event.preventDefault();cancel.focus()}
      }
    };
    cancel.onclick=()=>finish(false);approve.onclick=()=>finish(true);
    modal.onclick=event=>{if(event.target===modal)finish(false)};
    document.addEventListener('keydown',onKey);
  });
}
async function runApprovedEditorAction(path,payload,title){
  const invoke=confirmed=>api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,confirmed})});
  let result=await invoke(false);
  if(result.error?.startsWith('Confirmation required')){
    if(!await confirmD3Action(title,payload.file+' / '+payload.item,title.split(' ')[0]))return;
    result=await invoke(true);
  }
  show('editorScreen',result);
}
`;
}
