// Dump what "Save & Next" actually is on the Additional Information-I page
const { getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs = require('fs'), path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
envFile.split('\n').forEach(l => { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); });

const URL2 = 'https://ssc.gov.in/candidate-portal/cgl-application-form-2026/exam-requirements/cgl3yfc928zu2026/2zf22tlqj2so28z/false';

(async () => {
  const ctx = await launchPersistentContext(getGovformProfileDir('ssc-profile'));
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(URL2, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  if (page.url().includes('login')) {
    await page.click('text=Login or Register').catch(() => {});
    await page.waitForTimeout(1500);
    await page.fill('input[placeholder="Registration Number"]', process.env.REG_NO);
    await page.fill('input[placeholder="Password"]', process.env.PASSWORD);
    await page.waitForTimeout(1000);
    const cap = await page.evaluate(() => document.querySelector('.captcha')?.textContent.replace(/\s+/g, '').trim() || '');
    await page.evaluate((val) => {
      const inp = document.querySelector('input[placeholder="Captcha"]');
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto.set.call(inp, val);
      ['input','change','keyup','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
    }, cap);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim().toLowerCase() === 'login');
      if (b) b.click();
    });
    await page.waitForFunction(() => location.href.includes('candidate'), { timeout: 15000 });
    await page.goto(URL2, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
  }
  console.log('URL:', page.url());
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('app-dropdown-new')).map(d => d.getAttribute('label')));
  
  // open the multi-select and dump it
  const msb = page.locator('.custom-multi-select .selected-box').first();
  if (await msb.count() > 0) { await msb.scrollIntoViewIfNeeded(); await msb.click(); await page.waitForTimeout(1200); }
  const msHtml = await page.evaluate(() => document.querySelector('.custom-multi-select')?.outerHTML.slice(0, 2500) || 'NONE');
  console.log('MULTISELECT OPEN:', msHtml);
  console.log('LABELS:', JSON.stringify(labels, null, 1));
  const custom = await page.evaluate(() => {
    const tags = new Set();
    document.querySelectorAll('*').forEach(el => { if (el.tagName.startsWith('APP-')) tags.add(el.tagName); });
    const ms = Array.from(document.querySelectorAll('app-multi-select-dropdown, app-multiselect, [class*="multi"]'))
      .filter(el => el.getBoundingClientRect().height > 0)
      .map(el => ({ tag: el.tagName, label: el.getAttribute('label'), html: el.outerHTML.slice(0, 800) }));
    return { tags: [...tags], ms };
  });
  console.log('CUSTOM:', JSON.stringify(custom, null, 1));

  const q29 = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*')).filter(el =>
      el.children.length <= 2 && /29\.1|at least one language/i.test(el.textContent || ''));
    if (!els.length) return 'NOT FOUND';
    let n = els[0];
    for (let i = 0; i < 3 && n.parentElement; i++) n = n.parentElement;
    return n.outerHTML.slice(0, 2000);
  });
  console.log('Q29.1 AREA:', q29);

  const found = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length <= 2 && /save\s*&\s*next/i.test(el.textContent || '') && el.getBoundingClientRect().height > 0)
      .map(el => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60),
        parentTag: el.parentElement?.tagName, parentCls: (el.parentElement?.className || '').toString().slice(0, 60),
        outer: el.outerHTML.slice(0, 300) }));
  });
  console.log(JSON.stringify(found, null, 1));
  await ctx.close();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
