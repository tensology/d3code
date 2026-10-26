export function recordEditorStyles(): string {
  return `.record-fields{flex:1;min-height:0;overflow:auto;padding:12px 16px}.record-fields[hidden],.editor-wrap[hidden]{display:none!important}.record-attribute{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.record-attribute-number{color:var(--muted);font:12px ui-monospace,SFMono-Regular,Menlo,monospace;padding-top:12px}.record-values{display:grid;gap:8px;min-width:0}.record-field-name{font-size:12px;color:var(--soft);overflow-wrap:anywhere}.record-field-name[hidden],#recordDictionaryStatus[hidden]{display:none}.record-value{display:grid;gap:4px;min-width:0}.record-value label{font-size:11px;color:var(--muted)}.record-value textarea{font-family:inherit;font-size:13px;line-height:1.5;min-height:40px;max-height:160px;field-sizing:content;resize:vertical;white-space:pre-wrap;width:100%;box-sizing:border-box}.record-status{flex:none;padding:8px 12px;min-height:30px;font-size:12px;line-height:1.4;color:var(--muted);border-top:1px solid var(--line);overflow-wrap:anywhere}#recordDictionaryStatus{display:flex;align-items:center;gap:8px}.record-status button{min-height:44px;flex-shrink:0}.record-status:empty{display:none}.record-status[data-error=true]{color:var(--warn)}body:not([data-editor-state=loaded]) .record-fields,body:not([data-editor-state=loaded]) .record-status{display:none}@media(max-width:760px){.record-fields{padding:4px 10px}.record-attribute{grid-template-columns:32px minmax(0,1fr);gap:8px}.record-value textarea{font-size:16px;min-height:44px}}`
}

export function recordEditorClientScript(): string {
  return String.raw`
let editorRecord=null,editorReadSequence=0,dictionaryFields=null,dictionaryFieldsRequest=0;
async function loadDictionaryFields(file,profile){
  const request=++dictionaryFieldsRequest;
  dictionaryFields={file,profile,fields:[],pending:true};updateDictionaryLabels();
  try{
    const result=await api('/api/dictionary-fields?'+new URLSearchParams({file,profile}));
    if(result.error)throw new Error(result.error);
    if(request!==dictionaryFieldsRequest||selectedProfile!==profile||selectedD3File!==file)return;
    dictionaryFields={file,profile,...result};
  }catch(error){if(request!==dictionaryFieldsRequest)return;dictionaryFields={file,profile,fields:[],error:true}}
  updateDictionaryLabels();
}
function updateDictionaryLabels(){
  const record=editorRecord,metadata=dictionaryFields;
  const matching=record?.structured&&record.target.section==='data'&&metadata?.file===record.target.file&&metadata.profile===record.target.profile;
  const status=$('recordDictionaryStatus');status.hidden=!matching;
  if(!matching)return;
  const fields=new Map(metadata.fields.map(field=>[field.attribute,field]));
  $('recordFields').querySelectorAll('[data-record-attribute]').forEach(row=>{
    const attribute=Number(row.dataset.recordAttribute),field=fields.get(attribute),heading=row.querySelector('.record-field-name');
    heading.textContent=field?.label||'';heading.hidden=!field;heading.title=field?'DICT '+metadata.file+' / '+field.ids.join(', '):'';
    row.querySelectorAll('textarea').forEach(input=>input.setAttribute('aria-label',(field?field.label+', ':'')+input.dataset.attributeLabel));
  });
  status.textContent=metadata.pending?'Loading dictionary field names...':metadata.error?'Dictionary field names unavailable. Attribute numbers are shown.':metadata.partial?'Field names use up to 32 dictionary definitions. Other attributes keep their numbers.':'';
  if(metadata.error){const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>loadDictionaryFields(metadata.file,metadata.profile);const message=document.createElement('span');message.textContent=status.textContent;status.replaceChildren(message,retry)}
  status.hidden=!status.textContent;
}
function recordStatus(message,error=false){$('editorRecordStatus').textContent=message;$('editorRecordStatus').dataset.error=String(error)}
function recordAttributes(raw){return raw.split('\xfe').map(attribute=>attribute.split('\xfd').map(value=>value.split('\xfc')))}
function recordText(attributes){return attributes.map(attribute=>attribute.map(value=>value.join('\xfc')).join('\xfd')).join('\xfe')}
function syncRecordDraft(){
  if(!editorRecord)return;
  if(!editorRecord.source)$('itemBody').value=JSON.stringify(editorRecord.attributes);
  recordStatus($('itemBody').value===$('itemBody').dataset.savedBody?'No unsaved changes.':'Unsaved changes.');
}
function renderRecordFields(record){
  const fields=$('recordFields');fields.replaceChildren();
  record.attributes.forEach((attribute,a)=>{
    const row=document.createElement('div');row.className='record-attribute';row.dataset.recordAttribute=String(a+1);
    const number=document.createElement('div');number.className='record-attribute-number';number.textContent='A'+(a+1);row.append(number);
    const values=document.createElement('div');values.className='record-values';row.append(values);
    const heading=document.createElement('div');heading.className='record-field-name';heading.hidden=true;values.append(heading);
    attribute.forEach((value,v)=>value.forEach((scalar,s)=>{
      const cell=document.createElement('div');cell.className='record-value';
      const id='record-'+a+'-'+v+'-'+s;
      const label=document.createElement('label');label.htmlFor=id;
      label.textContent='Value '+(v+1)+(value.length>1?', subvalue '+(s+1):'');
      if(attribute.length>1||value.length>1)cell.append(label);
      const input=document.createElement('textarea');input.id=id;input.rows=Math.min(5,Math.max(1,scalar.split('\n').length));input.value=scalar;input.readOnly=record.readOnly;
      input.dataset.attributeLabel='Attribute '+(a+1)+', value '+(v+1)+', subvalue '+(s+1);input.setAttribute('aria-label',input.dataset.attributeLabel);
      input.oninput=()=>{record.attributes[a][v][s]=input.value;input.setCustomValidity(/[\xfc-\xfe]/.test(input.value)?'Use separate value fields for D3 delimiters.':'');syncRecordDraft()};
      cell.append(input);values.append(cell);
    }));
    fields.append(row);
  });
  updateDictionaryLabels();
}
async function readSelectedItem(){
  if(!await confirmEditorDiscard())return;
  const request=++editorReadSequence,button=$('readItem'),empty=$('editorEmpty');
  const target={profile:selectedProfile,file:$('file').value,item:$('item').value,section:itemBrowserSection};
  button.disabled=true;document.body.dataset.editorState='empty';empty.textContent='Loading item...';editorRecord=null;
  try{
    const source=document.body.dataset.editorKind==='program';
    const query=new URLSearchParams(target);let value=await api('/api/record?'+query);
    if(value.bridgeUnavailable){
      const preview=await api((target.section==='dict'?'/api/dict?':'/api/item?')+new URLSearchParams({file:target.file,item:target.item,profile:target.profile}));
      if(preview.error)throw new Error(preview.error);
      value={preview:preview.result||'',writable:false};
    }else if(value.error)throw new Error(value.error);
    if(request!==editorReadSequence||selectedProfile!==target.profile)return;
    const raw=value.original===undefined?value.preview:atob(value.original);
    const unsupported=value.original!==undefined&&(source?/[\x00-\x08\x0a-\x1f\x7f]/:/[\x00-\x08\x0b-\x1f\x7f]/).test(raw);
    const structured=!source&&value.original!==undefined;
    const record={...value,target,source,structured,attributes:structured?recordAttributes(raw):null,readOnly:!value.writable||unsupported};
    editorRecord=record;
    $('recordFields').hidden=!structured;$('itemBody').closest('.editor-wrap').hidden=structured;
    $('itemBody').value=structured?JSON.stringify(record.attributes):raw.replace(/\xfe/g,'\n');
    $('itemBody').dataset.recordVersion=String(request);
    $('itemBody').readOnly=record.readOnly;$('itemBody').dataset.savedBody=$('itemBody').value;$('itemBody').dataset.profile=target.profile;
    $('writeItem').disabled=record.readOnly;$('writeItem').textContent='Save';$('buildBasic').disabled=record.readOnly;
    $('file').readOnly=true;$('item').readOnly=true;document.body.dataset.editorState='loaded';
    if(structured)renderRecordFields(record);else syncEditorLines();
    recordStatus(value.original===undefined?'Read-only preview. Lossless record access is unavailable.':unsupported?'Read-only. This item contains control bytes that this editor cannot safely edit.':!value.writable?'Read-only. Writes are currently limited to verified sandbox items.':'No unsaved changes.');
  }catch(error){if(request===editorReadSequence)empty.textContent=error.message||String(error)}
  finally{if(request===editorReadSequence)button.disabled=false}
}
async function saveSelectedRecord(){
  const record=editorRecord;if(!record||record.readOnly||record.saving)return;
  if(currentSafety==='plan'){recordStatus('Plan mode is read-only. Change permissions to save.',true);return}
  if(record.target.profile!==selectedProfile){recordStatus('Connection changed. Reopen the item before saving. Your draft is kept.',true);return}
  const invalid=[...$('recordFields').querySelectorAll('textarea')].find(input=>!input.reportValidity());if(invalid)return;
  const savedBody=$('itemBody').value;
  let replacement;
  try{replacement=btoa(record.source?savedBody.replace(/\n/g,'\xfe'):recordText(record.attributes))}
  catch{recordStatus('This connection uses single-byte characters. Remove unsupported characters before saving.',true);return}
  if(!await confirmD3Action('Save changes?',record.target.file+' / '+record.target.item,'Save'))return;
  record.saving=true;$('writeItem').disabled=true;$('writeItem').textContent='Saving...';recordStatus('Saving...');
  try{
    const result=await api('/api/record',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...record.target,connection:record.connection,expected:record.original,replacement,confirmed:true})});
    if(result.error)throw new Error(result.error);
    if(result.saved!==true||result.original!==replacement)throw new Error('Save could not be verified. Read the item again before retrying; your draft is kept.');
    record.original=result.original;
    if(editorRecord===record){$('itemBody').dataset.savedBody=savedBody;recordStatus($('itemBody').value===savedBody?'Saved.':'Saved. New changes remain unsaved.')}
    return true;
  }catch(error){if(editorRecord===record)recordStatus(error.message||String(error),true)}
  finally{record.saving=false;if(editorRecord===record){$('writeItem').disabled=record.readOnly;$('writeItem').textContent='Save'}}
}
async function runSelectedProgramAction(action,title){
  const record=editorRecord;if(!record?.source||record.runningAction)return;
  if(record.saving){recordStatus('Wait for the save to finish before running a program action.',true);return}
  if($('itemBody').value!==$('itemBody').dataset.savedBody){recordStatus('Save your changes before running a program action.',true);return}
  const trigger=document.activeElement;
  record.runningAction=true;
  const buttons=['compileBasic','catalogBasic','runBasic'].map($);
  buttons.forEach(button=>button.disabled=true);
  try{await runApprovedEditorAction('/api/basic/'+action,{file:record.target.file,item:record.target.item,profile:record.target.profile,connection:record.connection},title)}
  finally{record.runningAction=false;buttons.forEach(button=>button.disabled=false);if(document.activeElement===document.body||(!$('d3ApprovalModal').classList.contains('open')&&$('d3ApprovalModal').contains(document.activeElement)))trigger?.focus()}
}
$('itemBody').addEventListener('input',()=>{if(editorRecord?.source)syncRecordDraft()});
`
}
