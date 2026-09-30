/* AeroTech rendering uses TechOps Hero art and StarNet's pure station document.
   Layout is presentation only; no room/prop grants tools or changes host state. */
(function(root){
  'use strict';
  function makeWorld(canvas,onSelect) {
    const ctx=canvas.getContext('2d');
    const images={}; const imageNames={background:'industrial.webp',mike:'mike.png',operator:'operator.png',clerk:'clerk.png',terminal:'terminal.png',printer:'printer.png'};
    for(const [key,file] of Object.entries(imageNames)){const im=new Image();im.src='/assets/'+file;images[key]=im;}
    const doc=WorldModel.defaultDoc(1);doc.meta.name='AeroTech Operations';doc.rooms={};doc.order=[];
    ['Dispatch','Engineering','Quality','Release'].forEach((name,i)=>{const id='a'+i;doc.rooms[id]={id,kind:'hab',name,rects:[{x1:i*20,y1:0,x2:i*20+17,y2:10}],floorStyle:'hull',tier:0,floorPaint:{}};doc.order.push(id);});
    doc.meta.spawnRoomId='a0';doc.meta.trunkRoomId='a0';
    const station=WorldModel.deserialize(doc);
    let tasks=[],selected=null,mode='OFFLINE',stale=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hit=[],last=0;const positions=new Map();
    const colors={active:'#b9ed7c',review:'#f2c480',danger:'#f59986',success:'#b4dca9',neutral:'#adc0bd'};
    const round=(x,y,w,h,r=6)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
    function label(text,x,y,{size=13,color='#dce7dc',align='left'}={}){ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.fillText(text,x,y);}
    function draw(now){
      requestAnimationFrame(draw);if(document.hidden||now-last<40)return;last=now;
      const w=1280,h=700;canvas.width=w;canvas.height=h;hit=[];
      ctx.imageSmoothingEnabled=false;
      if(images.background.complete&&images.background.naturalWidth)ctx.drawImage(images.background,0,0,1280,880);
      else{ctx.fillStyle='#182729';ctx.fillRect(0,0,w,h);}
      const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#09131adc');shade.addColorStop(.42,'#0b171a75');shade.addColorStop(1,'#071016c9');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
      if(!tasks.length){label('AEROTECH',w-42,130,{size:42,color:'#d1e9cd66',align:'right'});label('OPERATIONS DIVISION',w-42,160,{size:13,color:'#a6c4b788',align:'right'});return;}
      const rooms=station.rooms();
      const centers={};
      rooms.forEach((room,i)=>{
        const rect=room.rects[0];const center=80+((rect.x1+rect.x2)/2)*14;centers[room.name]=center;
        const count=tasks.filter(t=>t.area===room.name||(room.name==='Engineering'&&t.area==='Repair')).length;
        ctx.fillStyle='#12231de8';ctx.strokeStyle='#658471';round(center-128,202,256,67);ctx.fill();ctx.stroke();
        label(String(i+1).padStart(2,'0'),center-110,227,{size:11,color:'#a9d277'});label(room.name.toUpperCase(),center-110,248,{size:14});label(String(count),center+107,245,{size:24,color:'#b9ed7c',align:'right'});
        ctx.strokeStyle='#aaca7955';ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(center,278);ctx.lineTo(center,425);ctx.stroke();ctx.setLineDash([]);
        const prop=i===1&&tasks.some(t=>t.area==='Repair')?images.terminal:images.printer;
        if(prop.complete&&prop.naturalWidth){ctx.globalAlpha=.9;ctx.drawImage(prop,center-58,350,116,110);ctx.globalAlpha=1;}
      });
      const counts={};
      tasks.slice(0,16).forEach((task,index)=>{
        const area=task.area==='Repair'?'Engineering':task.area;
        const slot=counts[area]||0;counts[area]=slot+1;
        const targetX=centers[area]+[-55,45,-5,85][slot%4];const y=slot<2?539:612;
        const before=positions.get(task.id);const x=(!before||reduced||stale)?targetX:before+(targetX-before)*.12;positions.set(task.id,x);
        const color=colors[task.tone];
        ctx.fillStyle=task.id===selected?'#c4fb8780':'#0008';ctx.beginPath();ctx.ellipse(x,y-4,40,9,0,0,Math.PI*2);ctx.fill();
        const frame=!reduced&&!stale&&task.working?Math.floor(now/190)%6:0;
        if(images.mike.complete&&images.mike.naturalWidth)ctx.drawImage(images.mike,frame*160,0,160,144,x-77,y-129,154,139);
        ctx.fillStyle='#0b171df0';ctx.strokeStyle=task.id===selected?'#c1ef84':color+'88';round(x-65,y+7,130,43,4);ctx.fill();ctx.stroke();
        label((task.owner||task.id).slice(0,17),x,y+23,{size:10,color:'#e5eddf',align:'center'});
        label((stale?'STALE · ':'')+task.label.toUpperCase().slice(0,19),x,y+39,{size:8,color,align:'center'});
        if(task.working&&!stale){ctx.fillStyle=color;ctx.globalAlpha=reduced?1:.6+Math.sin(now/400)*.25;ctx.fillRect(x-3,y-126,6,6);ctx.globalAlpha=1;}
        hit.push({id:task.id,x:x-70,y:y-132,w:140,h:185});
      });
      if(tasks.length>16)label(`${tasks.length-16} additional tasks in the list below`,w-25,678,{size:12,align:'right'});
      if(stale){ctx.fillStyle='#151b2280';ctx.fillRect(0,0,w,h);label('CONNECTION LOST · LAST KNOWN STATE',w/2,175,{size:15,color:'#f2c480',align:'center'});}
    }
    canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1280,y=(e.clientY-r.top)/r.height*700;const a=hit.findLast(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h);if(a)onSelect(a.id);});
    canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1280,y=(e.clientY-r.top)/r.height*700;canvas.style.cursor=hit.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)?'pointer':'default';});
    requestAnimationFrame(draw);
    return {set(value,id,source,isStale){if(source!==mode)positions.clear();tasks=value;selected=id;mode=source;stale=isStale;for(const key of positions.keys())if(!tasks.some(t=>t.id===key))positions.delete(key);},motion(value){reduced=value;},get reduced(){return reduced;},layout:station.serialize()};
  }
  root.AeroWorld={makeWorld};
})(globalThis);
