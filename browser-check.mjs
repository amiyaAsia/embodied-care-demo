import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_BASE_URL||'http://localhost:4173';
async function send(text){await page.locator('#messageInput').fill(text);await page.locator('#sendButton').click();await page.waitForFunction(()=>!document.querySelector('#sendButton').disabled);}
const pause=['I notice you are turning away. What is worrying you?','We will pause now. I will withdraw the spoon and respect your choice.','I will check and follow the fictional care plan CP-M01.','I will record and report our agreed next step and planned review.'];
try{
 await page.goto(base);await page.waitForSelector('.care-scene');
 assert.equal(await page.title(),'Amiya Care Practice');assert.equal(await page.locator('html').getAttribute('lang'),'en-SG');
 assert.ok((await page.locator('#voiceButton').textContent()).includes('Read aloud'));
 assert.equal(await page.evaluate(()=>/[\u4e00-\u9fff]/.test(document.querySelector('.workspace').innerText)),false);
 await page.screenshot({path:'preview-english.png',fullPage:true});
 await send(pause[0]);await page.locator('#langZh').click();
 assert.ok((await page.locator('#chatFeed').textContent()).includes('食物看着烫'));
 assert.ok((await page.locator('#chatFeed').textContent()).includes(pause[0]));
 await page.locator('#langEn').click();
 for(const text of pause.slice(1))await send(text);
 assert.ok((await page.locator('#outcomeText').textContent()).includes('Pause respected'));
 assert.equal(await page.locator('#finishEncounter').isEnabled(),true);
 await page.locator('#finishEncounter').click();
 assert.ok((await page.locator('#historyContext').textContent()).includes('Pause respected'));
 assert.equal(await page.locator('#skillChecks .done').count(),0);
 // Returning encounter chooses support, also without feeding.
 for(const text of [pause[0],'I will ask the senior nurse for support with this ongoing difficulty.',pause[2],pause[3]])await send(text);
 assert.ok((await page.locator('#outcomeText').textContent()).includes('Support arranged'));
 await page.locator('#finishEncounter').click();
 assert.equal(await page.locator('#coachPanel').isVisible(),false);assert.equal(await page.locator('#suggestionArea').isVisible(),false);assert.equal(await page.locator('.action-card').isVisible(),false);
 await page.locator('#reviewButton').click();assert.ok((await page.locator('#dialogContent').textContent()).includes('No answer key'));await page.locator('#closeDialog').click();
 for(const text of pause)await send(text);
 assert.equal(await page.locator('#chatFeed .coach-message').count(),0);
 await page.locator('#finishEncounter').click();
 assert.equal(await page.locator('#decisionButton').count(),0);
 await page.locator('#reviewRole').selectOption('reviewer');assert.equal(await page.locator('#decisionButton').count(),0);
 await page.locator('#reviewRole').selectOption('operator');await page.locator('#reviewerName').fill('Demo reviewer Chen');await page.locator('#reviewerTitle').fill('Centre-appointed care lead');await page.locator('#nominateButton').click();
 await page.locator('#reviewRole').selectOption('reviewer');await page.locator('#decisionSelect').selectOption('ready-supervised');await page.locator('#decisionReason').fill('The worker respected refusal and documented the agreed review step. Supervision remains required.');await page.locator('#decisionButton').click();
 assert.ok((await page.locator('.review-decision').textContent()).includes('Ready for supervised'));
 await page.screenshot({path:'preview-reviewer.png',fullPage:true});
 await page.locator('#toShift').click();await page.locator('#difficultyText').fill('After the shift I found it difficult to pause when the senior refused lunch.');await page.locator('#reportDifficulty').click();
 assert.ok((await page.locator('#serviceArea').textContent()).includes('planned; not contacted'));
 await page.locator('#launchRefresher').click();for(const text of pause)await send(text);await page.locator('#finishEncounter').click();
 assert.equal(await page.locator('#completeFollowup').isEnabled(),false);
 await page.locator('#followupRole').selectOption('reviewer');await page.locator('#followupNote').fill('Observed supervised practice and agreed a pause and documented handover in this fictional workplace follow-up.');await page.locator('#completeFollowup').click();
 assert.ok((await page.locator('#serviceArea').textContent()).includes('Loop closed'));await page.screenshot({path:'preview-followup.png',fullPage:true});
 await page.locator('#langZh').click();assert.ok((await page.locator('#serviceArea').textContent()).includes('已通过审核者'));
 // Assistance can be the first and only serving attempt, no failure required.
 await page.goto(base);
 const assisted=[pause[0],'Would you be willing to have my help with a little food?','Would you prefer to pause, eat yourself, or have my help?',pause[2],'I will raise the bed and arrange supportive pillows.','I will check the food temperature and confirm it has cooled.'];
 for(const text of assisted)await send(text);
 await page.locator('#practiceButton').click();await page.waitForFunction(()=>!document.querySelector('#practiceButton').disabled,null,{timeout:20000});await send('How do you feel now? Are you comfortable?');
 assert.ok((await page.locator('#outcomeText').textContent()).includes('Chosen assistance completed'));
 // Chinese inputs, not only Chinese labels.
 await page.goto(base);await page.locator('#langZh').click();
 for(const text of ['我看到您转头拒绝，是有什么顾虑吗？','我们先暂停，移开勺子，不勉强您。','我会核对并遵循虚构照护计划CP-M01。','我会记录并报告已商定的下一步和复查安排。'])await send(text);
 assert.ok((await page.locator('#outcomeText').textContent()).includes('尊重暂停'));
 await page.locator('#langEn').click();const before=await page.locator('#turnCount').textContent();await page.locator('#demoButton').click();await page.waitForFunction(()=>document.querySelector('#detailDialog').open,null,{timeout:20000});await page.locator('#closeDialog').click();assert.equal(await page.locator('#turnCount').textContent(),before);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'preview-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: English default; full bilingual text/history/input; pause/support without feeding; first-attempt assist; returning fresh permissions; hint-free unfamiliar check; nominated human review; after-shift refresher and reviewer follow-up; demo isolation; mobile; no runtime errors.');
}catch(e){console.error('Page error details:',errors);await page.screenshot({path:'preview-debug.png',fullPage:true});throw e;}finally{await browser.close();}
