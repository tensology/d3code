import {chromium} from "/Users/paul/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir="/tmp/d3-terminal-header-qa";fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
try {
for(const width of [390,768,1280,1440])for(const theme of ["light","dark"]){
const page=await browser.newPage({viewport:{width,height:900}});let fail=false,release;
await page.route("**/api/terminal/reset",r=>r.fulfill({json:fail?{error:"SSH reset failed"}:{}}));
await page.route("**/api/terminal/send",async r=>{await new Promise(resolve=>release=resolve);await r.fulfill({json:{mechanism:"persistent-pty",displayTranscript:"WHO\n7 dm",clean:"7 dm"}})});
await page.goto("http://127.0.0.1:3742");await page.locator("#terminalModeButton").click();await page.evaluate(theme=>document.body.dataset.theme=theme,theme);
await page.locator("#terminalProfile").selectOption("Demo");
for(const state of ["idle","busy","connected","error"]){
if(state==="busy"){await page.locator("#terminalReconnect").click();await page.waitForFunction(()=>document.querySelector("#terminalSessionMeta").textContent==="Waiting for D3 response")}
if(state==="connected"){release();await page.waitForFunction(()=>document.querySelector("#terminalSessionMeta").textContent==="Connected")}
if(state==="error"){fail=true;await page.locator("#terminalReconnect").click();await page.waitForFunction(()=>document.querySelector("#terminalSessionMeta").textContent==="Connection/login issue");assert.match(await page.locator("#terminalMain").innerText(),/WHO[\s\S]*SSH reset failed/)}
const geometry=await page.evaluate(()=>{const sel=document.querySelector("#terminalProfile"),btn=document.querySelector("#terminalProfileEdit"),mark=document.querySelector("#terminalSessionMark"),meta=document.querySelector("#terminalSessionMeta");return{overflow:document.documentElement.scrollWidth>innerWidth,shared:mark.parentElement===meta.parentElement,selectHeight:sel.getBoundingClientRect().height,buttonHeight:btn.getBoundingClientRect().height,font:getComputedStyle(sel).fontSize,delta:Math.abs(mark.getBoundingClientRect().y+mark.getBoundingClientRect().height/2-meta.getBoundingClientRect().y-meta.getBoundingClientRect().height/2)}});
assert.equal(geometry.overflow,false);assert.equal(geometry.shared,true);assert.ok(geometry.delta<2);if(width===390){assert.ok(geometry.selectHeight>=44);assert.ok(geometry.buttonHeight>=44);assert.equal(geometry.font,"16px")}
await page.screenshot({path:`${dir}/${width}-${theme}-${state}.png`});
}
await page.close();
}
console.log("PASS: 32 terminal header states, alignment, containment, mobile target sizes, reconnect failure preserves transcript");
}finally{await browser.close()}
