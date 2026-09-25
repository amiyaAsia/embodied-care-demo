import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
  await page.waitForSelector('.care-scene-svg');
  assert.ok((await page.locator('h1').textContent()).includes('床旁'));
  assert.equal(await page.locator('.care-scene').getAttribute('data-positioned'), 'false');
  await page.screenshot({ path: 'preview-desktop.png', fullPage: true });
  await page.locator('#practiceButton').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'preview-refusal.png', fullPage: true });
  await page.waitForFunction(() => !document.querySelector('#practiceButton').disabled);
  assert.equal(await page.locator('#turnCount').textContent(), '第 1 轮');
  assert.ok((await page.locator('#chatFeed').textContent()).includes('未入口'));
  await page.locator('.observation-choice').first().click();
  async function send(text) { await page.locator('#messageInput').fill(text); await page.locator('#sendButton').click(); await page.waitForFunction(() => !document.querySelector('#sendButton').disabled); }
  await send('我看到您转头抿嘴了，先把勺子拿开休息一下。');
  await send('我知道您不想吃，是温度太烫还是口味不合适？');
  await send('我先说明一下，每次少一点，确认温度合适再喂，您随时可以停。');
  await page.locator('#positionButton').click();
  await page.waitForFunction(() => document.querySelector('.care-scene').dataset.phase === 'position');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'preview-positioning.png', fullPage: true });
  await page.waitForFunction(() => !document.querySelector('#positionButton').disabled);
  assert.equal(await page.locator('.care-scene').getAttribute('data-positioned'), 'true');
  await send('您想自己吃还是让我协助？愿意先试一小口吗？');
  await page.locator('#amplitude').fill('30'); await page.locator('#tempo').fill('3.5'); await page.locator('#hold').fill('2');
  await page.locator('#practiceButton').click();
  await page.waitForFunction(() => document.querySelector('.care-scene').dataset.phase === 'accept', { timeout: 15000 });
  await page.waitForTimeout(700); await page.screenshot({ path: 'preview-accepted.png', fullPage: true });
  await page.waitForFunction(() => !document.querySelector('#practiceButton').disabled, { timeout: 15000 });
  assert.ok((await page.locator('#chatFeed').textContent()).includes('自主微张嘴'));
  await send('这口吞完了吗，现在舒服吗？');
  assert.equal(await page.locator('#teachingScore').textContent(), '100');
  await page.screenshot({ path: 'preview-trained.png', fullPage: true });
  await page.locator('#reviewButton').click(); assert.ok((await page.locator('#dialogContent').textContent()).includes('照护')); await page.locator('#closeDialog').click();
  const turnBefore = await page.locator('#turnCount').textContent();
  await page.locator('#demoButton').click(); await page.waitForTimeout(1800); await page.locator('#demoButton').click();
  assert.equal(await page.locator('#turnCount').textContent(), turnBefore);
  assert.equal(await page.locator('#teachingScore').textContent(), '100');
  await page.locator('#resetButton').click();
  assert.equal(await page.locator('.care-scene').getAttribute('data-positioned'), 'false');
  // Keyboard-controlled manual serving: a complete outward/hold/withdraw path.
  await page.locator('#recordButton').click();
  const wrist = page.locator('[data-part="drag"]'); await wrist.focus();
  for (let i = 0; i < 40; i++) { await wrist.press('ArrowRight'); await page.waitForTimeout(80); }
  await page.waitForTimeout(1800);
  for (let i = 0; i < 40; i++) { await wrist.press('ArrowLeft'); await page.waitForTimeout(45); }
  await page.locator('#recordButton').click();
  await page.waitForFunction(() => !document.querySelector('#practiceButton').disabled, { timeout: 20000 });
  assert.equal(await page.locator('#turnCount').textContent(), '第 1 轮');
  await page.locator('#practiceButton').click(); await page.waitForTimeout(1300); await page.locator('#restButton').click();
  await page.waitForFunction(() => !document.querySelector('#practiceButton').disabled);
  assert.equal(await page.locator('#turnCount').textContent(), '第 2 轮');
  await page.locator('#resetButton').click();
  await page.locator('#demoButton').click();
  await page.waitForFunction(() => document.querySelector('#detailDialog').open, null, { timeout: 60000 });
  assert.ok((await page.locator('#dialogEyebrow').textContent()).includes('非你的个人成绩'));
  assert.equal(await page.locator('#teachingScore').textContent(), '0');
  await page.locator('#closeDialog').click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'preview-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: bedside recline, animated bed/pillow positioning, refusal without entry, prepared acceptance, post-check score, isolated demo, manual trajectory, withdrawal, mobile layout, no runtime errors');
} catch(error) {
  console.error('UI DEBUG', await page.evaluate(() => ({toast:document.querySelector('#toast').textContent,turn:document.querySelector('#turnCount').textContent,phase:document.querySelector('.care-scene').dataset.phase,button:document.querySelector('#recordButton').textContent,wrist:document.querySelector('[data-part="drag"]').getAttribute('aria-valuenow')})), errors);
  await page.screenshot({path:'preview-debug.png',fullPage:true}); throw error;
} finally { await browser.close(); }
