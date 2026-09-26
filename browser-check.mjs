import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CHAPTERS} from './tour-story.js';
import {readingDuration} from './tour-player.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
const base=process.env.TEST_BASE_URL||'http://localhost:4173/';
const out=new URL('./handover-local/',import.meta.url);await mkdir(out,{recursive:true});
const errors=[],requests=[];const results=[];
const page=await browser.newPage({viewport:{width:1440,height:1150}});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)requests.push(`${r.status()} ${r.url()}`);});
async function choose(index){await page.locator('#chaptersButton').click();await page.locator('.chapter-list button').nth(index).click();}
async function assertLayout(){
  const r=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,caption:parseFloat(getComputedStyle(document.querySelector('#caption')).fontSize),body:parseFloat(getComputedStyle(document.querySelector('body')).fontSize),controls:[...document.querySelectorAll('.player-controls button')].map(b=>parseFloat(getComputedStyle(b).fontSize)),clip:[...document.querySelectorAll('#caption,#physicalAction,.record-field dd')].filter(n=>n.getClientRects().length).some(n=>n.scrollWidth>n.clientWidth+2)}));
  assert.ok(r.scroll<=r.width+1,JSON.stringify(r));assert.ok(r.caption>=22);assert.ok(r.body>=18);assert.ok(r.controls.every(s=>s>=16));assert.equal(r.clip,false);
}
try{
  await page.clock.install();await page.goto(base);await page.waitForSelector('.tour-scene');
  assert.ok((await page.title()).startsWith('Amiya Care Practice'));
  assert.equal(await page.locator('textarea,input,form,select,[role="slider"]').count(),0);
  await page.clock.runFor(1700);assert.equal(await page.locator('body').getAttribute('data-playing'),'true');
  await page.locator('#playButton').click();const step=await page.locator('body').getAttribute('data-step');const progress=await page.locator('#storyProgress').getAttribute('value');await page.clock.runFor(12000);assert.equal(await page.locator('body').getAttribute('data-step'),step);assert.equal(await page.locator('#storyProgress').getAttribute('value'),progress);
  await page.locator('#chinese').click();assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');assert.equal(await page.locator('body').getAttribute('data-step'),step);assert.ok((await page.locator('#caption').textContent()).includes('慧琳'));
  await page.locator('#english').click();await assertLayout();
  await page.screenshot({path:new URL('tour-desktop.png',out).pathname.slice(1),fullPage:true});
  await page.locator('#playButton').click();await page.locator('#carePlanButton').click();assert.equal(await page.locator('body').getAttribute('data-playing'),'false');assert.ok((await page.locator('#dialogBody').textContent()).includes('CP-M02'));await page.locator('#closeDialog').click();assert.equal(await page.locator('body').getAttribute('data-playing'),'false');
  await page.locator('#sourcesButton').click();assert.equal(await page.locator('#dialogBody a').count(),3);await page.locator('#closeDialog').click();
  await choose(4);assert.equal(await page.locator('body').getAttribute('data-chapter'),'5');assert.equal(await page.locator('body').getAttribute('data-playing'),'false');assert.equal(await page.locator('#sceneHost').isVisible(),false);assert.ok((await page.locator('#captionType').textContent()).includes('Centre manager'));assert.ok((await page.locator('#recordFields').textContent()).includes('Aisha'));
  await page.screenshot({path:new URL('tour-cutaway.png',out).pathname.slice(1),fullPage:true});
  await choose(3);assert.ok((await page.locator('#caption').textContent()).includes('scripted example'));assert.equal(await page.locator('#recordStage').isVisible(),false);
  // Browser lifecycle signal: backgrounding must pause, never resume automatically.
  await page.locator('#playButton').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('body').getAttribute('data-playing'),'false');await page.clock.runFor(60000);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('body').getAttribute('data-playing'),'false');
  results.push('English default, bilingual position preservation, muted autoplay, pause/resume, chapter navigation, supporting panels pause, reference links, labelled cutaways, no visitor input, hidden-tab pause');
  // Full automatic story in a real browser. Virtual time accelerates only the test.
  await page.locator('#restartButton').click();await page.locator('#playButton').click();const seen=[];
  for(const [ci,c]of CHAPTERS.entries())for(const s of c.steps){
    assert.equal(await page.locator('body').getAttribute('data-step'),s.id);
    if(!seen.includes(ci))seen.push(ci);
    if(c.id==='check')assert.equal(await page.locator('#captionPanel').getAttribute('data-kind')==='coach',false);
    await page.clock.runFor(readingDuration(s,'en')+80);
  }
  assert.equal(seen.length,8);assert.equal(await page.locator('body').getAttribute('data-ended'),'true');assert.equal(await page.locator('#endingCard').isVisible(),true);assert.equal(await page.locator('body').getAttribute('data-playing'),'false');
  results.push('All 8 chapters and final fictional follow-up reached automatically without role switches, typed dialogue or form completion');
  await page.screenshot({path:new URL('tour-ending.png',out).pathname.slice(1),fullPage:true});
  // Readability at phone and equivalent 200% desktop layout viewport.
  for(const [width,height,label]of [[390,844,'phone'],[720,575,'desktop-200pct-layout']]){
    await page.setViewportSize({width,height});await choose(4);await assertLayout();await page.screenshot({path:new URL(`tour-${label}.png`,out).pathname.slice(1),fullPage:true});
    await page.locator('#chinese').click();await assertLayout();await page.locator('#carePlanButton').click();assert.ok(await page.locator('#dialogBody').isVisible());await page.locator('#closeDialog').click();await page.locator('#english').click();
  }
  results.push('390px mobile and 720px (200% layout-equivalent) viewport: 22px captions, 18px body/excerpts, 16px controls; EN/ZH no horizontal clipping');
  await page.setViewportSize({width:1440,height:1150});
  await page.evaluate(()=>document.body.style.zoom='2');await choose(4);await assertLayout();
  await page.screenshot({path:new URL('tour-200pct-rendered.png',out).pathname.slice(1),fullPage:true});
  await page.evaluate(()=>document.body.style.zoom='1');
  results.push('Additional 200% rendered-content zoom check at 1440px: wrapped records and captions, no horizontal clipping');
  // Deterministic speech adapter verifies sequencing without depending on OS voices.
  const spoken=await browser.newPage({viewport:{width:1280,height:1000}});
  await spoken.addInitScript(()=>{
    const stats={calls:0,cancel:0,active:0,maximum:0};window.speechStats=stats;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{stats.cancel++;stats.active=0;},speak:u=>{stats.calls++;stats.active++;stats.maximum=Math.max(stats.maximum,stats.active);window.pendingUtterance=u;}}});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
  });
  await spoken.clock.install();await spoken.goto(base);await spoken.locator('#restartButton').click();
  assert.equal(await spoken.evaluate(()=>speechStats.calls),0);
  await spoken.locator('#readButton').click();assert.equal(await spoken.evaluate(()=>speechStats.calls),0);
  await spoken.locator('#playButton').click();await spoken.clock.runFor(50000);assert.equal(await spoken.locator('body').getAttribute('data-step'),'intro-welcome');
  await spoken.evaluate(()=>{speechStats.active=0;pendingUtterance.onend();});await spoken.clock.runFor(20);
  assert.equal(await spoken.locator('body').getAttribute('data-step'),'intro-handover');assert.equal(await spoken.evaluate(()=>speechStats.maximum),1);
  await spoken.locator('#playButton').click();assert.equal(await spoken.evaluate(()=>speechStats.active),0);await spoken.close();
  results.push('Read aloud adapter: no automatic speech, one utterance at a time, captions wait for speech, pause cancels playback');
  const reduced=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});await reduced.clock.install();await reduced.goto(base);await reduced.clock.runFor(4000);assert.equal(await reduced.locator('body').getAttribute('data-playing'),'false');await reduced.locator('#playButton').click();assert.equal(await reduced.locator('body').getAttribute('data-playing'),'true');await reduced.locator('#playButton').click();await reduced.close();results.push('Reduced-motion starts paused with explicit Start fallback');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await writeFile(new URL('browser-results.json',out),JSON.stringify({url:base,date:new Date().toISOString(),status:'passed',results,errors,requests},null,2));
  console.log('PASS',results.join('\n'));
}catch(e){console.error(errors);await page.screenshot({path:new URL('tour-debug.png',out).pathname.slice(1),fullPage:true});throw e;}finally{await browser.close();}
