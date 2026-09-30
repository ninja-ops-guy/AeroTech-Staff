const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {StationClient,stationURL,publicProject}=require('../lib/station.cjs');
const {taskView}=require('../public/projection.js');
const {createServer}=require('../server.cjs');
const {CommandJournal}=require('../lib/commands.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
test('acceptance cannot be inferred from task states',()=>{
  for(const state of ['running','local_verified','review_ready','approved','integrated','completed','accepted']) assert.equal(taskView({state}).accepted,false);
  assert.equal(taskView({state:'approved'}).label,'Approved');
  assert.equal(taskView({state:'completed'}).label,'Unknown state');
});
test('endpoint scope is local and cannot carry credentials or alternate paths',()=>{
  assert.equal(stationURL('http://localhost:8765'),'http://127.0.0.1:8765');
  for(const url of ['https://example.com','http://127.0.0.1.evil:8765','http://user:secret@127.0.0.1:8765','http://127.0.0.1/api','http://127.0.0.1/?token=x']) assert.throws(()=>stationURL(url));
});
test('project projection excludes host settings, paths, lease and tokens',()=>{
  const p=publicProject({id:'p-one',name:'Test',repo:'/private',session_token:'secret',tasks:[{id:'A',state:'running',lease:'secret',owner:null,artifacts:[{id:'p-one:abc',name:'checks.json'},'p-one:def']}]});
  assert.equal(p.repo,undefined);assert.equal(p.session_token,undefined);assert.equal(p.tasks[0].lease,undefined);
  assert.deepEqual(p.tasks[0].artifacts,['p-one:abc','p-one:def']);
});
test('spoof endpoint is rejected before token-bearing request',async()=>{
  let calls=0;
  const client=new StationClient('http://127.0.0.1:8765',{fetchImpl:async()=>{calls++;return new Response(JSON.stringify({token:'x'.repeat(32),version:'0.3.0'}),{headers:{server:'OtherServer','content-type':'application/json'}});}});
  await assert.rejects(client.projects(),e=>e.code==='WRONG_SERVICE');assert.equal(calls,1);assert.equal(client.token,null);
});
test('native event sequence can have gaps across projects, and paginates',async()=>{
  const urls=[];
  const client=new StationClient('http://127.0.0.1:8765',{fetchImpl:async url=>{
    urls.push(url);const p=new URL(url);let data;
    if(p.pathname==='/api/bootstrap')data={version:'0.3.0',token:'x'.repeat(32)};
    else if(p.pathname==='/api/diagnostics')data={event_contract:'LDD workflow v1'};
    else if(p.pathname.endsWith('/events'))data={events:p.searchParams.get('after')==='0'?Array.from({length:500},(_,i)=>({seq:i*2+2,project_id:'p-one'})):[{seq:1002,project_id:'p-one'}]};
    else data={project:{id:'p-one',name:'Mission',tasks:[]}};
    return new Response(JSON.stringify(data),{headers:{server:'ResidualStation/0.3 Python/3.11','content-type':'application/json'}});
  }});
  const r=await client.detail('p-one');assert.equal(r.events.length,501);assert.equal(r.cursor,1002);assert.ok(urls.some(x=>x.endsWith('after=1000')));
});
test('wrong-project event is not admitted',async()=>{
  const client=new StationClient('http://127.0.0.1:8765',{fetchImpl:async url=>new Response(JSON.stringify(url.includes('/events')?{events:[{seq:1,project_id:'p-other'}]}:{project:{id:'p-one',tasks:[]}}),{headers:{server:'ResidualStation/0.3','content-type':'application/json'}})});
  client.token='test';await assert.rejects(client.detail('p-one'),e=>e.code==='INCOMPATIBLE');
});
test('auto port coexists, API requires local session, mutations and hostile origins rejected',async t=>{
  const existing=http.createServer((q,s)=>s.end('existing service'));
  await new Promise(r=>existing.listen(0,'127.0.0.1',r));t.after(()=>existing.close());
  const app=createServer({port:0});const url=await app.start();t.after(()=>app.server.close());
  assert.notEqual(app.server.address().port,existing.address().port);
  assert.equal(await (await fetch('http://127.0.0.1:'+existing.address().port)).text(),'existing service');
  assert.equal((await fetch(url+'/api/status')).status,403);
  const page=await fetch(url);const cookie=page.headers.get('set-cookie').split(';')[0];
  const headers={Cookie:cookie};const status=await (await fetch(url+'/api/status',{headers})).json();
  assert.equal(status.access,'read-only');assert.equal(status.product,'AeroTech Operations');
  assert.equal((await fetch(url+'/api/status',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(url+'/api/status',{headers,method:'POST'})).status,405);
  assert.equal((await fetch(url+'/%2e%2e/server.cjs',{headers})).status,404);
  const collision=createServer({port:existing.address().port});await assert.rejects(collision.start(),e=>e.code==='EADDRINUSE');
});
test('durable command ID is forwarded once, including after journal restart',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aerotech-journal-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let calls=0;
  const client={url:'http://127.0.0.1:8765',command:async()=>{calls++;return {status:'ACKNOWLEDGED',job_id:'j1'};}};
  const input={command_id:crypto.randomUUID(),project_id:'p-one',expected_revision:'a'.repeat(64),action:'run'};
  const first=await new CommandJournal(dir,client).execute(input);const replay=await new CommandJournal(dir,client).execute(input);
  assert.deepEqual(first,replay);assert.equal(calls,1);
  await assert.rejects(new CommandJournal(dir,client).execute({...input,action:'pause'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
});
test('ambiguous dispatch is never retried, and fences new commands for its mission',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aerotech-journal-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let calls=0;
  const client={url:'http://127.0.0.1:8765',command:async()=>{calls++;throw new Error('connection died after send');}};
  const input={command_id:crypto.randomUUID(),project_id:'p-one',expected_revision:'a'.repeat(64),action:'run'};
  assert.equal((await new CommandJournal(dir,client).execute(input)).status,'OUTCOME_UNKNOWN');
  assert.equal((await new CommandJournal(dir,client).execute(input)).status,'OUTCOME_UNKNOWN');assert.equal(calls,1);
  await assert.rejects(new CommandJournal(dir,client).execute({...input,command_id:crypto.randomUUID()}),e=>e.code==='OUTCOME_UNKNOWN');
});
test('changed task revision prevents command forwarding',async()=>{
  let posts=0;const p={id:'p-one',tasks:[{id:'A',state:'running',attempt:1}]};
  const client=new StationClient('http://127.0.0.1:8765',{fetchImpl:async(url,options)=>{if(options.method==='POST')posts++;return new Response(JSON.stringify({project:p}),{headers:{server:'ResidualStation/0.3','content-type':'application/json'}});}});
  client.token='existing';await assert.rejects(client.command({project_id:'p-one',action:'run',expected_revision:'0'.repeat(64)}),e=>e.code==='REVISION_CONFLICT');assert.equal(posts,0);
});
