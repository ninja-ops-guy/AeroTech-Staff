'use strict';
const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const state={config:null,projects:[],project:null,events:[],selected:null,demo:false,stale:false,observed:null,generation:0,busy:false};
const world=AeroWorld.makeWorld($('#floor'),selectTask);
const mode=()=>state.demo?'DEMO':state.project?.mode==='demo'?'STATION DEMO':state.project?'LIVE':'OFFLINE';
async function api(path,body){const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(20000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});let j;try{j=await r.json();}catch{throw new Error('The local bridge returned an unreadable response.');}if(!r.ok)throw new Error(j.error||'Station request failed.');return j;}
function notice(message){$('#notice').textContent=message;}
function badge(task){return el('span','badge '+task.tone,task.label);}
function showEvidence(title,value){$('#evidence-title').textContent=title;$('#evidence-body').textContent=typeof value==='string'?value:JSON.stringify(value,null,2);$('#evidence-dialog').showModal();}
function row(label,value){const r=el('div','info-row');r.append(el('span','',label),el('code','',value||'Not recorded'));return r;}
function selectTask(id){state.selected=id;renderTasks();renderInspector();world.set(state.project?.tasks||[],id,mode()+':'+(state.project?.id||''),state.stale,!!state.project?.paused);}
function renderMissions(){
  const target=$('#mission-list');target.replaceChildren();$('#mission-count').textContent=state.projects.length;
  const term=$('#search').value.toLowerCase();
  const projects=state.projects.filter(p=>p.name.toLowerCase().includes(term));
  for(const p of projects){const b=el('button','mission-item'+(state.project?.id===p.id?' selected':''));b.append(el('strong','',p.name),el('small','',`${p.tasks.length} tasks · ${state.demo?'preview':p.mode||'unknown'}${p.paused?' · paused':''}`));b.addEventListener('click',()=>loadProject(p.id));target.append(b);}
  if(!projects.length)target.append(el('p','empty',term?'No matching missions.':'Your missions will appear here.'));
}
function taskButton(t){const b=el('button','task'+(state.selected===t.id?' selected':''));const info=el('div');info.append(el('strong','',t.title||t.id),el('small','',`${t.id} · ${t.owner||'Unassigned'} · attempt ${t.attempt}`));b.append(info,badge(t));b.addEventListener('click',()=>selectTask(t.id));return b;}
function renderTasks(){
  const tasks=state.project?.tasks||[];const target=$('#tasks');target.replaceChildren();
  tasks.forEach(t=>target.append(taskButton(t)));if(!tasks.length)target.append(el('p','empty','No task activity to display.'));
  const board=$('#board');board.replaceChildren();for(const area of ['Dispatch','Engineering','Quality','Release','Repair']){const c=el('div','board-column');c.append(el('h3','',area.toUpperCase()));const group=tasks.filter(t=>t.area===area);group.forEach(t=>c.append(taskButton(t)));if(!group.length)c.append(el('p','empty','No tasks'));board.append(c);}
  $('#task-caption').textContent=`${tasks.length} tasks · select to inspect`;
  for(const [id,value] of Object.entries({'metric-total':tasks.length,'metric-active':tasks.filter(t=>t.working).length,'metric-blocked':tasks.filter(t=>t.area==='Repair').length,'metric-done':tasks.filter(t=>t.hostIntegrated).length}))$('#'+id).textContent=state.project?value:'—';
}
function renderInspector(){
  const t=state.project?.tasks.find(x=>x.id===state.selected);const target=$('#inspector-content');
  if(!t){target.replaceChildren();const d=el('div','empty-inspector');d.append(el('div','empty-symbol','◎'),el('h3','','Every task has a story.'),el('p','','Select a worker or task to inspect its state, candidate, checks, and recorded evidence.'));target.append(d);return;}
  target.replaceChildren(badge(t),el('h3','',t.title),el('p','',t.instruction||'No task instruction recorded.'));
  const appearance=el('label','crew-picker','Character appearance');const picker=el('select');picker.id='crew-character';picker.setAttribute('aria-label','Character appearance');for(const a of AeroCrew.atlas){const option=el('option','',a.name);option.value=a.id;picker.append(option);}picker.value=world.character(t).id;picker.onchange=()=>{world.choose(t,picker.value);};appearance.append(picker);target.append(appearance,el('p','small','Local appearance only. Tasks with the same worker share this look.'));
  target.append(row('Task',t.id),row('Worker',t.owner||'Unassigned'),row('Attempt',String(t.attempt)),row('Host state',t.state),row('Candidate',t.head_commit),row('Base',t.base_commit),row('Spec digest',state.project.spec_hash));
  const actions=el('div','evidence-actions');
  const checks=el('button','',`Recorded checks (${t.checks_result?.length||0}) ↗`);checks.onclick=()=>showEvidence('Host-recorded checks',t.checks_result||[]);actions.append(checks);
  const findings=el('button','',`Findings (${t.findings?.length||0}) ↗`);findings.onclick=()=>showEvidence('Host-recorded findings',t.findings||[]);actions.append(findings);
  const record=el('button','','Inspect task record ↗');record.onclick=()=>showEvidence(state.demo?'Demo task fixture':'Host task record',t);actions.append(record);
  for(const id of t.artifacts||[]){const b=el('button','','Artifact '+id.slice(-10)+' ↗');b.onclick=async()=>{b.disabled=true;try{const a=await api('/api/artifact?project='+encodeURIComponent(state.project.id)+'&id='+encodeURIComponent(id));showEvidence('Recorded artifact · '+id,a.text);}catch(e){notice(e.message);}finally{b.disabled=false;}};actions.append(b);}
  target.append(actions,el('p','evidence-note',state.demo?'Demo data for interface exploration. No agent or model is executing.':'States and checks are recorded by the host. This observer does not independently verify receipts or establish acceptance.'));
}
function renderEvents(){
  const container=$('#events');container.replaceChildren();
  for(const e of state.events.slice(-40).reverse()){
    const r=el('div','log-row');const d=new Date(e.timestamp);const stamp=Number.isNaN(d.getTime())?'—':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const b=el('button','','Inspect');b.onclick=()=>showEvidence(state.demo?'Demo event fixture':'Host-recorded event',e);
    r.append(el('code','',stamp),el('span','',e.task_id||'Mission'),el('span','',e.event_type),b);container.append(r);
  }
}
function render(){
  world.set(state.project?.tasks||[],state.selected,mode()+':'+(state.project?.id||''),state.stale,!!state.project?.paused);
  renderMissions();renderTasks();renderInspector();renderEvents();
  $('#mission-name').textContent=state.project?.name||'AeroTech command floor';
  $('#mode-badge').textContent=mode();$('#mode-badge').className='badge '+(state.demo?'review':state.project?'active':'neutral');
  $('#floor-caption').hidden=!!state.project;
  $('#floor-state').textContent=state.project?`${state.demo?'Preview · no execution':state.stale?'Stale · last known snapshot':'Host snapshot · '+state.config?.access}${state.project.paused?' · mission paused':''}`:'Awaiting station connection';
  $('#controls').hidden=state.demo||!state.project||state.config?.access!=='controlled';
  $('#pause-button').textContent=state.project?.paused?'Resume mission':'Pause mission';
  for(const id of ['run-button','triage-button','pause-button'])$('#'+id).disabled=state.stale||!!state.sending;
  $('#demo-button').disabled=!!state.sending;$('#connect-button').disabled=!!state.sending;
  $('#connection-label').textContent=state.demo?'DEMO PREVIEW':state.stale?'CONNECTION LOST':state.project?'STATION CONNECTED':state.config?.station_url?'STATION CONFIGURED':'OFFLINE STUDIO';
  $('#connection-dot').style.background=state.demo||state.stale?'#eebc76':state.project?'#b9ed7c':'#98a499';
  $('#source-note').textContent=state.demo?'Exploring labeled fixtures. No work is dispatched.':state.config?.station_url?`Reading ${state.config.station_url}. Tasks remain owned by RESIDUAL.`:'Connect your local RESIDUAL Command Station to see its missions.';
  $('#freshness').textContent=state.demo?'Demo fixtures · not live':state.observed?`${state.stale?'Last successful read':'Snapshot'} ${new Date(state.observed).toLocaleTimeString()}`:'No station data loaded';
  $('#station-link').hidden=!state.config?.station_url;if(state.config?.station_url)$('#station-link').href=state.config.station_url;
}
async function loadProject(id){
  const generation=++state.generation;
  if(state.demo){state.project=AeroProjection.projectView(state.projects.find(p=>p.id===id));state.selected=state.project.tasks[0]?.id;render();return;}
  try{const result=await api('/api/project?id='+encodeURIComponent(id));if(generation!==state.generation)return;
    state.project=AeroProjection.projectView(result.project);state.events=result.events;state.observed=result.observed_at;state.stale=false;
    if(!state.project.tasks.some(t=>t.id===state.selected))state.selected=state.project.tasks[0]?.id;
    notice(`${result.truncated?'Event history exceeds the 10,000-record preview limit. ':''}Read-only ${result.project.mode==='demo'?'station demo':'station'} snapshot. Project and log are separate reads; receipts are host-recorded.`);render();
  }catch(e){if(generation!==state.generation)return;state.stale=true;notice(e.message);render();}
}
async function connect(){
  if(state.demo){state.projects=[];state.project=null;state.events=[];state.selected=null;state.observed=null;}
  state.demo=false;const generation=++state.generation;
  try{state.config=await api('/api/status');if(generation!==state.generation)return;
    if(!state.config.station_url){state.projects=[];state.project=null;state.events=[];state.selected=null;state.stale=false;render();$('#connection-dialog').showModal();return;}
    const result=await api('/api/projects');if(generation!==state.generation)return;state.projects=result.projects;
    const id=state.projects.some(p=>p.id===state.project?.id)?state.project.id:state.projects[0]?.id;
    if(id)await loadProject(id);else{state.project=null;state.events=[];state.stale=false;state.observed=result.observed_at;render();notice('Connected. No projects yet. Create a mission in Command Station.');}
  }catch(e){if(generation!==state.generation)return;state.stale=true;notice(e.message);render();}
}
function demo(){
  ++state.generation;state.demo=true;state.stale=false;state.observed=null;
  const specs=[['OPS-101','Restore the health beacon','running','Hermes / build'],['OPS-102','Review the retry policy','review_ready','Hermes / verify'],['OPS-103','Prepare the shift handoff','ready',null],['OPS-104','Reconnect the telemetry feed','blocked','Hermes / network'],['OPS-105','Document station recovery','integrated','Hermes / docs'],['OPS-106','Check the release manifest','approved','Hermes / review']];
  const tasks=specs.map(([id,title,status,owner],i)=>({id,title,state:status,owner,attempt:i===3?2:1,route:'local',instruction:'Demonstration task. This is an interface fixture, not an execution receipt.',files:[],depends_on:[],artifacts:[],base_commit:null,head_commit:null,checks_result:[],findings:i===3?[{message:'Fixture: provider connection interrupted.'}]:[]}));
  state.projects=[{id:'demo-night-shift',name:'Night Shift / Station Recovery',goal:'Explore the AeroTech operations floor.',mode:'demo',spec_hash:null,paused:false,tasks}];
  state.project=AeroProjection.projectView(state.projects[0]);state.selected=tasks[0].id;
  state.events=tasks.map((t,i)=>({event_id:'fixture-'+i,event_type:i===3?'task.finding':'task.transition',task_id:t.id,actor:t.owner||'coordinator',timestamp:'2026-09-30T03:'+String(20+i).padStart(2,'0')+':00Z',data:{state:t.state},provenance:'AeroTech local demo fixture'}));
  notice('DEMO PREVIEW · Illustrative task states only. No model calls, no live agents, and no changes to RESIDUAL.');render();
}
$('#demo-button').onclick=demo;
$('#connect-button').onclick=()=>{$('#configured-endpoint').textContent=state.config?.station_url?'Configured: '+state.config.station_url:'No station is configured for this process.';$('#connection-dialog').showModal();};
$('#retry-button').onclick=()=>{$('#connection-dialog').close();connect();};
$('#refresh-button').onclick=()=>state.demo?notice('Demo fixtures are static. Connect a station to refresh real work.'):connect();
$('#search').oninput=renderMissions;
$('#floor-tab').onclick=()=>{ $('#floor-wrap').hidden=false;$('#board').hidden=true;$('#floor-tab').classList.add('selected');$('#board-tab').classList.remove('selected');$('#floor-tab').setAttribute('aria-pressed','true');$('#board-tab').setAttribute('aria-pressed','false');};
$('#board-tab').onclick=()=>{$('#floor-wrap').hidden=true;$('#board').hidden=false;$('#board-tab').classList.add('selected');$('#floor-tab').classList.remove('selected');$('#board-tab').setAttribute('aria-pressed','true');$('#floor-tab').setAttribute('aria-pressed','false');};
function motionLabel(){$('#motion-button').textContent=world.reduced?'Motion off':'Motion on';$('#motion-button').setAttribute('aria-pressed',String(world.reduced));}
$('#motion-button').onclick=()=>{world.motion(!world.reduced);motionLabel();};motionLabel();
let pendingCommand=null;
function proposeCommand(action){
  if(state.demo||state.stale||!state.project||state.config?.access!=='controlled')return;
  pendingCommand={command_id:crypto.randomUUID(),project_id:state.project.id,expected_revision:state.project.revision,action};
  $('#command-title').textContent=`${action[0].toUpperCase()+action.slice(1)} ${state.project.name}`;
  $('#command-explanation').textContent=action==='run'?'This starts the host’s configured batch workflow. It may call paid models, run permitted project checks, review candidates, and integrate work according to RESIDUAL’s existing policy. AeroTech does not change that policy.':action==='triage'?'Ask RESIDUAL to inspect task scope and run its configured baseline checks.':action==='pause'?'Pause this mission through the host. Already running operations may finish; this is not an emergency process kill.':'Resume this mission through the host. This action does not by itself dispatch a new batch.';
  $('#command-dialog').showModal();
}
$('#run-button').onclick=()=>proposeCommand('run');$('#triage-button').onclick=()=>proposeCommand('triage');$('#pause-button').onclick=()=>proposeCommand(state.project.paused?'resume':'pause');
$('#confirm-command').onclick=async()=>{
  if(!pendingCommand||state.sending)return;const command=pendingCommand;pendingCommand=null;$('#command-dialog').close();state.sending=true;render();
  $('#command-status').textContent='Sending one request…';
  try{const result=await api('/api/command',command);$('#command-status').textContent=`${result.status} · ${result.command_id}${result.job_id?' · host job '+result.job_id:''}${result.message?' · '+result.message:''}`;
    if(result.status==='ACKNOWLEDGED')notice('Host acknowledged the request. Completion must be observed in subsequent host records.');
    await connect();
  }catch(e){$('#command-status').textContent=`OUTCOME UNKNOWN · ${command.command_id} · ${e.message} Inspect Command Station before requesting more work. The bridge will not automatically resend this request.`;}
  finally{state.sending=false;render();}
};
$('#about-button').onclick=()=>showEvidence('AeroTech Operations 0.1', 'A local operations build with TechOps Hero artwork and StarNet’s MIT-licensed station document model.\n\nRESIDUAL Command Station 0.3 supplies mission/task records. This build polls snapshots; it does not implement the full RFS master spec or claim independent evidence verification. Run, triage, pause and resume are opt-in host requests. Full controls remain in Command Station.\n\nSource pins, asset hashes, attribution and limitations are in ASSET-MANIFEST.json and README.md in the download. No StarNet logo, character sprites or station artwork is used by this AeroTech entrypoint.');
(async()=>{try{state.config=await api('/api/status');render();if(state.config.station_url)await connect();}catch(e){notice(e.message);}})();
setInterval(async()=>{if(state.demo||!state.config?.station_url||state.busy||document.hidden)return;state.busy=true;try{await connect();}finally{state.busy=false;}},3000);
