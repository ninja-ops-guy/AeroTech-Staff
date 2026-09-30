'use strict';
const crypto = require('node:crypto');
// Adapter for the inspected RESIDUAL Command Station 0.3 API. Read-only.
class StationError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function stationURL(value) {
  const u = new URL(value);
  if (u.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(u.hostname) ||
      u.username || u.password || u.search || u.hash || u.pathname !== '/') {
    throw new StationError('INVALID_ENDPOINT', 'Use a local address such as http://127.0.0.1:8765.');
  }
  u.hostname = '127.0.0.1';
  return u.origin;
}
async function boundedBody(response, max = 4 * 1024 * 1024) {
  if (Number(response.headers.get('content-length')) > max) {
    await response.body?.cancel();
    throw new StationError('RESPONSE_TOO_LARGE', 'Station response exceeds the read limit.');
  }
  const reader = response.body.getReader(); const chunks = []; let n = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      n += value.length;
      if (n > max) throw new StationError('RESPONSE_TOO_LARGE', 'Station response exceeds the read limit.');
      chunks.push(Buffer.from(value));
    }
  } catch (e) { await reader.cancel(); throw e; }
  return Buffer.concat(chunks).toString('utf8');
}
const text = (v, max = 4000) => typeof v === 'string' ? v.slice(0, max) : null;
const refs = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 100) : [];
const artifactRefs = v => Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : x?.id).filter(x => typeof x === 'string').slice(0, 100) : [];
function publicTask(t) {
  if (!t || typeof t.id !== 'string' || typeof t.state !== 'string') throw new StationError('INCOMPATIBLE', 'Invalid task record.');
  return {id:text(t.id, 100), title:text(t.title, 300), state:text(t.state, 100),
    owner:text(t.owner, 150), attempt:Number.isSafeInteger(t.attempt) ? t.attempt : 0,
    route:text(t.route, 60), base_commit:text(t.base_commit, 64), head_commit:text(t.head_commit, 64),
    updated_at:text(t.updated_at, 80), instruction:text(t.instruction, 12000),
    files:refs(t.files), depends_on:refs(t.depends_on), artifacts:artifactRefs(t.artifacts),
    // These are recorded host results, not independently reverified receipts.
    checks_result:Array.isArray(t.checks_result) ? t.checks_result.slice(0, 30) : [],
    findings:Array.isArray(t.findings) ? t.findings.slice(0, 30) : []};
}
function publicProject(p) {
  if (!p || typeof p.id !== 'string' || !Array.isArray(p.tasks)) throw new StationError('INCOMPATIBLE', 'Invalid project record.');
  const revision = crypto.createHash('sha256').update(JSON.stringify([p.id,p.spec_hash,p.paused,p.tasks.map(t=>[t.id,t.state,t.attempt,t.base_commit,t.head_commit,t.updated_at])])).digest('hex');
  return {id:text(p.id, 100), revision, name:text(p.name, 300), goal:text(p.goal), mode:text(p.mode, 40),
    paused:p.paused === true, spec_hash:text(p.spec_hash, 64), tasks:p.tasks.slice(0, 100).map(publicTask)};
}
class StationClient {
  constructor(url, {fetchImpl = fetch} = {}) { this.url = stationURL(url); this.fetch = fetchImpl; this.token = null; this.version = null; }
  async request(path, authenticated = true) {
    let response;
    try { response = await this.fetch(this.url + path, {redirect:'error', signal:AbortSignal.timeout(5000), headers:authenticated ? {'X-Station-Token':this.token || ''} : {}}); }
    catch { throw new StationError('UNREACHABLE', 'Command Station is not reachable at the configured local address.'); }
    if (!/^ResidualStation\/0\.3(?:\s|$)/.test(response.headers.get('server') || '')) {
      this.token = null; throw new StationError('WRONG_SERVICE', 'The endpoint does not identify as RESIDUAL Command Station 0.3.');
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 403) this.token = null;
      throw new StationError(response.status === 403 ? 'SESSION_EXPIRED' : 'STATION_ERROR', `Command Station returned HTTP ${response.status}.`);
    }
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new StationError('INCOMPATIBLE', 'Expected a JSON station response.');
    let data;
    try { data = JSON.parse(await boundedBody(response)); }
    catch (e) { if (e instanceof StationError) throw e; throw new StationError('INCOMPATIBLE', 'Invalid JSON from Command Station.'); }
    return data;
  }
  async connect() {
    if (this.token) return;
    const b = await this.request('/api/bootstrap', false);
    if (b.version !== '0.3.0' || typeof b.token !== 'string' || b.token.length < 16 || b.token.length > 256) {
      throw new StationError('INCOMPATIBLE', 'This adapter supports the inspected Command Station 0.3 contract.');
    }
    this.token = b.token; this.version = b.version;
    const d = await this.request('/api/diagnostics');
    if (d.event_contract !== 'LDD workflow v1') { this.token = null; throw new StationError('INCOMPATIBLE', 'Unknown station event contract.'); }
  }
  async projects() {
    await this.connect(); const data = await this.request('/api/projects');
    if (!Array.isArray(data.projects)) throw new StationError('INCOMPATIBLE', 'Missing project list.');
    return data.projects.slice(0, 500).map(publicProject);
  }
  async detail(id) {
    if (!/^p-[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new StationError('BAD_ID', 'Invalid project identifier.');
    await this.connect();
    const base = '/api/projects/' + encodeURIComponent(id);
    const data = await this.request(base);
    const project = publicProject(data.project);
    if (project.id !== id) throw new StationError('INCOMPATIBLE', 'Project identity mismatch.');
    // SQLite event sequence is global, not contiguous per project. Preserve native cursors.
    let events = [], cursor = 0, truncated = false;
    for (let page = 0; page < 20; page++) {
      const result = await this.request(base + '/events?after=' + cursor);
      if (!Array.isArray(result.events)) throw new StationError('INCOMPATIBLE', 'Invalid event page.');
      for (const e of result.events) {
        if (e.project_id !== id || !Number.isSafeInteger(e.seq) || e.seq <= cursor) throw new StationError('INCOMPATIBLE', 'Invalid event identity or ordering.');
        cursor = e.seq; events.push(e);
      }
      if (result.events.length < 500) break;
      if (page === 19) truncated = true;
    }
    return {project, events, cursor, truncated, snapshot_consistency:'polling; project and events are separate reads',
      evidence_status:'host-recorded; not independently reverified'};
  }
  async artifact(projectId, artifactId) {
    const detail = await this.detail(projectId);
    if (!detail.project.tasks.some(t => t.artifacts.includes(artifactId))) throw new StationError('BAD_ID', 'Artifact is not referenced by this project’s tasks.');
    const response = await this.fetch(this.url + '/api/artifact?id=' + encodeURIComponent(artifactId), {
      redirect:'error', signal:AbortSignal.timeout(5000), headers:{'X-Station-Token':this.token}
    });
    if (!response.ok) { await response.body?.cancel(); throw new StationError('STATION_ERROR', 'Artifact is unavailable.'); }
    if (!/^text\//.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new StationError('UNSUPPORTED_ARTIFACT', 'Open binary artifacts in Command Station.'); }
    return {id:artifactId, text:await boundedBody(response, 1024 * 1024), evidence_status:'host-recorded'};
  }
  async command(input) {
    const {project_id,action,expected_revision}=input;
    if(!/^p-[a-zA-Z0-9_-]{1,80}$/.test(project_id)||!['run','triage','pause','resume'].includes(action)) throw new StationError('BAD_COMMAND','Unsupported command.');
    await this.connect();
    const current=publicProject((await this.request('/api/projects/'+encodeURIComponent(project_id))).project);
    if(current.revision!==expected_revision)throw new StationError('REVISION_CONFLICT','The mission changed. Refresh and review it before issuing another action.');
    const route=['pause','resume'].includes(action)?'pause':action;
    const body=route==='pause'?{paused:action==='pause'}:{};
    let response;
    try{
      response=await this.fetch(this.url+'/api/projects/'+encodeURIComponent(project_id)+'/'+route,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Station-Token':this.token,'Content-Type':'application/json'},body:JSON.stringify(body)
      });
    }catch{throw new StationError('OUTCOME_UNKNOWN','Delivery outcome is unknown. Inspect Command Station; this request will not be sent again.');}
    if(response.status>=500){await response.body?.cancel();throw new StationError('OUTCOME_UNKNOWN','The host returned a server error. Reconcile in Command Station before sending more work.');}
    if(!response.ok){await response.body?.cancel();throw new StationError('COMMAND_REJECTED',`The host rejected this request with HTTP ${response.status}.`);}
    let data;
    try{data=JSON.parse(await boundedBody(response,64000));}catch{throw new StationError('OUTCOME_UNKNOWN','The host reply was unreadable. Inspect Command Station before sending more work.');}
    if(route==='pause'&&data.ok===true)return {status:'APPLIED',action};
    if(typeof data.job_id==='string')return {status:'ACKNOWLEDGED',action,job_id:data.job_id};
    throw new StationError('OUTCOME_UNKNOWN','No recognized acknowledgment was received. Inspect Command Station.');
  }
}
module.exports = {StationClient, StationError, stationURL, boundedBody, publicProject};
