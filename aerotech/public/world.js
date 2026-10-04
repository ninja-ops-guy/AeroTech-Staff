/* TechOps Hero art + StarNet's station document. Rooms are presentation only. */
(function(root){
  'use strict';
  function makeWorld(canvas,onSelect){
    const ctx=canvas.getContext('2d'),crew=root.AeroCrew,images={};
    let saved={};try{saved=JSON.parse(localStorage.getItem('aerotech.crew.v1')||'{}');if(!saved||Array.isArray(saved)||typeof saved!=='object')saved={};}catch{}
    const roster=crew.makeRoster(saved);
    const files={background:'industrial.webp',terminal:'terminal.png',printer:'printer.png'};
    for(const a of crew.atlas)files[a.id]=a.file;
    for(const [key,file] of Object.entries(files)){const im=new Image();im.src='/assets/'+file;images[key]=im;}
    const doc=WorldModel.defaultDoc(1);doc.meta.name='AeroTech Operations';doc.rooms={};doc.order=[];
    ['Dispatch','Engineering','Quality','Release'].forEach((name,i)=>{const id='a'+i;doc.rooms[id]={id,kind:'hab',name,rects:[{x1:i*20,y1:0,x2:i*20+17,y2:10}],floorStyle:'hull',tier:0,floorPaint:{}};doc.order.push(id);});
    doc.meta.spawnRoomId='a0';doc.meta.trunkRoomId='a0';const station=WorldModel.deserialize(doc);
    let tasks=[],selected=null,scope='',stale=false,paused=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hit=[],last=0,hiddenCount=0;const positions=new Map();
    const colors={active:'#b9ed7c',review:'#f2c480',danger:'#f59986',success:'#b4dca9',neutral:'#adc0bd'};
    const round=(x,y,w,h,r=6)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
    function label(text,x,y,{size=13,color='#dce7dc',align='left'}={}){ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.fillText(text,x,y);}
    canvas.width=1280;canvas.height=700;
    function draw(now){
      requestAnimationFrame(draw);
      if(document.hidden){last=0;return;}
      const dt=last?(now-last)/1000:0;last=now;hit=[];
      const w=1280,h=700;ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
      if(images.background.complete&&images.background.naturalWidth)ctx.drawImage(images.background,0,0,1280,880);
      else{ctx.fillStyle='#182729';ctx.fillRect(0,0,w,h);}
      const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#09131adc');shade.addColorStop(.42,'#0b171a75');shade.addColorStop(1,'#071016c9');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
      if(!tasks.length){label('AEROTECH',w-42,130,{size:42,color:'#d1e9cd66',align:'right'});label('OPERATIONS DIVISION',w-42,160,{size:13,color:'#a6c4b788',align:'right'});return;}
      label('TECHOPS CREW',42,166,{size:12,color:'#a9d277'});
      label('Character looks are local · host ownership stays in the task record',w-42,166,{size:11,color:'#adc0bd',align:'right'});
      const centers={};
      station.rooms().forEach((room,i)=>{
        const rect=room.rects[0],center=80+((rect.x1+rect.x2)/2)*14;centers[room.name]=center;
        const group=tasks.filter(t=>t.area===room.name||(room.name==='Engineering'&&t.area==='Repair'));
        ctx.fillStyle='#12231de8';ctx.strokeStyle='#658471';round(center-128,202,256,67);ctx.fill();ctx.stroke();
        label(String(i+1).padStart(2,'0'),center-110,227,{size:11,color:'#a9d277'});label(room.name.toUpperCase(),center-110,248,{size:14});label(String(group.length),center+107,245,{size:24,color:'#b9ed7c',align:'right'});
        ctx.strokeStyle='#aaca7938';ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(center,278);ctx.lineTo(center,373);ctx.stroke();ctx.setLineDash([]);
        const prop=i===1&&group.some(t=>t.area==='Repair')?images.terminal:images.printer;
        if(prop.complete&&prop.naturalWidth){ctx.globalAlpha=.8;ctx.drawImage(prop,center-47,298,94,89);ctx.globalAlpha=1;}
        // Cosmetic station activity, tied only to the recorded active task state.
        if(group.some(t=>t.working)&&!stale&&!paused){ctx.fillStyle='#b9ed7c';ctx.fillRect(center-5,389,10,3);}
        for(const y of [476,620]){ctx.strokeStyle='#79998344';ctx.beginPath();ctx.moveTo(center-120,y+1);ctx.lineTo(center+120,y+1);ctx.stroke();}
      });
      const seating=crew.layout(tasks,centers);hiddenCount=seating.hidden;
      const actors=seating.visible.map(target=>{
        const task=target.task,character=roster.character(task);
        const p=crew.pose(positions.get(task.id),target,task,character,dt,{reduced,frozen:stale||paused});positions.set(task.id,p);
        return {task,character,p};
      }).sort((a,b)=>a.p.y-b.p.y);
      for(const {task,character,p} of actors){
        const x=p.x,y=p.y,color=colors[task.tone]||colors.neutral;
        ctx.fillStyle=task.id===selected?'#c4fb8760':'#0008';ctx.beginPath();ctx.ellipse(x,y,character.height*.30,6,0,0,Math.PI*2);ctx.fill();
        if(!crew.draw(ctx,images[character.id],character,p))label(character.name,x,y-35,{size:11,align:'center'});
        ctx.fillStyle='#0b171df0';ctx.strokeStyle=task.id===selected?'#c1ef84':color+'88';round(x-57,y+8,114,49,4);ctx.fill();ctx.stroke();
        label(character.name.toUpperCase(),x,y+22,{size:9,color:'#e5eddf',align:'center'});
        label((task.owner||task.id).slice(0,18),x,y+36,{size:8,color:'#afbeb2',align:'center'});
        label((stale?'STALE · ':'')+task.label.toUpperCase().slice(0,20),x,y+49,{size:8,color,align:'center'});
        if(task.working&&!stale&&!paused){ctx.fillStyle=color;ctx.globalAlpha=reduced?1:.7+Math.sin(p.clock/300)*.2;ctx.fillRect(x-3,y-character.height-13,6,6);ctx.globalAlpha=1;}
        hit.push({id:task.id,x:x-57,y:y-character.height-16,w:114,h:character.height+73});
      }
      if(hiddenCount)label(`${hiddenCount} additional tasks in the list below`,w-25,692,{size:11,align:'right'});
      if(stale){ctx.fillStyle='#151b2240';ctx.fillRect(0,0,w,h);label('CONNECTION LOST · LAST KNOWN STATE',w/2,128,{size:15,color:'#f2c480',align:'center'});}
      else if(paused)label('MISSION PAUSED · CREW AT REST',w/2,128,{size:15,color:'#f2c480',align:'center'});
    }
    function pointer(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*1280,y:(e.clientY-r.top)/r.height*700};}
    function at(e){const q=pointer(e);return hit.findLast(p=>q.x>=p.x&&q.x<=p.x+p.w&&q.y>=p.y&&q.y<=p.y+p.h);}
    canvas.addEventListener('click',e=>{const a=at(e);if(a)onSelect(a.id);});
    canvas.addEventListener('mousemove',e=>{canvas.style.cursor=at(e)?'pointer':'default';});
    requestAnimationFrame(draw);
    return {
      set(value,id,source,isStale,isPaused=false){if(source!==scope){positions.clear();scope=source;}tasks=value;selected=id;stale=isStale;paused=isPaused;roster.sync(tasks);for(const key of positions.keys())if(!tasks.some(t=>t.id===key))positions.delete(key);},
      character:task=>roster.character(task),
      choose(task,id){if(!roster.choose(task,id))return;for(const t of tasks)if(crew.keyFor(t)===crew.keyFor(task)){const p=positions.get(t.id);if(p)p.frame=0;}try{localStorage.setItem('aerotech.crew.v1',JSON.stringify(roster.saved()));}catch{}},
      motion(value){reduced=value;},get reduced(){return reduced;},layout:station.serialize(),
      // Read-only presentation snapshot for browser verification.
      snapshot(){return {stale,paused,reduced,hiddenCount,actors:tasks.filter(t=>hit.some(h=>h.id===t.id)).map(t=>({task:t.id,character:roster.character(t).id,...positions.get(t.id)}))};}
    };
  }
  root.AeroWorld={makeWorld};
})(globalThis);
