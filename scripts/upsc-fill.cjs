// UPSC Account Creation + OTR — upsconline.nic.in
// Flow: Instructions → Verify Email → Verify Mobile → Create Password → OTR
// OTP + CAPTCHA: manual fill in browser, type "done" in app

const { getGovformCredsFile, getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs   = require('fs');
const path = require('path');

const PROFILE_DIR  = getGovformProfileDir('upsc-profile');
const CREDS_FILE   = getGovformCredsFile();
const OTP_FILE        = '/tmp/govform_otp.txt';
const STATUS_FILE     = '/tmp/govform_status.json';
const SCREENSHOT_FILE = '/tmp/govform_screenshot.png';

function send(type, message, extra = {}) {
  const data = { type, message, ...extra };
  process.stdout.write(JSON.stringify(data) + '\n');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
}

async function saveScreenshot(page, label) {
  try {
    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    // Send base64 inline — /tmp is not shared across Vercel lambda instances
    send('screenshot', label || '📸 Screenshot liya — dekho neeche', { screenshot: buf.toString('base64') });
  } catch (e) {
    send('log', `Screenshot error: ${e.message}`);
  }
}

function loadCreds() {
  try { return fs.existsSync(CREDS_FILE) ? JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')) : {}; } catch { return {}; }
}

function saveCreds(exam, fields) {
  const all = loadCreds();
  all[exam] = { ...(all[exam] || {}), ...fields };
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(all, null, 2));
}

async function waitForInput(file, ms = 300000) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (fs.existsSync(file)) {
      const v = fs.readFileSync(file, 'utf8').trim();
      if (v) { fs.unlinkSync(file); return v; }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Input timeout');
}

async function fillInput(page, selector, value) {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    await el.scrollIntoViewIfNeeded();
    await page.evaluate(({ sel, val }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const p = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (p?.set) p.set.call(el, val);
      ['input', 'change', 'blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
    }, { sel: selector, val: value });
    return true;
  } catch { return false; }
}

async function fillByLabel(page, labelText, value) {
  return await page.evaluate(({ label, val }) => {
    const allInputs = Array.from(document.querySelectorAll('input, textarea, select'));
    const inp = allInputs.find(el => {
      const lbl = document.querySelector(`label[for="${el.id}"]`)?.textContent || '';
      const ph = el.placeholder || '';
      const nm = el.name || '';
      return (lbl + ph + nm).toLowerCase().includes(label.toLowerCase());
    });
    if (!inp) return false;
    const p = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (p?.set) p.set.call(inp, val);
    ['input', 'change', 'blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
    return true;
  }, { label: labelText, val: value });
}

(async () => {
  const student = {
    name:       process.env.FULL_NAME    || 'SUMIT KUMAR MINA',
    dob:        process.env.DOB          || '07/07/2000',
    mobile:     process.env.MOBILE       || '',
    email:      process.env.EMAIL        || 'Sumitkunwal8824@gmail.com',
    gender:     process.env.GENDER       || 'Male',
    fatherName: process.env.FATHER_NAME  || 'HARKESH MEENA',
    motherName: process.env.MOTHER_NAME  || '',
    category:   process.env.CATEGORY     || 'ST',
    aadhaar:    process.env.AADHAAR      || '2012 2796 4504',
    nationality:'Indian',
    state:      process.env.STATE        || 'Rajasthan',
    address:    process.env.ADDRESS      || 'Narouli Chaur, Sawai Madhopur',
    pin:        process.env.PIN          || '322214',
    photoPath:  process.env.PHOTO_PATH   || '',
    signPath:   process.env.SIGN_PATH    || '',
  };

  // Ask mobile only if not passed from profile
  if (!student.mobile) {
    send('otp', '📱 Apna mobile number type karo (10 digits):', { otpFile: OTP_FILE });
    student.mobile = (await waitForInput(OTP_FILE)).trim();
  } else {
    send('progress', `📱 Mobile: ${student.mobile} (profile se)`);
  }

  const savedCreds = loadCreds();
  const upscCreds  = savedCreds['upsc'] || {};
  let hasLogin     = !!(upscCreds.regId && upscCreds.password);

  if (hasLogin) {
    // Saved credentials hain — confirm karo
    send('otp', `💾 Saved UPSC account mila!\nReg ID: ${upscCreds.regId}\n\nKya isi se login karoon?\n"yes" = isi account se login\n"no" = naya account banana hai`, { otpFile: OTP_FILE });
    const confirm = (await waitForInput(OTP_FILE)).toLowerCase().trim();
    if (confirm !== 'yes' && confirm !== 'y' && confirm !== 'haan' && confirm !== '1') {
      hasLogin = false; // naya account banayenge
      send('progress', '📝 Naya UPSC account banayenge...');
    } else {
      send('progress', `✅ Saved account use karenge — Reg ID: ${upscCreds.regId}`);
    }
  }

  if (!hasLogin) {
    // Koi saved credentials nahi — poochho
    send('otp', '🔐 Kya tumhara UPSC account already hai?\n"yes" type karo agar hai, "no" type karo agar naya banana hai:', { otpFile: OTP_FILE });
    const ans = (await waitForInput(OTP_FILE)).toLowerCase().trim();
    if (ans === 'yes' || ans === 'y' || ans === 'haan' || ans === '1') {
      send('otp', '📋 Apna UPSC Registration ID type karo:', { otpFile: OTP_FILE });
      upscCreds.regId = (await waitForInput(OTP_FILE)).trim();
      send('otp', '🔑 Password type karo:', { otpFile: OTP_FILE });
      upscCreds.password = (await waitForInput(OTP_FILE)).trim();
      saveCreds('upsc', { regId: upscCreds.regId, password: upscCreds.password, email: student.email, mobile: student.mobile });
      hasLogin = true;
      send('progress', `✅ Credentials save ho gayi — Reg ID: ${upscCreds.regId}`);
    } else {
      send('progress', '📝 Naya UPSC account banayenge...');
    }
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  // Remove stale lock files so old sessions don't block new ones
  ['SingletonLock','SingletonCookie','SingletonSocket'].forEach(f => {
    try { fs.unlinkSync(path.join(PROFILE_DIR, f)); } catch {}
  });
  const context = await launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--disable-infobars',
      '--hide-crash-restore-bubble',
    ],
  });
  const page = await context.newPage();

  // Auto-dismiss any profile error dialogs
  context.on('page', async (newPage) => {
    await newPage.addInitScript(() => {
      window.alert = () => {};
      window.confirm = () => true;
    });
  });
  await page.addInitScript(() => {
    window.alert = () => {};
    window.confirm = () => true;
  });

  // ── Shared CAPTCHA helpers (top-level scope) ─────────────────

  async function dismissDialogs() {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ok = btns.find(b => /^ok$/i.test(b.textContent.trim()) && b.getBoundingClientRect().height > 0);
      if (ok) ok.click();
    });
    await page.waitForTimeout(500);
  }

  async function getCaptchaImage() {
    const imgs = await page.$$('img');
    let bestEl = null, bestArea = 0;
    for (const img of imgs) {
      const box = await img.boundingBox();
      if (!box) continue;
      const area = box.width * box.height;
      if (box.width < 60 || box.height < 20) continue;   // skip tiny icons
      if (box.width > 400 || box.height > 200) continue; // skip logos
      if (area > bestArea) { bestArea = area; bestEl = img; }
    }
    if (bestEl) {
      try { return await bestEl.screenshot({ type: 'png' }); } catch {}
    }
    return await page.screenshot({ type: 'png' });
  }

  async function solveCaptcha() {
    const buf = await getCaptchaImage();
    fs.writeFileSync(SCREENSHOT_FILE, buf);
    send('screenshot', '🔐 CAPTCHA captured');
    const Anthropic = require('@anthropic-ai/sdk');
    const ai = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await ai.messages.create({
      model: 'claude-opus-4-5', max_tokens: 20,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: buf.toString('base64') } },
        { type: 'text', text: 'This is a CAPTCHA image from UPSC India website. Reply with ONLY the CAPTCHA characters — no spaces, no explanation.' }
      ]}]
    });
    return resp.content[0].text.trim().replace(/[^a-zA-Z0-9]/g, '');
  }

  async function fillCaptchaInput(answer) {
    await page.evaluate((ans) => {
      const inputs = Array.from(document.querySelectorAll('input'));

      // Priority 1: explicit captcha field by name/id/placeholder/aria-label
      let inp = inputs.find(i => {
        if (i.type === 'email' || i.type === 'checkbox' || i.type === 'hidden') return false;
        const hint = (i.name + i.id + i.placeholder + (i.getAttribute('aria-label') || '')).toLowerCase();
        return hint.includes('captcha') || hint.includes('security');
      });

      // Priority 2: visible text input that is NOT a mobile/phone/confirm/email/password field
      if (!inp) {
        inp = inputs.find(i => {
          if (i.type !== 'text') return false;
          if (!i.offsetParent) return false; // hidden/invisible
          const hint = (i.name + i.id + i.placeholder + (i.getAttribute('aria-label') || '')).toLowerCase();
          // Skip mobile/phone/confirm/email/password/otp fields
          if (hint.match(/mobile|phone|confirm|email|password|otp|dob|date|name|pin|address/)) return false;
          return true;
        });
      }

      if (!inp) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inp, ans);
      ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
    }, answer);
  }

  async function solveCaptchaWithRetry(label) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      send('progress', `🤖 ${label} CAPTCHA attempt ${attempt}/5...`);
      try {
        const ans = await solveCaptcha();
        send('progress', `🎯 Claude: "${ans}"`);
        await fillCaptchaInput(ans);
        await page.waitForTimeout(400);

        // Click Get OTP / Submit
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const btn = btns.find(b => (b.textContent || b.value || '').match(/get\s*otp|send\s*otp|proceed|submit/i) && !b.disabled && b.getBoundingClientRect().height > 0);
          if (btn) btn.click();
        });
        await page.waitForTimeout(2000);

        const hasError = await page.evaluate(() => {
          const dialogs = document.querySelectorAll('.modal, .alert, [role="dialog"], .warning');
          for (const d of dialogs) {
            if (d.textContent.toLowerCase().includes('captcha') && d.getBoundingClientRect().height > 0) return true;
          }
          return false;
        });

        if (hasError) {
          send('progress', `❌ Wrong — retry...`);
          await dismissDialogs();
          await page.waitForTimeout(800);
        } else {
          send('progress', `✅ ${label} CAPTCHA solved! (attempt ${attempt})`);
          return true;
        }
      } catch (e) {
        send('progress', `⚠️ ${e.message}`);
      }
    }
    // Manual fallback
    await saveScreenshot(page);
    send('otp', `🔐 AI solve nahi kar paya — ${label} CAPTCHA manually type karo:`, { otpFile: OTP_FILE });
    const manual = (await waitForInput(OTP_FILE)).trim();
    await fillCaptchaInput(manual);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').match(/get\s*otp|send\s*otp|proceed/i) && !b.disabled);
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);
    return false;
  }

  // ── Mutex to prevent concurrent fills causing duplicate text ──
  let fillingEmail = false;

  // Fill all email fields (both Email ID and Confirm Email ID)
  async function fillAllEmailFields() {
    if (fillingEmail) return;
    fillingEmail = true;
    try {
      if (!page.url().includes('upsconline.nic.in')) return;
      // Use broad selector to catch Email ID, Confirm Email ID, Re-enter Email, etc.
      const inputs = await page.$$('input[placeholder*="Email" i], input[type="email"]');
      let filled = 0;
      for (const inp of inputs) {
        try {
          const current = await inp.inputValue().catch(() => '');
          // Skip if already has correct email
          if (current.toLowerCase() === student.email.toLowerCase()) continue;
          await inp.scrollIntoViewIfNeeded().catch(() => {});
          // Triple-click to select all existing text, then type replaces it
          await inp.click({ clickCount: 3 });
          await page.waitForTimeout(50);
          await inp.type(student.email, { delay: 30 });
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);
          filled++;
        } catch {}
      }
      if (filled > 0) send('progress', `✅ ${filled} email field(s) auto-filled`);
    } catch (e) {
      send('log', `Email fill error: ${e.message}`);
    } finally {
      fillingEmail = false;
    }
  }

  // Fill email whenever page loads/refreshes — waits for Angular to render inputs first
  async function fillEmailOnLoad() {
    try {
      if (!page.url().includes('upsconline.nic.in')) return;
      // Wait until Angular renders the input — up to 15 seconds
      await page.waitForSelector('input[placeholder*="Email" i], input[type="email"]', { timeout: 15000 });
      await page.waitForTimeout(800); // small delay for Angular FormControl init
      await fillAllEmailFields();
    } catch (e) {
      send('log', `Email fill error: ${e.message}`);
    }
  }
  page.on('load', fillEmailOnLoad);
  const emailFillLoop = setInterval(async () => {
    try {
      if (!page.url().includes('upsconline.nic.in')) return;
      await fillAllEmailFields();
    } catch {}
  }, 3000);

  try {
    // ── ACCOUNT CREATION ─────────────────────────────────────────
    if (!hasLogin) {
      // ── STEP 1: Instructions ────────────────────────────────────
      send('start', '🌐 UPSC Instructions page khol raha hoon...');
      await page.goto('https://upsconline.nic.in/instruction', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      send('progress', `📋 URL: ${page.url()}`);

      {
        send('progress', '📖 Step 1: Instructions page — checkbox tick kar raha hoon...');
        await page.evaluate(() => {
          const cbs = document.querySelectorAll('input[type="checkbox"]');
          cbs.forEach(cb => { if (!cb.checked) cb.click(); });
        });
        await page.waitForTimeout(500);

        // Try clicking Proceed button, fallback to direct navigation
        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
          const btn = btns.find(b => (b.textContent || b.value || '').match(/proceed|next|continue/i) && b.getBoundingClientRect().height > 0);
          if (btn) { btn.click(); return true; }
          return false;
        });
        if (!clicked) {
          await page.goto('https://upsconline.nic.in/onboarding', { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
        await page.waitForTimeout(2000);
        send('progress', `📋 Step 1 done — URL: ${page.url()}`);
      }

      // ── STEP 2: Verify Email ────────────────────────────────────
      send('progress', '📧 Step 2: Email ID verify kar raha hoon...');

      // Fill email fields
      const emailFilled = await page.evaluate((email) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const emailInputs = inputs.filter(i => i.type === 'email' || i.name?.toLowerCase().includes('email') || i.id?.toLowerCase().includes('email') || i.placeholder?.toLowerCase().includes('email'));
        if (emailInputs.length === 0) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        emailInputs.forEach(inp => {
          setter.call(inp, email);
          ['input', 'change', 'blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
        });
        return true;
      }, student.email);

      if (!emailFilled) {
        send('otp', `📧 Email field nahi mila browser mein. Browser mein manually email fill karo aur CAPTCHA bhi — phir "done" type karo:`, { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      } else {
        send('progress', `✅ Email filled: ${student.email}`);
        // Tick declaration checkbox
        await page.evaluate(() => {
          const cbs = document.querySelectorAll('input[type="checkbox"]');
          cbs.forEach(cb => { if (!cb.checked) cb.click(); });
        });
        await page.waitForTimeout(500);
        // ── Email CAPTCHA: shared helper use karo ──
        await dismissDialogs();
        await page.waitForTimeout(500);
        await solveCaptchaWithRetry('Email');
        send('progress', `📋 Email CAPTCHA done — URL: ${page.url()}`);
      }

      // Save fresh screenshot showing current browser state (OTP page)
      await saveScreenshot(page);

      // Wait for OTP — user types it in UI, we auto-fill in browser
      send('otp', `📧 Email ${student.email} par OTP aaya hoga — OTP neeche type karo:`, { otpFile: OTP_FILE });
      const emailOtp = await waitForInput(OTP_FILE);
      send('progress', `✅ OTP mila: ${emailOtp} — browser mein fill kar raha hoon...`);

      // Auto-fill OTP in browser
      const otpFilled = await page.evaluate((otp) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const otpInput = inputs.find(i => {
          const hint = (i.name + i.id + i.placeholder + (i.getAttribute('aria-label') || '')).toLowerCase();
          return hint.includes('otp') || hint.includes('verification') || hint.includes('code') || i.type === 'number';
        });
        if (!otpInput) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(otpInput, otp);
        ['input', 'change', 'blur'].forEach(e => otpInput.dispatchEvent(new Event(e, { bubbles: true })));
        return true;
      }, emailOtp);

      if (otpFilled) {
        send('progress', '✅ OTP auto-fill ho gaya! Submit kar raha hoon...');
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const btn = btns.find(b => (b.textContent || b.value || '').match(/verify|submit|confirm|proceed/i) && !b.disabled);
          if (btn) btn.click();
        });
        await page.waitForTimeout(2000);
        await saveScreenshot(page);
      } else {
        send('otp', '⚠️ OTP field nahi mila auto — browser mein manually fill karo phir "done" type karo:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      }
      send('progress', '✅ Email OTP step complete');

      // Auto-click OK on any success/confirmation dialog after email verify
      await page.waitForTimeout(1500);
      await dismissDialogs();
      await page.waitForTimeout(500);

      // Also try clicking OK button with text matching
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, .btn, [class*="ok"], [class*="confirm"]'));
        const okBtn = btns.find(b => {
          const txt = (b.textContent || b.value || '').trim().toUpperCase();
          return (txt === 'OK' || txt === 'OKAY' || txt === 'CLOSE' || txt === 'CONTINUE' || txt === 'PROCEED') && b.getBoundingClientRect().height > 0;
        });
        if (okBtn) okBtn.click();
      });
      await page.waitForTimeout(1000);
      await saveScreenshot(page);

      // ── STEP 3: Verify Mobile ────────────────────────────────────
      send('progress', '📱 Step 3: Mobile number verify kar raha hoon...');
      // Wait for mobile page to load properly
      await page.waitForTimeout(2000);

      const mobileFilled = await page.evaluate((mobile) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const mobileInputs = inputs.filter(i =>
          i.type === 'tel' || i.type === 'number' ||
          i.name?.toLowerCase().match(/mobile|phone|contact/) ||
          i.id?.toLowerCase().match(/mobile|phone|contact/) ||
          i.placeholder?.toLowerCase().match(/mobile|phone/)
        );
        if (mobileInputs.length === 0) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        mobileInputs.forEach(inp => {
          setter.call(inp, mobile);
          ['input', 'change', 'blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
        });
        return true;
      }, student.mobile);

      if (!mobileFilled) {
        send('otp', `📱 Mobile field nahi mila. Browser mein manually mobile number fill karo — phir "done" type karo:`, { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      } else {
        send('progress', `✅ Mobile filled: ${student.mobile}`);
        await page.waitForTimeout(400);

        // Double-check — re-fill mobile fields to ensure correct value
        await page.evaluate((mobile) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          inputs.forEach(i => {
            const hint = (i.name + i.id + i.placeholder + (i.getAttribute('aria-label') || '')).toLowerCase();
            if (hint.match(/mobile|phone/) && (i.type === 'text' || i.type === 'tel' || i.type === 'number')) {
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              setter.call(i, mobile);
              ['input', 'change', 'blur'].forEach(ev => i.dispatchEvent(new Event(ev, { bubbles: true })));
            }
          });
        }, student.mobile);
        await page.waitForTimeout(300);

        // Tick any declaration checkbox
        await page.evaluate(() => {
          const cbs = document.querySelectorAll('input[type="checkbox"]');
          cbs.forEach(cb => { if (!cb.checked) cb.click(); });
        });
        await page.waitForTimeout(500);

        // Screenshot before CAPTCHA so we can see browser state
        await saveScreenshot(page);

        // ── Claude Vision se Mobile CAPTCHA auto-solve ──
        await solveCaptchaWithRetry('Mobile');
      }

      // Mobile OTP — auto-fill
      await saveScreenshot(page);
      send('otp', `📱 Mobile ${student.mobile} par OTP aaya hoga — type karo:`, { otpFile: OTP_FILE });
      const mobileOtp = await waitForInput(OTP_FILE);
      send('progress', `✅ Mobile OTP: ${mobileOtp} — browser mein fill kar raha hoon...`);
      const mobileOtpFilled = await page.evaluate((otp) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const inp = inputs.find(i => {
          const hint = (i.name + i.id + i.placeholder + (i.getAttribute('aria-label') || '')).toLowerCase();
          return hint.includes('otp') || hint.includes('verification') || hint.includes('code');
        });
        if (!inp) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(inp, otp);
        ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
        return true;
      }, mobileOtp);

      if (mobileOtpFilled) {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => (b.textContent || '').match(/verify|submit|confirm/i) && !b.disabled);
          if (btn) btn.click();
        });
        send('progress', '✅ Mobile OTP auto-submit!');
        await page.waitForTimeout(2000);
        // Auto-click OK on success dialog after mobile verify
        await dismissDialogs();
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, .btn'));
          const okBtn = btns.find(b => {
            const txt = (b.textContent || '').trim().toUpperCase();
            return (txt === 'OK' || txt === 'OKAY' || txt === 'CLOSE' || txt === 'CONTINUE' || txt === 'PROCEED') && b.getBoundingClientRect().height > 0;
          });
          if (okBtn) okBtn.click();
        });
        await page.waitForTimeout(1000);
        await saveScreenshot(page);
      } else {
        send('otp', '⚠️ OTP field nahi mila — browser mein manually fill karo phir "done" type karo:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      }
      send('progress', '✅ Mobile OTP step complete');
      await page.waitForTimeout(1500);

      // ── STEP 4: Create Password ──────────────────────────────────
      send('progress', '🔑 Step 4: Password create kar raha hoon...');
      const newPass = `Sumit@123`;

      // Wait for password page to load
      await page.waitForTimeout(1500);

      const passFilled = await page.evaluate((pass) => {
        const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
        if (inputs.length === 0) return false;
        inputs.forEach(inp => {
          // Use native setter to trigger Angular/React change detection
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(inp, pass);
          inp.dispatchEvent(new Event('input',  { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          inp.dispatchEvent(new Event('blur',   { bubbles: true }));
        });
        return true;
      }, newPass);

      if (!passFilled) {
        send('otp', `🔑 Password field nahi mila. Browser mein password set karo: ${newPass} — phir "done" type karo:`, { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      } else {
        send('progress', `✅ Password filled: ${newPass}`);
        await page.waitForTimeout(800);
        await saveScreenshot(page);
        // Submit — "Create Password" button
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const btn = btns.find(b => (b.textContent || b.value || '').match(/create\s*password|submit|save|proceed/i) && b.getBoundingClientRect().height > 0);
          if (btn) btn.click();
        });
        await page.waitForTimeout(3000);
      }

      // Get Registration ID
      let regId = await page.evaluate(() => {
        const txt = document.body?.innerText || '';
        const m = txt.match(/(?:registration|applicant|otr|candidate)\s*(?:id|no|number|ref)[:\s#-]*([A-Z0-9]{6,20})/i)
                  || txt.match(/your\s+(?:id|account)[:\s]*([A-Z0-9]{6,20})/i)
                  || txt.match(/([0-9]{8,15})/);
        return m ? m[1] : null;
      });

      if (!regId) {
        send('otp', '📋 Registration ID/Number browser mein dikh raha hoga — copy karke yahan paste karo:', { otpFile: OTP_FILE });
        regId = (await waitForInput(OTP_FILE)).trim();
      }

      saveCreds('upsc', { regId, password: newPass, email: student.email, mobile: student.mobile });
      send('creds', `✅ UPSC Account bana gaya!\n📋 Registration ID: ${regId}\n🔑 Password: ${newPass}\n📧 Email: ${student.email}`, { regId, password: newPass });

      upscCreds.regId    = regId;
      upscCreds.password = newPass;
      await page.waitForTimeout(2000);
    }

    // ── LOGIN ──────────────────────────────────────────────────────
    send('progress', '🔐 UPSC homepage pe ja raha hoon...');
    await page.goto('https://upsconline.nic.in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click "Login" button in top nav
    await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a, button'));
      const loginBtn = allLinks.find(l => l.textContent?.trim().match(/^Login$/i) && l.getBoundingClientRect().height > 0);
      if (loginBtn) loginBtn.click();
    });
    await page.waitForTimeout(2000);
    send('progress', `📋 Login URL: ${page.url()}`);

    // Fill credentials
    await page.evaluate(({ regId, pass, dob }) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

      const regInput = inputs.find(i => i.type !== 'password' && !i.type.match(/check|radio|file|hidden/) &&
        (i.name + i.id + i.placeholder + '').toLowerCase().match(/reg|user|id|login/));
      if (regInput) { setter.call(regInput, regId); ['input','change','blur'].forEach(e => regInput.dispatchEvent(new Event(e,{bubbles:true}))); }

      const passInput = inputs.find(i => i.type === 'password');
      if (passInput) { setter.call(passInput, pass); ['input','change','blur'].forEach(e => passInput.dispatchEvent(new Event(e,{bubbles:true}))); }

      const dobInput = inputs.find(i => i.name?.toLowerCase().includes('dob') || i.type === 'date' || i.placeholder?.toLowerCase().includes('birth'));
      if (dobInput) { setter.call(dobInput, dob); ['input','change','blur'].forEach(e => dobInput.dispatchEvent(new Event(e,{bubbles:true}))); }
    }, { regId: upscCreds.regId, pass: upscCreds.password, dob: student.dob });

    await page.waitForTimeout(500);

    // Check for CAPTCHA at login
    const loginCaptchaEl = await page.$('img[src*="captcha" i], img[alt*="captcha" i], [class*="captcha" i] img');
    if (loginCaptchaEl) {
      await saveScreenshot(page);
      send('otp', '🔐 CAPTCHA text type karo:', { otpFile: OTP_FILE });
      const loginCaptchaAns = await waitForInput(OTP_FILE);
      await page.evaluate((ans) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const captchaInput = inputs.find(i => (i.name + i.id + i.placeholder).toLowerCase().match(/captcha|security|code/));
        if (!captchaInput) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(captchaInput, ans);
        ['input', 'change', 'blur'].forEach(e => captchaInput.dispatchEvent(new Event(e, { bubbles: true })));
      }, loginCaptchaAns);
      send('progress', `✅ Login CAPTCHA filled`);
    }

    send('otp', `🔐 Browser mein credentials check karo:\nReg ID: ${upscCreds.regId}\nPassword: ${upscCreds.password}\n\nSab sahi lage to Login button click karo — phir "done" type karo:`, { otpFile: OTP_FILE });
    await waitForInput(OTP_FILE);
    await page.waitForTimeout(2000);
    send('progress', `✅ Login done — URL: ${page.url()}`);

    // ── UNIVERSAL REGISTRATION (OTR) ─────────────────────────────
    send('progress', '📝 Universal Registration (OTR) shuru kar raha hoon...');
    await page.waitForTimeout(1000);

    // Click "Universal Registration" from nav/menu
    const otrClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      // Try "Proceed for Universal Registration" link
      const proceed = links.find(l => l.textContent?.toLowerCase().match(/proceed.*universal|proceed.*otr/i) && l.getBoundingClientRect().height > 0);
      if (proceed) { proceed.click(); return 'proceed'; }
      // Try nav menu
      const nav = links.find(l => l.textContent?.trim().toLowerCase().match(/universal\s*reg/i) && l.getBoundingClientRect().height > 0);
      if (nav) { nav.click(); return 'nav'; }
      return null;
    });

    if (!otrClicked) {
      send('otp', '📝 Browser mein "Universal Registration" → "Proceed for Universal Registration" click karo — phir "done" type karo:', { otpFile: OTP_FILE });
      await waitForInput(OTP_FILE);
    } else {
      await page.waitForTimeout(2000);
    }
    send('progress', `📋 OTR URL: ${page.url()}`);

    // Fill OTR form fields
    send('progress', '📝 OTR form fill ho raha hai...');

    await page.evaluate((s) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));

      const fillByHint = (hints, value) => {
        const inp = inputs.find(i => {
          const hint = (i.name + i.id + i.placeholder + (document.querySelector(`label[for="${i.id}"]`)?.textContent || '')).toLowerCase();
          return hints.some(h => hint.includes(h)) && !i.disabled && i.type !== 'hidden';
        });
        if (!inp) return;
        if (inp.tagName === 'SELECT') {
          for (const o of inp.options) {
            if (o.text.toLowerCase().includes(value.toLowerCase())) { inp.value = o.value; break; }
          }
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          setter.call(inp, value);
          ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
        }
      };

      fillByHint(['name', 'full'], s.name);
      fillByHint(['father'], s.fatherName);
      fillByHint(['mother'], s.motherName);
      fillByHint(['mobile', 'phone', 'contact'], s.mobile);
      fillByHint(['aadhaar', 'aadhar'], s.aadhaar.replace(/\s/g, ''));
      fillByHint(['address', 'addr'], s.address);
      fillByHint(['pin', 'postal', 'zip'], s.pin);
      fillByHint(['state'], s.state);
    }, student);

    // DOB
    await page.evaluate((dob) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const dobInp = document.querySelector('input[type="date"], input[name*="dob" i], input[id*="dob" i]');
      if (dobInp) { setter.call(dobInp, dob); ['input','change','blur'].forEach(e => dobInp.dispatchEvent(new Event(e,{bubbles:true}))); }
    }, student.dob);

    // Gender radio
    await page.evaluate((g) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      for (const r of radios) {
        const label = (r.nextElementSibling?.textContent || document.querySelector(`label[for="${r.id}"]`)?.textContent || '').toLowerCase();
        if (label.includes(g.toLowerCase())) { r.click(); return; }
      }
    }, student.gender);

    // Category
    await page.evaluate((cat) => {
      document.querySelectorAll('select').forEach(sel => {
        if ((sel.name + sel.id).toLowerCase().match(/categor|caste|communit/)) {
          for (const o of sel.options) {
            if (o.text.toUpperCase().includes(cat)) { sel.value = o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); }
          }
        }
      });
    }, student.category);

    await page.waitForTimeout(1000);

    // Photo/signature upload
    if (student.photoPath && fs.existsSync(student.photoPath)) {
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs[0]) { await fileInputs[0].setInputFiles(student.photoPath); await page.waitForTimeout(1500); send('progress', '✅ Photo uploaded'); }
      if (fileInputs[1] && student.signPath && fs.existsSync(student.signPath)) {
        await fileInputs[1].setInputFiles(student.signPath); await page.waitForTimeout(1500); send('progress', '✅ Signature uploaded');
      }
    }

    send('otp', '📝 OTR form browser mein check karo — sab details sahi hain to Save/Next click karo — phir "done" type karo:', { otpFile: OTP_FILE });
    await waitForInput(OTP_FILE);
    await page.waitForTimeout(2000);
    send('progress', `📋 After OTR form — URL: ${page.url()}`);

    // ── SCREENSHOT ──────────────────────────────────────────────
    await saveScreenshot(page);
    send('done', '🎉 UPSC Account bana gaya! Ab browser mein OTR complete karo.');

  } catch (err) {
    console.error('UPSC script error:', err);
    await saveScreenshot(page).catch(() => {});
    send('error', `❌ Error: ${err.message}`);
  }

  clearInterval(emailFillLoop);
  // Keep browser open
  await new Promise(r => setTimeout(r, 600000));
  await context.close();
})();
