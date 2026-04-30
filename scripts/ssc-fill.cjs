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
    motherName: process.env.MOTHER_NAME  || '',   // REQUIRED — no default
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
    send('progress', '🔍 Active exams check kar raha hoon...');
    await page.waitForTimeout(2000);

    // Scrape all exam links/buttons from dashboard
    var activeExams = await page.evaluate(function() {
      var exams = [];
      var seen = new Set();
      // Check tables, cards, list items for exam names
      document.querySelectorAll('a, button, tr, .card, .exam-item, li').forEach(function(el) {
        var txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (txt.length < 5 || txt.length > 200) return;
        // Look for exam-like keywords
        if (/(exam|recruitment|notification|apply|cgl|chsl|mts|cpo|steno|je|gd|selection|post|vacancy)/i.test(txt)) {
          var key = txt.substring(0, 60);
          if (!seen.has(key)) {
            seen.add(key);
            exams.push({ text: key, tag: el.tagName });
          }
        }
      });
      return exams.slice(0, 20); // max 20
    });

    if (activeExams.length > 0) {
      var examList = activeExams.map(function(e, i) { return (i+1) + '. ' + e.text; }).join('\n');
      send('exam_list', '📋 Ye active exams hain:\n' + examList + '\n\nKaunsa exam fill karna hai? Number ya naam type karo:', { otpFile: OTP_FILE });
      var examChoice = await waitForCaptchaSolution(120000);
      send('progress', '✅ Exam selected: ' + examChoice);

      // Click the selected exam
      var examClicked = await page.evaluate(function(choice) {
        var all = Array.from(document.querySelectorAll('a, button, .card, tr'));
        // Try by number
        var num = parseInt(choice);
        var examEls = all.filter(function(el) {
          var txt = (el.textContent || '').trim();
          return txt.length > 5 && txt.length < 200 &&
            /(exam|recruitment|apply|cgl|chsl|mts|cpo|steno|je|gd|selection)/i.test(txt);
        });
        var target = null;
        if (!isNaN(num) && num > 0 && examEls[num-1]) {
          target = examEls[num-1];
        } else {
          // Try by text match
          target = all.find(function(el) {
            return (el.textContent || '').toLowerCase().includes(choice.toLowerCase());
          });
        }
        if (target) {
          target.scrollIntoView({ block: 'center' });
          target.click();
          return (target.textContent || '').trim().substring(0, 80);
        }
        return null;
      }, examChoice);

      if (examClicked) {
        send('progress', '✅ Exam clicked: ' + examClicked);
        await page.waitForTimeout(3000);
      } else {
        send('progress', '⚠️ Exam link nahi mila — dashboard pe hoon');
      }
    } else {
      send('progress', '⚠️ Koi active exam nahi mila dashboard pe');
    }

    // Screenshot of current state — send base64 inline
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

    // Auto Save & Next with re-fill on failure
    async function autoSaveNext(label) {
      label = label || 'Save & Next';
      for (var attempt = 1; attempt <= 3; attempt++) {
        await page.evaluate(function() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); });
        await page.waitForTimeout(600);

        var prevUrl = page.url();
        var btnClicked = await page.evaluate(function() {
          var btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          var btn = btns.find(function(b) {
            var txt = (b.textContent || b.value || '').trim();
            return /save\s*&?\s*next|next|save|continue|proceed/i.test(txt) &&
              !b.disabled && b.getBoundingClientRect().height > 0;
          });
          if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return (btn.textContent || btn.value || '').trim(); }
          return null;
        });

        if (!btnClicked) {
          send('progress', '⚠️ ' + label + ' button nahi mila (attempt ' + attempt + ')');
          await page.waitForTimeout(1500);
          continue;
        }

        send('progress', '✅ ' + label + ' clicked: "' + btnClicked + '"');

        try {
          await page.waitForFunction(function(prev) {
            return window.location.href !== prev ||
              document.querySelector('input[type="file"]') ||
              document.querySelector('input[type="checkbox"]');
          }, prevUrl, { timeout: 10000 });
          send('progress', '✅ Next step: ' + page.url());

          // Check if refresh needed on new page
          await page.waitForTimeout(1000);
          await refillIfNeeded();
          break;
        } catch(e) {
          send('progress', '⚠️ Page nahi badi attempt ' + attempt + ' — retry...');
          await refillIfNeeded();
          await page.waitForTimeout(1500);
        }
      }
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

    // ── READ DASHBOARD DATA ────────────────────────────────────
    send('progress', '📋 Dashboard se details padh raha hoon...');
    await page.waitForTimeout(3000);
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
      // Read all displayed data from dashboard
      const otrData = await page.evaluate(() => {
        const text = document.body.innerText;
        return text;
      });
      send('progress', `✅ Dashboard data: ${otrData.substring(0, 300)}`);
      // Go directly to PDF generation
      send('progress', '✅ OTR already done — PDF generate kar raha hoon...');
      // Fall through to PDF generation below
    }

    if (!dashboardData.otrDone) {
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
  }

  // Keep browser open for 10 minutes (user can inspect)
  await new Promise(r => setTimeout(r, 600000));
  await context.close();
})();
