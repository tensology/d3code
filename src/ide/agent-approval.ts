export function agentApprovalStyles(): string {
  return `#d3ApprovalModal .settings-form-actions{gap:8px}.approval-event{padding:12px;display:grid;gap:8px;min-width:0}.approval-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.approval-heading strong{font-size:13px}.approval-state{font-size:11px;color:var(--muted)}.approval-target{margin:0;font-size:12px;line-height:1.5;color:var(--soft);overflow-wrap:anywhere}.approval-actions{display:flex;justify-content:flex-end;gap:8px}.approval-error{font-size:12px;color:var(--warn);overflow-wrap:anywhere}.approval-actions button{min-height:32px}@media(max-width:760px){.approval-actions button{min-height:44px}}`
}

export function agentApprovalClientScript(): string {
  return String.raw`
const busyApprovalIds=new Set(),reconcilingApprovalChats=new Set();
let reviewingApprovalId=null;
function chatAwaitingApproval(chatId){return Boolean(chatById(chatId)?.messages?.some(message=>message.kind==='approval'&&message.status==='pending'))}
function approvalAction(name){return {d3_create_item:'Create item',d3_write_item:'Replace item',d3_write_dict:'Replace dictionary item',d3_build_basic_program:'Build program',d3_compile_basic:'Compile program',d3_catalog:'Catalog program',d3_create_file:'Create file',d3_login:'Switch account',d3_call_subroutine:'Call subroutine',d3_tcl:'Run command'}[name]||'Run D3 action'}
function approvalLabel(status){return {pending:'Waiting for approval',approved:'Approved',declined:'Declined',expired:'Expired',cancelled:'Cancelled',invalidated:'Settings changed',unavailable:'No longer pending'}[status]||'No longer pending'}
function renderApprovalNode(node,message){
  node.className='tool-event approval-event';node.dataset.approvalId=message.approvalId;
  node.innerHTML='<div class="approval-heading"><strong></strong><span class="approval-state" role="status"></span></div><p class="approval-target"></p><div class="approval-error" role="status"></div>';
  node.querySelector('strong').textContent=approvalAction(message.name);
  node.querySelector('.approval-state').textContent=approvalLabel(message.status);
  node.querySelector('.approval-target').textContent=message.target||'';
  node.querySelector('.approval-error').textContent=message.error||'';
  if(message.status!=='pending')return;
  const actions=document.createElement('div');actions.className='approval-actions';
  for(const [label,handler]of[['Decline',()=>submitApproval(message,false)],['Review',()=>reviewApproval(message)]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=busyApprovalIds.has(message.approvalId);if(label==='Review')button.className='primary';button.onclick=handler;actions.append(button);
  }
  node.append(actions);
}
function refreshApprovalNode(message){document.querySelectorAll('[data-approval-id]').forEach(node=>{if(node.dataset.approvalId===message.approvalId)renderApprovalNode(node,message)})}
function setApprovalStatus(message,status,error=''){message.status=status;message.error=error;saveChats();refreshApprovalNode(message)}
function receiveApproval(chatId,jobId,pending){
  if(!pending?.id||!pending.proposal)return;
  const chat=chatById(chatId);if(!chat)return;
  if(chat.messages.some(message=>message.kind==='approval'&&message.approvalId===pending.id)){if(chatId===activeChatId)removeTypingRows();return}
  const proposal=pending.proposal,input=proposal.input||{};
  chat.messages=chat.messages.filter(message=>!(message.kind==='tool'&&message.status==='running'));
  if(chatId===activeChatId){removeTypingRows();chatOutputs().forEach(out=>out.querySelectorAll('.tool-event.running').forEach(node=>node.remove()));activeToolNode=null}
  const target=[proposal.profile,proposal.account,proposal.host,input.file?(input.section==='dict'||proposal.name==='d3_write_dict'?'DICT ':'')+input.file+(input.item?' / '+input.item:''):''].filter(Boolean).join(' / ');
  appendMessage({kind:'approval',role:'tool',chatId,jobId,approvalId:pending.id,name:proposal.name,target,status:'pending'},{chatId});
}
function resolveApprovalMessage(chatId,id,reason){const message=chatById(chatId)?.messages?.find(message=>message.kind==='approval'&&message.approvalId===id);if(message)setApprovalStatus(message,reason);if(reviewingApprovalId===id&&$('d3ApprovalModal').classList.contains('open'))$('cancelD3Approval').click()}
async function currentApproval(message){
  const job=await api('/api/agent/job?chat_id='+encodeURIComponent(message.chatId));
  if(job.job_id===message.jobId&&job.pending_approval?.id===message.approvalId)return job.pending_approval;
  const resolved=(job.events||[]).slice().reverse().find(event=>event.type==='approval_resolved'&&event.data?.approval_id===message.approvalId);
  setApprovalStatus(message,resolved?.data?.reason||'unavailable');return null;
}
function approvalDetail(proposal){
  const input=proposal.input||{},lines=[proposal.profile+' / '+(proposal.account||'no account')+(proposal.host?' at '+proposal.host:'')];
  if(input.file)lines.push((input.section==='dict'||proposal.name==='d3_write_dict'?'DICT ':'')+input.file+(input.item?' / '+input.item:''));
  const readable=value=>String(value).replace(/\xfe/g,'\n').replace(/\xfd/g,' <value> ').replace(/\xfc/g,' <subvalue> ').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,char=>{const code=char.charCodeAt(0);return(code>255?'\\u':'\\x')+code.toString(16).padStart(code>255?4:2,'0')});
  if(['d3_write_item','d3_write_dict','d3_build_basic_program'].includes(proposal.name)){
    if(typeof input.baseline?.original!=='string')throw new Error('Read the existing item with a lossless baseline before requesting this change.');
    let before;try{before=atob(input.baseline.original)}catch{throw new Error('The record baseline cannot be reviewed. Decline and read the item again.')}
    lines.push('','Before:',readable(before)||'(empty item)');
  }
  const body=typeof input.body==='string'?input.body:typeof input.source==='string'?input.source:null;
  if(body!==null)lines.push('','After:',readable(body)||'(empty item)');
  const settings=Object.fromEntries(Object.entries(input).filter(([key])=>!['confirmed','baseline','body','source','file','item','section'].includes(key)));
  if(Object.keys(settings).length)lines.push('',typeof input.command==='string'?readable(input.command):JSON.stringify(settings,null,2));
  return lines.join('\n');
}
async function submitApproval(message,approved){
  if(busyApprovalIds.has(message.approvalId))return;
  busyApprovalIds.add(message.approvalId);refreshApprovalNode(message);
  try{
    if(!await currentApproval(message))return;
    const result=await api('/api/agent/approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:message.chatId,job_id:message.jobId,approval_id:message.approvalId,approved})});
    if(result.error){await currentApproval(message);if(message.status==='pending')message.error='Approval could not be submitted. Refresh the workspace and try again.';return}
    setApprovalStatus(message,approved?'approved':'declined');
  }catch{message.error='Approval could not be submitted. Refresh the workspace and try again.'}
  finally{busyApprovalIds.delete(message.approvalId);saveChats();refreshApprovalNode(message)}
}
async function reviewApproval(message){
  if(reviewingApprovalId||busyApprovalIds.has(message.approvalId))return;
  reviewingApprovalId=message.approvalId;busyApprovalIds.add(message.approvalId);refreshApprovalNode(message);
  let approved=false;
  try{const pending=await currentApproval(message);if(!pending||message.status!=='pending')return;approved=await confirmD3Action(approvalAction(pending.proposal.name)+'?',approvalDetail(pending.proposal),'Approve')}
  catch(error){message.error=error?.message||'Approval could not be reviewed. Refresh the workspace and try again.'}
  finally{reviewingApprovalId=null;busyApprovalIds.delete(message.approvalId);saveChats();refreshApprovalNode(message)}
  if(approved)await submitApproval(message,true);
}
async function reconcileChatApprovals(chatId){
  const pending=chatById(chatId)?.messages?.filter(message=>message.kind==='approval'&&message.status==='pending')||[];
  if(!pending.length||reconcilingApprovalChats.has(chatId))return;
  reconcilingApprovalChats.add(chatId);
  try{
    const job=await api('/api/agent/job?chat_id='+encodeURIComponent(chatId));
    for(const message of pending){
      if(job.job_id===message.jobId&&job.pending_approval?.id===message.approvalId)continue;
      const resolved=(job.events||[]).slice().reverse().find(event=>event.type==='approval_resolved'&&event.data?.approval_id===message.approvalId);
      setApprovalStatus(message,resolved?.data?.reason||'unavailable');
    }
  }catch{}finally{reconcilingApprovalChats.delete(chatId)}
}
`
}
