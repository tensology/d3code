import assert from "node:assert/strict";
import {loadConfig} from "/var/www/d3code/dist/src/config/config.js";
import {basicAuthHeader} from "/var/www/d3code/dist/src/ide/auth.js";
const config=await loadConfig();const authorization=basicAuthHeader(config.ideAuth);
const call=async(actor,path,body)=>{if(body!==undefined&&["/api/terminal/send","/api/terminal/reset"].includes(path)){const target=await call(actor,"/api/terminal/state");body={profile:target.profile,connection:target.connection,...body}}const response=await fetch("http://127.0.0.1:3737"+path,{method:body===undefined?"GET":"POST",headers:{authorization,"content-type":"application/json",...(actor?{"x-d3code-user":actor}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,actor?200:403);return response.json()};
const actors=["900000001","900000002"];
try{
await call(undefined,"/api/status");
for(const actor of actors)await call(actor,"/api/terminal/reset",{});
for(const body of [{command:"WHO"},{command:"WHO",profile:"Office demo",connection:"0".repeat(64)}]){const denied=await fetch("http://127.0.0.1:3737/api/terminal/send",{method:"POST",headers:{authorization,"x-d3code-user":actors[0],"content-type":"application/json"},body:JSON.stringify(body)});assert.equal(denied.status,409);assert.match(await denied.text(),/Connection settings changed/)}
assert.equal((await call(actors[0],"/api/terminal/state")).connected,false);
await call(actors[0],"/api/terminal/send",{command:"WHO"});
const first=await call(actors[0],"/api/terminal/state"),fresh=await call(actors[1],"/api/terminal/state");
assert.equal(first.connected,true);assert.equal(fresh.connected,false);assert.equal(fresh.transcript,"");
await call(actors[1],"/api/terminal/send",{command:"WHO"});const second=await call(actors[1],"/api/terminal/state");
const port=state=>state.transcript.match(/(?:^|\n)\s*(\d+)\s+dm\s+dm\b/i)?.[1];assert.ok(port(first));assert.ok(port(second));assert.notEqual(port(first),port(second));
await call(actors[1],"/api/terminal/reset",{});const after=await call(actors[0],"/api/terminal/state");assert.equal(after.connected,true);assert.equal(after.transcript,first.transcript);
await call(actors[0],"/api/config/safety",{safety:"plan"});assert.equal((await call(actors[1],"/api/status")).safety,"ask");
console.log(JSON.stringify({status:"PASS",identityScope:"two synthetic trusted-proxy actors, not two enabled production users",ports:[port(first),port(second)],checks:["missing trusted identity refused","missing and stale terminal snapshots refused","fresh terminal empty","separate live D3 ports","other user reset leaves session intact","safety setting remains user-local"]}));
}finally{for(const actor of actors)await call(actor,"/api/terminal/reset",{});console.log("Both proof terminal sessions closed")}
