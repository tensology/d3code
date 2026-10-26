import {chromium} from '/Users/paul/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='/tmp/d3-program-ui-evidence';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const width of[390,768,1280,1440])for(const theme of['light','dark']){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:3742');await page.locator('#chatList [data-profile-select]').first().waitFor({state:'attached'});await page.locator('#editorModeButton').click();await page.evaluate(theme=>document.body.dataset.theme=theme,theme);
  assert.equal(await page.locator('#runBasic').isVisible(),false);
  await page.locator('[data-d3-file="bp"]').waitFor({state:'attached'});if(!await page.locator('[data-d3-file="bp"]').isVisible())await page.locator('#mobilePanelButton').click();await page.locator('[data-d3-file="bp"]').click();await page.getByRole('button',{name:'D3CODE.RUN.UI',exact:true}).click();await page.locator('#itemBody').waitFor({state:'visible'});assert.equal(await page.locator('#runBasic').isVisible(),true);
  const target={profile:'Office fixture',file:'bp',item:'D3CODE.RUN.UI',section:'data'},read=async()=>{const r=await context.request.get('http://127.0.0.1:3742/api/record?'+new URLSearchParams(target));assert.equal(r.status(),200);return r.json()};
  const original=await read(),source='* '+width+' '+theme+'\nPRINT "RUN UI VERIFIED"\nSTOP';await page.locator('#itemBody').fill(source);await page.locator('#runBasic').click();await page.locator('#editorRecordStatus').filter({hasText:'Save your changes'}).waitFor();assert.equal(await page.locator('#d3ApprovalModal.open').count(),0);
  await page.locator('#writeItem').click();await page.locator('#d3ApprovalModal.open').waitFor();await page.locator('#cancelD3Approval').click();assert.equal((await read()).original,original.original);
  await page.locator('#writeItem').click();await page.locator('#d3ApprovalModal.open').waitFor();await page.locator('#approveD3Action').click();await page.locator('#editorRecordStatus').filter({hasText:/^Saved\.$/}).waitFor();assert.equal(Buffer.from((await read()).original,'base64').toString('latin1'),source.replaceAll('\n','\xfe'));
  await page.screenshot({path:dir+'/'+width+'-'+theme+'-source.png'});
  await page.locator('#compileBasic').click();await page.getByRole('dialog',{name:'Compile program?'}).waitFor();await page.locator('#approveD3Action').click();await page.locator('#editorScreen').filter({hasText:'Successful compile'}).waitFor();await page.getByRole('button',{name:'Hide output',exact:true}).click();
  await page.locator('#runBasic').click();await page.getByRole('dialog',{name:'Run program?'}).waitFor();await page.screenshot({path:dir+'/'+width+'-'+theme+'-review.png'});await page.locator('#cancelD3Approval').click();assert.equal(await page.locator('#editorScreen').isVisible(),false);
  await page.locator('#runBasic').click();await page.getByRole('dialog',{name:'Run program?'}).waitFor();await page.locator('#approveD3Action').click();await page.locator('#editorScreen').filter({hasText:'RUN UI VERIFIED'}).waitFor();await page.screenshot({path:dir+'/'+width+'-'+theme+'-output.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 }finally{await context.close()}
}console.log('PASS: 24 program screens, browse, source save/cancel/readback, unsaved-run denial, compile and approved Run output at four widths and both themes')}
finally{await browser.close()}
