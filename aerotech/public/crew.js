/* Cosmetic character choices and motion. Never writes to host task records. */
(function(root){
  'use strict';
  const atlas=typeof module!=='undefined'&&module.exports?require('./crew-atlas.js'):root.AeroCrewAtlas;
  const byId=new Map(atlas.map(a=>[a.id,a]));
  const keyFor=task=>task.owner?'owner:'+task.owner:'task:'+task.id;
  function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
  function makeRoster(saved={}){
    const assigned=new Map(Object.entries(saved).filter(([key,id])=>typeof key==='string'&&byId.has(id)));
    return {
      sync(tasks){
        const keys=[...new Set(tasks.map(keyFor))].sort();
        const use=new Map(atlas.map(a=>[a.id,0]));
        for(const key of keys){const id=assigned.get(key);if(id)use.set(id,use.get(id)+1);}
        for(const key of keys){if(assigned.has(key))continue;
          const start=hash(key)%atlas.length;let best=atlas[start];
          for(let i=1;i<atlas.length;i++){const a=atlas[(start+i)%atlas.length];if(use.get(a.id)<use.get(best.id))best=a;}
          assigned.set(key,best.id);use.set(best.id,use.get(best.id)+1);
        }
      },
      character(task){return byId.get(assigned.get(keyFor(task)))||atlas[hash(keyFor(task))%atlas.length];},
      choose(task,id){if(!byId.has(id))return false;assigned.set(keyFor(task),id);return true;},
      saved(){return Object.fromEntries(assigned);}
    };
  }
  function pose(previous,target,task,character,dt,{reduced=false,frozen=false}={}){
    const p=previous?{...previous}:{x:target.x,y:target.y,face:1,clock:hash(keyFor(task))%6000,distance:0,frame:0,moving:false};
    if(frozen){p.moving=false;return p;}
    if(reduced){p.x=target.x;p.y=target.y;p.frame=0;p.moving=false;return p;}
    const seconds=Math.min(Math.max(dt,0),.05);p.clock+=seconds*1000;
    const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);
    p.moving=d>.35;
    if(p.moving){
      const step=Math.min(d,seconds*145);p.x+=dx/d*step;p.y+=dy/d*step;p.distance+=step;
      if(Math.abs(dx)>.1)p.face=Math.sign(dx);
      p.frame=character.walk[Math.floor(p.distance/13)%character.walk.length];
    }else{
      p.x=target.x;p.y=target.y;
      const ms=task.working?160:280;
      p.frame=character.idle[Math.floor(p.clock/ms)%character.idle.length];
    }
    return p;
  }
  function layout(tasks,centers){
    const counts={},visible=[];
    // Stable ordering prevents polling or list sorting from reshuffling seats.
    for(const task of [...tasks].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
      const area=task.area==='Repair'?'Engineering':task.area;
      const slot=counts[area]||0;counts[area]=slot+1;
      if(slot>=4||!Number.isFinite(centers[area]))continue;
      visible.push({task,x:centers[area]+(slot%2?62:-62),y:slot<2?476:620});
    }
    return {visible,hidden:tasks.length-visible.length};
  }
  function draw(ctx,image,character,p,{height=character.height,alpha=1}={}){
    if(!image?.complete||!image.naturalWidth)return false;
    const f=character.frames[p.frame]||character.frames[0],r=f.rect,s=height/character.standingHeight;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha*=alpha;
    ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(p.face||1,1);
    ctx.drawImage(image,...r,-f.pivot[0]*s,-f.pivot[1]*s,r[2]*s,r[3]*s);ctx.restore();return true;
  }
  const api={atlas,keyFor,hash,makeRoster,pose,layout,draw};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AeroCrew=api;
})(globalThis);
