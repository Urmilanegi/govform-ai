// One-off debug: open saved SSC session, go to education page,
// open the Passing Year dropdown, dump its DOM structure.
const { getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');

const EDU_URL = 'https://ssc.gov.in/candidate-portal/cgl-application-form-2026/education-details/cgl3yfc928zu2026/2zf22tlqj2so28z/false';

(async () => {
  // Minimal .env.local loader (dotenv not installed)
  const envFile = require('fs').readFileSync(require('path').join(__dirname, '..', '.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
  const ctx = await launchPersistentContext(getGovformProfileDir('ssc-profile'));
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(EDU_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());

  // Auto-login if session expired (captcha is readable from DOM)
  if (page.url().includes('login')) {
    console.log('logging in...');
    await page.click('text=Login or Register').catch(() => {});
    await page.waitForTimeout(1500);
    await page.fill('input[placeholder="Registration Number"]', process.env.REG_NO);
    await page.fill('input[placeholder="Password"]', process.env.PASSWORD);
    await page.waitForTimeout(1000);
    const cap = await page.evaluate(() => {
      const el = document.querySelector('.captcha, .captcha.no-copy, div.captcha');
      return el ? el.textContent.replace(/\s+/g, '').trim() : '';
    });
    console.log('captcha:', cap);
    await page.evaluate((val) => {
      const inp = document.querySelector('input[placeholder="Captcha"]');
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto.set.call(inp, val);
      ['input','change','keyup','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
    }, cap);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.trim().toLowerCase() === 'login' && b.getBoundingClientRect().height > 0);
      if (b) b.click();
    });
    await page.waitForFunction(() => window.location.href.includes('candidate'), { timeout: 15000 });
    await page.goto(EDU_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    console.log('URL now:', page.url());
  }

  const info = await page.evaluate(() => {
    const out = { dropdownTags: [], yearArea: null };
    // All dropdown-ish elements with their tag + classes
    document.querySelectorAll('select, ng-select, mat-select, [class*="select"], [class*="dropdown"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 5 && r.width > 10) {
        out.dropdownTags.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 80) });
      }
    });
    // Find the "Passing Year" label and dump the next 1200 chars of HTML after it
    const labels = Array.from(document.querySelectorAll('*')).filter(el =>
      el.children.length === 0 && /passing year/i.test(el.textContent || ''));
    if (labels.length) {
      let n = labels[0];
      // climb to the question container
      for (let i = 0; i < 3 && n.parentElement; i++) n = n.parentElement;
      out.yearArea = n.outerHTML.slice(0, 2500);
    }
    return out;
  });
  console.log('DROPDOWN ELEMENTS:', JSON.stringify(info.dropdownTags.slice(0, 20), null, 1));
  console.log('--- YEAR QUESTION HTML ---');
  console.log(info.yearArea || 'NOT FOUND');

  // Click the Passing Year dropdown's .value-area and dump the component HTML after opening
  // Single REAL click via Playwright (synthetic double-dispatch toggles it shut)
  const yearVA = page.locator('app-dropdown-new[label*="Passing Year"] .value-area');
  await yearVA.scrollIntoViewIfNeeded();
  await yearVA.click();
  console.log('value-area clicked: real-click');
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const dds = Array.from(document.querySelectorAll('app-dropdown-new'));
    const dd = dds.find(d => /passing year/i.test(d.getAttribute('label') || ''));
    return dd ? dd.outerHTML.slice(0, 4000) : 'NOT FOUND';
  });
  console.log('--- COMPONENT AFTER CLICK ---');
  console.log(after);

  const sc = await page.screenshot({ path: '/tmp/edu_debug.png' });
  console.log('screenshot saved /tmp/edu_debug.png');
  await ctx.close();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
