import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://localhost:4173');
  await page.waitForSelector('.care-scene-svg');
  await page.screenshot({ path: 'preview-desktop.png', fullPage: true });
  await page.locator('#practiceButton').click();
  await page.waitForFunction(() => document.querySelector('#turnCount').textContent === '第 1 轮', { timeout: 15000 });
  assert.ok(await page.locator('.observation-question').count());
  await page.locator('.observation-choice').first().click();
  async function send(text) { await page.locator('#messageInput').fill(text); await page.locator('#sendButton').click(); await page.waitForTimeout(850); }
  await send('周阿姨，我先示范向前伸，停一下再收回来，您愿意试试吗？');
  await send('坐稳，双脚落地，肩膀放松。');
  await send('我看到您耸肩了，我们先休息一下。');
  await send('我把幅度缩小，慢一点再给您示范。');
  await page.locator('#amplitude').fill('55');
  await page.locator('#tempo').fill('4.5');
  await page.locator('#hold').fill('1');
  await page.locator('#practiceButton').click();
  await page.waitForFunction(() => !document.querySelector('#practiceButton').disabled, { timeout: 15000 });
  await send('这次感觉怎么样，有没有酸或疼？');
  assert.equal(await page.locator('#teachingScore').textContent(), '100');
  await page.locator('#reviewButton').click();
  assert.ok((await page.locator('#dialogContent').textContent()).includes('教学完成度'));
  await page.locator('#closeDialog').click();
  await page.screenshot({ path: 'preview-trained.png', fullPage: true });
  const turnBefore = await page.locator('#turnCount').textContent();
  await page.locator('#demoButton').click();
  await page.waitForTimeout(2200);
  await page.locator('#demoButton').click();
  assert.equal(await page.locator('#turnCount').textContent(), turnBefore);
  assert.equal(await page.locator('#teachingScore').textContent(), '100');
  await page.locator('#resetButton').click();
  assert.equal(await page.locator('#teachingScore').textContent(), '0');
  await page.locator('#demoButton').click();
  await page.waitForFunction(() => document.querySelector('#detailDialog').open, { timeout: 45000 });
  assert.ok((await page.locator('#dialogEyebrow').textContent()).includes('非个人成绩'));
  assert.equal(await page.locator('#teachingScore').textContent(), '0');
  await page.locator('#closeDialog').click();
  // Real pointer recording, including complete return and scored replay.
  await page.locator('#recordButton').click();
  async function wristPoint(value) {
    return page.evaluate(p => {
      const body = document.querySelector('[data-person="trainee"] [data-part="body"]');
      const svg = document.querySelector('.care-scene-svg'); const point = svg.createSVGPoint();
      point.x = 38 + 135 * p; point.y = 39 - 118 * p - Math.sin(p * Math.PI) * 11;
      const output = point.matrixTransform(body.getScreenCTM()); return { x: output.x, y: output.y };
    }, value);
  }
  const origin = await wristPoint(0); await page.mouse.move(origin.x, origin.y); await page.mouse.down();
  for (let i = 1; i <= 30; i++) { const p = await wristPoint(.55 * i / 30); await page.mouse.move(p.x, p.y); await page.waitForTimeout(65); }
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'preview-motion.png', fullPage: true });
  for (let i = 29; i >= 0; i--) { const p = await wristPoint(.55 * i / 30); await page.mouse.move(p.x, p.y); await page.waitForTimeout(65); }
  await page.mouse.up();
  await page.locator('#recordButton').click();
  await page.waitForFunction(() => !document.querySelector('#practiceButton').disabled, { timeout: 15000 });
  assert.equal(await page.locator('#turnCount').textContent(), '第 1 轮');
  assert.ok((await page.locator('#chatFeed').textContent()).includes('手动动作示范'));
  // Pause must cancel capture and must not score an incomplete movement.
  await page.locator('#recordButton').click();
  const origin2 = await wristPoint(0); await page.mouse.move(origin2.x, origin2.y); await page.mouse.down();
  const half = await wristPoint(.45); await page.mouse.move(half.x, half.y);
  await page.locator('#restButton').dispatchEvent('click');
  await page.mouse.up(); await page.waitForTimeout(950);
  assert.equal(await page.locator('#recordButton').textContent(), '◎ 手动示范');
  assert.equal(await page.locator('#turnCount').textContent(), '第 2 轮');
  await page.locator('#resetButton').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'preview-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: page render, branching motion, observation, correction, 100-point teaching loop, review, demo cancel/restoration, full demo isolation, real pointer recording/replay, pause during drag, mobile overflow, no JS errors');
} finally { await browser.close(); }
