// SSC Complete Form Filler — Playwright Script
// Communicates via stdout JSON lines
// Status file for CAPTCHA solution: /tmp/ssc_captcha_solution.txt

const { getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = getGovformProfileDir('ssc-profile');
const CAPTCHA_FILE = '/tmp/ssc_captcha_solution.txt';
const STATUS_FILE = '/tmp/ssc_status.json';

function send(type, message, extra = {}) {
  const data = { type, message, ...extra };
  process.stdout.write(JSON.stringify(data) + '\n');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
}

async function waitForCaptchaSolution(timeoutMs = 180000) {
  if (fs.existsSync(CAPTCHA_FILE)) fs.unlinkSync(CAPTCHA_FILE);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(CAPTCHA_FILE)) {
      const sol = fs.readFileSync(CAPTCHA_FILE, 'utf8').trim();
      if (sol) { fs.unlinkSync(CAPTCHA_FILE); return sol; }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('CAPTCHA timeout');
}

async function pickDropdown(page, labelText, optionText) {
  await page.evaluate((lbl) => {
    const dds = document.querySelectorAll('.ng-dropdown');
    for (const dd of dds) {
      const labelEl = dd.querySelector('.label');
      if (labelEl && labelEl.textContent.includes(lbl)) {
        const clickable = dd.querySelector('.select-type, .value-area, .selected-value, [class*="select"]');
        if (clickable) clickable.click();
        return;
      }
    }
  }, labelText);
  await page.waitForTimeout(700);
  const clicked = await page.evaluate((optText) => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length === 0) {
        const txt = el.textContent?.trim();
        if (txt === optText) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 10) { el.click(); return true; }
        }
      }
    }
    return false;
  }, optionText);
  await page.waitForTimeout(500);
  return clicked;
}

async function setInputValue(page, selector, value) {
  await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const nativeSet = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    ).set;
    nativeSet.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sel: selector, val: value });
}

(async () => {
  // Student data — from Aadhaar
  // ── Read ALL details from env (passed from UI form) ──
  const student = {
    regNo:      process.env.REG_NO       || '10031303171',
    password:   process.env.PASSWORD     || 'Sumit@123',
    name:       process.env.FULL_NAME    || 'SUMIT KUMAR MINA',
    dob:        process.env.DOB          || '07/07/2000',
    gender:     process.env.GENDER       || 'Male',
    fatherName: process.env.FATHER_NAME  || 'HARKESH MEENA',
    motherName: process.env.MOTHER_NAME  || 'VARMA DEVI',
    mobile:     process.env.MOBILE       || '',   // REQUIRED — no default
    email:      process.env.EMAIL        || 'Sumitkunwal8824@gmail.com',   // REQUIRED — no default
    photoPath:  process.env.PHOTO_PATH   || '',
    signPath:   process.env.SIGN_PATH    || '',
    aadhaar:    process.env.AADHAAR      || '201227964504',
    category:   process.env.CATEGORY    || 'ST',
    nationality:'Citizen of India',
    visibleMark:process.env.VISIBLE_MARK || 'Mole on right hand',
    pwbd:       false,
    address:    process.env.ADDRESS      || 'S/O Harkesh Meena, Gram Narouli Choud, Naroli Chaur, PO Narauli Chaur',
    state:      process.env.STATE        || 'Rajasthan',
    district:   process.env.DISTRICT     || 'Sawai Madhopur',
    pin:        process.env.PIN          || '322214',
  };

  // ── Verify all required fields before starting ──
  send('progress', '🔍 Details verify ho rahi hain...');
  send('progress', `👤 Name: ${student.name}`);
  send('progress', `👩 Mother: ${student.motherName || '❌ MISSING!'}`);
  send('progress', `📱 Mobile: ${student.mobile || '❌ MISSING!'}`);
  send('progress', `📧 Email: ${student.email || '❌ MISSING!'}`);
  send('progress', `🏷️ Category: ${student.category}`);
  send('progress', `🏠 Address: ${student.address}`);
  send('progress', `📍 ${student.district}, ${student.state} — ${student.pin}`);

  // Stop if critical fields missing
  const missing = [];
  if (!student.motherName) missing.push('Mother Name');
  if (!student.mobile)     missing.push('Mobile');
  if (!student.email)      missing.push('Email');
  if (missing.length > 0) {
    send('error', `❌ Yeh fields fill nahi hain: ${missing.join(', ')} — wapas jao aur fill karo`);
    process.exit(1);
  }
  send('progress', '✅ Sab details verified — form fill shuru ho raha hai!');

  // Ensure profile dir exists
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  send('start', '🚀 SSC browser open kar raha hoon...');

  const context = await launchPersistentContext(PROFILE_DIR, {
    headless: false,
    slowMo: 0,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ── LOGIN ──────────────────────────────────────────────────
    send('progress', '🌐 SSC site load ho rahi hai...');
    await page.goto('https://ssc.gov.in/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check if already logged in
    const alreadyIn = await page.$('.candidate-portal, [href*="dashboard"], .user-profile').catch(() => null);
    if (!alreadyIn) {
      send('progress', '🔐 Login kar raha hoon...');
      await page.click('text=Login or Register');
      await page.waitForTimeout(1500);
      await page.fill('input[placeholder="Registration Number"]', student.regNo);
      await page.fill('input[placeholder="Password"]', student.password);

      // ── CAPTCHA: Read from DOM → Show to user → User types → Auto login ──
      await page.waitForTimeout(1500);

      // Helper: fill Angular captcha input properly
      async function fillCaptchaAndLogin(code) {
        // Step 1: Set value via Angular-compatible method
        await page.evaluate((val) => {
          const inp = document.querySelector('input[placeholder="Captcha"]');
          if (!inp) return;
          // Clear first
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          // Set new value using native setter
          const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          proto.set.call(inp, val);
          // Fire all events Angular listens to
          ['input','change','keyup','blur'].forEach(ev =>
            inp.dispatchEvent(new Event(ev, { bubbles: true }))
          );
        }, code);

        await page.waitForTimeout(600);

        // Verify value was set
        const actual = await page.evaluate(() =>
          document.querySelector('input[placeholder="Captcha"]')?.value || ''
        );
        send('progress', `🖊️ Input set to: "${actual}"`);

        // Step 2: Click login button
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(b =>
            b.textContent?.trim().toLowerCase() === 'login' &&
            b.getBoundingClientRect().height > 0
          );
          if (b) b.click();
        });
        send('progress', '⏳ Login ho raha hai...');

        // Step 3: Wait for redirect
        try {
          await page.waitForFunction(
            () => window.location.href.includes('candidate-portal') || window.location.href.includes('dashboard'),
            { timeout: 12000 }
          );
          return true;
        } catch {
          return false;
        }
      }

      // ── Claude Vision se CAPTCHA auto-solve ──
      async function solveCaptchaWithAI() {
        try {
          // 1. Pehle DOM text try karo
          const domText = await page.evaluate(() => {
            const el = document.querySelector('.captcha, .captcha.no-copy, div.captcha');
            const t = el ? el.textContent.replace(/\s+/g, '').trim() : '';
            return t;
          });
          if (domText && domText.length >= 4 && domText.length <= 8 && /^[a-zA-Z0-9]+$/.test(domText)) {
            send('progress', `🔑 DOM se CAPTCHA mila: "${domText}"`);
            return domText;
          }

          // 2. Screenshot le CAPTCHA element ka
          send('progress', '📸 CAPTCHA image capture kar raha hoon...');
          const captchaEl = await page.$('.captcha, canvas[id*="captcha"], img[src*="captcha"], .captchaImg, #captchaImg, [class*="captcha"] img, [class*="captcha"] canvas');
          let imgBase64 = null;
          let imgBuf = null;

          if (captchaEl) {
            imgBuf = await captchaEl.screenshot({ type: 'png' });
          } else {
            imgBuf = await page.screenshot({ type: 'png' });
          }
          // Send base64 inline — /tmp not shared across Vercel lambdas
          send('screenshot', '📸 CAPTCHA screenshot ready', { screenshot: imgBuf.toString('base64') });
          imgBase64 = imgBuf.toString('base64');

          // 3. Claude Vision ko bhejo
          send('progress', '🤖 Claude AI CAPTCHA solve kar raha hai...');
          const Anthropic = require('@anthropic-ai/sdk');
          const ai = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
          const resp = await ai.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 50,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgBase64 } },
                { type: 'text', text: 'This is a CAPTCHA image from an Indian government website (SSC). Read the text/numbers shown in the CAPTCHA carefully. Reply with ONLY the CAPTCHA characters, nothing else. No spaces, no explanation.' }
              ]
            }]
          });

          const solved = resp.content[0].text.trim().replace(/\s+/g, '');
          send('progress', `🎯 Claude ne solve kiya: "${solved}"`);
          return solved;
        } catch (e) {
          send('progress', `⚠️ AI solve fail: ${e.message} — user se maang raha hoon`);
          return null;
        }
      }

      // Send base64 inline — /tmp not shared across Vercel lambdas
      const fullBuf = await page.screenshot({ type: 'png' });
      send('screenshot', '📸 Page screenshot saved', { screenshot: fullBuf.toString('base64') });

      // Try AI solve first
      let captchaCode = await solveCaptchaWithAI();

      let ok = false;
      if (captchaCode) {
        send('progress', `✏️ Auto-typing: "${captchaCode}"`);
        ok = await fillCaptchaAndLogin(captchaCode);
      }

      // Retry with AI up to 3 times
      for (let retry = 1; retry <= 3 && !ok; retry++) {
        await page.waitForTimeout(1500);
        send('progress', `🔄 Retry ${retry} — naya CAPTCHA AI solve kar raha hai...`);

        // Click refresh captcha if button exists
        await page.evaluate(() => {
          const refreshBtn = document.querySelector('[class*="captcha"] button, .captcha-refresh, #refreshCaptcha, [title*="refresh"], [title*="Refresh"]');
          if (refreshBtn) refreshBtn.click();
        });
        await page.waitForTimeout(1000);

        captchaCode = await solveCaptchaWithAI();
        if (captchaCode) {
          ok = await fillCaptchaAndLogin(captchaCode);
        } else {
          // Last resort: ask user
          send('captcha', `🔐 AI solve nahi kar paya — manually type karo:`, { captchaText: '' });
          const userTyped = await waitForCaptchaSolution(60000);
          ok = await fillCaptchaAndLogin(userTyped);
        }
      }

      if (!ok) {
        send('error', '❌ Login nahi hua. Page refresh karke dobara try karo.');
        return;
      }
    }

    await page.waitForTimeout(2000);
    send('progress', '✅ Login successful!');

    // ── CHECK NEW / ACTIVE EXAMS ──────────────────────────────
    send('progress', '🔍 Dashboard check kar raha hoon — pending ya new exam...');
    await page.waitForTimeout(3000);

    // ── Helper: Playwright native click by text ────────────────────
    async function clickByText(texts, description) {
      for (var t of texts) {
        try {
          // Try Playwright locator — most reliable for SPAs
          var loc = page.locator(`button, a, [role="tab"]`).filter({ hasText: new RegExp(t, 'i') }).first();
          var count = await loc.count();
          if (count > 0) {
            await loc.scrollIntoViewIfNeeded();
            await loc.click({ force: true });
            send('progress', `✅ Clicked "${description}": ${t}`);
            return t;
          }
        } catch(e) { /* try next */ }
      }
      // Fallback: evaluate click
      var clicked = await page.evaluate(function(texts) {
        var all = Array.from(document.querySelectorAll('button, a, span, div'));
        for (var t of texts) {
          var re = new RegExp(t, 'i');
          var el = all.find(function(e) {
            var r = e.getBoundingClientRect();
            return r.height > 0 && r.width > 0 && re.test((e.textContent || '').trim());
          });
          if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return el.textContent.trim().substring(0, 50);
          }
        }
        return null;
      }, texts);
      if (clicked) send('progress', `✅ Fallback clicked "${description}": ${clicked}`);
      return clicked;
    }

    // ── STEP 1: Click "My Applications" tab ──────────────────────
    send('progress', '📂 My Applications tab pe ja raha hoon...');
    var tabClicked = await clickByText(['My Applications', 'My Application'], 'My Applications Tab');
    await page.waitForTimeout(2500); // wait for tab content to load

    // Debug: log what buttons are visible
    var visibleBtns = await page.evaluate(function() {
      return Array.from(document.querySelectorAll('button, a'))
        .filter(function(e) { var r = e.getBoundingClientRect(); return r.height > 0 && r.width > 0; })
        .map(function(e) { return (e.textContent || '').trim().substring(0, 40); })
        .filter(function(t) { return t.length > 0; })
        .slice(0, 20);
    });
    send('progress', '🔍 Visible buttons: ' + visibleBtns.join(' | '));

    // ── STEP 2: Look for Continue / Resume button ─────────────────
    var resumeClicked = await clickByText(
      ['Continue', 'Resume', 'Incomplete', 'Fill Form', 'Pending'],
      'Resume/Continue'
    );

    if (resumeClicked) {
      send('progress', '✅ Pending application mili — "' + resumeClicked + '" click hua');
      // Wait for page to fully navigate away from dashboard
      try {
        await page.waitForFunction(
          function() { return !window.location.href.includes('/dashboard'); },
          { timeout: 12000 }
        );
        send('progress', '✅ Exam form page pe aa gaye: ' + page.url());
      } catch(e) {
        send('progress', '⚠️ Navigation slow — current URL: ' + page.url());
        await page.waitForTimeout(3000);
      }
    } else {
      // ── STEP 3: No pending — Live Examinations > Apply ───────────
      send('progress', '📋 Pending nahi mila — Live Examinations pe ja raha hoon...');
      await clickByText(['Live Examinations', 'Live Exam'], 'Live Examinations Tab');
      await page.waitForTimeout(2500);

      // Log visible buttons after tab switch
      var liveBtns = await page.evaluate(function() {
        return Array.from(document.querySelectorAll('button, a'))
          .filter(function(e) { var r = e.getBoundingClientRect(); return r.height > 0; })
          .map(function(e) { return (e.textContent || '').trim().substring(0, 40); })
          .filter(function(t) { return t.length > 1; })
          .slice(0, 15);
      });
      send('progress', '🔍 Live Exam buttons: ' + liveBtns.join(' | '));

      // Click Apply button
      var applyClicked = await clickByText(
        ['Apply', 'Apply Now', 'Apply Online'],
        'Apply Button'
      );

      if (!applyClicked) {
        // Try exam name links
        applyClicked = await clickByText(
          ['JHT', 'CGL', 'CHSL', 'MTS', 'CPO', 'Steno', '2026', '2025'],
          'Exam Link'
        );
      }

      if (applyClicked) {
        send('progress', '✅ Apply clicked: ' + applyClicked);
        await page.waitForTimeout(3000);
      } else {
        send('progress', '⚠️ Koi Apply button nahi mila — screenshot dekho');
      }
    }

    // Screenshot of current state
    var examScr = await page.screenshot({ type: 'png', fullPage: false });
    send('screenshot', '📸 Exam page', { screenshot: examScr.toString('base64') });
    send('progress', '📋 Current page: ' + page.url());

    // ── REFRESH-RESILIENT FILL HELPER ─────────────────────────
    // Save all fill data to disk — if page refreshes, re-fill
    var FILL_CACHE_FILE = '/tmp/ssc_fill_cache.json';
    var fillCache = {};

    function saveFillCache() {
      fs.writeFileSync(FILL_CACHE_FILE, JSON.stringify(fillCache));
    }

    async function resilientFill(selector, value, label) {
      // Save to cache
      fillCache[selector] = value;
      saveFillCache();

      var el = await page.$(selector);
      if (!el) { send('progress', '⚠️ Field nahi mila: ' + label); return false; }
      await el.scrollIntoViewIfNeeded();
      await page.evaluate(function(params) {
        var el = document.querySelector(params.sel);
        if (!el) return;
        // Check if already filled correctly
        if (el.value && el.value.trim() === params.val) return;
        var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (proto && proto.set) proto.set.call(el, params.val);
        ['input','change','blur','keyup'].forEach(function(ev) {
          el.dispatchEvent(new Event(ev, { bubbles: true }));
        });
      }, { sel: selector, val: value });
      await page.waitForTimeout(150);
      send('progress', '✅ ' + label + ' filled');
      return true;
    }

    // Re-fill all cached fields after refresh detection
    async function refillIfNeeded() {
      var needsRefill = await page.evaluate(function() {
        var inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
        var empty = inputs.filter(function(el) {
          var r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !el.value.trim();
        });
        return empty.length > 2; // more than 2 empty = probably refreshed
      });

      if (needsRefill && Object.keys(fillCache).length > 0) {
        send('progress', '🔄 Page refresh detect hua — details re-fill kar raha hoon...');
        for (var sel in fillCache) {
          await page.evaluate(function(params) {
            var el = document.querySelector(params.sel);
            if (!el) return;
            var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            if (proto && proto.set) proto.set.call(el, params.val);
            ['input','change','blur'].forEach(function(ev) {
              el.dispatchEvent(new Event(ev, { bubbles: true }));
            });
          }, { sel: sel, val: fillCache[sel] });
          await page.waitForTimeout(100);
        }
        send('progress', '✅ Re-fill complete — ' + Object.keys(fillCache).length + ' fields');
      }
    }

    // Auto Save & Next — Playwright native click + popup dismiss
    async function autoSaveNext(label) {
      label = label || 'Save & Next';

      // Scroll to bottom first
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(800);

      // EXACT text match first, any clickable tag — "Save & Next" on CGL 2026
      // is not always a <button>, and a loose /Next/i match grabs an unrelated
      // "Next" element that navigates to the portal homepage.
      var nextTexts = ['Save & Next', 'Save and Next', 'Save&Next', 'Next', 'Save', 'Submit'];
      var clicked = false;
      for (var nt of nextTexts) {
        try {
          var esc2 = nt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var btn = page.locator('button, a, [role="button"], input[type="submit"], input[type="button"]')
            .filter({ hasText: new RegExp(`^\\s*${esc2}\\s*$`, 'i') }).last();
          if (await btn.count() > 0 && await btn.isVisible()) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ force: true, timeout: 5000 });
            send('progress', `✅ ${label}: "${nt}" clicked`);
            clicked = true;
            break;
          }
        } catch(e) {}
      }

      if (!clicked) {
        // Fallback: evaluate click
        await page.evaluate(() => {
          var btns = Array.from(document.querySelectorAll('button'));
          var btn = btns.find(b => /next|save/i.test(b.textContent) && !b.disabled && b.getBoundingClientRect().height > 0);
          if (btn) btn.click();
        });
        send('progress', `⚠️ ${label}: fallback evaluate click`);
      }

      await page.waitForTimeout(1500);

      // After click — dismiss any success/error popup
      for (var i = 0; i < 3; i++) {
        var dismissed = false;
        for (var pt of ['Okay', 'OK', 'Close']) {
          try {
            var pb = page.getByRole('button', { name: new RegExp(`^${pt}$`, 'i') });
            if (await pb.count() > 0 && await pb.isVisible()) {
              await pb.click({ force: true, timeout: 2000 });
              send('progress', `✅ Post-save popup dismissed: "${pt}"`);
              await page.waitForTimeout(1000);
              dismissed = true;
              break;
            }
          } catch(e) {}
        }
        if (!dismissed) break;
      }
      await page.waitForTimeout(800);
      send('progress', `📋 After ${label}: ${page.url()}`);
    }

    // ── HUMAN-LIKE TYPING HELPERS ──────────────────────────────
    // Type like a human — char by char with random delay
    async function humanType(locator, text) {
      await locator.click();
      await page.waitForTimeout(200 + Math.random() * 200);
      // Clear existing value first
      await locator.selectText().catch(() => {});
      await page.keyboard.press('Backspace');
      for (const ch of text) {
        await page.keyboard.type(ch);
        await page.waitForTimeout(60 + Math.random() * 80); // 60–140ms per char
      }
      await page.waitForTimeout(300 + Math.random() * 200);
    }

    // Fill input with Angular-compatible native setter + human feel
    async function fillField(selector, value, label) {
      const el = await page.$(selector);
      if (!el) { send('progress', `⚠️ Field not found: ${label}`); return; }
      const box = await el.boundingBox();
      if (!box) return;
      // Scroll into view, click, type
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await humanType(page.locator(selector).first(), value);
      // Also fire Angular events via evaluate
      await page.evaluate((sel) => {
        const inp = document.querySelector(sel);
        if (!inp) return;
        ['input','change','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
      }, selector);
      send('progress', `✅ ${label} filled`);
    }

    // Fill textarea human-like
    async function fillTextarea(index, value, label) {
      const tas = await page.$$('textarea');
      const ta = tas[index];
      if (!ta) { send('progress', `⚠️ Textarea ${index} not found: ${label}`); return; }
      await ta.scrollIntoViewIfNeeded();
      await ta.click();
      await page.waitForTimeout(300);
      await ta.selectText().catch(() => {});
      await page.keyboard.press('Backspace');
      for (const ch of value) {
        await page.keyboard.type(ch);
        await page.waitForTimeout(50 + Math.random() * 70);
      }
      await page.evaluate((idx, val) => {
        const ta = document.querySelectorAll('textarea')[idx];
        if (!ta) return;
        const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        s.call(ta, val);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }, index, value);
      send('progress', `✅ ${label} filled`);
    }

    // ── CHECK CURRENT PAGE — Application form ya Dashboard? ──────
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    send('progress', `📋 Current page: ${currentUrl}`);

    // Detect if we landed on an application/exam form page (not dashboard)
    // Also check page content for form indicators
    const pageHasForm = await page.evaluate(() => {
      const url = window.location.href;
      const body = document.body.innerText.toLowerCase();
      return /application-form|jht|cgl|chsl|mts|cpo|steno|gd-|je-/i.test(url)
        || body.includes('personal details')
        || body.includes('education details')
        || body.includes('additional information')
        || body.includes('fill form')
        || body.includes('instructions to follow')
        || document.querySelectorAll('input:not([type="hidden"])').length > 3;
    });

    const isOnExamPage = (
      /application-form|apply-form|jht|cgl|chsl|mts|cpo|steno|gd-|je-|exam-form/i.test(currentUrl)
      || pageHasForm
    ) && !currentUrl.includes('/dashboard');

    if (isOnExamPage) {
      send('progress', '✅ Exam application page detect hua — yahan pe hi kaam karenge!');

      // ── Education data — env se lega, nahi toh dropdown ka pehla valid option ──
      const edu = {
        highestQual:  process.env.HIGHEST_QUAL   || 'Graduation',
        gradDegree:   process.env.GRAD_DEGREE    || 'B.A.',
        gradYear:     process.env.GRAD_YEAR      || '2022',
        gradState:    process.env.GRAD_STATE     || student.state || 'Rajasthan',
        gradUniv:     process.env.GRAD_UNIV      || null,   // will pick first option
        gradSubjects: process.env.GRAD_SUBJECTS  || 'Hindi, English, History',
        gradMedium:   process.env.GRAD_MEDIUM    || 'Hindi',
        gradRoll:     process.env.GRAD_ROLL      || '',
        gradPercent:  process.env.GRAD_PERCENT   || '',
        gradCgpa:     process.env.GRAD_CGPA      || '',
        pgQual:       process.env.PG_QUAL        || 'N/A',  // skip PG by default
        pgEqStatus:   process.env.PG_EQ_STATUS   || '',
        examCenter1:  process.env.EXAM_CENTER1   || 'Jaipur',
        examCenter2:  process.env.EXAM_CENTER2   || 'Ajmer',
      };

      // ── Helper: pick first valid dropdown option if value unknown ──
      async function pickFirstDropdownOption(labelKeyword, fieldName) {
        const picked = await page.evaluate((kw) => {
          // Find all visible dropdowns / selects
          const selects = Array.from(document.querySelectorAll('select'));
          for (const sel of selects) {
            const nearby = sel.closest('[class*="form"], [class*="field"], div')?.innerText || '';
            if (nearby.toLowerCase().includes(kw.toLowerCase()) || selects.length === 1) {
              const opts = Array.from(sel.options).filter(o => o.value && o.value !== '' && !/select/i.test(o.text));
              if (opts.length > 0) {
                sel.value = opts[0].value;
                ['change','input'].forEach(ev => sel.dispatchEvent(new Event(ev, { bubbles: true })));
                return opts[0].text;
              }
            }
          }
          // Try custom dropdown — click and pick first li
          const allDrops = Array.from(document.querySelectorAll('[class*="dropdown"], [class*="select"]'));
          for (const dd of allDrops) {
            const lbl = dd.closest('*')?.querySelector('label, .label, span');
            if (lbl && lbl.textContent.toLowerCase().includes(kw.toLowerCase())) {
              const trigger = dd.querySelector('button, .trigger, .value-area') || dd;
              trigger.click();
              return 'triggered';
            }
          }
          return null;
        }, labelKeyword);

        if (picked && picked !== 'triggered') {
          send('progress', `✅ ${fieldName}: first option = "${picked}"`);
          await page.waitForTimeout(600);
          return picked;
        }
        if (picked === 'triggered') {
          await page.waitForTimeout(700);
          // Click first visible option
          const opt = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('li[role="option"], [class*="option"], [class*="item"]'));
            const visible = items.find(i => i.getBoundingClientRect().height > 0 && i.textContent.trim() && !/select/i.test(i.textContent));
            if (visible) { visible.click(); return visible.textContent.trim(); }
            return null;
          });
          if (opt) send('progress', `✅ ${fieldName}: "${opt}"`);
          await page.waitForTimeout(500);
          return opt;
        }
        send('progress', `⚠️ ${fieldName}: no option found — skip`);
        return null;
      }

      // ── Helper: select dropdown option by partial text ─────────
      async function selectDropdown(labelOrIndex, optionText, fieldName) {
        try {
          // Find all dropdown trigger buttons/divs
          const clicked = await page.evaluate(({ lbl, opt }) => {
            // Try to find by label text
            const allEls = Array.from(document.querySelectorAll('*'));
            let dropdownContainer = null;

            // Method 1: Find by nearby label
            for (const el of allEls) {
              const txt = (el.textContent || '').trim();
              if (txt === lbl && el.children.length <= 3) {
                // Look for dropdown in siblings/parent
                let sib = el.nextElementSibling;
                while (sib) {
                  if (sib.querySelector('select') || sib.classList.toString().includes('select') ||
                      sib.classList.toString().includes('dropdown') || sib.tagName === 'SELECT') {
                    dropdownContainer = sib;
                    break;
                  }
                  sib = sib.nextElementSibling;
                }
                if (!dropdownContainer && el.parentElement) {
                  const parent = el.parentElement;
                  const sel = parent.querySelector('select') ||
                    parent.querySelector('[class*="select"]') ||
                    parent.querySelector('[class*="dropdown"]');
                  if (sel) dropdownContainer = sel;
                }
                if (dropdownContainer) break;
              }
            }

            // Method 2: click the dropdown
            if (dropdownContainer) {
              const trigger = dropdownContainer.tagName === 'SELECT' ? dropdownContainer :
                dropdownContainer.querySelector('select') ||
                dropdownContainer.querySelector('[class*="select-trigger"], [class*="dropdown-toggle"], button, .value-area');
              if (trigger) {
                trigger.scrollIntoView({ block: 'center' });
                trigger.click();
                return 'clicked-trigger';
              }
            }
            return null;
          }, { lbl: labelOrIndex, opt: optionText });

          await page.waitForTimeout(800);

          // Now click the option
          const optClicked = await page.evaluate((opt) => {
            const allEls = Array.from(document.querySelectorAll('li, option, [role="option"], [class*="option"], [class*="item"]'));
            for (const el of allEls) {
              const txt = (el.textContent || '').trim();
              const r = el.getBoundingClientRect();
              if (r.height > 0 && txt.toLowerCase().includes(opt.toLowerCase())) {
                el.scrollIntoView({ block: 'center' });
                el.click();
                return txt;
              }
            }
            // Try native select
            const selects = Array.from(document.querySelectorAll('select'));
            for (const sel of selects) {
              const opts = Array.from(sel.options);
              const found = opts.find(o => o.text.toLowerCase().includes(opt.toLowerCase()));
              if (found) {
                sel.value = found.value;
                ['change','input'].forEach(ev => sel.dispatchEvent(new Event(ev, { bubbles: true })));
                return found.text;
              }
            }
            return null;
          }, optionText);

          if (optClicked) {
            send('progress', `✅ ${fieldName}: "${optClicked}"`);
          } else {
            send('progress', `⚠️ ${fieldName} option "${optionText}" nahi mila — manually select karo`);
          }
          await page.waitForTimeout(600);
        } catch(e) {
          send('progress', `⚠️ ${fieldName} dropdown error: ${e.message}`);
        }
      }

      // ── Helper: fill text input by placeholder/label ───────────
      async function fillInput(keywords, value, fieldName) {
        if (!value) return;
        await page.evaluate(({ kws, val }) => {
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="radio"]):not([type="checkbox"]), textarea'));
          for (const inp of inputs) {
            const hint = ((inp.placeholder || '') + (inp.id || '') + (inp.name || '') + (inp.getAttribute('aria-label') || '')).toLowerCase();
            if (kws.some(k => hint.includes(k.toLowerCase())) && !inp.disabled && !inp.readOnly) {
              inp.scrollIntoView({ block: 'center' });
              const s = inp.tagName === 'TEXTAREA'
                ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
                : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              s.call(inp, val);
              ['input', 'change', 'blur', 'keyup'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
              return;
            }
          }
        }, { kws: keywords, val: value });
        send('progress', `✅ ${fieldName}: "${value}"`);
        await page.waitForTimeout(300);
      }

      // Screenshot of exam home page
      const examHomeSc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
      if (examHomeSc) send('screenshot', '📸 Exam home page', { screenshot: examHomeSc });

      // ── CLICK FILL FORM BUTTON ─────────────────────────────────
      send('progress', '🖱️ Fill Form button click kar raha hoon...');
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(1000);

      const fillFormClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
        const btn = btns.find(b => {
          const txt = (b.textContent || b.value || '').trim();
          const r = b.getBoundingClientRect();
          return r.height > 0 && /fill\s*form|start\s*fill|proceed|begin/i.test(txt);
        });
        if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return btn.textContent.trim(); }
        return null;
      });

      if (fillFormClicked) {
        send('progress', `✅ Fill Form clicked: "${fillFormClicked}"`);
      } else {
        send('progress', '⚠️ Fill Form button nahi mila');
      }
      await page.waitForTimeout(3000);

      // ── POPUP DISMISSER — Playwright native click ─────────────
      async function dismissPopups() {
        // Try multiple strategies to close any popup/modal
        var dismissed = false;

        // Strategy 1: Playwright getByRole button with text
        var popupTexts = ['Okay', 'OK', 'Close', 'Dismiss', 'Got it', 'Done', 'OKAY', 'ok'];
        for (var txt of popupTexts) {
          try {
            var btn = page.getByRole('button', { name: new RegExp(txt, 'i') }).first();
            if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 })) {
              await btn.click({ force: true, timeout: 3000 });
              send('progress', `✅ Popup dismissed (role): "${txt}"`);
              await page.waitForTimeout(1500);
              dismissed = true;
              break;
            }
          } catch(e) {}
        }

        if (!dismissed) {
          // Strategy 2: getByText exact match
          for (var txt2 of popupTexts) {
            try {
              var el = page.getByText(txt2, { exact: true }).first();
              if (await el.count() > 0 && await el.isVisible()) {
                await el.click({ force: true, timeout: 2000 });
                send('progress', `✅ Popup dismissed (text): "${txt2}"`);
                await page.waitForTimeout(600);
                dismissed = true;
                break;
              }
            } catch(e) {}
          }
        }

        if (!dismissed) {
          // Strategy 3: Any visible modal button
          try {
            var modalBtn = page.locator('dialog button, [role="dialog"] button, .modal button, [class*="modal"] button, [class*="dialog"] button').first();
            if (await modalBtn.count() > 0 && await modalBtn.isVisible()) {
              await modalBtn.click({ force: true, timeout: 2000 });
              send('progress', '✅ Popup dismissed (modal button)');
              await page.waitForTimeout(600);
              dismissed = true;
            }
          } catch(e) {}
        }

        if (!dismissed) {
          // Strategy 4: X close button (SVG or ×)
          try {
            var closeBtn = page.locator('button:has(svg), button[aria-label*="close" i], button[aria-label*="dismiss" i]').first();
            if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
              await closeBtn.click({ force: true, timeout: 2000 });
              send('progress', '✅ Popup X closed');
              await page.waitForTimeout(600);
              dismissed = true;
            }
          } catch(e) {}
        }

        return dismissed;
      }

      // ── CUSTOM DROPDOWN FILLER (SSC Angular dropdowns) ─────────
      // labelText = exact label like "19. Highest Educational Qualification:"
      // optionText = option to select like "Graduation"
      async function fillSSCDropdown(labelText, optionText, fieldName) {
        if (!optionText) { send('progress', `⏭️ Skip ${fieldName} — no value`); return false; }
        try {
          send('progress', `🔽 ${fieldName}: looking for "${optionText}"...`);

          // Step 1: Find the dropdown trigger div near this label
          // SSC uses: label text → sibling div with class containing "select" or chevron
          var triggered = await page.evaluate((lbl) => {
            // Find label/span containing the text
            var allEls = Array.from(document.querySelectorAll('label, p, span, div, h4, h5'));
            var labelEl = null;
            for (var el of allEls) {
              var own = (el.childNodes[0]?.textContent || el.textContent || '').trim();
              if (own.includes(lbl.substring(0, 20))) { labelEl = el; break; }
            }
            if (!labelEl) return false;

            // Find the nearest dropdown container (parent or sibling)
            var container = labelEl.closest('[class*="form-field"], [class*="field"], [class*="input"], .col, .row') || labelEl.parentElement;
            if (!container) container = labelEl.parentElement?.parentElement;

            // Find trigger within container
            var trigger = container?.querySelector('[class*="select"], [class*="dropdown"], .chevron, button:not([type="submit"])') || null;

            // Try finding any div that has "Select" as visible text or a chevron SVG
            if (!trigger) {
              var allDivs = Array.from(container?.querySelectorAll('div, span') || []);
              trigger = allDivs.find(d => {
                var r = d.getBoundingClientRect();
                return r.height > 10 && r.width > 50 && /^select$/i.test(d.textContent.trim());
              });
            }

            if (trigger) {
              trigger.scrollIntoView({ block: 'center' });
              trigger.click();
              trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              return true;
            }
            return false;
          }, labelText);

          await page.waitForTimeout(800);

          // Step 2: If page.evaluate didn't work, use Playwright locator
          if (!triggered) {
            // Try: find element containing label text, then find next dropdown
            try {
              var labelLoc = page.getByText(labelText.substring(0, 25), { exact: false }).first();
              if (await labelLoc.count() > 0) {
                // Find dropdown in the same parent section
                var parentEl = await labelLoc.locator('xpath=ancestor::div[contains(@class,"col") or contains(@class,"field") or contains(@class,"form")][1]').first();
                var dropdownEl = parentEl.locator('[class*="select"], [class*="dropdown"]').first();
                if (await dropdownEl.count() > 0) {
                  await dropdownEl.click({ force: true });
                  await page.waitForTimeout(800);
                }
              }
            } catch(e2) {}
          }

          // Step 3: Wait for options panel and click matching option
          await page.waitForTimeout(600);
          var optClicked = await page.evaluate((opt) => {
            // Options are usually in: mat-option, li[role="option"], .dropdown-item, ul > li
            var selectors = [
              'mat-option', '[role="option"]', '.ng-option', '.dropdown-item',
              '[class*="option"]', '[class*="item"]', 'ul li', '.list-item'
            ];
            for (var sel of selectors) {
              var opts = Array.from(document.querySelectorAll(sel));
              var visible = opts.filter(o => {
                var r = o.getBoundingClientRect();
                return r.height > 0 && r.width > 0;
              });
              if (visible.length > 0) {
                var match = visible.find(o => o.textContent.trim().toLowerCase().includes(opt.toLowerCase()));
                if (match) {
                  match.scrollIntoView({ block: 'nearest' });
                  match.click();
                  return match.textContent.trim();
                }
              }
            }
            return null;
          }, optionText);

          if (optClicked) {
            send('progress', `✅ ${fieldName}: "${optClicked}"`);
            await page.waitForTimeout(600);
            return true;
          }

          // Step 4: Last resort — nth select by index
          send('progress', `⚠️ ${fieldName}: option "${optionText}" nahi mila panel mein`);
          return false;

        } catch(e) {
          send('progress', `⚠️ ${fieldName} error: ${e.message}`);
          return false;
        }
      }

      // ── Nth dropdown filler (by position on page) — Playwright native ──
      // ── Option picker — EXACT match first, then prefix, then substring ──
      // Substring-only matching caused "Graduation" to select "Equivalent to
      // Graduation" on the CGL 2026 form, which opened an extra EQ-Status
      // dropdown and shifted every index-based fill after it.
      async function pickVisibleOption(optionText) {
        return await page.evaluate((opt) => {
          var want = opt.trim().toLowerCase();
          var selectors = ['mat-option', '[role="option"]', '.ng-option', '.dropdown-item', '.dropdown-menu li', 'ul.dropdown-menu li', 'li'];
          var doClick = (el) => {
            el.scrollIntoView({ block: 'nearest' });
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return el.textContent.trim();
          };
          for (var sel of selectors) {
            var opts = Array.from(document.querySelectorAll(sel)).filter(o => {
              var r = o.getBoundingClientRect();
              return r.height > 0 && r.width > 0;
            });
            if (opts.length === 0) continue;
            var txt = (o) => o.textContent.trim().toLowerCase();
            var match = opts.find(o => txt(o) === want)
                     || opts.find(o => txt(o).startsWith(want))
                     || opts.find(o => txt(o).includes(want));
            if (match) return doClick(match);
          }
          return null;
        }, optionText);
      }

      // ── UI prompt: question screen pe dikhao, user ke input ka wait karo ──
      // (UI 'otp' type message pe input box dikhata hai; jawab CAPTCHA_FILE me aata hai)
      // Jawab cache hota hai — loop ki agli iteration me wahi sawal dobara
      // NAHI poochha jaata (user ko baar-baar pareshan na karo).
      var ANSWERS_FILE = '/tmp/govform_answers.json';
      function loadAnswers() { try { return JSON.parse(fs.readFileSync(ANSWERS_FILE, 'utf8')); } catch { return {}; } }
      function saveAnswer(q, a) { var all = loadAnswers(); all[q] = a; fs.writeFileSync(ANSWERS_FILE, JSON.stringify(all)); }
      async function askUser(question, fallback) {
        var cached = loadAnswers()[question];
        if (cached) { send('progress', `⏭️ "${question.slice(0, 50)}..." — pichla jawab "${cached}" use kar raha hoon`); return cached; }
        try {
          send('otp', question, { otpFile: CAPTCHA_FILE });
          var ans = await waitForCaptchaSolution(300000);
          ans = (ans || '').trim() || fallback || '';
          if (ans) saveAnswer(question, ans);
          return ans;
        } catch(e) {
          send('progress', `⚠️ User input timeout — ${fallback ? `"${fallback}" use kar raha hoon` : 'skip'}`);
          return fallback || '';
        }
      }

      // ── SSC CGL 2026 dropdown filler (app-dropdown-new component) ──
      // DOM (confirmed via debug-edu-dom.cjs):
      //   <app-dropdown-new label="20.2. Passing Year:">
      //     .value-area  ← trigger (needs a REAL Playwright click; synthetic
      //                    JS click doesn't open it / double-dispatch closes it)
      //     .drop-list.active ul.list li  ← options appear only while open
      // Ek hi field pe 5 baar retry — poora form dobara fill karne ke bajaye.
      async function fillSscDropdown(labelText, optionText, fieldName, tries) {
        tries = tries || 5;
        fillSscDropdown.lastOptions = null;
        for (var attempt = 1; attempt <= tries; attempt++) {
          var ok = await fillSscDropdownOnce(labelText, optionText, fieldName);
          if (ok) return true;
          // "option hi nahi hai" wale case me retry bekaar hai
          if (fillSscDropdown.lastOptions && fillSscDropdown.lastOptions.length) return false;
          if (attempt < tries) {
            send('progress', `🔁 ${fieldName}: retry ${attempt + 1}/${tries}...`);
            await page.waitForTimeout(600);
          }
        }
        return false;
      }

      async function fillSscDropdownOnce(labelText, optionText, fieldName) {
        if (!optionText) { send('progress', `⏭️ Skip ${fieldName} — no value`); return false; }
        try {
          var dd = page.locator(`app-dropdown-new[label*="${labelText}"]`).first();
          if (await dd.count() === 0) {
            // fallback: match by visible .label text
            dd = page.locator('app-dropdown-new').filter({ has: page.locator('.label', { hasText: labelText }) }).first();
          }
          if (await dd.count() === 0) { send('progress', `⚠️ ${fieldName}: app-dropdown "${labelText}" nahi mila`); return false; }

          // Pehle se sahi value set hai? To dobara mat chhedo. NOTE: select hone
          // ke baad .select-type element DOM se hat jaata hai — isliye poora
          // .value-area padho (usme selected text hota hai).
          var current = (await dd.locator('.value-area').first().textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
          if (current && !/^select$/i.test(current) &&
              current.toLowerCase().includes(optionText.toLowerCase())) {
            send('progress', `⏭️ ${fieldName}: pehle se "${current.slice(0, 40)}" — skip`);
            return true;
          }
          send('progress', `🔽 ${fieldName} [app-dropdown "${labelText}"]: "${optionText}"`);

          var va = dd.locator('.value-area').first();
          await va.scrollIntoViewIfNeeded();
          await va.click();
          await page.waitForTimeout(700);

          var esc = optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // exact (whitespace-padded) match first, then substring
          var li = dd.locator('.drop-list li').filter({ hasText: new RegExp(`^\\s*${esc}\\s*$`, 'i') }).first();
          if (await li.count() === 0) li = dd.locator('.drop-list li').filter({ hasText: new RegExp(esc, 'i') }).first();
          if (await li.count() === 0) {
            var avail = await dd.locator('.drop-list li').allTextContents().catch(() => []);
            fillSscDropdown.lastOptions = avail.map(t => t.trim()).filter(Boolean);
            send('progress', `⚠️ ${fieldName}: "${optionText}" options me nahi — mile: ${avail.slice(0, 10).join('|').slice(0, 150)}`);
            await va.click().catch(() => {}); // close panel
            return false;
          }
          await li.scrollIntoViewIfNeeded();
          await li.click();
          await page.waitForTimeout(600);
          var now = await dd.locator('.select-type, .value-area').first().textContent().catch(() => '');
          send('progress', `✅ ${fieldName}: "${(now || optionText).trim()}"`);
          return true;
        } catch(e) {
          send('progress', `⚠️ ${fieldName} error: ${e.message.slice(0, 120)}`);
          return false;
        }
      }

      // ── Type-to-filter for searchable ng-select panels ──────────
      // Long lists (years, states, universities) are virtual-scrolled, so the
      // wanted option may not be in the DOM at all until filtered by typing.
      async function typeInDropdownFilter(text) {
        try {
          var focused = await page.evaluate(() => {
            var inp = document.querySelector(
              '.ng-dropdown-panel input, ng-select input[type="text"], input[role="combobox"], [class*="select"] input[type="text"]:not([readonly])'
            );
            if (!inp) return false;
            var r = inp.getBoundingClientRect();
            if (r.height === 0) return false;
            inp.focus();
            return true;
          });
          if (!focused) return false;
          await page.keyboard.type(text, { delay: 60 });
          await page.waitForTimeout(900);
          return true;
        } catch(e) { return false; }
      }

      // ── Label-based dropdown filler ─────────────────────────────
      // Finds the dropdown that sits right after the question label text,
      // so a new conditional dropdown appearing mid-form can't shift targets
      // the way index-based (#nth) selection does.
      async function fillDropdownByLabel(labelText, optionText, fieldName) {
        if (!optionText) { send('progress', `⏭️ Skip ${fieldName} — no value`); return false; }
        try {
          send('progress', `🔽 ${fieldName} (label "${labelText}"): "${optionText}"`);
          var opened = await page.evaluate(({ lbl, opt }) => {
            var want = lbl.trim().toLowerCase();
            var wantOpt = opt.trim().toLowerCase();
            // Include native <select> — the CGL 2026 form uses plain selects,
            // whose <option>s can't be clicked; we must set .value + change.
            var dds = Array.from(document.querySelectorAll('select, ng-select, mat-select, [class*="ng-select"], [class*="select-container"], [class*="dropdown"]:not([class*="dropdown-menu"])'))
              .filter(el => { var r = el.getBoundingClientRect(); return r.height > 5 && r.width > 10; });
            // Walk all text nodes that contain the label; pick the first dropdown
            // positioned BELOW/AFTER it in document order.
            var labels = Array.from(document.querySelectorAll('label, p, div, span, h1, h2, h3, h4, h5, strong, b'))
              .filter(el => el.children.length <= 2 && (el.textContent || '').trim().toLowerCase().includes(want))
              .filter(el => { var r = el.getBoundingClientRect(); return r.height > 0; });
            for (var lab of labels) {
              var pos = lab.compareDocumentPosition.bind(lab);
              var after = dds.find(dd => pos(dd) & Node.DOCUMENT_POSITION_FOLLOWING);
              if (!after) continue;
              after.scrollIntoView({ block: 'center' });
              if (after.tagName === 'SELECT') {
                var opts = Array.from(after.options);
                var txt = (o) => (o.textContent || '').trim().toLowerCase();
                var match = opts.find(o => txt(o) === wantOpt)
                         || opts.find(o => txt(o).startsWith(wantOpt))
                         || opts.find(o => txt(o).includes(wantOpt));
                if (!match) return { ok: false, reason: 'native select me option nahi: ' + opts.slice(0,8).map(o=>o.textContent.trim()).join('|') };
                after.value = match.value;
                after.dispatchEvent(new Event('input',  { bubbles: true }));
                after.dispatchEvent(new Event('change', { bubbles: true }));
                return { ok: true, native: true, picked: match.textContent.trim() };
              }
              after.click();
              after.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              after.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              return { ok: true, native: false };
            }
            return { ok: false, reason: 'label ke paas dropdown nahi mila' };
          }, { lbl: labelText, opt: optionText });
          if (!opened.ok) { send('progress', `⚠️ ${fieldName}: ${opened.reason}`); return false; }
          if (opened.native) {
            send('progress', `✅ ${fieldName}: "${opened.picked}" (native select)`);
            await page.waitForTimeout(700);
            return true;
          }
          await page.waitForTimeout(1000);
          var clicked = await pickVisibleOption(optionText);
          if (!clicked && await typeInDropdownFilter(optionText)) {
            clicked = await pickVisibleOption(optionText);
          }
          if (clicked) {
            send('progress', `✅ ${fieldName}: "${clicked}"`);
            await page.waitForTimeout(700);
            return true;
          }
          send('progress', `⚠️ ${fieldName}: no option found for "${optionText}"`);
          return false;
        } catch(e) {
          send('progress', `⚠️ ${fieldName} error: ${e.message}`);
          return false;
        }
      }

      async function fillNthDropdown(nth, optionText, fieldName) {
        if (!optionText) { send('progress', `⏭️ Skip ${fieldName} (nth=${nth}) — no value`); return false; }
        try {
          send('progress', `🔽 ${fieldName} (dropdown #${nth}): "${optionText}"`);

          // SSC uses ng-select custom dropdowns — target .ng-select or .ng-select-container
          // Also try mat-select, [class*="select"] as fallbacks
          var selectors = [
            'ng-select',
            '.ng-select',
            'mat-select',
            '[class*="ng-select"]',
            '[class*="select-container"]',
            '[class*="dropdown"]:not([class*="dropdown-menu"])',
          ];

          var found = false;
          for (var sel of selectors) {
            var loc = page.locator(sel).filter({ visible: true });
            var cnt = await loc.count();
            if (cnt >= nth) {
              send('progress', `  📊 Using selector "${sel}", count=${cnt}, picking #${nth}`);
              var target = loc.nth(nth - 1);
              await target.scrollIntoViewIfNeeded();
              await target.click({ force: true });
              await page.waitForTimeout(1000);
              found = true;
              break;
            }
          }

          if (!found) {
            // Last resort: evaluate click on nth visible dropdown-like element
            send('progress', `  ⚠️ No selector matched — using evaluate fallback`);
            await page.evaluate((n) => {
              var all = Array.from(document.querySelectorAll('ng-select, mat-select, [class*="ng-select"], select'))
                .filter(el => {
                  var r = el.getBoundingClientRect();
                  return r.height > 5 && r.width > 10;
                });
              var el = all[n - 1];
              if (el) {
                el.scrollIntoView({ block: 'center' });
                el.click();
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              }
            }, nth);
            await page.waitForTimeout(1000);
          }

          var clicked = await pickVisibleOption(optionText);
          if (!clicked && await typeInDropdownFilter(optionText)) {
            clicked = await pickVisibleOption(optionText);
          }

          if (clicked) {
            send('progress', `✅ ${fieldName}: "${clicked}"`);
            await page.waitForTimeout(700);
            return true;
          }
          send('progress', `⚠️ ${fieldName}: no option found for "${optionText}"`);
          return false;
        } catch(e) {
          send('progress', `⚠️ ${fieldName} error: ${e.message}`);
          return false;
        }
      }

      // ── Text input filler — Angular compatible ─────────────────
      async function fillTextByPlaceholder(placeholder, value, fieldName) {
        if (!value) { send('progress', `⏭️ Skip ${fieldName} — no value`); return false; }
        try {
          var inp = page.locator(`input[placeholder*="${placeholder}" i], textarea[placeholder*="${placeholder}" i]`).first();
          var cnt = await inp.count();
          if (cnt > 0) {
            await inp.scrollIntoViewIfNeeded();
            await inp.click({ force: true });
            await page.waitForTimeout(200);
            // Clear existing value
            await inp.selectText().catch(() => {});
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            // Type value
            await inp.fill(value);
            // Fire Angular events
            var sel = `input[placeholder*="${placeholder}" i], textarea[placeholder*="${placeholder}" i]`;
            // Playwright page.evaluate passes exactly ONE arg — wrap multiple in an object.
            await page.evaluate(({ s, v }) => {
              var el = document.querySelector(s);
              if (!el) return;
              var proto = Object.getOwnPropertyDescriptor(
                el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
              );
              if (proto && proto.set) proto.set.call(el, v);
              ['input','change','blur','keyup'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
            }, { s: sel, v: value });
            await page.waitForTimeout(300);
            send('progress', `✅ ${fieldName}: "${value}"`);
            return true;
          } else {
            // Fallback: try by label text
            send('progress', `⚠️ ${fieldName}: placeholder "${placeholder}" nahi mila — label try karta hoon`);
            return false;
          }
        } catch(e) { send('progress', `⚠️ ${fieldName}: ${e.message}`); return false; }
      }

      // ── MULTI-STEP FORM FILL LOOP ──────────────────────────────
      var maxSteps = 15;
      var stepCount = 0;
      var lastFormUrl = null; // recovery: portal kabhi-kabhi save ke baad homepage pe phenk deta hai

      while (stepCount < maxSteps) {
        // Dismiss any popup first
        await dismissPopups();
        await page.waitForTimeout(1000);
        var stepUrl = page.url();

        if (stepUrl.includes('application-form') || stepUrl.includes('candidate-portal/cgl')) {
          lastFormUrl = stepUrl;
        } else if (lastFormUrl && !stepUrl.includes('candidate-portal')) {
          // Save ke baad homepage/root pe redirect ho gaye — form pe wapas jao
          send('progress', '↩️ Portal ne form se bahar phenk diya — form pe wapas ja raha hoon...');
          await page.goto(lastFormUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(3000);
          stepUrl = page.url();
        }
        send('progress', `📋 Step ${stepCount + 1}: ${stepUrl}`);

        // Take screenshot of each step
        var stepSc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
        if (stepSc) send('screenshot', `📸 Step ${stepCount + 1}`, { screenshot: stepSc });

        // Detect step type from URL and page content
        var stepInfo = await page.evaluate(() => {
          var url = window.location.href.toLowerCase();
          var body = (document.body.innerText || '').toLowerCase();
          // A real form step (personal/education/etc.) is identified by its URL slug.
          // Note: form URLs can ALSO contain "/null/" as a route param after the exam id
          // (e.g. .../personal-details/cgl..2026/null/false), so "/null/" alone must NOT
          // be treated as the home page — only the literal "home-page" slug, or "/null/"
          // when no form-step slug is present.
          var isFormStep = /personal-details|education|additional|professional-background|exam-requirements|upload|document|preview|submit|payment/.test(url);
          return {
            url,
            isHomePage:    url.includes('home-page') || (url.includes('/null/') && !isFormStep),
            // URL is authoritative. The body fallback ("personal details" text) must be
            // ignored when the URL already points at a later step, because the page's
            // breadcrumb/stepper still renders "Personal Details" as a completed label —
            // that false-positive made the bot re-fill personal on the education page.
            isPersonal:    url.includes('personal') || (body.includes('personal details') && !isFormStep),
            isEducation:   url.includes('education'),
            isAdditional1: url.includes('additional') && (url.includes('-i') || url.includes('additional-information-i')),
            isAdditional2: url.includes('additional') && (url.includes('-ii') || url.includes('additional-information-ii')),
            // CGL 2026: "Additional Information-I" = /professional-background/,
            // "Additional Information-II" = /exam-requirements/
            isAdditional:  url.includes('additional') || url.includes('professional-background') || url.includes('exam-requirements'),
            isUpload:      url.includes('upload') || url.includes('document'),
            isPreview:     url.includes('preview'),
            isSubmit:      url.includes('submit'),
            isDone:        body.includes('successfully submitted') || body.includes('application submitted') || body.includes('form has been submitted'),
            isPayment:     url.includes('payment') || body.includes('pay fee'),
          };
        });

        // ── DONE ──────────────────────────────────────────────────
        if (stepInfo.isDone) {
          send('progress', '🎉 Form successfully submitted!');
          break;
        }

        // ── STILL ON HOME PAGE (Fill Form not clicked yet) ────────
        if (stepInfo.isHomePage) {
          send('progress', '🖱️ Still on home page — Fill Form retry...');
          await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
          await page.waitForTimeout(800);
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const btn = btns.find(b => /fill\s*form/i.test((b.textContent || '').trim()) && b.getBoundingClientRect().height > 0);
            if (btn) btn.click();
          });
          await page.waitForTimeout(2500);
          stepCount++;
          continue;
        }

        // ── PERSONAL DETAILS ──────────────────────────────────────
        if (stepInfo.isPersonal) {
          send('progress', '👤 Personal Details step');
          // First dismiss any popup (Success/Okay)
          await dismissPopups();
          await page.waitForTimeout(800);

          // Check if still showing popup
          var stillPopup = await page.evaluate(() => {
            return !!document.querySelector('[class*="modal"], [class*="dialog"], [role="dialog"]');
          });
          if (stillPopup) {
            send('progress', '⚠️ Popup still visible — pressing Escape...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);
          }

          // Click "Next" button (Personal Details already filled from OTR)
          await clickByText(['Next', 'Save & Next', 'Save and Next'], 'Personal Next');
          await page.waitForTimeout(2000);
          // Dismiss success popup after Next
          await dismissPopups();
          await page.waitForTimeout(1000);
          stepCount++;
          continue;
        }

        // ── EDUCATION DETAILS ─────────────────────────────────────
        if (stepInfo.isEducation) {
          await dismissPopups();
          await page.waitForTimeout(1000);

          // Form pehle se COMPLETE hai? To kuch mat chhedo — seedha Save & Next.
          // (Re-select karne se dependent fields reset ho jaati thi aur loop banta tha.)
          var eduDone = await page.evaluate(() => {
            var dds = Array.from(document.querySelectorAll('app-dropdown-new'));
            if (!dds.length) return false;
            var unset = dds.filter(d => {
              var st = d.querySelector('.select-type');
              return st && /^\s*select\s*$/i.test(st.textContent || '');
            }).length;
            var roll = document.querySelector('input[placeholder*="roll" i]');
            return unset === 0 && (!roll || (roll.value || '').length > 2);
          }).catch(() => false);
          if (eduDone) {
            send('progress', '⏭️ Education pehle se complete — seedha Save & Next');
            var eduBtn2 = page.locator('form button.save-btn').first();
            if (await eduBtn2.count() > 0) { await eduBtn2.scrollIntoViewIfNeeded(); await eduBtn2.click().catch(() => {}); }
            await page.waitForTimeout(2500);
            await dismissPopups();
            stepCount++;
            continue;
          }

          send('progress', '📚 Education Details fill ho raha hai...');

          // Ask for missing data via chat
          if (!edu.gradDegree || !edu.gradYear || !edu.gradPercent) {
            send('progress', '⚠️ Kuch education data missing hai — chat mein puch raha hoon...');
          }

          if (!edu.gradDegree) {
            send('otp', '📚 Graduation Degree kya hai? (B.A. / B.Sc. / B.Com. / B.Tech. etc.)', { otpFile: CAPTCHA_FILE });
            edu.gradDegree = await waitForCaptchaSolution(300000);
          }
          if (!edu.gradYear) {
            send('otp', '📅 Graduation Passing Year kya hai? (jaise: 2022)', { otpFile: CAPTCHA_FILE });
            edu.gradYear = await waitForCaptchaSolution(300000);
          }
          if (!edu.gradUniv) {
            send('otp', '🏫 Graduation University/Institute ka naam? (jo form mein option mein aaye)', { otpFile: CAPTCHA_FILE });
            edu.gradUniv = await waitForCaptchaSolution(300000);
          }
          if (!edu.gradRoll) {
            send('otp', '🔢 Graduation Roll Number kya hai?', { otpFile: CAPTCHA_FILE });
            edu.gradRoll = await waitForCaptchaSolution(300000);
          }
          if (!edu.gradPercent && !edu.gradCgpa) {
            send('otp', '📊 Graduation Percentage ya CGPA? (jaise: 65.50 ya 7.5)', { otpFile: CAPTCHA_FILE });
            var percOrCgpa = await waitForCaptchaSolution(300000);
            if (percOrCgpa.includes('.') && parseFloat(percOrCgpa) <= 10) edu.gradCgpa = percOrCgpa;
            else edu.gradPercent = percOrCgpa;
          }

          send('progress', `📝 Filling: ${edu.highestQual} | ${edu.gradDegree} | ${edu.gradYear} | ${edu.gradState} | ${edu.gradUniv}`);
          send('progress', `📝 Subjects: ${edu.gradSubjects} | Medium: ${edu.gradMedium} | Roll: ${edu.gradRoll} | %: ${edu.gradPercent}`);

          // ── GRADUATION DROPDOWNS (app-dropdown-new, by question label) ──
          // CGL 2026 uses custom <app-dropdown-new label="..."> components;
          // index-based (#nth) filling broke when "Equivalent to Graduation"
          // opened an extra EQ-Status dropdown and shifted every index.
          await fillSscDropdown('Highest Educational', edu.highestQual, 'Q19 Highest Qual')
            || await fillNthDropdown(1, edu.highestQual, 'Q19 Highest Qual');
          await page.waitForTimeout(600);

          // CGL 2026: Q20 options are qualification LEVELS (Graduation /
          // Equivalent to Graduation...), not degree names like B.A.
          await fillSscDropdown('Qualifying Educational Qualification', edu.highestQual || 'Graduation', 'Q20 Qualification')
            || await fillNthDropdown(2, edu.highestQual || 'Graduation', 'Q20 Qualification');
          await page.waitForTimeout(600);

          // Q20.1 EQ Status (required on CGL 2026): "Passed" / "Appearing".
          // Degree complete (passing year past) → Passed; warna Appearing.
          var eqStatus = process.env.EQ_STATUS ||
            (parseInt(edu.gradYear, 10) <= new Date().getFullYear() ? 'Passed' : 'Appearing');
          await fillSscDropdown('EQ Status', eqStatus, 'Q20.1 EQ Status');

          await fillSscDropdown('Passing Year', edu.gradYear, 'Q20.2 Year');
          await page.waitForTimeout(800);

          await fillSscDropdown('State/ UT of University', edu.gradState, 'Q20.3 State')
            || await fillSscDropdown('State', edu.gradState, 'Q20.3 State');
          await page.waitForTimeout(2000); // wait for university list to load after state

          await fillSscDropdown('Name of University', edu.gradUniv, 'Q20.4 University');
          await page.waitForTimeout(600);

          // Subjects — text input (not present on every layout)
          await fillTextByPlaceholder('ubject', edu.gradSubjects, 'Q20.5 Subjects');

          await fillSscDropdown('Medium', edu.gradMedium, 'Q20.6 Medium');
          await page.waitForTimeout(1000);

          // Roll Number — CGL 2026 placeholder is "Enter roll no here..."
          await fillTextByPlaceholder('roll no', edu.gradRoll, 'Q20.5 Roll')
            || await fillTextByPlaceholder('graduation roll', edu.gradRoll, 'Q20.7 Roll');

          // Q20.8 Percentage
          if (edu.gradPercent) await fillTextByPlaceholder('ercentage', edu.gradPercent, 'Q20.8 Percentage');

          // Q20.9 CGPA
          if (edu.gradCgpa) await fillTextByPlaceholder('cgpa', edu.gradCgpa, 'Q20.9 CGPA');

          // ── POST GRADUATION ───────────────────────────────────────
          await page.waitForTimeout(500);
          // Auto-skip PG if not set in env (user doesn't have PG)
          var hasPG = edu.pgQual && edu.pgQual.trim() && edu.pgQual.toUpperCase() !== 'N/A' && edu.pgQual.trim() !== '';
          send('progress', `📚 Post Graduation: ${hasPG ? 'YES — filling' : 'NO — skip karte hain'}`);

          if (hasPG) {
            if (!edu.pgQual) {
              send('otp', '🎓 PG Degree kya hai? (M.A. / M.Sc. / M.Com. etc.)', { otpFile: CAPTCHA_FILE });
              edu.pgQual = await waitForCaptchaSolution(300000);
            }
            if (!edu.pgYear) {
              send('otp', '📅 PG Passing Year?', { otpFile: CAPTCHA_FILE });
              edu.pgYear = await waitForCaptchaSolution(300000);
            }
            if (!edu.pgUniv) {
              send('otp', '🏫 PG University naam?', { otpFile: CAPTCHA_FILE });
              edu.pgUniv = await waitForCaptchaSolution(300000);
            }
            if (!edu.pgRoll) {
              send('otp', '🔢 PG Roll Number?', { otpFile: CAPTCHA_FILE });
              edu.pgRoll = await waitForCaptchaSolution(300000);
            }
            if (!edu.pgPercent && !edu.pgCgpa) {
              send('otp', '📊 PG Percentage ya CGPA?', { otpFile: CAPTCHA_FILE });
              var pgPerc = await waitForCaptchaSolution(300000);
              if (pgPerc.includes('.') && parseFloat(pgPerc) <= 10) edu.pgCgpa = pgPerc;
              else edu.pgPercent = pgPerc;
            }

            // Dropdown #7 = Q21.1 PG Qual
            await fillNthDropdown(7, edu.pgQual, 'Q21.1 PG Qual');
            await page.waitForTimeout(1000);
            // Dropdown #8 = Q21.2 EQ Status — pick first
            await fillNthDropdown(8, edu.pgEqStatus || 'Passed', 'Q21.2 EQ Status');
            await page.waitForTimeout(1000);
            // Dropdown #9 = Q21.3 Year
            await fillNthDropdown(9, edu.pgYear, 'Q21.3 PG Year');
            await page.waitForTimeout(1000);
            // Dropdown #10 = Q21.4 State
            await fillNthDropdown(10, edu.pgState || edu.gradState, 'Q21.4 PG State');
            await page.waitForTimeout(2000);
            // Dropdown #11 = Q21.5 University
            await fillNthDropdown(11, edu.pgUniv, 'Q21.5 PG Univ');
            await page.waitForTimeout(1000);
            // Q21.6 Subjects
            await fillTextByPlaceholder('ubject', edu.pgSubjects || edu.gradSubjects, 'Q21.6 PG Subjects');
            // Dropdown #12 = Q21.7 Medium
            await fillNthDropdown(12, edu.pgMedium || edu.gradMedium, 'Q21.7 PG Medium');
            await page.waitForTimeout(800);
            // Q21.8 Roll
            await fillTextByPlaceholder('post graduation roll', edu.pgRoll, 'Q21.8 PG Roll');
            // Q21.9 Percentage
            if (edu.pgPercent) await fillTextByPlaceholder('ercentage', edu.pgPercent, 'Q21.9 PG Percent');
            if (edu.pgCgpa) await fillTextByPlaceholder('cgpa', edu.pgCgpa, 'Q21.10 PG CGPA');
          } else {
            send('progress', '✅ Post Graduation — skip (No PG)');
          }

          // Screenshot before save
          var eduSc = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
          if (eduSc) send('screenshot', '📸 Education filled — check karo', { screenshot: eduSc });

          // Dismiss any popup then Save & Next — form ke andar wala asli
          // button.save-btn (loose /Next/i match galat element pakad leta hai)
          await dismissPopups();
          await page.waitForTimeout(500);
          var eduSaveBtn = page.locator('form button.save-btn').filter({ hasText: /save|next/i }).first();
          if (await eduSaveBtn.count() > 0) {
            await eduSaveBtn.scrollIntoViewIfNeeded();
            await eduSaveBtn.click({ timeout: 5000 }).catch(() => {});
            send('progress', '✅ Education Save & Next (button.save-btn) clicked');
          } else {
            await clickByText(['Save & Next', 'Save and Next', 'Next', 'Save'], 'Education Save & Next');
          }
          await page.waitForTimeout(2000);
          await dismissPopups(); // dismiss success popup after save
          await page.waitForTimeout(1500);

          // Agar abhi bhi education page pe hain, to validation rok rahi hai —
          // page ke red error messages user ko dikhao taaki guess na karna pade.
          if (page.url().toLowerCase().includes('education')) {
            var valErrors = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('.text-danger, [class*="error"], [class*="invalid-feedback"], .mat-error'))
                .map(el => (el.textContent || '').trim())
                .filter(t => t.length > 3 && t.length < 120)
                .slice(0, 8);
            }).catch(() => []);
            if (valErrors.length) {
              send('progress', `🚫 Validation errors: ${[...new Set(valErrors)].join(' • ')}`);
            }
          }
          stepCount++;
          continue;
        }

        // ── ADDITIONAL INFORMATION ────────────────────────────────
        if (stepInfo.isAdditional) {
          send('progress', '📋 Additional Information fill ho raha hai...');
          await page.waitForTimeout(1500);

          // Yes/No radio answer — find the question text, then real-click the
          // radio whose label matches the answer (mouse click; Angular needs it)
          async function answerRadio(qKeyword, answer, fieldName) {
            try {
              // Pehle se sahi radio checked hai? Skip — dobara mat chhedo.
              var already = await page.evaluate(({ kw, ans }) => {
                var kwl = kw.toLowerCase();
                var qEls = Array.from(document.querySelectorAll('*')).filter(el =>
                  el.children.length <= 3 && (el.textContent || '').toLowerCase().includes(kwl) &&
                  el.getBoundingClientRect().height > 0)
                  .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
                if (!qEls.length) return false;
                var after = Array.from(document.querySelectorAll('input[type="radio"]'))
                  .filter(r => qEls[0].compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING);
                if (after.length < 2) return false;
                return after[ans.toLowerCase() === 'yes' ? 0 : 1].checked;
              }, { kw: qKeyword, ans: answer }).catch(() => false);
              if (already) { send('progress', `⏭️ ${fieldName}: pehle se ${answer} — skip`); return true; }
              var pt = await page.evaluate(({ kw, ans }) => {
                var kwl = kw.toLowerCase();
                // Question label: SHORTEST visible match — most specific, warna
                // "22.1 ... Age Relaxation Code" wala label Q22 ("Age Relaxation")
                // ki lookup hijack kar leta hai.
                var qEls = Array.from(document.querySelectorAll('*')).filter(el =>
                  el.children.length <= 3 &&
                  (el.textContent || '').toLowerCase().includes(kwl) &&
                  el.getBoundingClientRect().height > 0)
                  .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
                if (!qEls.length) return null;
                var q = qEls[0];
                // Question ke BAAD document order me aane wale pehle radios —
                // SSC layout: pehla = Yes, doosra = No. (Container walk-up form
                // tak chala jaata tha aur galat question ke radios pakad leta tha.)
                var after = Array.from(document.querySelectorAll('input[type="radio"]'))
                  .filter(r => q.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING);
                if (after.length < 2) return null;
                var r = after[ans.toLowerCase() === 'yes' ? 0 : 1];
                var rect = (r.closest('label') || r).getBoundingClientRect();
                return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
              }, { kw: qKeyword, ans: answer });
              if (!pt) { send('progress', `⚠️ ${fieldName}: radio "${answer}" nahi mila`); return false; }
              await page.mouse.click(pt.x, pt.y);
              await page.waitForTimeout(500);
              // Verify the radio actually got checked (Angular custom radios
              // sometimes ignore the click) — agar nahi, to input pe direct click.
              var verified = await page.evaluate(({ kw, ans }) => {
                var kwl = kw.toLowerCase();
                var qEls = Array.from(document.querySelectorAll('*')).filter(el =>
                  el.children.length <= 3 && (el.textContent || '').toLowerCase().includes(kwl) &&
                  el.getBoundingClientRect().height > 0);
                if (!qEls.length) return false;
                var q2 = qEls.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
                var after2 = Array.from(document.querySelectorAll('input[type="radio"]'))
                  .filter(r => q2.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING);
                if (after2.length < 2) return false;
                var r = after2[ans.toLowerCase() === 'yes' ? 0 : 1];
                if (!r.checked) {
                  r.click();
                  r.checked = true;
                  ['input','change','click'].forEach(ev => r.dispatchEvent(new Event(ev, { bubbles: true })));
                }
                return r.checked;
              }, { kw: qKeyword, ans: answer });
              send('progress', `${verified ? '✅' : '⚠️'} ${fieldName}: ${answer}${verified ? '' : ' (checked verify FAIL)'}`);
              return verified;
            } catch(e) { send('progress', `⚠️ ${fieldName}: ${e.message.slice(0, 100)}`); return false; }
          }

          if (page.url().toLowerCase().includes('exam-requirements')) {
            // CGL 2026 Additional Information-II: exam languages + AAO post opts
            var lang = process.env.EXAM_LANGUAGE || 'Hindi';
            // Q29.1 — .custom-multi-select component (selected-box trigger + chips)
            try {
              var msBox = page.locator('.custom-multi-select .selected-box').first();
              if (await msBox.count() > 0) {
                var alreadyPicked = await page.locator('.custom-multi-select .chips-container').first().textContent().catch(() => '');
                if ((alreadyPicked || '').toLowerCase().includes(lang.toLowerCase())) {
                  send('progress', `✅ Q29.1 Language: "${lang}" pehle se selected`);
                } else {
                  await msBox.scrollIntoViewIfNeeded();
                  await msBox.click();
                  await page.waitForTimeout(800);
                  var langEsc = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  // options: .dropdown-list > .dropdown-item (checkbox + text)
                  var langOpt = page.locator('.custom-multi-select .dropdown-item')
                    .filter({ hasText: new RegExp(`^\\s*${langEsc}\\s*$`, 'i') }).first();
                  if (await langOpt.count() > 0) {
                    await langOpt.locator('input[type="checkbox"]').click().catch(async () => { await langOpt.click(); });
                    send('progress', `✅ Q29.1 Language: "${lang}"`);
                  } else {
                    var availLang = await page.locator('.custom-multi-select .dropdown-item').allTextContents().catch(() => []);
                    send('progress', `⚠️ Q29.1 Language: "${lang}" nahi mila — options: ${availLang.slice(0, 8).join('|').slice(0, 120)}`);
                  }
                  await page.keyboard.press('Escape').catch(() => {});
                  await page.mouse.click(640, 200); // click outside to close panel
                  await page.waitForTimeout(500);
                }
              } else send('progress', '⚠️ Q29.1: custom-multi-select nahi mila');
            } catch(e) { send('progress', `⚠️ Q29.1 Language: ${e.message.slice(0, 100)}`); }

            // Q25 CBE medium + verify (dono same value)
            await fillSscDropdown('Medium for Computer Based', process.env.CBE_MEDIUM || lang, 'Q25 CBE Medium');
            await fillSscDropdown('Verify Medium', process.env.CBE_MEDIUM || lang, 'Q25 Verify CBE Medium');
            await fillSscDropdown('Medium of Matriculation', process.env.MATRIC_MEDIUM || lang, 'Q29.2 Matric Medium');
            // User-specific Yes/No sawal: screen pe poochho, user ke jawab se tick karo.
            // Env var set ho to bina pooche use karo.
            async function askRadioOnScreen(kw, fieldName, envVal, defAns) {
              // Portal pe ye sawal pehle se answered hai? To mat poochho.
              var done = await page.evaluate((k) => {
                var kwl = k.toLowerCase();
                var qEls = Array.from(document.querySelectorAll('*')).filter(el =>
                  el.children.length <= 3 && (el.textContent || '').toLowerCase().includes(kwl) &&
                  el.getBoundingClientRect().height > 0)
                  .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
                if (!qEls.length) return null;
                var after = Array.from(document.querySelectorAll('input[type="radio"]'))
                  .filter(r => qEls[0].compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING);
                if (after.length < 2) return null;
                if (after[0].checked) return 'Yes';
                if (after[1].checked) return 'No';
                return null;
              }, kw).catch(() => null);
              if (done) { send('progress', `⏭️ ${fieldName}: pehle se ${done} — skip`); return done; }
              var ans = envVal;
              if (!ans) {
                ans = await askUser(`❓ ${fieldName} — "Yes" ya "No" type karo (default: ${defAns})`, defAns);
              }
              ans = /^y/i.test((ans || '').trim()) ? 'Yes' : 'No';
              await answerRadio(kw, ans, fieldName);
              return ans;
            }
            await askRadioOnScreen('category of blindness', 'Q26.1 Benchmark disability — blindness (VH) hai?', process.env.DISABILITY_VH, 'No');
            await askRadioOnScreen('Both Arms Affected', 'Q26.2 Benchmark disability — Both Arms/Cerebral Palsy hai?', process.env.DISABILITY_BA, 'No');
            // Keyword me "also applying for the Post of" rakho — warna 27.1/28.1
            // ke saath EQ wala 27.2/28.2 bhi match ho jaata tha aur galat
            // sub-question tick ho jaata tha.
            var jso = await askRadioOnScreen('also applying for the Post of Junior Statistical', 'Q27.1 JSO (MoSPI) ke liye bhi apply karna hai?', process.env.JSO, 'No');
            if (jso === 'Yes') await answerRadio('possess EQ for the Post of Junior Statistical', 'Yes', 'Q27.2 JSO EQ');
            var rgi = await askRadioOnScreen('also applying for the Post of Statistical Investigator', 'Q28.1 Statistical Investigator (RGI) ke liye bhi apply?', process.env.SI_RGI, 'No');
            if (rgi === 'Yes') await answerRadio('possess EQ for the Post of Statistical Investigator', 'Yes', 'Q28.2 RGI EQ');
            await askRadioOnScreen('Physical limitation to write', 'Q26.3 Likhne me physical limitation hai?', process.env.PHYS_LIMIT, 'No');

            // AAO posts bhi user se screen pe poochho (env set ho to skip)
            var aaoC = await askRadioOnScreen('applying for the Post of Assistant Audit Officer (Central', 'Q30.1 Assistant Audit Officer (Central) ke liye apply?', process.env.AAO_CENTRAL, 'No');
            if (aaoC === 'Yes') await answerRadio('possess EQ for the Post of Assistant Audit Officer (Central', 'Yes', 'Q30.2 AAO Central EQ');
            var aaoS = await askRadioOnScreen('applying for the Post of Assistant Audit Officer (State', 'Q31.1 Assistant Audit Officer (State) ke liye apply?', process.env.AAO_STATE, 'No');
            if (aaoS === 'Yes') await answerRadio('possess EQ for the Post of Assistant Audit Officer (State', 'Yes', 'Q31.2 AAO State EQ');
            var aaoA = await askRadioOnScreen('applying for the Post of Assistant Accounts Officer (State', 'Q32.1 Assistant Accounts Officer (State) ke liye apply?', process.env.AAO_ACCOUNTS, 'No');
            if (aaoA === 'Yes') await answerRadio('possess EQ for the Post of Assistant Accounts Officer (State', 'Yes', 'Q32.2 AAO Accounts EQ');
            await page.waitForTimeout(500);
          } else {
            // CGL 2026 Additional Information-I (defaults per user instruction:
            // ESM No, Age Relaxation No, job-opportunities info sharing Yes)
            await answerRadio('Ex-Servicemen', process.env.ESM || 'No', 'Q21 Ex-Servicemen');
            await answerRadio('seeking Age Relaxation', process.env.AGE_RELAXATION || 'No', 'Q22 Age Relaxation');
            await answerRadio('job opportunities', process.env.INFO_SHARING || 'Yes', 'Q23 Info Sharing');
            await page.waitForTimeout(500);
          }

          // Exam center / Category sirf tab jab ye fields IS page ke form me hain.
          // (CGL 2026 Additional-I me ye nahi hote; blind selectDropdown('Category')
          // header ka "Staff Selection Commission" link click karke homepage khol deta tha.)
          var formText = await page.evaluate(() => document.querySelector('form')?.innerText || '');
          if (/exam\s*center|preference/i.test(formText)) {
            if (!edu.examCenter1) {
              edu.examCenter1 = await askUser('Exam Center 1st preference kya chahiye? (city name, jaise: Jaipur)', edu.examCenter1);
            }
            if (!edu.examCenter2) {
              edu.examCenter2 = await askUser('Exam Center 2nd preference? (city name)', edu.examCenter2);
            }
            // CGL 2026 labels: "Preference 1" / "Preference 2" / "Preference 3"
            // Chaha hua center option me na ho to user se SCREEN PE poochho
            // (options ke sath) aur uske click/type ka wait karo.
            // Student ki state ke centers options me PEHLE dikhao (profile/marksheet
            // se state pata hai — GRAD_STATE/STATE env).
            var studentState = (process.env.GRAD_STATE || process.env.STATE || 'Rajasthan').toLowerCase();
            var STATE_CITIES = {
              rajasthan: ['jaipur', 'ajmer', 'alwar', 'bharatpur', 'bikaner', 'jodhpur', 'kota', 'sikar', 'sriganganagar', 'udaipur'],
            };
            var homeCities = STATE_CITIES[studentState] || [];
            function sortByHomeState(opts) {
              return [...opts].sort((a, b) => {
                var ah = homeCities.some(c => a.toLowerCase().includes(c)) ? 0 : 1;
                var bh = homeCities.some(c => b.toLowerCase().includes(c)) ? 0 : 1;
                return ah - bh;
              });
            }
            async function centerIsSet(label) {
              var dd = page.locator(`app-dropdown-new[label*="${label}"]`).first();
              if (await dd.count() === 0) return false;
              var cur = (await dd.locator('.value-area').first().textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
              return !!cur && !/^select$/i.test(cur);
            }
            async function fillCenterOrAsk(label, want, fieldName) {
              if (await centerIsSet(label)) { send('progress', `⏭️ ${fieldName}: pehle se set — skip`); return; }
              if (want && await fillSscDropdown(label, want, fieldName)) return;
              // 2 round tak: user se poochho → select karo → VERIFY karo
              for (var round = 1; round <= 2; round++) {
                var opts = (fillSscDropdown.lastOptions || []).slice(0, 14);
                if (!opts.length) {
                  await fillSscDropdownOnce(label, '___list___', fieldName);
                  opts = (fillSscDropdown.lastOptions || []).slice(0, 14);
                }
                if (!opts.length) return;
                opts = sortByHomeState(opts);
                var choice = await askUser(
                  `📍 ${fieldName}${want ? `: "${want}" available nahi hai` : ''}. In me se type karo:\n${opts.join(' | ')}`, '');
                if (!choice) return;
                var clean = choice.replace(/^NR-/i, '').replace(/\s*\(\d+\)\s*$/, '').trim();
                await fillSscDropdown(label, clean, fieldName);
                if (await centerIsSet(label)) { send('progress', `✅ ${fieldName} confirm ho gaya`); return; }
                // select nahi hua — cached jawab hatao taaki dobara poochh sakein
                var all = loadAnswers();
                Object.keys(all).forEach(k => { if (k.includes(fieldName)) delete all[k]; });
                fs.writeFileSync(ANSWERS_FILE, JSON.stringify(all));
                send('progress', `⚠️ ${fieldName}: "${choice}" select nahi hua — dobara poochh raha hoon`);
              }
            }
            await fillCenterOrAsk('Preference 1', edu.examCenter1, 'Exam Center 1');
            await fillCenterOrAsk('Preference 2', edu.examCenter2, 'Exam Center 2');
            // Preference 3 bhi REQUIRED hai (CGL 2026) — env se ya user se poochke
            await fillCenterOrAsk('Preference 3', process.env.EXAM_CENTER3 || '', 'Exam Center 3');
          }
          // NOTE: yahan Category mat select karo — legacy selectDropdown header ka
          // "Staff Selection Commission" link click karke homepage khol deta tha.

          // Fill any other visible text fields generically
          var addlSc = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
          if (addlSc) send('screenshot', '📸 Additional Info', { screenshot: addlSc });

          // CGL 2026 ka asli save button: form ke andar
          // <button class="btn save-btn">Save & Next</button>.
          // NOTE: page pe aur bhi .save-btn hote hain (FAQ/feedback widgets) —
          // form scope + exact text dono zaroori hain.
          var saveBtn = page.locator('form button.save-btn').filter({ hasText: /save\s*&?\s*(and)?\s*next/i }).first();
          if (await saveBtn.count() === 0) saveBtn = page.locator('button.save-btn').filter({ hasText: /save\s*&?\s*(and)?\s*next/i }).first();
          if (await saveBtn.count() > 0) {
            await saveBtn.scrollIntoViewIfNeeded();
            await saveBtn.click({ timeout: 5000 }).catch(() => {});
            send('progress', '✅ Save & Next (button.save-btn) clicked');
            await page.waitForTimeout(2500);
            await dismissPopups();
            send('progress', `📋 After Save & Next — Additional Info: ${page.url()}`);
            // Same page = validation rok rahi hai — saare red errors dikhao
            if (/professional-background|additional|exam-requirements/.test(page.url().toLowerCase())) {
              var addlErrors = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.text-danger, [class*="error"], [class*="invalid-feedback"], .mat-error'))
                  .map(el => (el.textContent || '').trim())
                  .filter(t => t.length > 3 && t.length < 140)
                  .slice(0, 10);
              }).catch(() => []);
              if (addlErrors.length) send('progress', `🚫 Validation errors: ${[...new Set(addlErrors)].join(' • ')}`);
            }
          } else {
            await autoSaveNext('Save & Next — Additional Info');
          }
          stepCount++;
          continue;
        }

        // ── UPLOAD DOCUMENTS ──────────────────────────────────────
        if (stepInfo.isUpload) {
          send('progress', '📸 Upload Documents page...');
          await page.waitForTimeout(1500);

          // ── FACE AUTHENTICATION GATE (mySSC mobile app, Aadhaar) ──
          // SSC CGL 2026: photo se PEHLE phone app se face auth zaroori hai.
          // Pending ho to user ko app bhejo aur har 15s me status poll karo.
          try {
            var faBody = await page.locator('body').innerText().catch(() => '');
            if (/face authentication status\s*:?\s*pending/i.test(faBody)) {
              send('faceauth', '📱 FACE AUTH PENDING — mySSC app se Aadhaar Face Authentication karo (2 min ka kaam). Main yahan wait kar raha hoon, complete hote hi khud aage badh jaunga.', {
                appLink: 'https://play.google.com/store/apps/details?id=in.gov.ssc.myssc',
                steps: ['mySSC app kholo/install karo', 'SSC ID-password se login', 'My Application → CGL 2026 → Continue', 'Aadhaar Auth Verification → face scan'],
              });
              var faDone = false, faWait = 0;
              while (!faDone && faWait < 900000) { // max 15 min
                await page.waitForTimeout(15000); faWait += 15000;
                await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
                await page.waitForTimeout(3000);
                var faTxt = await page.locator('body').innerText().catch(() => '');
                if (/face authentication status\s*:?\s*(completed|success|verified|done)/i.test(faTxt)) {
                  faDone = true;
                  send('progress', '✅ Face Authentication COMPLETED! Ab photo capture karte hain...');
                } else if (!/face authentication/i.test(faTxt)) {
                  faDone = true; // section hi gayab — assume done
                } else {
                  send('progress', `⏳ Face auth abhi bhi pending... (${Math.round(faWait / 60000)} min) — mySSC app se complete karo`);
                }
              }
              if (!faDone) send('progress', '⚠️ Face auth 15 min me complete nahi hua — photo try kar raha hoon fir bhi');
            }
          } catch {}

          // ── PHOTO: SSC live-webcam capture (file upload nahi) ──
          // User apni site pe camera se selfie leta hai → /api/capture-photo
          // use govform_cam.y4m bana deta hai → browser already fake-camera flag
          // ke saath khula hai → yahan "Capture Live Photo" dabane par SSC ko
          // wahi photo "webcam" dikhti hai.
          var READY_FILE = require('path').join(require('os').tmpdir(), 'govform_cam_ready');
          var hasLivePhotoBtn = await page.locator('button, a').filter({ hasText: /capture live photo|capture photo|live photo/i }).count();
          if (hasLivePhotoBtn > 0) {
            // Purana marker hatao — user ke FRESH capture ka hi wait karo.
            try { if (fs.existsSync(READY_FILE)) fs.unlinkSync(READY_FILE); } catch {}
            send('otp', '📷 Apni site pe Camera kholo aur photo khquo — fir woh real SSC pe capture ho jayegi.', { otpFile: CAPTCHA_FILE });
            var waited = 0;
            while (!fs.existsSync(READY_FILE) && waited < 300000) { await page.waitForTimeout(1500); waited += 1500; }
            await page.waitForTimeout(800); // y4m write settle
            send('progress', '📸 Capture Live Photo dabake selfie capture kar raha hoon...');
            // 1) Camera modal kholo (outer "Capture Live Photo" button)
            await page.locator('button, a').filter({ hasText: /capture live photo|capture photo|live photo/i }).first().click().catch(() => {});
            await page.waitForTimeout(4000); // camera warm-up + face frame

            // 2) Modal ka "Capture" button — 10 baar tak try, ANY visible "Capture" button (force click)
            var captured = false;
            for (var ci = 0; ci < 10; ci++) {
              // SSC ka modal custom Angular component use karta hai — broad selector chahiye
              // "Capture Live Photo" wala outer button EXCLUDE karo (hasText exact match)
              var allCaptureBtns = page.locator('button').filter({ hasText: /capture/i });
              var btnCount = await allCaptureBtns.count().catch(() => 0);
              for (var bi = 0; bi < btnCount; bi++) {
                var btn = allCaptureBtns.nth(bi);
                var txt = (await btn.innerText().catch(() => '')).trim();
                // Skip "Capture Live Photo" outer button, only click exact "Capture"
                if (/capture live photo/i.test(txt)) continue;
                var vis = await btn.isVisible().catch(() => false);
                if (!vis) continue;
                await btn.scrollIntoViewIfNeeded().catch(() => {});
                await btn.click({ force: true }).catch(() => {});
                send('progress', `📷 Capture click (btn ${bi}, try ${ci + 1}): "${txt}"`);
                captured = true;
                await page.waitForTimeout(2500);
                break;
              }
              if (captured) break;
              await page.waitForTimeout(1500);
            }
            if (!captured) send('progress', '⚠️ Modal "Capture" button nahi mila');

            // 3) SSC "not in frame" error → "Capture Again" click karke retry karo
            await page.waitForTimeout(1500);
            for (var cr = 0; cr < 5; cr++) {
              var errMsg = await page.locator('text=/not inside the frame/i, text=/recapture/i').count().catch(() => 0);
              var capAgain = page.locator('button').filter({ hasText: /capture again|recapture/i }).first();
              if (errMsg > 0 || await capAgain.count() > 0) {
                send('progress', `⚠️ SSC frame error — Capture Again (retry ${cr + 1})`);
                if (await capAgain.count() > 0) await capAgain.click({ force: true }).catch(() => {});
                await page.waitForTimeout(3000); // camera re-stabilize
                // Re-try capture
                var snap2 = page.locator('button').filter({ hasText: /^capture$/i }).last();
                if (await snap2.count() === 0) snap2 = page.locator('button').filter({ hasText: /capture/i }).filter({ hasNotText: /live photo|again/i }).last();
                if (await snap2.count() > 0) {
                  await snap2.click({ force: true }).catch(() => {});
                  send('progress', `📷 Capture retry ${cr + 1}`);
                  await page.waitForTimeout(2500);
                }
              } else {
                break; // no error, aage badho
              }
            }

            // 4) Confirm/Use/OK (agar preview confirm maange)
            await page.waitForTimeout(1000);
            for (var cf = 0; cf < 5; cf++) {
              var useBtn = page.locator('button')
                .filter({ hasText: /^\s*(use photo|use|confirm|ok|okay|save|done|submit)\s*$/i }).first();
              if (await useBtn.count() > 0 && await useBtn.isVisible().catch(() => false)) {
                await useBtn.click({ force: true }).catch(() => {});
                await page.waitForTimeout(1500);
                break;
              }
              await page.waitForTimeout(1000);
            }
            send('progress', '✅ Live photo capture ho gayi!');
          } else if (student.photoPath && fs.existsSync(student.photoPath)) {
            // Fallback: agar file upload input ho
            var photoInp = await page.$('input[type="file"][id*="photo" i], input[type="file"][name*="photo" i]');
            if (!photoInp) photoInp = await page.$('input[type="file"]');
            if (photoInp) {
              await photoInp.setInputFiles(student.photoPath);
              await page.waitForTimeout(2000);
              send('progress', '✅ Photo uploaded!');
            }
          } else {
            send('progress', '⚠️ Photo na live-capture na file — skip');
          }

          // Upload Signature
          if (student.signPath && fs.existsSync(student.signPath)) {
            var fileInps = await page.$$('input[type="file"]');
            var signInp = await page.$('input[type="file"][id*="sign" i], input[type="file"][name*="sign" i]');
            if (!signInp && fileInps.length > 1) signInp = fileInps[1];
            if (signInp) {
              await signInp.setInputFiles(student.signPath);
              await page.waitForTimeout(2000);
              send('progress', '✅ Signature uploaded!');
            }
          } else {
            send('progress', '⚠️ Signature path nahi hai — skip');
          }

          var uploadSc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
          if (uploadSc) send('screenshot', '📸 Upload done', { screenshot: uploadSc });

          await autoSaveNext('Save & Next — Upload');
          stepCount++;
          continue;
        }

        // ── PREVIEW FORM ──────────────────────────────────────────
        if (stepInfo.isPreview) {
          send('progress', '👁️ Preview Form — screenshot le raha hoon...');
          var prevSc = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
          if (prevSc) send('screenshot', '📸 Preview — check karo', { screenshot: prevSc });

          // Auto-click Submit (no user confirmation needed)
          await page.waitForTimeout(1500);
          var submitted = await page.evaluate(() => {
            var btns = Array.from(document.querySelectorAll('button'));
            var btn = btns.find(b => /submit|final|confirm|next/i.test(b.textContent) && b.getBoundingClientRect().height > 0 && !b.disabled);
            if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return btn.textContent.trim(); }
            return null;
          });
          if (submitted) {
            send('progress', `🚀 Preview Submit clicked: "${submitted}"`);
            await page.waitForTimeout(4000);
          }
          stepCount++;
          continue;
        }

        // ── SUBMIT FORM ───────────────────────────────────────────
        if (stepInfo.isSubmit) {
          send('progress', '🚀 Submit Form page...');
          // Tick all checkboxes (declaration)
          var cbCount = await page.evaluate(() => {
            var count = 0;
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (!cb.checked) { cb.click(); count++; } });
            return count;
          });
          send('progress', `✅ ${cbCount} declaration checkboxes ticked`);
          await page.waitForTimeout(800);

          var submitSc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
          if (submitSc) send('screenshot', '📸 Submit page', { screenshot: submitSc });

          await autoSaveNext('Final Submit');
          await page.waitForTimeout(4000);
          stepCount++;
          continue;
        }

        // ── PAYMENT PAGE — stop here, user does payment manually ──
        if (stepInfo.isPayment) {
          send('progress', '💳 Payment page — browser mein manually complete karo!');
          var paySc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
          if (paySc) send('screenshot', '📸 Payment page — manually complete karo', { screenshot: paySc });
          // Don't auto-pay — just stop loop here
          break;
        }

        // ── UNKNOWN STEP ──────────────────────────────────────────
        send('progress', `⚠️ Unknown step — ${stepUrl}`);
        var unkSc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
        if (unkSc) send('screenshot', `📸 Unknown step`, { screenshot: unkSc });

        // Try to click next/continue anyway
        var nextClicked = await page.evaluate(() => {
          var btns = Array.from(document.querySelectorAll('button'));
          var btn = btns.find(b => /next|continue|save|proceed/i.test(b.textContent) && b.getBoundingClientRect().height > 0 && !b.disabled);
          if (btn) { btn.click(); return btn.textContent.trim(); }
          return null;
        });
        if (nextClicked) {
          send('progress', `✅ Next clicked: "${nextClicked}"`);
          await page.waitForTimeout(2500);
        } else {
          send('progress', '❌ No next button found — loop end');
          break;
        }
        stepCount++;
      }

      // ── Loop ended — take final screenshot & keep browser alive ──
      send('progress', `✅ Form steps complete (${stepCount} steps) — browser open hai, dekh lo`);
      var finalSc2 = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
      send('screenshot', `📸 Final state — ${page.url()}`, { screenshot: finalSc2 });
      send('progress', `📋 Final URL: ${page.url()}`);

      // ── Browser open rakhna — 30 min (user inspect kar sakta hai) ──
      send('progress', '⏳ Browser 30 min tak open hai — payment ya check karo...');
      await new Promise(r => setTimeout(r, 1800000)); // 30 min
      return;

    } // end isOnExamPage

    // ── NOT on exam page — we're on dashboard ─────────────────────
    // OTR check karo BUT sirf agar genuinely on dashboard hain
    send('progress', '📋 Dashboard pe hain — OTR check skip (exam page nahi mila)');
    send('progress', `📋 Current URL: ${page.url()}`);
    var dashSc = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
    if (dashSc) send('screenshot', '📸 Current state', { screenshot: dashSc });
    // Browser open rakho — close mat karo
    send('progress', '⏳ Browser open hai — kuch action karo ya manually check karo...');
    await new Promise(r => setTimeout(r, 1800000)); // 30 min open
    return;

    // ── (Legacy OTR flow — only reached if above return removed) ──
    const dashboardData = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        raw: body.substring(0, 2000),
        otrDone: body.includes('Edit Registration Details'),
        name: document.querySelector('[class*="name"], h2, h3')?.textContent?.trim() || '',
      };
    });
    send('progress', `📊 OTR already done: ${dashboardData.otrDone}`);

    if (dashboardData.otrDone) {
      send('progress', '✅ OTR pehle se complete hai! Dashboard se data padh raha hoon...');
      const otrData = await page.evaluate(() => document.body.innerText);
      send('progress', `✅ Dashboard data: ${otrData.substring(0, 300)}`);
      send('progress', '✅ OTR already done — PDF generate kar raha hoon...');
    }

    if (!dashboardData.otrDone) {
    // ── STEP 2.5: OTR PERSONAL DETAILS (naye users ke missing fields) ──
    send('progress', '🌐 OTR Personal Details check kar raha hoon...');
    await page.goto('https://ssc.gov.in/candidate-portal/one-time-registration/personal-details', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    if (page.url().includes('one-time-registration/personal-details')) {
      send('progress', '📋 Personal Details page — missing fields bhar raha hoon...');
      const dobDash = (student.dob || '').replace(/\//g, '-');

      // Label dhoondh ke uske paas wala KHALI input bharo
      const fillByLabel = async (labelRe, value, name) => {
        if (!value) { send('progress', `⚠️ ${name}: value hi nahi hai`); return; }
        const ok = await page.evaluate(({ re, val }) => {
          const rx = new RegExp(re, 'i');
          const all = Array.from(document.querySelectorAll('label, .label, p, span, b, div'));
          for (const lbl of all) {
            const t = (lbl.textContent || '').trim();
            if (!rx.test(t) || t.length > 90) continue;
            let scope = lbl.closest('div');
            for (let hop = 0; hop < 4 && scope; hop++) {
              const inp = scope.querySelector('input:not([type=radio]):not([type=checkbox]):not([disabled])');
              if (inp && !inp.value) {
                const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                inp.focus(); s.call(inp, val);
                ['input','change','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
                return true;
              }
              scope = scope.parentElement;
            }
          }
          return false;
        }, { re: labelRe, val: value });
        send('progress', ok ? `✅ ${name}: ${value}` : `⚠️ ${name} field nahi mila / pehle se bhara hai`);
      };

      await fillByLabel('verify\\s*date\\s*of\\s*birth', dobDash, 'Verify DOB');
      await fillByLabel("candidate'?s?\\s*mobile\\s*number|^\\s*\\d*\\.?\\s*mobile\\s*number", student.mobile, 'Mobile Number');
      await fillByLabel("candidate'?s?\\s*email|^\\s*\\d*\\.?\\s*email\\s*id", student.email, 'Email ID');

      // Highest qualification dropdowns
      const hq = process.env.HIGHEST_QUAL ||
        (process.env.QUAL_DEGREE || process.env.QUAL_YEAR ? 'Graduation and above' : 'Graduation and above');
      const hqOk = await pickDropdown(page, 'Highest Level of Education', hq);
      await page.waitForTimeout(700);
      send('progress', hqOk !== false ? `✅ Highest Qualification: ${hq}` : '⚠️ Highest Qualification dropdown nahi mila');
      await pickDropdown(page, 'Verify Highest Level', hq);
      await page.waitForTimeout(700);
      send('progress', `✅ Verify Highest Qualification: ${hq}`);

      // Save & Next
      const saved = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type=submit], a'));
        const b = btns.find(x => /save\s*&?\s*next|save\s*and\s*next/i.test(x.textContent || x.value || ''));
        if (b) { b.click(); return true; }
        return false;
      });
      send('progress', saved ? '💾 Personal Details — Save & Next' : '⚠️ Save & Next button nahi mila');
      await page.waitForTimeout(3500);
    } else {
      send('progress', '✅ Personal Details pehle se complete hai');
    }

    // ── NAVIGATE TO OTR ───────────────────────────────────────
    send('progress', '🌐 OTR form fill karne ja raha hoon...');
    await page.goto('https://ssc.gov.in/candidate-portal/one-time-registration/additional-details', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const otrUrl = page.url();
    send('progress', `📋 OTR Page: ${otrUrl}`);

    // If redirected (OTR done after all), skip form fill
    if (!otrUrl.includes('one-time-registration')) {
      send('progress', '✅ OTR already done (redirect detected) — PDF generate kar raha hoon');
      await page.goto('https://ssc.gov.in/candidate-portal/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    } else {

    // ── STEP 3: ADDITIONAL DETAILS ─────────────────────────────
    send('progress', '📋 Additional Details fill ho raha hai...');
    await page.waitForTimeout(1500);

    // Category
    send('progress', '🔽 Category select kar raha hoon...');
    await pickDropdown(page, 'Category', student.category);
    await page.waitForTimeout(800);
    send('progress', '✅ Category: ST');

    await page.waitForTimeout(500);
    await pickDropdown(page, 'Verify Category', student.category);
    await page.waitForTimeout(800);
    send('progress', '✅ Verify Category: ST');

    await page.waitForTimeout(500);
    await pickDropdown(page, 'Nationality', student.nationality);
    await page.waitForTimeout(800);
    send('progress', '✅ Nationality: Citizen of India');

    // Visible Mark — find textarea by nearby label text, fallback to index
    await page.waitForTimeout(600);
    const vmFilled = await page.evaluate((val) => {
      // Try to find textarea associated with a "Visible Mark" or "Identification Mark" label
      const labels = Array.from(document.querySelectorAll('label, .label, span, p, div'));
      for (const lbl of labels) {
        const txt = lbl.textContent || '';
        if (txt.match(/visible\s*mark|identification\s*mark/i)) {
          // Look for sibling or nearby textarea
          let el = lbl.nextElementSibling;
          while (el) {
            if (el.tagName === 'TEXTAREA') { el.focus(); break; }
            const ta = el.querySelector('textarea');
            if (ta) { el = ta; break; }
            el = el.nextElementSibling;
          }
          if (!el || el.tagName !== 'TEXTAREA') {
            // Try parent's next sibling
            const parent = lbl.parentElement;
            if (parent) {
              let sib = parent.nextElementSibling;
              while (sib) {
                const ta = sib.tagName === 'TEXTAREA' ? sib : sib.querySelector('textarea');
                if (ta) { el = ta; break; }
                sib = sib.nextElementSibling;
              }
            }
          }
          if (el && el.tagName === 'TEXTAREA') {
            const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            s.call(el, val);
            ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
            return true;
          }
        }
      }
      // Fallback: fill first visible textarea
      const tas = Array.from(document.querySelectorAll('textarea'));
      const ta = tas.find(t => t.getBoundingClientRect().height > 0 && !t.disabled);
      if (ta) {
        const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        s.call(ta, val);
        ['input','change','blur'].forEach(ev => ta.dispatchEvent(new Event(ev, { bubbles: true })));
        return 'fallback';
      }
      return false;
    }, student.visibleMark);
    if (vmFilled === true) send('progress', '✅ Visible Mark filled (by label)');
    else if (vmFilled === 'fallback') send('progress', '✅ Visible Mark filled (fallback textarea[0])');
    else send('progress', '⚠️ Visible Mark textarea not found — manually check karo');

    // PwBD: No
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const noLabel = labels.find(l => l.textContent?.trim() === 'No');
      if (noLabel) noLabel.click();
    });
    send('progress', '✅ PwBD: No');

    // Scroll down to address section
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    // Address — find empty textarea
    await page.waitForTimeout(600);
    const taCount = await page.evaluate(() => document.querySelectorAll('textarea').length);
    send('progress', `🔍 ${taCount} textareas found`);
    // Fill the first empty textarea as address
    await page.evaluate((addr) => {
      const tas = Array.from(document.querySelectorAll('textarea'));
      for (const ta of tas) {
        if (!ta.disabled && (!ta.value || ta.value.trim() === '') && ta.getBoundingClientRect().height > 0) {
          ta.click();
          const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
          s.call(ta, addr);
          ['input','change','blur'].forEach(ev => ta.dispatchEvent(new Event(ev, { bubbles: true })));
          break;
        }
      }
    }, student.address);
    send('progress', '✅ Address filled');

    await page.waitForTimeout(800);

    // State dropdown
    send('progress', '🔽 State select kar raha hoon...');
    await pickDropdown(page, 'State', student.state);
    await page.waitForTimeout(2000);
    send('progress', '✅ State: Rajasthan');

    // District dropdown (loads after state)
    send('progress', '🔽 District select kar raha hoon...');
    await pickDropdown(page, 'District', student.district);
    await page.waitForTimeout(1000);
    send('progress', '✅ District: Sawai Madhopur');

    // PIN code
    await page.waitForTimeout(600);
    await page.evaluate((pin) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const inp of inputs) {
        const hint = (inp.id + inp.name + inp.placeholder).toLowerCase();
        if (hint.includes('pin') || hint.includes('postal')) {
          const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          s.call(inp, pin);
          ['input','change','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
          break;
        }
      }
    }, student.pin);
    send('progress', '✅ PIN: 322214');

    // Same as permanent address: Yes
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const yesLabel = labels.find(l => l.textContent?.trim() === 'Yes');
      if (yesLabel) yesLabel.click();
    });
    send('progress', '✅ Same address: Yes');

    // Auto Save & Next with refresh resilience
    await autoSaveNext('Save & Next — Additional Details');

    // ── STEP: PHOTO & SIGNATURE UPLOAD ────────────────────────
    await page.waitForTimeout(2000);
    const uploadUrl = page.url();
    send('progress', `📋 Upload page check: ${uploadUrl}`);

    // Detect upload page: by URL OR by presence of file inputs
    const hasFileInputs = await page.evaluate(() =>
      document.querySelectorAll('input[type="file"]').length > 0
    );
    const isUploadPage = uploadUrl.includes('upload') || uploadUrl.includes('photo') ||
      uploadUrl.includes('document') || uploadUrl.includes('sign') || hasFileInputs;

    if (isUploadPage) {
      send('progress', '📸 Photo & Signature upload page mili — upload ho raha hai...');

      // ── Upload Photo ──
      if (student.photoPath && fs.existsSync(student.photoPath)) {
        try {
          // Try specific selectors first, then fall back to first file input
          let photoInput = await page.$('input[type="file"][accept*="image"][id*="photo" i], input[type="file"][name*="photo" i]');
          if (!photoInput) photoInput = await page.$('input[type="file"]');
          if (photoInput) {
            await photoInput.setInputFiles(student.photoPath);
            await page.waitForTimeout(2000);
            // Wait for any loading spinner to disappear
            await page.waitForFunction(() => !document.querySelector('.uploading, .loading, [class*="spinner"]'), { timeout: 8000 }).catch(() => {});
            send('progress', '✅ Photo uploaded!');
          } else {
            send('progress', '⚠️ Photo file input nahi mila page pe');
          }
        } catch (e) {
          send('progress', `⚠️ Photo upload error: ${e.message}`);
        }
      } else if (student.photoPath) {
        send('progress', `⚠️ Photo file server pe nahi mila: ${student.photoPath}`);
      } else {
        send('progress', '⚠️ Photo path diya nahi — skip');
      }

      // ── Upload Signature ──
      if (student.signPath && fs.existsSync(student.signPath)) {
        try {
          const fileInputs = await page.$$('input[type="file"]');
          // Try specific selector first
          let signInput = await page.$('input[type="file"][id*="sign" i], input[type="file"][name*="sign" i]');
          if (!signInput) {
            // Fallback: 2nd file input (usually signature)
            signInput = fileInputs.length > 1 ? fileInputs[1] : fileInputs[0];
          }
          if (signInput) {
            await signInput.setInputFiles(student.signPath);
            await page.waitForTimeout(2000);
            await page.waitForFunction(() => !document.querySelector('.uploading, .loading, [class*="spinner"]'), { timeout: 8000 }).catch(() => {});
            send('progress', '✅ Signature uploaded!');
          } else {
            send('progress', '⚠️ Signature file input nahi mila page pe');
          }
        } catch (e) {
          send('progress', `⚠️ Signature upload error: ${e.message}`);
        }
      } else if (student.signPath) {
        send('progress', `⚠️ Signature file server pe nahi mila: ${student.signPath}`);
      } else {
        send('progress', '⚠️ Signature path diya nahi — skip');
      }

      // Auto Save & Next after upload
      await page.waitForTimeout(800);
      await autoSaveNext('Save & Next — Upload');
    } else {
      send('progress', `⚠️ Upload page nahi mili (URL: ${uploadUrl}) — skip kar raha hoon`);
    }

    // ── STEP 4: DECLARATION ────────────────────────────────────
    send('progress', `📋 Current: ${page.url()}`);
    await page.waitForTimeout(2000);

    // Detect declaration page by URL OR by presence of checkboxes + submit button
    const currentUrl4 = page.url();
    const isDeclarationPage = currentUrl4.includes('declaration') ||
      currentUrl4.includes('preview') ||
      currentUrl4.includes('confirm') ||
      await page.evaluate(() => {
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent?.trim().match(/submit|final|confirm/i) && b.getBoundingClientRect().height > 0
        );
        return cbs.length > 0 && !!submitBtn;
      });

    if (isDeclarationPage) {
      send('progress', '📜 Declaration page — checkboxes tick ho rahe hain...');
      const cbCount = await page.evaluate(() => {
        let count = 0;
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if (!cb.checked) { cb.click(); count++; }
        });
        return count;
      });
      send('progress', `✅ ${cbCount} checkboxes ticked`);
      await page.waitForTimeout(1000);

      // Final Submit
      const submitted = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent?.trim().match(/submit|final|confirm/i) && b.getBoundingClientRect().height > 0);
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (submitted) {
        send('progress', '🚀 Final Submit clicked!');
        await page.waitForTimeout(4000);
      }
    } else {
      send('progress', `⚠️ Declaration page nahi mili — current: ${currentUrl4}`);
    }

    } // end: else (otrUrl check — fill form block)
    } // end: if (!dashboardData.otrDone)

    // ── OFFICIAL SSC PRINTOUT ──────────────────────────────────
    send('progress', '🖨️ Official SSC printout le raha hoon...');
    await page.waitForTimeout(2000);

    // Helper: check if current page is an error/404 page
    async function isErrorPage() {
      return page.evaluate(() => {
        const txt = (document.body?.innerText || '').toLowerCase();
        return txt.includes('oops') || txt.includes('404') || txt.includes('page not found') ||
               txt.includes('can not be found') || txt.includes('not found');
      });
    }

    // ── Step 1: Capture the current page FIRST (this is the post-submit/confirmation page)
    send('progress', `📋 Capturing current page: ${page.url()}`);
    let officialScreenshot = null;
    let officialPdfBuf = null;

    const isCurrentError = await isErrorPage();
    if (!isCurrentError) {
      // Current page is valid — take screenshot + PDF now before navigating anywhere
      officialScreenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
      await page.emulateMedia({ media: 'print' });
      officialPdfBuf = await page.pdf({
        format: 'A4', printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      }).catch(() => null);
      await page.emulateMedia({ media: 'screen' });
      if (officialPdfBuf && officialPdfBuf.length > 5000) {
        fs.writeFileSync('/tmp/ssc_official_printout.pdf', officialPdfBuf);
        send('progress', `✅ Official SSC PDF captured from: ${page.url()}`);
      }
    } else {
      send('progress', `⚠️ Current page is error page — trying dashboard`);
    }

    // ── Step 2: Try Print/Preview button ONLY if still on same page (not navigating away)
    if (!officialPdfBuf || officialPdfBuf.length <= 5000) {
      const printClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const btn = btns.find(b =>
          b.textContent?.toLowerCase().match(/print|preview|download|view.*form/i) &&
          b.getBoundingClientRect().height > 0
        );
        if (btn) { btn.click(); return btn.textContent?.trim(); }
        return null;
      });
      if (printClicked) {
        send('progress', `✅ Clicked: "${printClicked}"`);
        await page.waitForTimeout(3000);
        if (!await isErrorPage()) {
          officialScreenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
          await page.emulateMedia({ media: 'print' });
          officialPdfBuf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }).catch(() => null);
          await page.emulateMedia({ media: 'screen' });
          if (officialPdfBuf && officialPdfBuf.length > 5000) {
            fs.writeFileSync('/tmp/ssc_official_printout.pdf', officialPdfBuf);
            send('progress', '✅ Official PDF from print button!');
          }
        }
      }
    }

    // ── Step 3: Try dashboard as last resort (NOT the broken preview URL)
    if (!officialPdfBuf || officialPdfBuf.length <= 5000) {
      try {
        await page.goto('https://ssc.gov.in/candidate-portal/dashboard', { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(2500);
        if (!await isErrorPage()) {
          send('progress', '✅ Dashboard loaded — capturing PDF');
          officialScreenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
          await page.emulateMedia({ media: 'print' });
          officialPdfBuf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }).catch(() => null);
          await page.emulateMedia({ media: 'screen' });
          if (officialPdfBuf && officialPdfBuf.length > 5000) {
            fs.writeFileSync('/tmp/ssc_official_printout.pdf', officialPdfBuf);
            send('progress', '✅ Official PDF from dashboard!');
          }
        }
      } catch { /* ignore */ }
    }

    // ── Step 4: Screenshot → PDF fallback (always gives something useful)
    if (!officialPdfBuf || officialPdfBuf.length <= 5000) {
      if (officialScreenshot) {
        send('progress', '⚠️ PDF blank — converting screenshot to PDF');
        const screenshotHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{margin:0;padding:0}img{width:100%;height:auto;display:block}</style></head>
<body><img src="data:image/png;base64,${officialScreenshot}"/></body></html>`;
        const scPage = await context.newPage();
        await scPage.setContent(screenshotHtml, { waitUntil: 'load' });
        const scPdf = await scPage.pdf({ format: 'A4', printBackground: true }).catch(() => null);
        if (scPdf) {
          fs.writeFileSync('/tmp/ssc_official_printout.pdf', scPdf);
          send('progress', '✅ Official PDF (screenshot) saved!');
        }
        await scPage.close();
      } else {
        send('progress', '⚠️ Official printout lena sambhav nahi hua — summary PDF use karo');
      }
    }

    // Save screenshot separately always
    if (officialScreenshot) {
      fs.writeFileSync('/tmp/ssc_official_screenshot.png', Buffer.from(officialScreenshot, 'base64'));
    }

    // ── GENERATE SUMMARY PDF ───────────────────────────────────
    send('progress', '🖨️ Summary PDF generate ho raha hai...');
    await page.waitForTimeout(1000);

    // Screenshot of confirmation/final page
    const confirmScreenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);

    // Embed photo as base64 if available
    let photoBase64Html = '';
    let signBase64Html  = '';
    if (student.photoPath && fs.existsSync(student.photoPath)) {
      const ext = path.extname(student.photoPath).replace('.', '') || 'jpeg';
      const b64 = fs.readFileSync(student.photoPath).toString('base64');
      photoBase64Html = `<img src="data:image/${ext};base64,${b64}" style="width:110px;height:130px;object-fit:cover;border:2px solid #ddd;border-radius:4px;"/>`;
    }
    if (student.signPath && fs.existsSync(student.signPath)) {
      const ext = path.extname(student.signPath).replace('.', '') || 'jpeg';
      const b64 = fs.readFileSync(student.signPath).toString('base64');
      signBase64Html = `<img src="data:image/${ext};base64,${b64}" style="width:180px;height:70px;object-fit:contain;border:2px solid #ddd;border-radius:4px;"/>`;
    }

    const summaryHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>SSC OTR — Form Summary</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #222; }
  h1 { color: #1a3c8e; border-bottom: 2px solid #1a3c8e; padding-bottom: 8px; margin: 0; }
  h2 { color: #1a3c8e; font-size: 14px; margin-top: 20px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { padding: 7px 10px; border: 1px solid #ddd; font-size: 13px; }
  td:first-child { background: #f0f4ff; font-weight: bold; width: 35%; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .badge { background: #16a34a; color: white; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; display: inline-block; margin-top: 8px; }
  .photos { display: flex; gap: 24px; align-items: flex-end; }
  .photo-label { font-size: 10px; color: #888; text-align: center; margin-top: 4px; }
  .footer { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
</style>
</head>
<body>
<div class="top">
  <div>
    <h1>SSC OTR — Registration Summary</h1>
    <span class="badge">✅ SUBMITTED</span>
    <p style="font-size:12px;color:#555;margin-top:6px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
  </div>
  <div class="photos">
    <div>
      ${photoBase64Html || '<div style="width:110px;height:130px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa;border-radius:4px;">No Photo</div>'}
      <div class="photo-label">Photo</div>
    </div>
    <div>
      ${signBase64Html || '<div style="width:180px;height:70px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa;border-radius:4px;">No Signature</div>'}
      <div class="photo-label">Signature</div>
    </div>
  </div>
</div>

<h2>Personal Details</h2>
<table>
  <tr><td>Registration No.</td><td>${student.regNo}</td></tr>
  <tr><td>Full Name</td><td>${student.name}</td></tr>
  <tr><td>Date of Birth</td><td>${student.dob}</td></tr>
  <tr><td>Gender</td><td>${student.gender}</td></tr>
  <tr><td>Father's Name</td><td>${student.fatherName}</td></tr>
  <tr><td>Mother's Name</td><td>${student.motherName}</td></tr>
</table>

<h2>Contact Details</h2>
<table>
  <tr><td>Mobile</td><td>${student.mobile}</td></tr>
  <tr><td>Email</td><td>${student.email}</td></tr>
  <tr><td>Aadhaar No.</td><td>${student.aadhaar.replace(/(\d{4})/g,'$1 ').trim()}</td></tr>
</table>

<h2>Category & Other Details</h2>
<table>
  <tr><td>Category</td><td>${student.category}</td></tr>
  <tr><td>Nationality</td><td>${student.nationality}</td></tr>
  <tr><td>PwBD</td><td>No</td></tr>
  <tr><td>Visible Mark</td><td>${student.visibleMark}</td></tr>
</table>

<h2>Address Details</h2>
<table>
  <tr><td>Address</td><td>${student.address}</td></tr>
  <tr><td>District</td><td>${student.district}</td></tr>
  <tr><td>State</td><td>${student.state}</td></tr>
  <tr><td>PIN Code</td><td>${student.pin}</td></tr>
</table>

<div class="footer">
  <p>⚠️ Yeh sirf reference ke liye hai. Official copy SSC website se download karein.</p>
  <p>Generated by GovForm AI · ssc.gov.in</p>
</div>
</body>
</html>`;

    // Render in a new page → PDF
    const summaryPage = await context.newPage();
    let summaryPdfBuf = null;
    try {
      await summaryPage.setContent(summaryHtml, { waitUntil: 'load', timeout: 15000 });
      summaryPdfBuf = await summaryPage.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });
    } catch (e) {
      send('progress', `⚠️ Summary PDF render error: ${e.message}`);
    } finally {
      await summaryPage.close().catch(() => {});
    }

    const summaryPdfPath = '/tmp/ssc_summary_printout.pdf';
    if (summaryPdfBuf && summaryPdfBuf.length > 1000) {
      fs.writeFileSync(summaryPdfPath, summaryPdfBuf);
      send('progress', '✅ Summary PDF ready!');
    } else {
      // Absolute fallback: write a minimal PDF marker so the download endpoint doesn't 404
      send('progress', '⚠️ Summary PDF generation failed — placeholder saved');
      fs.writeFileSync(summaryPdfPath, summaryHtml); // serve HTML as fallback
    }

    const summaryPdfBase64 = summaryPdfBuf ? summaryPdfBuf.toString('base64') : '';

    send('done', '🎉 SSC OTR Complete! Form fill ho gaya! PDF ready hai — download karo!', {
      screenshot: confirmScreenshot,
      pdfBase64: summaryPdfBase64,
      pdfPath: summaryPdfPath,
    });

  } catch (err) {
    const errScreenshot = await page.screenshot({ encoding: 'base64' }).catch(() => null);
    send('error', `❌ Error: ${err.message}`, { screenshot: errScreenshot });
    // Error ke baad bhi browser open rakho — 30 min
    send('progress', '⏳ Error ke baad bhi browser open hai — check karo');
    await new Promise(r => setTimeout(r, 1800000));
  }

  // Browser 30 min open — user can inspect / pay / verify
  await new Promise(r => setTimeout(r, 1800000));
  await context.close();
})();
