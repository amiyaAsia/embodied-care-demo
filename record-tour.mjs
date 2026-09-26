import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {CHAPTERS} from './tour-story.js';
import {readingDuration} from './tour-player.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=new URL('./handover-local/recordings/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:fileURLToPath(output),size:{width:1440,height:1100}}});
const page=await context.newPage();const video=page.video();const chapters=[];
const source=process.env.TEST_BASE_URL||'http://localhost:4173/';
try{
 const startClock=new Date('2026-09-26T10:00:00Z');await page.clock.install({time:startClock});await page.clock.pauseAt(startClock);await page.goto(source);await page.waitForSelector('.tour-scene');
 await page.locator('#restartButton').click();
 // The overlay belongs to this QA recording only; production has no speed control.
 await page.evaluate(()=>{const label=document.createElement('div');label.textContent='COMPLETE STORY · ACCELERATED QA SCREEN RECORDING · captions readable at normal speed on site';Object.assign(label.style,{position:'fixed',top:'0',left:'0',right:'0',zIndex:'99',background:'#244c40',color:'white',font:'16px Segoe UI',padding:'5px 16px',textAlign:'center'});document.body.append(label);});
 await page.locator('#playButton').click();let wallStart=Date.now();
 for(const [ci,c]of CHAPTERS.entries())for(const step of c.steps){
   const actual=await page.locator('body').getAttribute('data-step');if(actual!==step.id)throw new Error(`Expected ${step.id}, got ${actual}`);
   if(!chapters.some(x=>x.chapter===ci+1))chapters.push({chapter:ci+1,title:c.title.en,videoSeconds:(Date.now()-wallStart)/1000});
   const duration=readingDuration(step,'en')+40;
   for(let elapsed=0;elapsed<duration;){const tick=Math.min(200,duration-elapsed);await page.clock.runFor(tick);elapsed+=tick;await new Promise(r=>setTimeout(r,35));}
 }
 if(await page.locator('body').getAttribute('data-ended')!=='true')throw new Error('Story did not finish');
 await new Promise(r=>setTimeout(r,1800));
 await context.close();await video.saveAs(fileURLToPath(new URL('amiya-care-practice-complete-loop.webm',output)));
 await writeFile(new URL('recording-chapters.json',output),JSON.stringify({source,allChapters:8,accelerated:true,normalStoryDurationSeconds:CHAPTERS.flatMap(c=>c.steps).reduce((n,s)=>n+readingDuration(s,'en'),0)/1000,chapters},null,2));
 console.log('Complete eight-chapter screen recording saved.');
}finally{await browser.close();}
