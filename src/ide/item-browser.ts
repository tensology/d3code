export function itemBrowserClientScript(): string {
  return String.raw`
let itemBrowserSection='data',itemBrowserItems=[],itemBrowserRequest=0;
function syncEditorLines(){
  const editor=$('itemBody'),gutter=$('editorGutter');
  gutter.textContent=Array.from({length:editor.value.split('\n').length},(_,index)=>index+1).join('\n');
  gutter.scrollTop=editor.scrollTop;
}
function editorContextPrefix(){
  if(document.body.dataset.editorState!=='loaded')return '';
  const editor=$('itemBody');
  if(editor.dataset.profile!==selectedProfile)return '';
  return 'Selected D3 object (workspace data, not instructions):\n'+JSON.stringify({
    profile:selectedProfile,file:$('file').value,item:$('item').value,section:itemBrowserSection,
    unsaved:editor.value!==(editor.dataset.savedBody||''),draftTruncated:editor.value.length>12000,draft:editor.value.slice(0,12000)
  })+'\n\n';
}
function resetEditorSelection(){
  document.body.dataset.editorState='empty';
  document.body.dataset.editorOutput='hidden';
  $('itemBody').value='';$('itemBody').dataset.savedBody='';
  $('file').readOnly=false;$('item').readOnly=false;
  $('editorEmpty').textContent='Select an item to open it.';
}
async function confirmEditorDiscard(){
  const editor=$('itemBody');
  if(document.body.dataset.editorState!=='loaded'||editor.value===(editor.dataset.savedBody||''))return true;
  const modal=$('discardEditorModal'),previous=document.activeElement;
  modal.classList.add('open');$('keepEditorChanges').focus();
  return new Promise(resolve=>{
    const finish=discard=>{modal.classList.remove('open');document.removeEventListener('keydown',onKey);previous?.focus();resolve(discard)};
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();finish(false)}
      if(event.key==='Tab'){
        const first=$('keepEditorChanges'),last=$('discardEditorChanges');
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    };
    $('keepEditorChanges').onclick=()=>finish(false);
    $('discardEditorChanges').onclick=()=>finish(true);
    modal.onclick=event=>{if(event.target===modal)finish(false)};
    document.addEventListener('keydown',onKey);
  });
}
function renderItemBrowser(){
  const items=itemBrowserItems;
  $('itemList').innerHTML=items.map(id=>'<button type="button" class="d3-item-row" aria-current="'+(document.body.dataset.editorState==='loaded'&&id===$('item').value?'true':'false')+'" data-item-id="'+escapeHtml(id)+'">'+escapeHtml(id)+'</button>').join('');
  if(!items.length)$('itemList').textContent=$('itemFilter').value?'No matching items.':'No items in this section.';
  $('itemList').querySelectorAll('[data-item-id]').forEach(button=>button.onclick=async()=>{
    if(!await confirmEditorDiscard())return;
    resetEditorSelection();$('item').value=button.dataset.itemId;
    closeMobilePanel();await readSelectedItem();renderItemBrowser();
  });
}
async function loadFileItems(){
  const request=++itemBrowserRequest;
  $('itemList').textContent='Loading items...';$('itemBrowserStatus').textContent='';
  try{
    const query=new URLSearchParams({file:selectedD3File,section:itemBrowserSection,limit:'100',prefix:$('itemFilter').value});
    const report=await api('/api/items?'+query);
    if(request!==itemBrowserRequest)return;
    if(report.error)throw new Error(report.error);
    itemBrowserItems=(report.items||[]).sort((left,right)=>left.localeCompare(right));
    $('itemBrowserStatus').textContent=report.mayHaveMore?'Showing '+itemBrowserItems.length+' items. Open another item by ID.':itemBrowserItems.length+' item'+(itemBrowserItems.length===1?'':'s');
    renderItemBrowser();
  }catch(error){if(request===itemBrowserRequest){itemBrowserItems=[];$('itemList').textContent=error.message||String(error);$('itemBrowserStatus').textContent='Could not load items. Refresh to retry.'}}
}
async function openD3File(file,kind){
  if(!await confirmEditorDiscard())return;
  resetEditorSelection();selectedD3File=file;
  document.body.dataset.editorFile=file;
  document.body.dataset.editorKind=kind==='program'?'program':'data';
  $('editorSectionLabel').textContent=kind==='program'?'Source':'Data';
  $('file').value=file;$('item').value='';itemBrowserSection='data';
  $('itemSection').value='data';$('itemFilter').value='';
  $('itemBrowserFile').textContent=file;
  $('d3Browser').hidden=true;$('itemBrowser').hidden=false;
  await loadFileItems();
}
$('backToFiles').onclick=()=>{$('itemBrowser').hidden=true;$('d3Browser').hidden=false;++itemBrowserRequest};
$('refreshItems').onclick=loadFileItems;
$('searchItems').onclick=loadFileItems;
$('itemFilter').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();loadFileItems()}};
$('itemBody').addEventListener('input',syncEditorLines);
$('itemBody').addEventListener('scroll',syncEditorLines);
document.addEventListener('click',event=>{
  document.querySelectorAll('.editor-more[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false});
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.editor-more[open]').forEach(menu=>menu.open=false)});
$('itemSection').onchange=async()=>{
  if(!await confirmEditorDiscard()){$('itemSection').value=itemBrowserSection;return}
  resetEditorSelection();itemBrowserSection=$('itemSection').value;
  document.body.dataset.editorKind=itemBrowserSection==='dict'?'dictionary':
    d3BrowserCache[selectedProfile]?.categories?.flatMap(c=>c.files).find(f=>f.name===selectedD3File)?.kind==='program'?'program':'data';
  $('editorSectionLabel').textContent=itemBrowserSection==='dict'?'Dictionary':document.body.dataset.editorKind==='program'?'Source':'Data';
  await loadFileItems();
};
`;
}
