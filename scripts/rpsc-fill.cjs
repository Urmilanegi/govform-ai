// RPSC Form Filler — via sso.rajasthan.gov.in → rpsc.rajasthan.gov.in
// Handles SSO Registration → OTP → Login → RPSC Apply
// Communicates via stdout JSON lines

const { getGovformCredsFile, getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs   = require('fs');
const path = require('path');

const PROFILE_DIR  = getGovformProfileDir('rpsc-profile');
const CREDS_FILE   = getGovformCredsFile();
const OTP_FILE     = '/tmp/govform_otp.txt';
const CAPTCHA_FILE = '/tmp/govform_captcha.txt';
const STATUS_FILE  = '/tmp/govform_status.json';

function send(type, message, extra = {}) {
  const data = { type, message, ...extra };
  process.stdout.write(JSON.stringify(data) + '\n');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
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
async function waitForInput(file, ms = 180000) {
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
  const el = await page.$(selector);
  if (!el) return false;
  await el.scrollIntoViewIfNeeded();
  await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const p = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (p?.set) p.set.call(el, val);
    ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
  }, { sel: selector, val: value });
  return true;
}

async function isErrorPage(page) {
  const txt = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
  const url = page.url().toLowerCase();
  return txt.includes('404') || txt.includes('page not found') || txt.includes('oops') ||
         txt.includes('error occurred') || url.includes('404');
}

async function submitOtpWithRetry(page, otpSelector, verifyBtnPattern, label, maxTries = 3) {
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const prompt = attempt === 1
      ? `📱 ${label} — OTP enter karo:`
      : `❌ OTP galat tha! Phir se try karo (attempt ${attempt}/${maxTries}):`;
    send('otp', prompt, { otpFile: OTP_FILE });
    const otp = await waitForInput(OTP_FILE);
    send('progress', `✏️ OTP submit: ${otp}`);
    await fillInput(page, otpSelector, otp);
    await page.waitForTimeout(400);
    await page.evaluate((pattern) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => new RegExp(pattern, 'i').test(b.textContent || ''));
      if (btn) btn.click();
    }, verifyBtnPattern);
    await page.waitForTimeout(3000);
    const pageText = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
    const hasError =
      pageText.includes('invalid otp') || pageText.includes('wrong otp') ||
      pageText.includes('otp incorrect') || pageText.includes('incorrect otp') ||
      pageText.includes('otp expired') || pageText.includes('verification failed') ||
      pageText.includes('otp not match') || pageText.includes('invalid verification') ||
      pageText.includes('invalid code');
    if (!hasError) { send('progress', '✅ OTP verified!'); return otp; }
    if (attempt === maxTries) throw new Error('OTP 3 baar galat tha. Process band ho raha hai.');
  }
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
    category:   process.env.CATEGORY    || 'ST',
    aadhaar:    process.env.AADHAAR      || '201227964504',
    state:      'Rajasthan',
    district:   process.env.DISTRICT     || 'Sawai Madhopur',
    pin:        process.env.PIN          || '322214',
    address:    process.env.ADDRESS      || 'Narouli Chaur, Sawai Madhopur',
    photoPath:  process.env.PHOTO_PATH   || '',
    signPath:   process.env.SIGN_PATH    || '',
  };

  send('progress', '🔍 RPSC details check ho rahi hain...');
  if (!student.mobile) {
    send('otp', '📱 Mobile number enter karo (10 digits):', { otpFile: OTP_FILE });
    student.mobile = await waitForInput(OTP_FILE);
  }
  if (!student.email) {
    send('otp', '📧 Email address enter karo:', { otpFile: OTP_FILE });
    student.email = await waitForInput(OTP_FILE);
  }

  const savedCreds = loadCreds();
  const savedRpsc  = savedCreds['rpsc'] || {};
  // Prefer env vars (passed from app) over saved file creds
  const rpscCreds  = {
    ssoId:    process.env.SSO_ID   || savedRpsc.ssoId    || '',
    password: process.env.SSO_PASS || savedRpsc.password || '',
  };
  const hasLogin   = !!(rpscCreds.ssoId && rpscCreds.password);
  send('progress', hasLogin ? `✅ SSO ID: ${rpscCreds.ssoId}` : '📝 SSO ID/Password nahi mila — enter karo');

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const context = await launchPersistentContext(PROFILE_DIR, {
    headless: false, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ── ASK FOR SSO CREDS IF MISSING ──────────────────────────
    if (!rpscCreds.ssoId) {
      send('otp', '🔐 SSO ID enter karo (jaise: RAMKUMAR9983):', { otpFile: OTP_FILE });
      rpscCreds.ssoId = await waitForInput(OTP_FILE);
    }
    if (!rpscCreds.password) {
      send('otp', '🔑 SSO Password enter karo:', { otpFile: OTP_FILE });
      rpscCreds.password = await waitForInput(OTP_FILE);
    }
    // Save for next time
    saveCreds('rpsc', { ssoId: rpscCreds.ssoId, password: rpscCreds.password });

    // ── SSO LOGIN ─────────────────────────────────────────────
    send('progress', '🌐 SSO login page khol raha hoon...');
    await page.goto('https://sso.rajasthan.gov.in/signin', { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto('https://sso.rajasthan.gov.in/signin', { waitUntil: 'domcontentloaded', timeout: 20000 });
    });
    await page.waitForTimeout(2500);

    // Close any popup/overlay/modal first
    await page.evaluate(function() {
      // Close buttons in modals
      var closeBtns = Array.from(document.querySelectorAll('button.close, .modal .close, [data-dismiss="modal"], .popup-close, .overlay-close, button[aria-label*="close" i]'));
      closeBtns.forEach(function(b) { try { b.click(); } catch(e){} });
      // Hide overlays
      var overlays = Array.from(document.querySelectorAll('.modal-backdrop, .overlay, .popup-overlay'));
      overlays.forEach(function(o) { o.style.display = 'none'; });
    });
    await page.waitForTimeout(500);

    // Get actual field info from page DOM
    var fieldInfo = await page.evaluate(function() {
      var inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
      return inputs.map(function(inp) {
        var rect = inp.getBoundingClientRect();
        return {
          type: inp.type, name: inp.name, id: inp.id,
          placeholder: inp.placeholder, className: inp.className,
          visible: rect.height > 0 && rect.width > 0
        };
      }).filter(function(i) { return i.visible; });
    });
    send('progress', '🔍 Form fields: ' + JSON.stringify(fieldInfo.slice(0,5)));

    // Reliable fill — clears first, then fills
    async function ssoFill(selectors, value) {
      var selList = Array.isArray(selectors) ? selectors : [selectors];
      for (var s of selList) {
        try {
          var el = await page.$(s);
          if (!el) continue;
          var isVisible = await el.isVisible();
          if (!isVisible) continue;

          // Force clear via JS first
          await page.evaluate(function(sel) {
            var inp = document.querySelector(sel);
            if (inp) {
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '');
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, s);
          await page.waitForTimeout(100);

          // Use Playwright's fill() — it clears + fills atomically
          await page.fill(s, value);
          await page.waitForTimeout(100);

          // Trigger Angular change detection
          await page.evaluate(function(sel) {
            var inp = document.querySelector(sel);
            if (inp) ['input','change','blur'].forEach(function(ev) {
              inp.dispatchEvent(new Event(ev, { bubbles: true }));
            });
          }, s);

          // Verify
          var actual = await page.evaluate(function(sel) {
            return (document.querySelector(sel) || {}).value || '';
          }, s);
          if (actual === value) return true;
        } catch (e) {}
      }
      return false;
    }

    // Captcha solve with full page crop around captcha area
    async function solveSsoCaptcha() {
      // Take screenshot of just the captcha image element
      var capImg = await page.$('img[src*="aptcha" i], img[src*="Captcha" i], img[id*="captcha" i]');
      var capBuf;
      if (capImg) {
        // Get bigger box with padding for context
        var box = await capImg.boundingBox();
        if (box) {
          capBuf = await page.screenshot({
            type: 'png',
            clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 10), width: box.width + 60, height: box.height + 20 }
          });
        } else {
          capBuf = await capImg.screenshot({ type: 'png' });
        }
      } else {
        // Fallback: crop right side of page where captcha is
        var vp = page.viewportSize() || { width: 1280, height: 900 };
        capBuf = await page.screenshot({
          type: 'png',
          clip: { x: vp.width * 0.55, y: vp.height * 0.45, width: vp.width * 0.35, height: vp.height * 0.12 }
        });
      }
      send('screenshot', '📸 CAPTCHA cropped', { screenshot: capBuf.toString('base64') });

      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const ai = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
        var r = await ai.messages.create({
          model: 'claude-opus-4-5', max_tokens: 50,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: capBuf.toString('base64') } },
            { type: 'text', text: 'This is a CAPTCHA image from Rajasthan SSO login page. It contains exactly 6 distorted digits (0-9 only). Read every single digit carefully from LEFT to RIGHT — do NOT skip any digit. Count all 6 digits. Reply with ONLY those 6 digits, no spaces, no letters, nothing else. Double-check you have exactly 6 digits before answering.' }
          ]}]
        });
        var solved = r.content[0].text.trim().replace(/[^0-9]/g, '');
        send('progress', '🎯 CAPTCHA solved: "' + solved + '"');
        return solved;
      } catch (e) {
        send('progress', '⚠️ AI fail: ' + e.message);
        return null;
      }
    }

    // If password missing — ask user once and save
    if (!rpscCreds.password) {
      send('otp', '🔑 SSO Password enter karo (ek baar — phir save ho jaayega):', { otpFile: OTP_FILE });
      rpscCreds.password = await waitForInput(OTP_FILE, 120000);
      saveCreds('rpsc', { ssoId: rpscCreds.ssoId, password: rpscCreds.password });
      send('progress', '✅ Password save ho gaya!');
    }

    // Wait for login form to be ready
    await page.waitForSelector('input[type="password"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Fill SSO ID — using exact field info from DOM
    var idSelector = await page.evaluate(function() {
      var inputs = Array.from(document.querySelectorAll('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])'));
      var vis = inputs.filter(function(i) { var r = i.getBoundingClientRect(); return r.height > 0 && r.width > 0; });
      if (vis.length === 0) return null;
      var inp = vis[0]; // First visible text input = SSO ID
      if (inp.id) return '#' + inp.id;
      if (inp.name) return 'input[name="' + inp.name + '"]';
      return 'input[type="text"]';
    });
    send('progress', '🔍 SSO ID field: ' + idSelector);
    var idFilled = idSelector ? await ssoFill([idSelector], rpscCreds.ssoId) : false;
    send('progress', idFilled ? '✅ SSO ID fill ho gaya' : '⚠️ SSO ID fill nahi hua');
    await page.waitForTimeout(400);

    // Fill Password
    var passFilled = await ssoFill(['input[type="password"]'], rpscCreds.password);
    send('progress', passFilled ? '✅ Password fill ho gaya' : '⚠️ Password fill nahi hua');
    await page.waitForTimeout(400);

    // ── Handle "Already logged-in" checkbox ───────────────────
    var alreadyLoggedIn = await page.evaluate(function() {
      var txt = (document.body.innerText || '').toLowerCase();
      return txt.includes('already logged') || txt.includes('last session') || txt.includes('close the last session');
    });
    if (alreadyLoggedIn) {
      send('progress', '⚠️ Already logged-in dialog mila — checkbox tick karke close kar raha hoon...');
      await page.evaluate(function() {
        var cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        cbs.forEach(function(cb) { if (!cb.checked) cb.click(); });
      });
      await page.waitForTimeout(800);
      send('progress', '✅ Previous session close kar di');
    }

    // ── CAPTCHA + Login retry loop (max 5 attempts) ──────────
    var loginSuccess = false;
    for (var attempt = 1; attempt <= 5; attempt++) {
      send('progress', '🔐 Login attempt ' + attempt + '/5...');

      // Force-fill SSO ID using JS (most reliable for Angular)
      await page.evaluate(function(ssoId) {
        var inputs = Array.from(document.querySelectorAll('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])'));
        var visible = inputs.filter(function(i) { var r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        var inp = visible[0];
        if (!inp) return;
        inp.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, ssoId);
        ['input','change','keyup','blur'].forEach(function(ev) { inp.dispatchEvent(new Event(ev, { bubbles: true })); });
      }, rpscCreds.ssoId);
      await page.waitForTimeout(200);

      // Force-fill Password using JS
      await page.evaluate(function(pass) {
        var inp = document.querySelector('input[type="password"]');
        if (!inp) return;
        inp.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, pass);
        ['input','change','keyup','blur'].forEach(function(ev) { inp.dispatchEvent(new Event(ev, { bubbles: true })); });
      }, rpscCreds.password);
      await page.waitForTimeout(200);

      // Check if "already logged in" checkbox is present — if yes, no captcha needed
      var alreadyLoggedInNow = await page.evaluate(function() {
        var txt = (document.body.innerText || '').toLowerCase();
        return txt.includes('already logged') || txt.includes('last session');
      });

      if (alreadyLoggedInNow) {
        send('progress', '⚠️ Already logged-in — checkbox tick, seedha Login click...');
        // Make sure checkbox is ticked
        await page.evaluate(function() {
          document.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { if (!cb.checked) cb.click(); });
        });
        await page.waitForTimeout(500);
        // No captcha needed — click Login directly
        await page.evaluate(function() {
          var btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          var btn = btns.find(function(b) { return /^login$/i.test((b.textContent || b.value || '').trim()); });
          if (btn) btn.click();
        });
      } else {
        // Normal flow: solve captcha then login
        var captchaSolved = await solveSsoCaptcha();
        if (!captchaSolved) {
          send('captcha', '🔢 AI nahi padh paya — CAPTCHA manually type karo:', { captchaText: '' });
          captchaSolved = await waitForInput(CAPTCHA_FILE, 60000);
        }
        await ssoFill(['input[placeholder*="Captcha" i]', 'input[placeholder*="captcha" i]', 'input[name*="captcha" i]', 'input[id*="captcha" i]'], captchaSolved);
        await page.waitForTimeout(300);
        await page.evaluate(function() {
          var btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          var btn = btns.find(function(b) { return /^login$/i.test((b.textContent || b.value || '').trim()); });
          if (btn) btn.click();
        });
      }

      // Wait to see if login worked
      await page.waitForTimeout(3000);
      var currentUrl = page.url();
      var pageText = (await page.evaluate(function() { return document.body.innerText || ''; })).toLowerCase();

      if (!currentUrl.includes('signin') || currentUrl.includes('dashboard')) {
        send('progress', '✅ SSO Login ho gaya!');
        loginSuccess = true;
        break;
      } else if (pageText.includes('already logged') || pageText.includes('last session')) {
        send('progress', '⚠️ Already logged-in dialog — checkbox tick karke retry...');
        await page.evaluate(function() {
          var cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          cbs.forEach(function(cb) { if (!cb.checked) cb.click(); });
        });
        await page.waitForTimeout(1000);
        // Re-fill password (fields may clear after checkbox)
        await ssoFill(['input[type="password"]'], rpscCreds.password);
        await page.waitForTimeout(300);
      } else if (pageText.includes('invalid captcha') || pageText.includes('wrong captcha')) {
        send('progress', '❌ CAPTCHA galat tha, refresh karke retry...');
        await page.evaluate(function() {
          var refresh = document.querySelector('[id*="refresh" i], .refresh-captcha, [title*="refresh" i], [onclick*="captcha" i]');
          if (refresh) refresh.click();
        });
        await page.waitForTimeout(1500);
        // Re-fill fields
        await ssoFill(['input[placeholder*="User" i]', '#username', 'input[type="text"]:first-of-type'], rpscCreds.ssoId);
        await page.waitForTimeout(300);
        await ssoFill(['input[type="password"]'], rpscCreds.password);
        await page.waitForTimeout(300);
      } else if (pageText.includes('password is req') || pageText.includes('please fill')) {
        send('progress', '⚠️ Password field empty tha — phir se fill kar raha hoon...');
        await ssoFill(['input[type="password"]'], rpscCreds.password);
        await page.waitForTimeout(300);
      } else if (pageText.includes('invalid') || pageText.includes('incorrect')) {
        send('progress', '❌ Login failed — SSO ID ya password galat hai');
        break;
      }
    }
    if (!loginSuccess) send('progress', '⚠️ Login uncertain: ' + page.url());

    // ── OPEN RECRUITMENT PORTAL (click from SSO dashboard) ───────
    send('progress', '🏛️ SSO dashboard par Recruitment Portal dhundh raha hoon...');
    await page.waitForTimeout(2000);

    // Find and click Recruitment Portal link on SSO dashboard
    var clicked = await page.evaluate(function() {
      var all = Array.from(document.querySelectorAll('a, button, div[onclick], span[onclick]'));
      var match = all.find(function(el) {
        var txt = (el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
        return txt.includes('recruitment') || txt.includes('rpsc') || txt.includes('भर्ती');
      });
      if (match) { match.click(); return true; }
      return false;
    });

    if (!clicked) {
      send('progress', '⚠️ Dashboard par link nahi mila — direct URL try kar raha hoon...');
      await page.goto('https://recruitment.rajasthan.gov.in/candidateloginservlet', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    }

    await page.waitForTimeout(3000);

    // ── EXAM FORM CHECK ───────────────────────────────────────
    var examName = (process.env.EXAM_NAME || '').toLowerCase();
    send('progress', '🔍 Active forms check kar raha hoon...');

    // Get all visible links/buttons text on the page
    var pageLinks = await page.evaluate(function() {
      return Array.from(document.querySelectorAll('a, button, td, li'))
        .map(function(el) { return { text: (el.textContent || '').trim(), tag: el.tagName }; })
        .filter(function(x) { return x.text.length > 2 && x.text.length < 200; });
    });

    // Check if requested exam form is active
    var examKeywords = examName ? examName.split(/\s+/) : [];
    var matchedLink = await page.evaluate(function(keywords) {
      var all = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
      return all.findIndex(function(el) {
        var txt = (el.textContent || el.value || '').toLowerCase();
        if (!keywords.length) return false;
        return keywords.some(function(kw) { return txt.includes(kw); });
      });
    }, examKeywords);

    var scr1 = await page.screenshot({ type: 'png', fullPage: false });
    send('screenshot', '📸 Recruitment Portal loaded');

    if (matchedLink === -1 && examName) {
      send('progress', '❌ "' + process.env.EXAM_NAME + '" form abhi start nahi hua.');
      send('done', '⚠️ Application Not Started Yet — "' + process.env.EXAM_NAME + '" ka form portal par available nahi hai. Jab form aaye tab dobara try karna.', { screenshot: scr1.toString('base64') });
      await context.close();
      return;
    }

    // ── STEP 1: OPEN OTR & FETCH SAVED DETAILS ───────────────
    send('progress', '📋 OTR khol raha hoon — saved details fetch karunga...');

    var otrClicked = await page.evaluate(function() {
      var all = Array.from(document.querySelectorAll('a, button, input[type="button"]'));
      var otr = all.find(function(el) {
        var txt = (el.textContent || el.value || '').toLowerCase();
        return txt.includes('otr') || txt.includes('one time') || txt.includes('one-time');
      });
      if (otr) { otr.click(); return true; }
      return false;
    });

    if (!otrClicked) {
      send('progress', '⚠️ OTR button nahi mila — direct URL try kar raha hoon...');
      await page.goto('https://recruitment.rajasthan.gov.in/otr', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    }

    await page.waitForTimeout(3000);
    var otrScr = await page.screenshot({ type: 'png', fullPage: false });
    send('screenshot', '📸 OTR page');

    // Extract ALL field values from OTR page (pre-saved details)
    var otrData = await page.evaluate(function() {
      var result = {};
      // Read input/select/textarea values
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea').forEach(function(el) {
        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        var key = (el.name || el.id || '').trim();
        if (!key) return;
        var val = (el.type === 'select-one' || el.tagName === 'SELECT')
          ? el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : ''
          : (el.value || '').trim();
        if (val) result[key] = val;
      });
      // Also read visible text spans/tds that show profile data (readonly display)
      document.querySelectorAll('td, span, div, label, p').forEach(function(el) {
        var txt = (el.textContent || '').trim();
        var prev = (el.previousElementSibling || {}).textContent || '';
        var labelTxt = prev.toLowerCase().replace(/[^a-z ]/g, '').trim();
        if (txt.length > 0 && txt.length < 120 && labelTxt.length > 0) {
          result['__display__' + labelTxt.replace(/ /g,'_')] = txt;
        }
      });
      return result;
    });

    var otrFieldCount = Object.keys(otrData).filter(function(k) { return !k.startsWith('__display__'); }).length;
    send('progress', '✅ OTR se ' + otrFieldCount + ' fields fetch ki gayi');

    // Pick best value: OTR first, then student-provided, then empty
    function best(otrKeys, studentVal) {
      for (var i = 0; i < otrKeys.length; i++) {
        var k = otrKeys[i];
        if (otrData[k] && otrData[k].trim()) return otrData[k].trim();
      }
      // fuzzy search OTR display data
      for (var dk in otrData) {
        if (!dk.startsWith('__display__')) continue;
        for (var i2 = 0; i2 < otrKeys.length; i2++) {
          if (dk.includes(otrKeys[i2].toLowerCase()) && otrData[dk].trim()) return otrData[dk].trim();
        }
      }
      return (studentVal || '').trim() || '';
    }

    // MERGED profile — OTR + student both used, best value wins
    var mergedProfile = {
      name:            best(['candidateName','fullName','name','cand_name'],        student.name),
      fatherName:      best(['fatherName','father_name','fName','fname'],           student.fatherName),
      motherName:      best(['motherName','mother_name','mName','mname'],           student.motherName),
      dob:             best(['dob','dateOfBirth','date_of_birth','birthDate'],       student.dob),
      mobile:          best(['mobile','mobileNo','mobile_no','phone'],              student.mobile),
      email:           best(['email','emailId','email_id'],                         student.email),
      aadhaar:         best(['aadhaar','aadhaarNo','adhar','aadharNo'],              student.aadhaar),
      address:         best(['address','permanentAddress','perm_address'],          student.address),
      district:        best(['district','dist'],                                    student.district),
      pin:             best(['pin','pinCode','pin_code'],                            student.pin),
      category:        best(['category','caste','castCategory'],                    process.env.CATEGORY || 'ST'),
      gender:          best(['gender','sex'],                                       student.gender),
      state:           best(['state','stateName'],                                  'Rajasthan'),
      // Qualification fields — mostly from student (not in OTR)
      qualDegree:      best(['qualification','degree'],                             process.env.QUAL_DEGREE   || ''),
      qualStream:      best(['stream','subject'],                                   process.env.QUAL_STREAM   || ''),
      qualCollege:     best(['college','collegeName'],                              process.env.QUAL_COLLEGE  || ''),
      qualUniversity:  best(['university','universityName'],                        process.env.QUAL_UNIV     || ''),
      qualYear:        best(['passingYear','passYear'],                             process.env.QUAL_YEAR     || ''),
      qualPercent:     best(['percentage','percent','marks'],                       process.env.QUAL_PERCENT  || ''),
      qualRollNo:      best(['rollNo','rollNumber'],                                process.env.QUAL_ROLL     || ''),
      visibleMark:     best(['identificationMark','visible_mark'],                  process.env.VISIBLE_MARK  || ''),
    };

    // Log what we have from each source
    send('progress', '📊 Merged Profile:');
    send('progress', '   👤 Name: ' + mergedProfile.name + ' | DOB: ' + mergedProfile.dob);
    send('progress', '   📱 Mobile: ' + mergedProfile.mobile + ' | Email: ' + mergedProfile.email);
    send('progress', '   🏠 Dist: ' + mergedProfile.district + ' | Category: ' + mergedProfile.category);
    send('progress', '   🎓 Degree: ' + (mergedProfile.qualDegree || 'N/A') + ' | ' + (mergedProfile.qualYear || 'N/A'));

    // ── STEP 2: CHECK EXAM FORM & FILL ───────────────────────
    send('progress', '🔙 Exam form par wapas ja raha hoon...');
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    if (matchedLink === -1 && examName) {
      var scr1b = await page.screenshot({ type: 'png', fullPage: false });
      send('done', '⚠️ Application Not Started Yet — "' + process.env.EXAM_NAME + '" ka form portal par available nahi hai. Jab form aaye tab dobara try karna.', { screenshot: scr1b.toString('base64') });
      await context.close();
      return;
    }

    // Click exam apply link
    var examClicked = await page.evaluate(function(keywords) {
      var all = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
      var match = all.find(function(el) {
        var txt = (el.textContent || el.value || '').toLowerCase();
        return keywords.length
          ? keywords.some(function(kw) { return txt.includes(kw); })
          : txt.includes('apply') || txt.includes('new application');
      });
      if (match) { match.click(); return true; }
      return false;
    }, examKeywords);

    if (!examClicked) {
      var noFormScr = await page.screenshot({ type: 'png', fullPage: false });
      send('done', '📋 Exam apply link nahi mila — portal screenshot dekho.', { screenshot: noFormScr.toString('base64') });
      await context.close();
      return;
    }

    await page.waitForTimeout(3000);
    var formScr = await page.screenshot({ type: 'png', fullPage: false });
    send('screenshot', '📸 Exam application form');

    // Read all form fields
    var formFields = await page.evaluate(function() {
      return Array.from(document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
      )).filter(function(el) {
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).map(function(el) {
        return {
          name: el.name || el.id || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          value: el.value || '',
          type: el.type || el.tagName.toLowerCase()
        };
      });
    });

    var emptyFields = formFields.filter(function(f) { return !f.value.trim(); });
    var alreadyFilled = formFields.filter(function(f) { return f.value.trim(); });

    send('progress', '📊 Form fields: ' + alreadyFilled.length + ' filled, ' + emptyFields.length + ' empty');

    if (emptyFields.length === 0) {
      send('progress', '✅ Sabhi fields already filled hain — photo/sign check kar raha hoon...');

      // Still try photo/sign upload even if text fields are filled
      var photoPathV = student.photoPath || process.env.PHOTO_PATH || '';
      var signPathV  = student.signPath  || process.env.SIGN_PATH  || '';
      if (photoPathV && fs.existsSync(photoPathV)) {
        var pInp = await page.$('input[type="file"][name*="photo" i], input[type="file"][id*="photo" i]');
        if (pInp) { await pInp.setInputFiles(photoPathV); await page.waitForTimeout(600); send('progress', '✅ Photo upload ho gaya'); }
      }
      if (signPathV && fs.existsSync(signPathV)) {
        var sInp = await page.$('input[type="file"][name*="sign" i], input[type="file"][id*="sign" i]');
        if (sInp) { await sInp.setInputFiles(signPathV); await page.waitForTimeout(600); send('progress', '✅ Signature upload ho gaya'); }
      }

      var verifyBuf = await page.screenshot({ type: 'png', fullPage: true });
      send('screenshot', '✅ All fields verified');
      send('done', '🎉 Form already complete hai! (' + alreadyFilled.length + ' fields filled). Photo/Sign bhi check ki. — aage batao kya karna hai.', { screenshot: verifyBuf.toString('base64') });
    } else {
      // Fill empty fields using OTR-fetched profile
      send('progress', '📝 OTR data se ' + emptyFields.length + ' empty fields fill kar raha hoon...');

      var fieldMap = {
        // Identity
        'name': mergedProfile.name, 'fullname': mergedProfile.name, 'candidatename': mergedProfile.name,
        'fathername': mergedProfile.fatherName, 'fname': mergedProfile.fatherName,
        'mothername': mergedProfile.motherName, 'mname': mergedProfile.motherName,
        'dob': mergedProfile.dob, 'dateofbirth': mergedProfile.dob, 'birthdate': mergedProfile.dob,
        // Contact
        'mobile': mergedProfile.mobile, 'phone': mergedProfile.mobile, 'mobileno': mergedProfile.mobile,
        'email': mergedProfile.email,
        // Documents
        'aadhaar': mergedProfile.aadhaar, 'aadharno': mergedProfile.aadhaar, 'adharno': mergedProfile.aadhaar,
        // Address
        'address': mergedProfile.address, 'permanentaddress': mergedProfile.address,
        'district': mergedProfile.district, 'dist': mergedProfile.district,
        'pin': mergedProfile.pin, 'pincode': mergedProfile.pin,
        'state': mergedProfile.state,
        // Category & Gender
        'category': mergedProfile.category, 'caste': mergedProfile.category, 'castcategory': mergedProfile.category,
        'gender': mergedProfile.gender, 'sex': mergedProfile.gender,
        // Qualification
        'degree': mergedProfile.qualDegree, 'qualification': mergedProfile.qualDegree,
        'stream': mergedProfile.qualStream, 'subject': mergedProfile.qualStream,
        'college': mergedProfile.qualCollege, 'collegename': mergedProfile.qualCollege,
        'university': mergedProfile.qualUniversity, 'universityname': mergedProfile.qualUniversity,
        'passingyear': mergedProfile.qualYear, 'passyear': mergedProfile.qualYear,
        'percentage': mergedProfile.qualPercent, 'percent': mergedProfile.qualPercent,
        'rollno': mergedProfile.qualRollNo, 'rollnumber': mergedProfile.qualRollNo,
        'identificationmark': mergedProfile.visibleMark, 'visiblemark': mergedProfile.visibleMark,
      };

      for (var fi = 0; fi < emptyFields.length; fi++) {
        var field = emptyFields[fi];
        var key = (field.name + ' ' + field.placeholder).toLowerCase().replace(/[^a-z]/g, '');
        var fillVal = null;
        for (var fk in fieldMap) {
          if (key.includes(fk) && fieldMap[fk]) { fillVal = fieldMap[fk]; break; }
        }
        if (fillVal) {
          var sel = field.name ? '[name="' + field.name + '"]' : (field.id ? '#' + field.id : null);
          if (sel) {
            await fillInput(page, sel, fillVal);
            await page.waitForTimeout(150);
          }
        }
      }

      await page.waitForTimeout(500);

      // ── PHOTO & SIGNATURE UPLOAD ──────────────────────────
      var photoPath = student.photoPath || process.env.PHOTO_PATH || '';
      var signPath  = student.signPath  || process.env.SIGN_PATH  || '';

      async function uploadFile(fileInputSelector, filePath, label) {
        if (!filePath || !fs.existsSync(filePath)) {
          send('progress', '⚠️ ' + label + ' file nahi mili: ' + (filePath || 'path empty'));
          return false;
        }
        try {
          var fileInput = await page.$(fileInputSelector);
          if (!fileInput) {
            // Try to find any visible file input matching label keywords
            fileInput = await page.evaluateHandle(function(lbl) {
              var inputs = Array.from(document.querySelectorAll('input[type="file"]'));
              return inputs.find(function(el) {
                var ctx = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('accept') || '') +
                  ' ' + (el.closest('label,div,td') ? el.closest('label,div,td').textContent : '')).toLowerCase();
                return ctx.includes(lbl);
              }) || null;
            }, label.toLowerCase());
            if (!fileInput || !(await fileInput.asElement())) {
              send('progress', '⚠️ ' + label + ' upload field nahi mila');
              return false;
            }
            fileInput = fileInput.asElement();
          }
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(800);
          send('progress', '✅ ' + label + ' upload ho gaya: ' + filePath.split('/').pop());
          return true;
        } catch (e) {
          send('progress', '❌ ' + label + ' upload fail: ' + e.message);
          return false;
        }
      }

      // Photo upload
      send('progress', '🖼️ Photo upload kar raha hoon...');
      await uploadFile(
        'input[type="file"][name*="photo" i], input[type="file"][id*="photo" i], input[type="file"][accept*="image"]:first-of-type',
        photoPath, 'Photo'
      );

      // Signature upload
      send('progress', '✍️ Signature upload kar raha hoon...');
      await uploadFile(
        'input[type="file"][name*="sign" i], input[type="file"][id*="sign" i], input[type="file"][accept*="image"]:last-of-type',
        signPath, 'Signature'
      );

      await page.waitForTimeout(500);
      var filledBuf = await page.screenshot({ type: 'png', fullPage: true });
      send('screenshot', '📝 Form filled using OTR data');
      send('done', '🎉 OTR + student details merge karke form fill ho gaya! Photo/Sign bhi upload ki. — aage batao kya karna hai.', { screenshot: filledBuf.toString('base64') });
    }

  } catch (err) {
    const scr = await page.screenshot({ encoding: 'base64' }).catch(() => null);
    send('error', '❌ Error: ' + err.message, { screenshot: scr });
  }

  await new Promise(r => setTimeout(r, 600000));
  await context.close();
})();
