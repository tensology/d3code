import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '/Users/paul/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const remote = (input) => execFileSync('ssh', ['-o','BatchMode=yes','root@tensology.com','cd /var/www/tensology.com/backend/webapp && /opt/venvs/tensology/bin/python manage.py shell'], {input, encoding:'utf8', maxBuffer:1024*1024});
const created = remote(`import json\nfrom django.contrib.sessions.backends.db import SessionStore\nfrom main.models import CustomerEmployee\nactors=[CustomerEmployee.objects.get(pk=5),CustomerEmployee.objects.filter(is_active=True,d3code_enabled=False).exclude(customer_id=51).first()]\nresult=[]\nfor actor in actors:\n if actor is None: continue\n s=SessionStore();s.update({'auth_role':'customer_user','customer_id':actor.customer_id,'customer_user_id':actor.pk,'employee_id':actor.pk});s.set_expiry(600);s.save();result.append({'cookie':s.session_key,'allowed':actor.pk==5})\nprint('AUDIT_SESSIONS='+json.dumps(result))\n`);
const sessions = JSON.parse(created.split('\n').find(x=>x.startsWith('AUDIT_SESSIONS=')).slice(15));
let browser, auditContext;
try {
 await mkdir('/tmp/d3code-production-record-evidence',{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const fixture=JSON.parse(execFileSync('cat',['/tmp/d3-record-ui-fixture.json'],{encoding:'utf8'}));
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get('https://tickets.crystallogic.co.za/api/d3code/api/record')).status(),401);await anonymous.close();
 const denied=sessions.find(s=>!s.allowed);const unflagged=await browser.newContext();await unflagged.addCookies([{name:'sessionid',value:denied.cookie,domain:'tickets.crystallogic.co.za',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);assert.equal((await unflagged.request.get('https://tickets.crystallogic.co.za/api/d3code/api/record')).status(),403);await unflagged.close();console.log('PASS record API denies anonymous and unflagged other customer');
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const session=sessions.find(s=>s.allowed);
 await context.addCookies([{name:'sessionid',value:session.cookie,domain:'tickets.crystallogic.co.za',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let staleState=true;await page.route("**/api/d3code/api/terminal/state",async route=>{const response=await route.fetch();const data=await response.json();if(staleState){data.connection="0".repeat(64);staleState=false}await route.fulfill({response,json:data})});
 await page.goto('https://tickets.crystallogic.co.za/dashboard/d3code',{waitUntil:'networkidle'});
 const frame=page.frameLocator('iframe[title="D3Code"]');
 const csrf=(await context.cookies()).find(c=>c.name==='csrftoken')?.value;
 const headers={'X-CSRFToken':csrf,Referer:'https://tickets.crystallogic.co.za/dashboard/d3code'};
 const api='https://tickets.crystallogic.co.za/api/d3code/api/';
 const get=async target=>{const response=await context.request.get(api+'record?'+new URLSearchParams(target));assert.equal(response.status(),200);return response.json()};
 const put=(target,baseline,replacement)=>context.request.put(api+'record',{headers,data:{...target,connection:baseline.connection,expected:baseline.original,replacement,confirmed:true}});
 await frame.getByRole('button',{name:'D3 terminal'}).click();
 await frame.getByRole('button',{name:/^(Connect|Reconnect)$/}).click();
 await frame.getByRole("dialog",{name:"Connection settings changed"}).waitFor();assert.match(await frame.locator("#d3ApprovalDetail").innerText(),/Office demo.*dm.*office.crystallogic.org/);
 for(const width of[1440,1280,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:"/tmp/d3code-production-record-evidence/stale-review-"+width+".png",fullPage:true})}
 await frame.locator("#cancelD3Approval").click();assert.equal((await context.request.get(api+"terminal/state").then(r=>r.json())).connected,false);
 await frame.getByRole("button",{name:/^(Connect|Reconnect)$/}).click();await frame.getByRole("dialog",{name:"Connection settings changed"}).waitFor();await frame.locator("#approveD3Action").click();
 console.log("PASS simulated stale browser snapshot requires target review; Cancel leaves D3 disconnected; approval uses current production settings");
 await frame.getByRole('log',{name:'D3 console transcript'}).filter({hasText:/\d+ dm dm/}).waitFor({timeout:45000});
 for(const width of[1440,1280,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);await page.screenshot({path:'/tmp/d3code-production-record-evidence/stale-reconnected-'+width+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);await context.request.post(api+'terminal/reset',{headers,data:await context.request.get(api+'terminal/state').then(r=>r.json())});await context.close();console.log('PASS branded director workspace, office DM WHO and no JavaScript errors after deployment');
} finally {
  await browser?.close();
  for(const session of sessions) remote(`from django.contrib.sessions.models import Session\nSession.objects.filter(session_key=${JSON.stringify(session.cookie)}).delete()\n`);
  console.log('Test browser closed and temporary login sessions removed');
}
