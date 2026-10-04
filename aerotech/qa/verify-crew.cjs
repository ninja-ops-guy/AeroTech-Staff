/* Browser regression for cosmetic crew motion; no live station or model calls. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('../server.cjs');
async function main(){
  const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
  const app=createServer();const url=await app.start();let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM_PATH?{executablePath:process.env.TEST_CHROMIUM_PATH}:{})});
    const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(r.method()==='POST')requests.push(r.url());});
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.goto(url);await page.getByRole('button',{name:'Explore demo',exact:true}).click();
    await page.waitForFunction(()=>world.snapshot().actors.length===6);
    await page.waitForFunction(()=>performance.getEntriesByType('resource').filter(r=>/assets\/(mike|waldo|kat|man|operator|clerk)\.png/.test(r.name)).length===6);
    const initial=await page.evaluate(()=>world.snapshot());assert.equal(new Set(initial.actors.map(a=>a.character)).size,6);
    await page.screenshot({path:path.join(__dirname,'crew-desktop.png'),fullPage:true});
    const first=await page.evaluate(()=>world.snapshot().actors.filter(a=>['mike','waldo','kat','man'].includes(a.character)).map(a=>a.frame));
    await page.waitForFunction(prior=>JSON.stringify(world.snapshot().actors.filter(a=>['mike','waldo','kat','man'].includes(a.character)).map(a=>a.frame))!==JSON.stringify(prior),first);
    // Click the displayed actor using the same scaled coordinates a user sees.
    const actor=initial.actors.find(a=>a.task==='OPS-104'),box=await page.locator('#floor').boundingBox();
    await page.mouse.click(box.x+actor.x/1280*box.width,box.y+(actor.y-25)/700*box.height);
    await page.waitForFunction(()=>state.selected==='OPS-104');
    await page.getByLabel('Character appearance').selectOption('waldo');
    assert.equal(await page.evaluate(()=>world.character(state.project.tasks.find(t=>t.id==='OPS-104')).id),'waldo');
    await page.reload();await page.getByRole('button',{name:'Explore demo',exact:true}).click();
    assert.equal(await page.evaluate(()=>world.character(state.project.tasks.find(t=>t.id==='OPS-104')).id),'waldo');
    await page.waitForFunction(()=>world.snapshot().actors.length===6);
    // Local render fixture: move one task to another area and inspect actual animation.
    await page.evaluate(()=>{const t=state.project.tasks[0];world.choose(t,'mike');t.area='Quality';render();});
    await page.waitForFunction(()=>world.snapshot().actors.find(a=>a.task==='OPS-101')?.moving);
    let moving=await page.evaluate(()=>world.snapshot().actors.find(a=>a.task==='OPS-101'));assert.ok(moving.frame>=6&&moving.frame<=11);
    await page.waitForFunction(()=>!world.snapshot().actors.find(a=>a.task==='OPS-101').moving);
    await page.evaluate(()=>{state.project.paused=true;render();});
    await page.waitForTimeout(50);const pause=await page.locator('#floor').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(200);assert.equal(await page.locator('#floor').evaluate(c=>c.toDataURL()),pause);
    await page.evaluate(()=>{state.project.paused=false;state.stale=true;render();});
    await page.waitForTimeout(50);const stale=await page.locator('#floor').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(200);assert.equal(await page.locator('#floor').evaluate(c=>c.toDataURL()),stale);
    await page.evaluate(()=>{state.stale=false;render();});await page.getByRole('button',{name:'Motion on',exact:true}).click();
    await page.waitForTimeout(50);const reduced=await page.locator('#floor').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(200);assert.equal(await page.locator('#floor').evaluate(c=>c.toDataURL()),reduced);
    assert.ok((await page.evaluate(()=>world.snapshot())).actors.every(a=>a.frame===0&&!a.moving));
    await page.getByRole('button',{name:'Board',exact:true}).click();assert.ok(await page.locator('#board').isVisible());
    await page.getByRole('button',{name:'Floor',exact:true}).click();
    // Dense room fixture: four visible seats, with remaining tasks still in the list.
    await page.evaluate(()=>{for(const t of state.project.tasks)t.area='Engineering';render();});
    await page.waitForFunction(()=>world.snapshot().hiddenCount===2);
    assert.equal(await page.locator('#tasks .task').count(),6);
    // Clear local looks to capture the default six-character demo on a narrow viewport.
    const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.getByRole('button',{name:'Explore demo',exact:true}).click();
    await mobile.waitForFunction(()=>world.snapshot().actors.length===6);await mobile.waitForTimeout(150);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await mobile.evaluate(()=>document.querySelector('#floor').getBoundingClientRect().width<=document.querySelector('.floor-column').getBoundingClientRect().width),true);
    assert.ok((await mobile.evaluate(()=>world.snapshot())).actors.every(a=>a.frame===0));
    await mobile.locator('#tasks .task').first().click();await mobile.getByLabel('Character appearance').selectOption('kat');
    await mobile.screenshot({path:path.join(__dirname,'crew-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    const report={source_manifest_sha256:JSON.parse(fs.readFileSync(path.join(__dirname,'../BUILD-MANIFEST.json'),'utf8')).sha256,verified_at:new Date().toISOString(),browser:browser.version(),fixture:'AeroTech local demo plus presentation-only transitions',characters:initial.actors.map(a=>a.character),checks:['six distinct default characters','idle frames advance','canvas click selects task','appearance choice persists across reload','authored locomotion frames on room transition','paused canvas frozen','stale canvas frozen','reduced-motion canvas frozen','crowded-room overflow retained in task list','board/floor switch','390px viewport without horizontal overflow'],page_errors:errors,post_requests:requests,unit_tests:16,scope:'Visual crew update only. No new live RESIDUAL, provider, Windows or acceptance qualification.'};
    fs.writeFileSync(path.join(__dirname,'crew-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
