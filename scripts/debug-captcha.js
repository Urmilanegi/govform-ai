// Debug: Get full login modal HTML
const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext(
    require('path').join(require('os').homedir(), '.govform', 'ssc-profile'),
    { headless: true, viewport: { width: 1280, height: 900 } }
  );
  const page = await context.newPage();

  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('image/') && !url.includes('/assets/')) {
      const buf = await res.body().catch(() => null);
      if (buf && buf.length > 500 && buf.length < 100000) {
        require('fs').writeFileSync('/tmp/ssc_captcha_debug.png', buf);
        console.log('IMAGE SAVED from:', url, 'size:', buf.length);
      }
    }
  });

  await page.goto('https://ssc.gov.in/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=Login or Register').catch(() => {});
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder="Registration Number"]', '10031303171').catch(() => {});
  await page.fill('input[placeholder="Password"]', 'Sumit@123').catch(() => {});
  await page.waitForTimeout(3000);

  // Get full modal HTML
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.modal, .login-modal, .popup, [class*="modal"], [class*="login"], app-login, .overlay, .dialog');
    return m ? m.outerHTML.substring(0, 5000) : 'no modal found';
  });
  console.log('MODAL HTML:\n', modal.substring(0, 3000));

  // Get ALL elements with background-image
  const bgImgs = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all.filter(el => {
      const bg = window.getComputedStyle(el).backgroundImage;
      return bg && bg !== 'none' && bg.includes('url(') && !bg.includes('.svg') && !bg.includes('/assets/');
    }).map(el => ({
      tag: el.tagName,
      id: el.id,
      cls: el.className,
      bg: window.getComputedStyle(el).backgroundImage.substring(0, 150),
    }));
  });
  console.log('\nBG IMAGES (non-asset):', JSON.stringify(bgImgs, null, 2));

  await context.close();
})();
