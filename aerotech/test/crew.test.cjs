'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const crew=require('../public/crew.js');
const task=(id,owner='worker-'+id,area='Engineering')=>({id,owner,area,working:true});
test('six workers receive a varied, stable cast across polling, state changes and list order',()=>{
  const roster=crew.makeRoster(),tasks=Array.from({length:6},(_,i)=>task(String(i)));
  roster.sync(tasks);const before=tasks.map(t=>roster.character(t).id);assert.equal(new Set(before).size,6);
  roster.sync(tasks.toReversed().map(t=>({...t,area:'Quality'})));assert.deepEqual(tasks.map(t=>roster.character(t).id),before);
  const same=task('another',tasks[0].owner);roster.sync([...tasks,same]);assert.equal(roster.character(same).id,before[0]);
  assert.equal(roster.choose(tasks[0],'waldo'),true);assert.equal(roster.character(same).id,'waldo');
  const restored=crew.makeRoster({...roster.saved(),invalid:'unknown'});assert.equal(restored.character(tasks[0]).id,'waldo');
  assert.equal(restored.choose(tasks[0],'missing'),false);
});
test('authored frames fit their source sheets and foot pivots stay in the frames',()=>{
  for(const a of crew.atlas){
    const png=fs.readFileSync(path.join(__dirname,'../public/assets',a.file));
    const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
    for(const f of a.frames){const [x,y,w,h]=f.rect;assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height,a.id);assert.ok(f.pivot[0]>=0&&f.pivot[0]<=w&&f.pivot[1]>=0&&f.pivot[1]<=h);}
    for(const index of [...a.idle,...a.walk])assert.ok(a.frames[index]);
  }
});
test('all copied game artwork matches its provenance hash',()=>{
  const manifest=require('../ASSET-MANIFEST.json');for(const a of manifest.assets){const bytes=fs.readFileSync(path.join(__dirname,'..',a.file));assert.equal(bytes.length,a.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);}
});
test('travel uses elapsed time, correct facing and locomotion frames without overshoot',()=>{
  const a=crew.atlas[0],t=task('travel'),target={x:100,y:200};
  let p=crew.pose(null,{x:200,y:200},t,a,0);
  p=crew.pose(p,target,t,a,.05);assert.equal(p.face,-1);assert.ok(a.walk.includes(p.frame));assert.equal(p.x,192.75);
  for(let i=0;i<100;i++)p=crew.pose(p,target,t,a,.016);
  assert.equal(p.x,100);assert.equal(p.y,200);assert.equal(p.moving,false);assert.ok(a.idle.includes(p.frame));
  const advance=(hz)=>{let q=crew.pose(null,{x:0,y:0},t,a,0);for(let i=0;i<hz;i++)q=crew.pose(q,{x:1000,y:0},t,a,1/hz);return q.x;};
  assert.ok(Math.abs(advance(30)-advance(60))<.00001);
});
test('stale and paused poses freeze; reduced motion snaps to an unanimated frame',()=>{
  const a=crew.atlas[0],t=task('freeze'),start=crew.pose(null,{x:10,y:20},t,a,0),target={x:400,y:30};
  const frozen=crew.pose(start,target,t,a,1,{frozen:true});assert.deepEqual(frozen,start);
  const reduced=crew.pose(start,target,t,a,1,{reduced:true});assert.equal(reduced.x,400);assert.equal(reduced.frame,0);assert.equal(reduced.moving,false);
});
test('crowded rooms cap visible seats and preserve unique, deterministic positions',()=>{
  const centers={Engineering:480};const tasks=Array.from({length:9},(_,i)=>task(String(i)));
  const layout=crew.layout(tasks,centers);assert.equal(layout.visible.length,4);assert.equal(layout.hidden,5);
  assert.equal(new Set(layout.visible.map(p=>p.x+','+p.y)).size,4);
  assert.deepEqual(crew.layout(tasks.toReversed(),centers),layout);
});
