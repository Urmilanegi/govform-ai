// UPTET / UPESSC OTR Form Filler — uptet.upessc.org
// Flow A (New):    Register → fill personal details → Aadhaar OTP → Mobile OTP → Email OTP → Live Photo (manual)
// Flow B (Exist):  Login → fill OTR ID / mobile / email + password + math captcha → dashboard
// Communicates via stdout JSON lines

const { getGovformCredsFile, getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs   = require('fs');
const path = require('path');

const PROFILE_DIR  = getGovformProfileDir('uptet-profile');
const CREDS_FILE   = getGovformCredsFile();
const OTP_FILE        = '/tmp/govform_otp.txt';
const STATUS_FILE     = '/tmp/govform_status.json';
const SCREENSHOT_FILE = '/tmp/govform_screenshot.png';

const UPTET_BASE      = 'https://uptet.upessc.org/otr/';
const UPTET_REGISTER  = 'https://uptet.upessc.org/otr/register';
const UPTET_LOGIN     = 'https://uptet.upessc.org/otr/login';

function send(type, message, extra = {}) {
  const data = { type, message, ...extra };
  process.stdout.write(JSON.stringify(data) + '\n');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
}

async function saveScreenshot(page, label) {
  try {
    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    fs.writeFileSync(SCREENSHOT_FILE, buf);
    send('screenshot', label || '📸 Browser screenshot');
  } catch (e) {
    send('log', `Screenshot error: ${e.message}`);
  }
}

function loadCreds() {
  try {
    if (!fs.existsSync(CREDS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveCreds(exam, fields) {
  const all = loadCreds();
  all[exam] = { ...(all[exam] || {}), ...fields };
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(all, null, 2));
}

async function waitForInput(file, timeoutMs = 180000) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(file)) {
      const val = fs.readFileSync(file, 'utf8').trim();
      if (val) { fs.unlinkSync(file); return val; }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Input timeout (3 minutes)');
}

// Fill a single input via React/Angular-compatible native setter
function buildFillEval(selector, value) {
  return { selector, value };
}

async function fillByCss(page, selector, value) {
  return page.evaluate(({ selector, value }) => {
    const el = document.querySelector(selector);
    if (!el || el.disabled || el.type === 'hidden') return false;
    const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, value);
    ['input', 'change', 'blur'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
    return true;
  }, { selector, value });
}

// Fill all visible inputs whose id/name/placeholder/label matches a keyword
async function fillByKeyword(page, keyword, value) {
  return page.evaluate(({ keyword, value }) => {
    const kw = keyword.toLowerCase();
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    const targets = inputs.filter(el => {
      if (el.disabled || el.type === 'hidden' || el.readOnly) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const hint = [el.id, el.name, el.placeholder, el.getAttribute('aria-label'),
        el.labels?.[0]?.textContent, el.closest('label')?.textContent,
        el.previousElementSibling?.textContent, el.parentElement?.querySelector('label')?.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return hint.includes(kw);
    });
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    targets.forEach(el => {
      setter?.call(el, value);
      ['input', 'change', 'blur'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
    });
    return targets.length;
  }, { keyword, value });
}

// Select a dropdown option by keyword
async function selectByKeyword(page, containerKeyword, optionKeyword) {
  return page.evaluate(({ containerKeyword, optionKeyword }) => {
    const sels = Array.from(document.querySelectorAll('select'));
    const ck = containerKeyword.toLowerCase();
    const ok = optionKeyword.toLowerCase();
    for (const sel of sels) {
      const hint = [sel.id, sel.name, sel.getAttribute('aria-label'),
        sel.labels?.[0]?.textContent, sel.closest('label')?.textContent,
        sel.previousElementSibling?.textContent, sel.parentElement?.querySelector('label')?.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hint.includes(ck)) continue;
      const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(ok) || o.value.toLowerCase().includes(ok));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, label: hint.slice(0, 40), picked: opt.text };
      }
    }
    return { ok: false };
  }, { containerKeyword, optionKeyword });
}

// Click a button whose text matches pattern
async function clickButton(page, pattern) {
  return page.evaluate((pattern) => {
    const re = new RegExp(pattern, 'i');
    const isVisible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.disabled;
    };
    const btns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
    const btn = btns.find(b => re.test(b.textContent || b.value || '') && isVisible(b));
    if (btn) { btn.click(); return (btn.textContent || btn.value || '').trim().slice(0, 50); }
    return null;
  }, pattern);
}

// Read math captcha (e.g. "41 − 33 = ?") and return the answer
async function solveMathCaptcha(page) {
  return page.evaluate(() => {
    const captchaEl = document.querySelector('[class*="captcha"], [id*="captcha"], .security-check, [class*="security"]');
    const text = (captchaEl?.textContent || document.body.innerText || '').replace(/\s/g, '');
    // Match patterns like: 41−33=? or 41-33=? or 5+3=? or 12×2=? etc.
    const m = text.match(/(\d+)\s*([+\-−×*÷/])\s*(\d+)\s*=\s*\?/);
    if (!m) return null;
    const a = parseInt(m[1]), b = parseInt(m[3]), op = m[2];
    if (op === '+') return String(a + b);
    if (op === '-' || op === '−') return String(a - b);
    if (op === '×' || op === '*') return String(a * b);
    if (op === '÷' || op === '/') return String(Math.round(a / b));
    return null;
  });
}

(async () => {
  const student = {
    name:       process.env.FULL_NAME    || 'SUMIT KUMAR MINA',
    dob:        process.env.DOB          || '07/07/2000',
    mobile:     process.env.MOBILE       || '',
    email:      process.env.EMAIL        || '',
    gender:     process.env.GENDER       || 'Male',
    fatherName: process.env.FATHER_NAME  || 'HARKESH MEENA',
    motherName: process.env.MOTHER_NAME  || '',
    aadhaar:    process.env.AADHAAR      || '',
    category:   process.env.CATEGORY    || 'General',
    state:      process.env.STATE        || 'Uttar Pradesh',
    district:   process.env.DISTRICT     || '',
    password:   process.env.PASSWORD     || '',
    photoPath:  process.env.PHOTO_PATH   || '',
  };

  send('progress', '🔍 UPTET details check kar raha hoon...');

  // Prompt for missing required fields
  if (!student.mobile) {
    send('otp', '📱 Mobile number enter karo (10 digits):', { otpFile: OTP_FILE });
    student.mobile = await waitForInput(OTP_FILE);
  }
  if (!student.email) {
    send('otp', '📧 Email address enter karo:', { otpFile: OTP_FILE });
    student.email = await waitForInput(OTP_FILE);
  }
  if (!student.motherName) {
    send('otp', "👩 Mother's name enter karo (CAPITALS mein):", { otpFile: OTP_FILE });
    student.motherName = await waitForInput(OTP_FILE);
  }
  if (!student.aadhaar) {
    send('otp', '🪪 Aadhaar number enter karo (12 digits):', { otpFile: OTP_FILE });
    student.aadhaar = (await waitForInput(OTP_FILE)).replace(/\s/g, '');
  }

  // Check saved credentials
  const savedCreds = loadCreds();
  const uptetCreds = savedCreds['uptet'] || {};

  // Ask: new candidate or existing OTR ID?
  let isNew = true;
  if (uptetCreds.otrId && uptetCreds.password) {
    send('progress', `✅ Saved OTR ID mila: ${uptetCreds.otrId} — Login karunga`);
    isNew = false;
  } else {
    send('otp', '🆕 Kya tumhara UPESSC OTR ID already hai?\n"yes" type karo agar hai, "no" type karo agar naya registration karna hai:', { otpFile: OTP_FILE });
    const ans = (await waitForInput(OTP_FILE)).toLowerCase().trim();
    isNew = ans !== 'yes' && ans !== 'y' && ans !== 'haan' && ans !== '1';
    if (!isNew) {
      send('otp', '🆔 Apna OTR ID / Mobile / Email type karo:', { otpFile: OTP_FILE });
      uptetCreds.otrId = await waitForInput(OTP_FILE);
      if (!uptetCreds.password) {
        send('otp', '🔑 Password type karo:', { otpFile: OTP_FILE });
        uptetCreds.password = await waitForInput(OTP_FILE);
      }
      saveCreds('uptet', { otrId: uptetCreds.otrId, password: uptetCreds.password });
    }
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
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
  const page = (context.pages().filter(p => !p.isClosed())[0]) || await context.newPage();

  try {
    // ── FLOW B: LOGIN (existing OTR) ────────────────────────────────
    if (!isNew) {
      send('start', '🔐 UPESSC Login page khol raha hoon...');
      await page.goto(UPTET_LOGIN, { waitUntil: 'commit', timeout: 60000 }).catch(async () => {
        send('progress', '⚠️ Login page slow hai — dobara try kar raha hoon...');
        await page.goto(UPTET_LOGIN, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      });
      await page.waitForTimeout(2500);

      // Fill Mobile / Email / OTR ID
      await fillByKeyword(page, 'mobile', uptetCreds.otrId);
      await fillByKeyword(page, 'email', uptetCreds.otrId);
      await fillByKeyword(page, 'otr', uptetCreds.otrId);
      send('progress', `✅ Login ID filled: ${uptetCreds.otrId}`);

      // Fill Password
      await page.evaluate((pass) => {
        const inp = document.querySelector('input[type="password"]');
        if (!inp) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(inp, pass);
        ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
      }, uptetCreds.password);
      send('progress', '✅ Password filled');

      // Solve math captcha
      await page.waitForTimeout(600);
      const captchaAnswer = await solveMathCaptcha(page);
      if (captchaAnswer !== null) {
        // Find the captcha answer input (usually a small "Ans" field)
        const captchaFilled = await page.evaluate((ans) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const captchaInput = inputs.find(i => {
            const hint = (i.placeholder + i.id + i.name + (i.getAttribute('aria-label') || '')).toLowerCase();
            return hint.includes('ans') || hint.includes('captcha') || hint.includes('answer') || hint.includes('security');
          }) || inputs.find(i => i.placeholder === 'Ans' || i.maxLength <= 5);
          if (!captchaInput) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(captchaInput, ans);
          ['input', 'change', 'blur'].forEach(e => captchaInput.dispatchEvent(new Event(e, { bubbles: true })));
          return true;
        }, captchaAnswer);
        send('progress', captchaFilled ? `✅ Math captcha solved: ${captchaAnswer}` : '⚠️ Captcha field nahi mila — screenshot dekho');
      } else {
        await saveScreenshot(page, '📸 Login page — captcha manually solve karo:');
        send('otp', '🔐 Browser mein math captcha answer fill karo — fill karne ke baad "done" type karo:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      }

      await page.waitForTimeout(500);
      const clicked = await clickButton(page, 'login|resume|sign.*in|submit');
      send('progress', clicked ? `✅ Login button clicked: "${clicked}"` : '⚠️ Login button nahi mila — manually click karo');
      await page.waitForTimeout(4000);

      const loginUrl = page.url();
      const loginText = (await page.evaluate(() => document.body?.innerText || '')).toLowerCase();
      const loginOk = !loginUrl.includes('/login') || loginText.includes('dashboard') || loginText.includes('welcome') || loginText.includes('profile');

      if (!loginOk) {
        await saveScreenshot(page, '📸 Login result:');
        send('otp', '⚠️ Login status unclear. Browser dekho — phir "done" type karo jab logged in ho jao:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
      } else {
        send('progress', `✅ Login ho gaya! URL: ${loginUrl}`);
      }

      await saveScreenshot(page, '📸 UPTET Login complete!');
      send('done', '✅ UPTET Login complete!');
      await context.close();
      return;
    }

    // ── FLOW A: REGISTRATION (new candidate) ────────────────────────
    send('start', '📝 UPESSC Registration page khol raha hoon...');
    await page.goto(UPTET_REGISTER, { waitUntil: 'commit', timeout: 60000 }).catch(async () => {
      send('progress', '⚠️ Page slow hai — dobara try kar raha hoon...');
      await page.goto(UPTET_REGISTER, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    });
    await page.waitForTimeout(3000);

    send('progress', '📝 Section 1: Personal Details fill ho rahi hain...');

    // Full Name + Re-enter Full Name
    const nameFilled = await page.evaluate((name) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const nameInputs = inputs.filter(i => {
        const hint = (i.id + i.name + i.placeholder + (i.labels?.[0]?.textContent || '') + (i.parentElement?.querySelector('label')?.textContent || '')).toLowerCase();
        return (hint.includes('full name') || hint.includes('fullname') || hint.includes('candidate name')) && !i.disabled && i.type !== 'hidden';
      });
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      nameInputs.forEach(inp => {
        setter.call(inp, name);
        ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
      });
      return nameInputs.length;
    }, student.name);
    send('progress', nameFilled ? `✅ Full Name filled (${nameFilled} fields)` : '⚠️ Full Name field nahi mila');
    await page.waitForTimeout(300);

    // Father's Name + Re-enter
    const fatherFilled = await page.evaluate((name) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const targets = inputs.filter(i => {
        const hint = (i.id + i.name + i.placeholder + (i.labels?.[0]?.textContent || '') + (i.parentElement?.querySelector('label')?.textContent || '')).toLowerCase();
        return hint.includes('father') && !i.disabled && i.type !== 'hidden';
      });
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      targets.forEach(inp => {
        setter.call(inp, name);
        ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
      });
      return targets.length;
    }, student.fatherName);
    send('progress', fatherFilled ? `✅ Father Name filled (${fatherFilled} fields)` : '⚠️ Father Name field nahi mila');
    await page.waitForTimeout(300);

    // Mother's Name + Re-enter
    const motherFilled = await page.evaluate((name) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const targets = inputs.filter(i => {
        const hint = (i.id + i.name + i.placeholder + (i.labels?.[0]?.textContent || '') + (i.parentElement?.querySelector('label')?.textContent || '')).toLowerCase();
        return hint.includes('mother') && !i.disabled && i.type !== 'hidden';
      });
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      targets.forEach(inp => {
        setter.call(inp, name);
        ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
      });
      return targets.length;
    }, student.motherName);
    send('progress', motherFilled ? `✅ Mother Name filled (${motherFilled} fields)` : '⚠️ Mother Name field nahi mila');
    await page.waitForTimeout(300);

    // Date of Birth — Day / Month / Year dropdowns
    const [dd, mm, yyyy] = student.dob.split('/');
    await selectByKeyword(page, 'day', String(parseInt(dd)));
    await page.waitForTimeout(200);
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    await selectByKeyword(page, 'month', monthNames[parseInt(mm)] || mm);
    await page.waitForTimeout(200);
    await selectByKeyword(page, 'year', yyyy);
    send('progress', `✅ DOB filled: ${student.dob}`);
    await page.waitForTimeout(300);

    // Re-enter DOB (same dropdowns, second set)
    await page.evaluate(({ dd, mm, yyyy, monthNames }) => {
      const sels = Array.from(document.querySelectorAll('select'));
      // Find all day/month/year selects and fill the second set if present
      const daySels  = sels.filter(s => (s.id+s.name+(s.labels?.[0]?.textContent||'')).toLowerCase().includes('day'));
      const monSels  = sels.filter(s => (s.id+s.name+(s.labels?.[0]?.textContent||'')).toLowerCase().includes('month'));
      const yearSels = sels.filter(s => (s.id+s.name+(s.labels?.[0]?.textContent||'')).toLowerCase().includes('year'));
      const fire = (sel, val) => {
        const opt = Array.from(sel.options).find(o => o.text.includes(val) || o.value === val);
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      };
      if (daySels[1])  fire(daySels[1],  String(parseInt(dd)));
      if (monSels[1])  fire(monSels[1],  monthNames[parseInt(mm)] || mm);
      if (yearSels[1]) fire(yearSels[1], yyyy);
    }, { dd, mm, yyyy, monthNames });
    await page.waitForTimeout(300);

    // Gender dropdown(s)
    const genderResult = await selectByKeyword(page, 'gender', student.gender.toLowerCase());
    // Also fill re-enter gender
    await page.evaluate((gender) => {
      const sels = Array.from(document.querySelectorAll('select'));
      const genderSels = sels.filter(s => (s.id+s.name+(s.labels?.[0]?.textContent||'')).toLowerCase().includes('gender'));
      genderSels.forEach(sel => {
        const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(gender.toLowerCase()));
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    }, student.gender);
    send('progress', `✅ Gender filled: ${student.gender}`);
    await page.waitForTimeout(300);

    // ── Section 2: Contact & Identity ────────────────────────────────
    send('progress', '📋 Section 2: Identity & Contact fill ho rahi hai...');

    // Tick consent checkbox
    await page.waitForTimeout(500);
    const cbCount = await page.evaluate(() => {
      const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      let count = 0;
      cbs.forEach(cb => { if (!cb.checked) { cb.click(); count++; } });
      return count;
    });
    if (cbCount > 0) send('progress', `✅ ${cbCount} consent checkbox(es) ticked`);
    await page.waitForTimeout(500);

    // Aadhaar Number
    const aadhaarFilled = await fillByKeyword(page, 'aadhaar', student.aadhaar.replace(/\s/g, ''));
    send('progress', aadhaarFilled ? `✅ Aadhaar filled: ${student.aadhaar}` : '⚠️ Aadhaar field nahi mila');
    await page.waitForTimeout(400);

    // Click "Verify via Aadhaar OTP"
    const aadhaarOtpBtn = await clickButton(page, 'verify.*aadhaar|aadhaar.*otp|send.*aadhaar');
    send('progress', aadhaarOtpBtn ? `✅ "${aadhaarOtpBtn}" clicked` : '⚠️ Aadhaar OTP button nahi mila — manually click karo');
    await page.waitForTimeout(2000);

    // User fills Aadhaar OTP in browser
    send('otp', '🪪 Browser mein Aadhaar OTP aaya hoga — wahan fill karo aur Verify karo — phir yahan "done" type karo:', { otpFile: OTP_FILE });
    await waitForInput(OTP_FILE);
    send('progress', '✅ Aadhaar OTP done');
    await page.waitForTimeout(1000);

    // Mobile Number
    const mobileFilled = await fillByKeyword(page, 'mobile', student.mobile);
    if (!mobileFilled) await fillByCss(page, 'input[type="tel"]', student.mobile);
    send('progress', `✅ Mobile filled: ${student.mobile}`);
    await page.waitForTimeout(400);

    // Click "Send OTP" for mobile
    const mobileOtpBtn = await clickButton(page, 'send.*otp|generate.*otp');
    send('progress', mobileOtpBtn ? `✅ Mobile OTP button clicked: "${mobileOtpBtn}"` : '⚠️ Mobile OTP button nahi mila — manually click karo');
    await page.waitForTimeout(2000);

    // User fills mobile OTP in browser
    send('otp', '📱 Browser mein Mobile OTP aaya hoga — wahan fill karo aur Verify karo — phir yahan "done" type karo:', { otpFile: OTP_FILE });
    await waitForInput(OTP_FILE);
    send('progress', '✅ Mobile OTP done');
    await page.waitForTimeout(1000);

    // Email ID
    const emailFilled = await fillByKeyword(page, 'email', student.email);
    if (!emailFilled) await fillByCss(page, 'input[type="email"]', student.email);
    send('progress', `✅ Email filled: ${student.email}`);
    await page.waitForTimeout(400);

    // Click "Send OTP" for email (second "Send OTP" button on page)
    const emailOtpBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const visible = btns.filter(b => /send.*otp|generate.*otp/i.test(b.textContent || '') && b.getBoundingClientRect().height > 0);
      // Pick the one near email field (usually 2nd button)
      const btn = visible.length > 1 ? visible[1] : visible[0];
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });
    send('progress', emailOtpBtn ? `✅ Email OTP button clicked: "${emailOtpBtn}"` : '⚠️ Email OTP button nahi mila — manually click karo');
    await page.waitForTimeout(2000);

    // User fills email OTP in browser
    send('otp', '📧 Browser mein Email OTP aaya hoga — wahan fill karo aur Verify karo — phir yahan "done" type karo:', { otpFile: OTP_FILE });
    await waitForInput(OTP_FILE);
    send('progress', '✅ Email OTP done');
    await page.waitForTimeout(1000);

    // Live Photo section — fully manual (requires camera/webcam)
    await saveScreenshot(page, '📸 Current page — Live Photo section:');
    send('otp', '📷 Browser mein "Live Photo" section hai — webcam se photo lo — phir yahan "done" type karo jab ho jaye (ya "skip" type karo agar baad mein karna hai):', { otpFile: OTP_FILE });
    await waitForInput(OTP_FILE);
    send('progress', '✅ Live Photo step done');
    await page.waitForTimeout(1000);

    // ── Password ────────────────────────────────────────────────────
    const newPassword = student.password || `UPTET@${student.mobile.slice(-4)}2024!`;
    await page.evaluate((pass) => {
      const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      inputs.forEach(inp => {
        setter.call(inp, pass);
        ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
      });
    }, newPassword);
    send('progress', `✅ Password filled: ${newPassword}`);
    await page.waitForTimeout(400);

    // Submit Registration
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await page.waitForTimeout(700);
    const submitClicked = await clickButton(page, 'register|submit|create.*otr|initialize|proceed');
    send('progress', submitClicked ? `✅ Submit button clicked: "${submitClicked}"` : '⚠️ Submit button nahi mila — manually click karo');
    await page.waitForTimeout(5000);

    // Read OTR ID from page
    const otrId = await page.evaluate(() => {
      const txt = document.body.innerText;
      const patterns = [
        /otr\s*(?:id|no|number)[:\s#.]*([A-Z0-9]{6,20})/i,
        /your\s+otr\s*(?:id|no)[:\s]*([A-Z0-9]{6,20})/i,
        /registration\s*(?:id|no|number)[:\s#.]*([A-Z0-9]{6,20})/i,
        /unique\s*id[:\s]*([A-Z0-9]{8,20})/i,
      ];
      for (const p of patterns) {
        const m = txt.match(p);
        if (m) return m[1];
      }
      return null;
    });

    if (otrId) {
      saveCreds('uptet', { otrId, password: newPassword });
      send('creds', `✅ Registration ho gayi!\nOTR ID: ${otrId}\nPassword: ${newPassword}`, { otrId, password: newPassword });
    } else {
      await saveScreenshot(page, '📸 Registration result — OTR ID dekho:');
      send('otp', '📋 Browser mein OTR ID dikh raha hoga — copy karke yahan paste karo:', { otpFile: OTP_FILE });
      const manualOtrId = await waitForInput(OTP_FILE);
      saveCreds('uptet', { otrId: manualOtrId, password: newPassword });
      send('progress', `✅ OTR ID saved: ${manualOtrId}`);
    }

    await page.waitForTimeout(2000);
    await saveScreenshot(page, '📸 UPTET Registration complete!');
    send('done', '✅ UPTET Registration complete! OTR ID save ho gaya hai — agle baar auto login karunga.');

  } catch (err) {
    await saveScreenshot(page, '📸 Error screen').catch(() => {});
    send('error', `❌ Error: ${err.message}`);
  } finally {
    await context.close().catch(() => {});
  }
})();
