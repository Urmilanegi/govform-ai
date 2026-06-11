// Education page pe SIRF Save & Next click karo, kuch fill mat karo
const { getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs = require('fs'), path = require('path');
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
});
const URL2 = 'https://ssc.gov.in/candidate-portal/cgl-application-form-2026/education-details/cgl3yfc928zu2026/2zf22tlqj2so28z/false';
(async () => {
  const ctx = await launchPersistentContext(getGovformProfileDir('ssc-profile'));
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(URL2, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  if (page.url().includes('login')) {
    await page.click('text=Login or Register').catch(() => {});
    await page.waitForTimeout(1500);
    await page.fill('input[placeholder="Registration Number"]', process.env.REG_NO);
    await page.fill('input[placeholder="Password"]', process.env.PASSWORD);
    await page.waitForTimeout(800);
    const cap = await page.evaluate(() => document.querySelector('.captcha')?.textContent.replace(/\s+/g, '').trim() || '');
    await page.evaluate((v) => { const i = document.querySelector('input[placeholder="Captcha"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v);
      ['input','change','keyup','blur'].forEach(e => i.dispatchEvent(new Event(e, { bubbles: true }))); }, cap);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().toLowerCase() === 'login'); if (b) b.click(); });
    await page.waitForFunction(() => location.href.includes('candidate'), { timeout: 15000 });
    await page.goto(URL2, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
  }
  console.log('BEFORE:', page.url());
  const btn = page.locator('form button.save-btn').first();
  console.log('save-btn found:', await btn.count());
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(4000);
  // dismiss any popup
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /okay|ok|close/i.test(b.textContent) && b.getBoundingClientRect().height > 0); if (b) b.click(); });
  await page.waitForTimeout(2000);
  console.log('AFTER:', page.url());
  const errs = await page.evaluate(() => [...document.querySelectorAll('.text-danger, [class*="error"], .mat-error')]
    .map(e => e.textContent.trim()).filter(t => t.length > 3 && t.length < 140).slice(0, 8));
  console.log('ERRORS:', JSON.stringify(errs));
  await page.screenshot({ path: '/tmp/after_save.png' });
  await ctx.close();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
