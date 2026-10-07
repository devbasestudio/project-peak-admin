import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
async function route(existing = false) {
  let removals=0,inserts=0,links=0;
  const assetId=randomUUID();
  const db={storage:{from:()=>({info:async()=>({data:{size:1000}}),remove:async()=>{removals++;}})},from(){
    const chain={select(){return chain;},eq(){return chain;},maybeSingle:async()=>({data:existing?{id:assetId,asset_id:assetId}:null}),
      insert(){inserts++;return chain;},single:async()=>({data:{id:assetId}}),upsert:async()=>{links++;return {error:null};}};
    return chain;
  }};
  const source=await readFile(new URL("../src/app/api/admin/exercise-video-upload/route.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(compiled,{exports,console,require(name){
    if(name==="node:crypto")return {randomUUID};
    if(name==="next/server")return {NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),init)}};
    if(name.endsWith("admin-db"))return {createAdminClient:()=>db,getAuditActorId:async()=>randomUUID(),writeAudit:async()=>{}};
    if(name.endsWith("security"))return {isAllowedOrigin:()=>true};
    if(name.endsWith("session"))return {requireAdminSession:async()=>({id:"session"})};
    throw new Error(name);
  }});
  const id=randomUUID(); const payload={exerciseId:id,role:"primary",path:`shared-exercises/${id}/primary/test.mp4`,mimeType:"video/mp4",fileName:"test.mp4"};
  const request=()=>({json:async()=>payload});
  return {exports,request,counts:()=>({removals,inserts,links})};
}
test("replacement and response-loss cleanup never destroy stored videos",async()=>{
  const r=await route(); assert.equal((await r.exports.PATCH(r.request())).status,200);
  assert.equal((await r.exports.DELETE(r.request())).status,200);
  assert.deepEqual(r.counts(),{removals:0,inserts:1,links:1});
});
test("retrying committed video finalization reuses the original asset",async()=>{
  const r=await route(true); assert.equal((await r.exports.PATCH(r.request())).status,200);
  assert.deepEqual(r.counts(),{removals:0,inserts:0,links:0});
});
