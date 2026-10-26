import {chromium} from '/Users/paul/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='/tmp/d3-approval-ui-evidence';fs.mkdirSync(dir,{recursive:true});
const writes=()=>fs.existsSync('/tmp/d3-approval-fixture-writes.jsonl')?fs.readFileSync('/tmp/d3-approval-fixture-writes.jsonl','utf8').trim().split('\n').filter(Boolean).length:0;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
for(const width of[390,768,1280,1440])for(const theme of['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const before=writes();
  await page.goto('http://127.0.0.1:3742');await page.locator('#chatModeButton').click();await page.evaluate(theme=>document.body.dataset.theme=theme,theme);
  await page.locator('#chatPrompt').fill('Create a D3 sandbox item');await page.getByRole('button',{name:'Send message',exact:true}).click();
  const card=page.locator('#chatOutput .approval-event');await card.getByRole('button',{name:'Review',exact:true}).waitFor();assert.equal(writes(),before);
  assert.match(await card.innerText(),/Create item.*Waiting for approval/s);await page.screenshot({path:`${dir}/${width}-${theme}-pending.png`});
  const stored=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));assert.ok(!stored.includes('onerror=window'));assert.ok(!stored.includes('"baseline"'));
  await card.getByRole('button',{name:'Review',exact:true}).click();await page.getByRole('dialog',{name:'Create item?'}).waitFor();assert.match(await page.locator('#d3ApprovalDetail').innerText(),/After:[\s\S]*<img/);assert.equal(await page.locator('#d3ApprovalDetail img').count(),0);assert.equal(await page.evaluate(()=>window.approvalXss),undefined);assert.equal(await page.locator('#cancelD3Approval').evaluate(el=>el===document.activeElement),true);
  await page.screenshot({path:`${dir}/${width}-${theme}-review.png`});await page.locator('#cancelD3Approval').click();assert.equal(writes(),before);await card.getByRole('button',{name:'Review',exact:true}).waitFor();
  await page.reload();await page.locator('#chatModeButton').click();await page.evaluate(theme=>document.body.dataset.theme=theme,theme);await card.getByRole('button',{name:'Review',exact:true}).waitFor();assert.equal(await card.count(),1);await page.waitForTimeout(500);assert.equal(await page.locator("#chatOutput .typing-row").count(),0);await page.screenshot({path:`${dir}/${width}-${theme}-reloaded.png`});
  await card.getByRole('button',{name:'Review',exact:true}).click();await page.getByRole('dialog',{name:'Create item?'}).waitFor();await page.locator('#approveD3Action').click();await page.waitForFunction(()=>document.querySelector('#chatOutput .approval-state')?.textContent==='Approved');await page.getByRole('button',{name:'Stop agent',exact:true}).waitFor({state:'hidden'});assert.equal(writes(),before+1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.evaluate(()=>window.approvalXss),undefined);assert.deepEqual(errors,[]);await page.screenshot({path:`${dir}/${width}-${theme}-approved.png`});await context.close();
}
for(const [scenario,prompt]of[['declined','Create D3 sandbox item'],['conflict','Create D3 sandbox conflict'],['replace','replace D3 sandbox item']]){
  const context=await browser.newContext({viewport:{width:390,height:1000}}),page=await context.newPage(),before=writes();await page.goto('http://127.0.0.1:3742');await page.locator('#chatModeButton').click();await page.locator('#chatPrompt').fill(prompt);await page.getByRole('button',{name:'Send message',exact:true}).click();const card=page.locator('#chatOutput .approval-event');await card.getByRole('button',{name:'Review',exact:true}).waitFor();
  if(scenario==='declined')await card.getByRole('button',{name:'Decline',exact:true}).click();
  else{await card.getByRole('button',{name:'Review',exact:true}).click();await page.locator('#d3ApprovalModal.open').waitFor();if(scenario==='replace'){assert.match(await page.locator('#d3ApprovalDetail').innerText(),/Before:[\s\S]*OLD[\s\S]*After:/);await page.screenshot({path:`${dir}/390-light-replacement-review.png`})}await page.locator('#approveD3Action').click()}
  await page.getByRole('button',{name:'Stop agent',exact:true}).waitFor({state:'hidden'});if(scenario==='replace')assert.equal(writes(),before+1);else assert.equal(writes(),before);
  if(scenario!=='replace')assert.match(await page.locator('#chatOutput .tool-event:not(.approval-event) .tool-status').last().innerText(),/blocked/);await page.screenshot({path:`${dir}/390-light-${scenario}.png`});await context.close();
}
console.log('PASS: 24 primary screens, reload/resume, exact-once approval, safe source text, cancellation, decline, replacement preview and failed-write status');
}finally{await browser.close()}
