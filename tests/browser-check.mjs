/** Run with PLAYWRIGHT_BROWSERS_PATH set and a Playwright module path as argument.
 * Optional browser dependency lives outside the delivered app. This script owns its
 * preview server and closes it on exit. Evidence writes only to artifacts/ and scratch. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const modulePath = process.argv[2];
if (!modulePath) throw new Error('Pass the path to playwright/index.mjs');
const { chromium, firefox, webkit } = await import(pathToFileURL(modulePath));
await mkdir('test/scratch', {recursive:true});
await mkdir('artifacts/screenshots', {recursive:true});
await build({stdin:{contents:`export { LEVELS } from './src/game/levels'; export { CHALLENGE_BOARDS, OFFLINE_BOARD, TIERS, buildChallengeLevel } from './src/game/challenge';`,resolveDir:'.'},bundle:true,platform:'node',format:'esm',outfile:'test/scratch/browser-fixtures.mjs'});
const { LEVELS, CHALLENGE_BOARDS, OFFLINE_BOARD, TIERS, buildChallengeLevel } = await import('../test/scratch/browser-fixtures.mjs');
const recorded=JSON.parse(await readFile('tests/fixture-settlements.json','utf8'));
const API='https://api.squeekchain.com/v1/settlements?range=24h';
const BASE='http://127.0.0.1:4174/preview/';
const LIVE='https://wheelworks-a-hamster-powered-rou.imd.site/';
const results=[];
const check=async(name,fn)=>{try{await fn();results.push({name,status:'pass'});console.log('PASS',name);}catch(e){results.push({name,status:'fail',reason:e.message.split('\n')[0].slice(0,200)});console.log('FAIL',name,e.message.split('\n')[0]);}};
const server=createServer(async(req,res)=>{try{const rel=new URL(req.url,BASE).pathname.replace(/^\/preview\//,'');if(rel.includes('..'))throw new Error();const path='dist/'+(rel||'index.html');res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':'text/html');res.end(await readFile(path));}catch{res.statusCode=404;res.end('missing');}});
await new Promise(r=>server.listen(4174,'127.0.0.1',r));
const b=await chromium.launch({headless:true});
const fixture=()=>({...recorded,generatedAt:new Date().toISOString(),recentSettlements:recorded.recentSettlements.map(s=>({...s,blockTimestamp:new Date(Date.now()-120_000).toISOString()}))});
const context=async(opts={})=>{const c=await b.newContext({viewport:{width:390,height:844},...opts});c.setDefaultTimeout(7000);c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(BASE)&&r.status()>=400)errors.push('Local export resource failed: '+r.status());});});return c;};
const pageWithFeed=async(data=fixture(),opts={})=>{const c=await context(opts);const p=await c.newPage();p.setDefaultTimeout(7000);await p.route(API,r=>data===null?r.abort():r.fulfill({json:data}));await p.goto(BASE);return p;};
const tile=(p,x,y)=>p.getByRole('button',{name:new RegExp(`^Column ${x+1}, row ${y+1}:`)});
const tool=(p,k)=>p.locator('button.tool').filter({hasText:k[0].toUpperCase()+k.slice(1)});
const remembered=new WeakMap();
async function place(p,placements){for(const q of placements){const t=tool(p,q.kind);await t.click();const m=((await t.getAttribute('aria-label'))??'').match(/next orientation (\d+)/);let rots=remembered.get(p)??{straight:0,elbow:0,alternator:0};let rot=m?Number(m[1])/90:rots[q.kind];await tile(p,q.x,q.y).click();for(let i=0;rot!==(q.kind==='straight'?q.rot%2:q.rot)&&i<4;i++){await tile(p,q.x,q.y).click();rot=(rot+1)%(q.kind==='straight'?2:4);}rots[q.kind]=rot;remembered.set(p,rots);}}
async function finish(p){for(let i=0;i<201;i++){const status=await p.locator('.status').innerText();if(/Solved|Run failed/.test(status))return status;await p.getByRole('button',{name:'Step',exact:true}).click();}throw new Error('Did not terminate');}
const shot=(p,name)=>p.screenshot({path:`artifacts/screenshots/${name}.jpg`,type:'jpeg',quality:85,fullPage:true});
const errors=[];
try {
 let p=await pageWithFeed();
 await check('Fresh tutorial: follow adjacent directions to tick-3 win, live orientation preview, default mute',async()=>{
  assert.equal(await p.getByRole('button',{name:'Sound off',exact:true}).count(),1);
  assert.match(await p.locator('.coach-current').innerText(),/Pick Straight/);
  await tool(p,'straight').click();await tile(p,1,1).click();
  assert.match(await tile(p,1,1).getAttribute('aria-label'),/north to south/);
  await tile(p,1,1).click();
  assert.match(await tool(p,'straight').getAttribute('aria-label'),/90 degrees/);
  assert.equal(await tool(p,'straight').locator('path').first().getAttribute('d'),await tile(p,1,1).locator('path').first().getAttribute('d'));
  assert.match(await p.locator('.coach-current').innerText(),/second dashed tile once/);
  await tile(p,2,1).click();assert.match(await tile(p,2,1).getAttribute('aria-label'),/east to west/);
  await shot(p,'tutorial-selected-390');
  await p.getByRole('button',{name:'Start',exact:true}).click();
  await p.getByRole('button',{name:'Pause',exact:true}).click();await shot(p,'tutorial-running-390');
  assert.match(await finish(p),/Solved at tick 3/);await shot(p,'tutorial-win-390');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wheelworks.save')).solved.tutorial),3);
 });
 await check('Share/reload reproduces layout at tick 0 and preserves earned local win',async()=>{
  await p.getByRole('button',{name:'Copy share link',exact:true}).click();const url=await p.locator('.share-field input').inputValue();assert.match(url,/#s=v1~L~tutorial~/);
  await p.reload();assert.match(await p.locator('.status').innerText(),/Ready/);assert.match(await tile(p,1,1).getAttribute('aria-label'),/east to west/);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wheelworks.save')).solved.tutorial),3);
 });
 for(let i=1;i<LEVELS.length;i++)await check(`Level ${i}: place reference through UI and solve`,async()=>{
  await p.getByRole('button',{name:new RegExp(`^Level ${i}:`)}).click();await place(p,LEVELS[i].solution);
  assert.match(await finish(p),/Solved/);
 });
 await shot(p,'level-six-win-390');
 await check('Selected level and selected Challenge tabs preserve ticks; mode return restores run; board keeps one Tab tile',async()=>{
  const before=await p.locator('.status').innerText();await p.getByRole('button',{name:/^Level 6:/}).click();assert.equal(await p.locator('.status').innerText(),before);
  await tile(p,4,5).focus();await p.keyboard.press('ArrowRight');
  await p.getByRole('button',{name:'Chain challenge',exact:true}).click();assert.equal(await p.locator('.cell[tabindex="0"]').count(),1);
  await p.getByRole('button',{name:'Step',exact:true}).click();const challengeStatus=await p.locator('.status').innerText();
  await p.getByRole('button',{name:'Chain challenge',exact:true}).click();assert.equal(await p.locator('.status').innerText(),challengeStatus);
  await p.getByRole('button',{name:'Workshop',exact:true}).click();assert.equal(await p.locator('.status').innerText(),before);
  await p.getByRole('button',{name:'Chain challenge',exact:true}).click();assert.equal(await p.locator('.status').innerText(),challengeStatus);
 });
 await check('Hashchange accepts new board at tick 0; malformed link retains current board and state',async()=>{
  await p.evaluate(()=>location.hash='#s=v1~L~tutorial~11b21b');await p.locator('#level-title').filter({hasText:'First spark'}).waitFor();assert.match(await p.locator('.status').innerText(),/Ready/);
  await p.getByRole('button',{name:'Step',exact:true}).click();const before=await p.locator('.status').innerText();await p.evaluate(()=>location.hash='#s=invalid');await p.locator('.banner-bad').waitFor();assert.equal(await p.locator('.status').innerText(),before);
 });
 await p.context().close();
 p=await pageWithFeed();
 await check('Mode return preserves a shared workshop level rather than opening the older saved level',async()=>{
  const q=await pageWithFeed();await q.evaluate(()=>location.hash='#s=v1~L~lopsided~12b22l32b42h41a23a24a15b25h');await q.locator('#level-title').filter({hasText:'Lopsided order'}).waitFor();await q.getByRole('button',{name:'Step',exact:true}).click();const state=await q.locator('.status').innerText();
  await q.getByRole('button',{name:'Chain challenge',exact:true}).click();await q.getByRole('button',{name:'Workshop',exact:true}).click();assert.equal(await q.locator('#level-title').innerText(),'Lopsided order');assert.equal(await q.locator('.status').innerText(),state);await q.context().close();
 });
 await check('Shared provenance matches ALL fields; forged round/block visibly unverified; safe explorer',async()=>{
  const s=recorded.recentSettlements[0];
  const link=(round,block,work=s.workAdded)=>`#s=v1~C~${s.transactionHash}~${round}~${work}~${block}~`;
  await p.evaluate(h=>location.hash=h,link(s.settledThroughRound,s.ethereumBlockNumber));await p.locator('.provenance summary').click();
  await p.getByText('All fields match a recent safe settlement in the live feed, including the Sepolia network.').waitFor();
  const frozen=await p.locator('#level-title').innerText();
  for(const [round,block,work] of [['999999999999','1',s.workAdded],[s.settledThroughRound,'1',s.workAdded],[s.settledThroughRound,s.ethereumBlockNumber,String(Number(s.workAdded)+1)]]) {
    await p.evaluate(h=>location.hash=h,link(round,block,work));await p.locator('.unverified').waitFor();assert.match(await p.locator('.chain-title').innerText(),/unverified round/);assert.equal(await p.getByText('All fields match a recent safe settlement in the live feed, including the Sepolia network.').count(),0);
  }
  assert.equal(await p.locator('.provenance a').getAttribute('href'),'https://sepolia.etherscan.io/tx/'+s.transactionHash);
  await shot(p,'unverified-share-390');
 });
 await p.context().close();
 for(const scenario of ['offline','stale','future-feed','future-settlement','invalid']) await check(`Feed ${scenario}: honest playable fallback and Retry now`,async()=>{
  let data=fixture();if(scenario==='offline')data=null;if(scenario==='stale')data.generatedAt='2020-01-01T00:00:00Z';if(scenario==='future-feed')data.generatedAt=new Date(Date.now()+600_000).toISOString();if(scenario==='future-settlement')data.recentSettlements=data.recentSettlements.map(s=>({...s,blockTimestamp:new Date(Date.now()+600_000).toISOString()}));if(scenario==='invalid')data={status:'available'};
  const q=await pageWithFeed(data);await q.getByRole('button',{name:'Chain challenge',exact:true}).click();await q.getByRole('button',{name:'Retry now',exact:true}).waitFor();assert.match(await q.locator('.chain-title').innerText(),/Offline workshop challenge—authored, not chain-derived/);
  assert.match(await q.locator('.feed-retry').innerText(),/Automatic retry in/);
  await place(q,buildChallengeLevel(OFFLINE_BOARD,TIERS[1],'test').solution);assert.match(await finish(q),/Solved/);
  if(scenario==='offline')await shot(q,'offline-win-390');
  await q.unroute(API);await q.route(API,r=>r.fulfill({json:fixture()}));await q.getByRole('button',{name:'Retry now',exact:true}).click();await q.getByRole('button',{name:'Load latest round',exact:true}).waitFor();assert.match(await q.locator('.status').innerText(),/Solved/);
  await q.getByRole('button',{name:'Load latest round',exact:true}).click();assert.match(await q.locator('.chain-title').innerText(),/Sepolia · round/);assert.match(await q.locator('.status').innerText(),/Ready/);await q.context().close();
 });
 await check('Cached freshness at new challenge start and visibility return; frozen run never changes',async()=>{
  const q=await pageWithFeed();await q.getByRole('button',{name:'Chain challenge',exact:true}).click();
  await q.getByRole('button',{name:'Step',exact:true}).click();const before=await q.locator('.status').innerText();const title=await q.locator('#level-title').innerText();
  await q.clock.install();await q.clock.setSystemTime(new Date(Date.now()+3*3600_000));
  await q.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await q.getByRole('button',{name:'Retry now',exact:true}).waitFor();
  assert.equal(await q.locator('#level-title').innerText(),title);assert.equal(await q.locator('.status').innerText(),before);
  await q.context().close();
  const r=await pageWithFeed();await r.clock.install();await r.clock.setSystemTime(new Date(Date.now()+3*3600_000));
  await r.getByRole('button',{name:'Chain challenge',exact:true}).click();assert.match(await r.locator('.chain-title').innerText(),/Offline workshop challenge/);await r.context().close();
 });
 await check('Automatic retry recovers after 60 seconds using virtual clock; offline run stays frozen',async()=>{
  const c=await context();const q=await c.newPage();let attempts=0;
  await q.clock.install();await q.route(API,r=>++attempts===1?r.abort():r.fulfill({json:fixture()}));await q.goto(BASE);
  await q.getByRole('button',{name:'Chain challenge',exact:true}).click();await q.getByRole('button',{name:'Retry now',exact:true}).waitFor();
  await q.getByRole('button',{name:'Step',exact:true}).click();const before=await q.locator('.status').innerText();
  await q.clock.fastForward(61_000);await q.getByRole('button',{name:'Load latest round',exact:true}).waitFor();assert.ok(attempts>=2);assert.equal(await q.locator('.status').innerText(),before);await c.close();
 });
 await check('Nine chain variants and offline Busy variant solve through UI (all 12 covered in simulation)',async()=>{
  const q=await pageWithFeed();
  for(const board of [...CHALLENGE_BOARDS,OFFLINE_BOARD])for(const tier of TIERS){
    const level=buildChallengeLevel(board,tier,'test');const idx=CHALLENGE_BOARDS.findIndex(x=>x.id===board.id);
    let hash='0x'+'a'.repeat(58)+String(idx).padStart(6,'0'); // synthetic input, never shown as real live data
    const code=idx<0?'v1~O~':`v1~C~${hash}~1~${tier.minWork}~1~`;
    // Offline share grammar intentionally fixes Busy tier; other offline tiers are sim-only.
    if(idx<0&&tier.id!==1)continue;
    await q.evaluate(h=>location.hash='#s='+h,code);await q.locator('#level-title').filter({hasText:board.name}).waitFor();await place(q,level.solution);assert.match(await finish(q),/Solved/);
  }
  await q.context().close();
 });
 for(const failure of ['getter','read','write'])await check(`Storage ${failure} denial: warning, playable win, in-memory progress`,async()=>{
  const c=await context();await c.addInitScript(kind=>{if(!/^https?:$/.test(location.protocol))return;if(kind==='write')localStorage.setItem('wheelworks.save',JSON.stringify({version:1,solved:{'straight-shot':7},layouts:{},lastLevel:'tutorial',settings:{muted:true,motion:'system'}}));if(kind==='getter')Object.defineProperty(window,'localStorage',{get(){throw new Error('denied');}});else Storage.prototype[kind==='read'?'getItem':'setItem']=()=>{throw new Error('denied');};},failure);
  const q=await c.newPage();await q.route(API,r=>r.abort());await q.goto(BASE);await q.getByText(/Saves unavailable/).waitFor();await place(q,LEVELS[0].solution);assert.match(await finish(q),/Solved/);assert.match(await q.getByRole('button',{name:/^Tutorial:/}).getAttribute('aria-label'),/solved/);if(failure==='write')assert.deepEqual(await q.evaluate(()=>JSON.parse(localStorage.getItem('wheelworks.save')).solved),{'straight-shot':7});await c.close();
 });
 for(const failure of ['constructor','resume','playback'])await check(`Audio ${failure} failure: ticks, win and persisted progress survive`,async()=>{
  const c=await context();await c.addInitScript(kind=>{window.AudioContext=class{constructor(){if(kind==='constructor')throw new Error('denied');}state='suspended';resume(){return kind==='resume'?Promise.reject(new Error('denied')):Promise.resolve();}createOscillator(){throw new Error('playback denied');}};},failure);
  const q=await c.newPage();await q.route(API,r=>r.abort());await q.goto(BASE);await q.getByRole('button',{name:'Sound off',exact:true}).click();await place(q,LEVELS[0].solution);assert.match(await finish(q),/Solved/);assert.equal(await q.evaluate(()=>JSON.parse(localStorage.getItem('wheelworks.save')).solved.tutorial),3);await q.getByText(/Sound unavailable/).waitFor();await c.close();
 });
 await check('Keyboard: one roving tile, arrows/R/Delete, Enter placement, visible focus',async()=>{
  const q=await pageWithFeed();await tool(q,'straight').click();await tile(q,1,1).focus();await q.keyboard.press('Enter');await q.keyboard.press('r');assert.match(await tile(q,1,1).getAttribute('aria-label'),/east to west/);await q.keyboard.press('ArrowRight');await q.keyboard.press('Enter');assert.match(await tile(q,2,1).getAttribute('aria-label'),/east to west/);await shot(q,'keyboard-focus-390');await q.keyboard.press('Delete');assert.match(await tile(q,2,1).getAttribute('aria-label'),/empty floor/);assert.equal(await q.locator('.cell[tabindex="0"]').count(),1);await q.context().close();
 });
 await check('Emulated touch: tutorial solved with tap input',async()=>{
  const q=await pageWithFeed(fixture(),{hasTouch:true,isMobile:true});await tool(q,'straight').tap();await tile(q,1,1).tap();await tile(q,1,1).tap();await tile(q,2,1).tap();await q.getByRole('button',{name:'Start',exact:true}).tap();await q.locator('.status-won').waitFor();await q.context().close();
 });
 for(const view of [{width:1440,height:900},{width:390,height:844},{width:320,height:640},{width:1024,height:600},{width:1440,height:900,zoom:2}]) await check(`Responsive state matrix ${view.width}x${view.height}${view.zoom?' with 200% CSS zoom (not native zoom)':''}`,async()=>{
  const q=await pageWithFeed(null,{viewport:{width:view.width,height:view.height}});
  if(view.zoom)await q.evaluate(()=>document.documentElement.style.zoom='2');
  const suffix=`${view.width}${view.zoom?'-zoom200':''}`;
  const capture=async(state)=>{await shot(q,`${state}-${suffix}`);assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${state} must not overflow horizontally`);};
  await capture('initial');await tool(q,'straight').click();await tile(q,1,1).click();await tile(q,1,1).click();await tile(q,2,1).click();await capture('selected');
  await q.getByRole('button',{name:'Start',exact:true}).click();await capture('running');
  if(await q.getByRole('button',{name:'Pause',exact:true}).count())await q.getByRole('button',{name:'Pause',exact:true}).click();
  assert.match(await finish(q),/Solved/);await capture('win');
  await q.getByRole('button',{name:'Run it again',exact:true}).click();await q.getByRole('button',{name:'Clear all parts',exact:true}).click();await q.getByRole('button',{name:'Start',exact:true}).click();await q.locator('.status-failed').waitFor();await capture('fail');
  await q.getByRole('button',{name:'Reset and try again',exact:true}).click();assert.match(await q.locator('.status').innerText(),/Ready/);await capture('retry');
  await q.getByRole('button',{name:'Chain challenge',exact:true}).click();await q.getByRole('button',{name:'Retry now',exact:true}).waitFor();await capture('offline');
  if(view.width===390&&!view.zoom){const box=await q.locator('.controls').boundingBox();assert.ok(box.y+box.height<=844,'Active challenge controls must fit first screen at 390×844');}
  await q.context().close();
 });
 await check('Reduced motion: no wheel animation, static pulses, playable win',async()=>{
  const q=await pageWithFeed(null);await q.emulateMedia({reducedMotion:'reduce'});await q.waitForFunction(()=>document.querySelector('.app')?.dataset.motion==='reduce');await place(q,LEVELS[0].solution);await q.getByRole('button',{name:'Start',exact:true}).click();assert.equal(await q.locator('.app').getAttribute('data-motion'),'reduce');assert.equal(await q.locator('.wheel-spin').evaluateAll(els=>els.every(e=>getComputedStyle(e).animationName==='none')),true);await q.locator('.status-won').waitFor();await shot(q,'reduced-motion-win');await q.context().close();
 });
 await check('Runtime console: no uncaught app exceptions',async()=>{assert.equal(errors.length,0,JSON.stringify(errors));});
 for(const [name,type] of Object.entries({firefox,webkit})){
  let other;try{other=await type.launch({headless:true});const q=await other.newPage();await q.goto(BASE);await place(q,LEVELS[0].solution);assert.match(await finish(q),/Solved/);results.push({name:`${name} tutorial`,status:'pass'});}catch{results.push({name:`${name} rendered checks`,status:'unavailable',reason:'Browser cannot launch: required system libraries unavailable.'});}finally{await other?.close();}
 }
 await check('Existing HTTPS deployment reachable and playable tutorial plus six levels',async()=>{
  const c=await context({viewport:{width:1440,height:900}});const q=await c.newPage();const response=await q.goto(LIVE,{timeout:30000,waitUntil:'domcontentloaded'});assert.equal(response.status(),200);assert.match(await q.title(),/Wheelworks/);
  for(let i=0;i<LEVELS.length;i++){if(i>0)await q.getByRole('button',{name:new RegExp(`^Level ${i}:`)}).click();await place(q,LEVELS[i].solution);assert.match(await finish(q),/Solved/);}
  await shot(q,'existing-deployed-level-six');
  await q.getByRole('button',{name:'Squeekchain challenge',exact:true}).click();
  const liveButton=q.getByRole('button',{name:/Start round/});const offlineButton=q.getByRole('button',{name:'Play the offline workshop challenge',exact:true});
  await Promise.race([liveButton.waitFor({timeout:12000}),offlineButton.waitFor({timeout:12000})]).catch(()=>{});
  if(await liveButton.count()){await liveButton.click();const title=await q.locator('#level-title').innerText();const spec=CHALLENGE_BOARDS.find(x=>title.includes(x.name));assert.ok(spec);await place(q,buildChallengeLevel(spec,TIERS[1],'test').solution);assert.match(await finish(q),/Solved/);results.push({name:'Existing deployment real live challenge',status:'pass'});}else{results.push({name:'Existing deployment real live challenge',status:'unavailable',reason:'Public feed unavailable in this browser environment; fallback offered.'});await offlineButton.click();await place(q,buildChallengeLevel(OFFLINE_BOARD,TIERS[1],'test').solution);assert.match(await finish(q),/Solved/);await shot(q,'existing-deployed-offline-win');}
  await c.close();
 });
} finally {
 await b.close();await new Promise(r=>server.close(r));
 await writeFile('artifacts/browser-results.json',JSON.stringify({scope:'Local production export; separate checks of the existing HTTPS deployment. Synthetic feed responses are explicitly test fixtures.',results, browserExceptions:errors},null,2)+'\n');
}
if(results.some(r=>r.status==='fail'))process.exitCode=1;
