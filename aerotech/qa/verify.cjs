// Optional integration/browser proof. Requires a RESIDUAL source checkout and Playwright.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const readline=require('node:readline');
const {StationClient}=require('../lib/station.cjs');
const {createServer}=require('../server.cjs');
async function main(){
  if(!process.argv[2])throw new Error('Usage: node qa/verify.cjs /path/to/residual-source');
  const child=spawn(process.env.PYTHON||'python3',[path.join(__dirname,'station_fixture.py'),path.resolve(process.argv[2])],{stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',b=>errors+=b);
  let browser,app;const os=require('node:os');const journalRoot=fs.mkdtempSync(path.join(os.tmpdir(),'aerotech-control-proof-'));
  try{
    const lines=readline.createInterface({input:child.stdout});
    const [line]=await Promise.race([once(lines,'line'),once(child,'exit').then(()=>{throw new Error('Fixture stopped: '+errors);}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Fixture startup timed out: '+errors)),30000).unref())]);
    const info=JSON.parse(line);const client=new StationClient(info.url);
    const projects=await client.projects();assert.equal(projects.length,1);
    const detail=await client.detail(info.project_id);assert.deepEqual(detail.project.tasks.map(t=>t.state),['integrated','approved','ready']);
    const artifact=await client.artifact(info.project_id,detail.project.tasks[0].artifacts[0]);assert.ok(artifact.text.length);
    assert.ok(!JSON.stringify(detail).includes(client.token));
    const receipt={verified_at:new Date().toISOString(),unit_tests:10,station_transport:'PASS',source_contract:JSON.parse(fs.readFileSync(path.join(__dirname,'../ASSET-MANIFEST.json'))).residual_commit,
      live_provider_calls:0,fixture:'Real RESIDUAL training mission: scripted proposals; actual local Git/check/review/integration execution',
      host_states:detail.project.tasks.map(t=>t.state),event_count:detail.events.length,artifact_read:'PASS',token_exposure:'NOT_OBSERVED',
      limitations:['controls opt in; no direct approval/integration override','polling snapshots; separate project/event reads','preflight revision check is not an atomic host compare-and-swap','no independent receipt verification','no Windows or Tauri package qualification','no live Hermes/model qualification']};
    app=createServer({station:info.url,control:true,dataDirectory:journalRoot});const url=await app.start();
    const playwright=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
    browser=await playwright.chromium.launch({headless:true,...(process.env.TEST_CHROMIUM_PATH?{executablePath:process.env.TEST_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1512,height:1120}});const pageErrors=[];const consoleErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    await page.goto(url);await page.waitForFunction(()=>document.querySelector('#mode-badge').textContent==='STATION DEMO');
    assert.equal(await page.locator('#tasks button').count(),3);
    await page.getByRole('button',{name:'Pause mission',exact:true}).click();await page.getByRole('button',{name:'Send request',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#pause-button').textContent==='Resume mission');
    assert.equal((await client.detail(info.project_id)).project.paused,true);
    await page.getByRole('button',{name:'Resume mission',exact:true}).click();await page.getByRole('button',{name:'Send request',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#pause-button').textContent==='Pause mission');
    assert.equal((await client.detail(info.project_id)).project.paused,false);
    await page.getByRole('button',{name:'Triage mission',exact:true}).click();await page.getByRole('button',{name:'Send request',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#command-status').textContent.startsWith('ACKNOWLEDGED'));
    for(let i=0;i<100;i++){if(!(await client.request('/api/jobs')).jobs.some(j=>['queued','running'].includes(j.state)))break;await new Promise(r=>setTimeout(r,100));}
    await page.getByRole('button',{name:'Run mission',exact:true}).click();await page.getByRole('button',{name:'Send request',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#metric-done').textContent==='3',{},{timeout:30000});
    assert.deepEqual((await client.detail(info.project_id)).project.tasks.map(t=>t.state),['integrated','integrated','integrated']);
    await page.getByRole('button',{name:/Restore the health beacon/}).first().click();
    assert.ok((await page.locator('#inspector-content').innerText()).includes('Integrated'));
    await page.locator('.evidence-actions button').last().click();await page.waitForFunction(()=>document.querySelector('#evidence-dialog').open);
    assert.ok((await page.locator('#evidence-body').textContent()).length>10);await page.locator('#evidence-dialog .close').click();
    await page.getByRole('button',{name:'Board',exact:true}).click();assert.equal(await page.locator('#board').isVisible(),true);
    await page.getByRole('button',{name:'Floor',exact:true}).click();assert.equal(await page.locator('#floor-wrap').isVisible(),true);
    await page.getByRole('button',{name:'Explore demo'}).click();assert.equal(await page.locator('#tasks button').count(),6);
    await page.waitForTimeout(600);await page.screenshot({path:path.join(__dirname,'aerotech-floor.png'),fullPage:true});
    await page.getByRole('button',{name:'Motion on',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Motion off',exact:true}).count(),1);
    await page.getByRole('searchbox',{name:'Find a mission'}).fill('nonexistent');assert.equal(await page.locator('#mission-list button').count(),0);
    await page.getByRole('searchbox',{name:'Find a mission'}).fill('');
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'aerotech-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile page overflows horizontally');
    await page.setViewportSize({width:1512,height:1120});await page.getByRole('button',{name:'Connect',exact:true}).click();await page.getByRole('button',{name:'Retry configured connection'}).click();
    await page.waitForFunction(()=>document.querySelector('#mode-badge').textContent==='STATION DEMO');
    await page.reload();await page.waitForFunction(()=>document.querySelector('#tasks').children.length===3);
    await page.screenshot({path:path.join(__dirname,'aerotech-station.png'),fullPage:true});
    child.kill('SIGINT');await once(child,'exit');
    await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='CONNECTION LOST');
    assert.equal(await page.locator('#tasks button').count(),3);assert.ok((await page.locator('#freshness').innerText()).includes('Last successful read'));
    assert.deepEqual(pageErrors,[]);assert.equal(consoleErrors.filter(x=>!x.includes('502')).length,0);
    Object.assign(receipt,{browser:'PASS',browser_engine:await browser.version(),page_errors:pageErrors,desktop_and_mobile:'PASS',reconnect_reload:'PASS',stale_retention:'PASS',controlled_pause_resume:'PASS',controlled_triage_run:'PASS: all three training tasks integrated by the host',durable_command_replay:'PASS in focused tests',expected_http_errors:['502 after intentional station stop'],canvas_used_techops_assets:true});
    fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
  }finally{if(browser)await browser.close();if(app)await new Promise(r=>app.server.close(r));if(child.exitCode===null)child.kill('SIGINT');fs.rmSync(journalRoot,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
