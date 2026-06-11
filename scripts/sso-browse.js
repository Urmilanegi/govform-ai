// ── Rajasthan SSO Browser Automation ─────────────────────────────
// Logs into sso.rajasthan.gov.in, reads dashboard services,
// waits for user command, then navigates + fills the requested form.
// Communicates with the Next.js API via stdout JSON lines.

const { getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs   = require('fs');
const path = require('path');

const PROFILE_DIR    = getGovformProfileDir('sso-profile');
const OTP_FILE       = '/tmp/govform_otp.txt';
const CAPTCHA_FILE   = '/tmp/govform_captcha.txt';
const COMMAND_FILE   = '/tmp/sso_command.txt';
const STATUS_FILE    = '/tmp/sso_status.json';
const SCREENSHOT     = '/tmp/govform_screenshot.png';

const SSO_URL        = 'https://sso.rajasthan.gov.in/signin';
const MAX_RETRIES    = 3;

function send(type, message, extra = {}) {
  const d = { type, message, ...extra };
  process.stdout.write(JSON.stringify(d) + '\n');
  try { fs.writeFileSync(STATUS_FILE, JSON.stringify(d)); } catch {}
}

// ── Angular-safe input fill ───────────────────────────────────────
async function fillInput(page, selector, value) {
  if (!value) return false;
  const el = await page.$(selector);
  if (!el) return false;
  await el.scrollIntoViewIfNeeded();
  await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (native?.set) native.set.call(el, val);
    ['input', 'change', 'blur'].forEach(ev =>
      el.dispatchEvent(new Event(ev, { bubbles: true }))
    );
  }, { sel: selector, val: value });
  return true;
}

// ── Wait for file input (OTP / CAPTCHA / COMMAND) ─────────────────
async function waitForInput(file, timeoutMs = 180000) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const t = Date.now();
  while (Date.now() - t < timeoutMs) {
    if (fs.existsSync(file)) {
      const v = fs.readFileSync(file, 'utf8').trim();
      if (v) { fs.unlinkSync(file); return v; }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timeout waiting for input');
}

// ── Screenshot helper ─────────────────────────────────────────────
async function screenshot(page) {
  try {
    await page.screenshot({ path: SCREENSHOT, fullPage: false });
    send('screenshot', 'Screenshot updated');
  } catch {}
}

// ── OCR captcha via page DOM (SSO uses text/math captcha) ─────────
async function solveCaptcha(page) {
  // Try DOM text first (canvas/span with captcha text)
  try {
    // SSO portal renders captcha as SVG or image with alt text
    // Try common selectors
    const selectors = [
      '#captchaCode',
      '.captcha-text',
      '[id*="captcha"] text',
      '.captchaText',
      'span.captcha',
    ];
    for (const sel of selectors) {
      const text = await page.$eval(sel, el => el.textContent?.trim()).catch(() => null);
      if (text && /^[\d\s+\-=?]+$/.test(text)) {
        // Math captcha like "3 + 5 = ?"
        const solved = evalMathCaptcha(text);
        if (solved !== null) return String(solved);
        return text.replace(/[^a-zA-Z0-9]/g, '');
      }
      if (text && text.length >= 4 && text.length <= 8) return text;
    }
  } catch {}

  // Try canvas extraction via JS
  try {
    const canvasText = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#captchaCanvas, canvas.captcha, canvas');
      if (!canvas) return null;
      // Try to read aria-label or title
      return canvas.getAttribute('aria-label') || canvas.getAttribute('title') || null;
    });
    if (canvasText && canvasText.length >= 4) return canvasText;
  } catch {}

  // Try getting captcha image and sending to UI for manual entry
  await screenshot(page);
  send('captcha', '🔢 SSO Captcha type karo (screenshot dekho):', { captchaText: '' });
  const manual = await waitForInput(CAPTCHA_FILE, 60000);
  return manual;
}

function evalMathCaptcha(text) {
  // "3 + 5 = ?" → 8
  const match = text.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
  if (!match) return null;
  const [, a, op, b] = match;
  const n1 = parseInt(a), n2 = parseInt(b);
  if (op === '+') return n1 + n2;
  if (op === '-') return n1 - n2;
  if (op === '*') return n1 * n2;
  if (op === '/') return Math.round(n1 / n2);
  return null;
}

// ── Read services from SSO dashboard ─────────────────────────────
async function getDashboardServices(page) {
  try {
    await page.waitForSelector('.service, .app-tile, .service-tile, .app-icon, .service-card, [class*="service"], [class*="app"]', { timeout: 8000 });
  } catch {}

  const services = await page.evaluate(() => {
    // Try multiple selectors used by SSO portal
    const sels = [
      '.app-name', '.service-name', '.tile-title',
      '.app-tile h3', '.app-tile p', '.service-title',
      '[class*="app"] .name', '[class*="service"] .title',
      '.app-list li', '.services li',
    ];
    const found = new Set();
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length > 2 && t.length < 60) found.add(t);
      });
    }
    // Fallback: all clickable tiles with text
    if (found.size === 0) {
      document.querySelectorAll('a[href], button, .tile, .card').forEach(el => {
        const t = el.textContent?.trim().split('\n')[0];
        if (t && t.length > 3 && t.length < 50) found.add(t);
      });
    }
    return [...found].slice(0, 30);
  });

  // Always include common Rajasthan services
  const KNOWN_SERVICES = [
    { id: 'scholarship', name: '🎓 Scholarship / छात्रवृत्ति', keywords: ['scholarship', 'छात्र', 'devnarayan'] },
    { id: 'rpsc',        name: '📋 RPSC Exam Form',            keywords: ['rpsc', 'psc', 'ras'] },
    { id: 'rsmssb',      name: '📝 RSMSSB Form',              keywords: ['rsmssb', 'subordinate'] },
    { id: 'reet',        name: '🏫 REET Form',                keywords: ['reet', 'teacher', 'शिक्षक'] },
    { id: 'police',      name: '👮 Police Bharti',            keywords: ['police', 'पुलिस'] },
    { id: 'emitra',      name: '🖥️ E-Mitra Services',         keywords: ['emitra', 'e-mitra', 'मित्र'] },
    { id: 'pehchan',     name: '🪪 Pehchan (Domicile/Caste)', keywords: ['pehchan', 'domicile', 'caste'] },
    { id: 'bhamashah',   name: '💳 Bhamashah Card',           keywords: ['bhamashah'] },
  ];

  // Match detected services to known ones
  const matched = [];
  for (const svc of KNOWN_SERVICES) {
    const found = services.some(s => svc.keywords.some(k => s.toLowerCase().includes(k)));
    if (found) matched.push(JSON.stringify(svc));
  }
  // If nothing matched, return all known services (portal might have changed)
  const result = matched.length > 0
    ? matched.map(s => JSON.parse(s))
    : KNOWN_SERVICES;

  return result;
}

// ── SSO Login ────────────────────────────────────────────────────
async function ssoLogin(page, ssoId, ssoPass) {
  send('progress', `🌐 SSO portal khol raha hoon...`);
  await page.goto(SSO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await screenshot(page);

  // Fill SSO ID
  const idSelectors = ['#username', '#user_name', '#loginid', 'input[name="username"]', 'input[placeholder*="SSO"]'];
  let filled = false;
  for (const sel of idSelectors) {
    if (await page.$(sel)) { await fillInput(page, sel, ssoId); filled = true; break; }
  }
  if (!filled) {
    await page.fill('input[type="text"]:first-of-type', ssoId).catch(() => {});
  }

  // Fill Password
  const passSelectors = ['#password', 'input[type="password"]', 'input[name="password"]'];
  for (const sel of passSelectors) {
    if (await page.$(sel)) { await fillInput(page, sel, ssoPass); break; }
  }

  // Solve captcha
  send('progress', '🔢 Captcha padh raha hoon...');
  const captchaValue = await solveCaptcha(page);
  if (captchaValue) {
    send('progress', `🤖 Captcha auto-fill: "${captchaValue}"`);
    const captchaInputSels = ['#captcha', '#captchaCode', 'input[name="captcha"]', 'input[placeholder*="captcha" i]', 'input[placeholder*="Enter code" i]'];
    for (const sel of captchaInputSels) {
      if (await page.$(sel)) { await fillInput(page, sel, captchaValue); break; }
    }
  }

  // Click login
  await screenshot(page);
  const loginBtnSels = ['#loginBtn', 'button[type="submit"]', 'input[type="submit"]', 'button:has-text("Login")', 'button:has-text("Sign In")'];
  for (const sel of loginBtnSels) {
    const btn = await page.$(sel);
    if (btn) { await btn.click(); break; }
  }

  // Wait for login result
  await page.waitForTimeout(3000);
  await screenshot(page);

  const url = page.url();
  // Check for login failure
  const errorText = await page.$eval('body', el => el.innerText).catch(() => '');
  if (errorText.includes('Invalid') || errorText.includes('incorrect') || errorText.includes('गलत')) {
    // Captcha might have been wrong — retry once with manual entry
    send('captcha', '❌ Login fail hua. Captcha phir se enter karo:', { captchaText: '' });
    await screenshot(page);
    const manualCaptcha = await waitForInput(CAPTCHA_FILE, 60000);
    // Re-fill and submit
    await page.goto(SSO_URL, { waitUntil: 'domcontentloaded' });
    for (const sel of idSelectors) {
      if (await page.$(sel)) { await fillInput(page, sel, ssoId); break; }
    }
    for (const sel of passSelectors) {
      if (await page.$(sel)) { await fillInput(page, sel, ssoPass); break; }
    }
    const captchaInputSels = ['#captcha', '#captchaCode', 'input[name="captcha"]'];
    for (const sel of captchaInputSels) {
      if (await page.$(sel)) { await fillInput(page, sel, manualCaptcha); break; }
    }
    for (const sel of loginBtnSels) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
    await page.waitForTimeout(3000);
  }

  // OTP check (some SSO accounts need OTP)
  const bodyNow = await page.$eval('body', el => el.innerText).catch(() => '');
  if (bodyNow.includes('OTP') || bodyNow.includes('One Time Password')) {
    send('otp', '📱 OTP aaya hai — mobile pe dekho aur yahan type karo:');
    const otp = await waitForInput(OTP_FILE, 180000);
    const otpSels = ['#otp', 'input[name="otp"]', 'input[placeholder*="OTP"]', 'input[maxlength="6"]'];
    for (const sel of otpSels) {
      if (await page.$(sel)) { await fillInput(page, sel, otp); break; }
    }
    const submitBtns = ['button[type="submit"]', 'button:has-text("Verify")', 'button:has-text("Submit")'];
    for (const sel of submitBtns) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
    await page.waitForTimeout(3000);
  }

  // Confirm login success
  const finalUrl = page.url();
  const finalBody = await page.$eval('body', el => el.innerText).catch(() => '');
  if (finalUrl.includes('dashboard') || finalUrl.includes('sso') && !finalUrl.includes('signin')) {
    send('progress', '✅ SSO Login successful!');
    return true;
  }
  if (finalBody.includes('Welcome') || finalBody.includes('स्वागत') || finalBody.includes('Dashboard')) {
    send('progress', '✅ SSO Login successful!');
    return true;
  }
  throw new Error('Login nahi hua — credentials check karo');
}

// ── Navigate to service ───────────────────────────────────────────
async function navigateToService(page, serviceId) {
  const serviceUrls = {
    'scholarship': 'https://scholarship.rajasthan.gov.in',
    'rpsc':        'https://rpsc.rajasthan.gov.in',
    'rsmssb':      'https://rsmssb.rajasthan.gov.in',
    'reet':        'https://rajeduboard.rajasthan.gov.in',
    'police':      'https://police.rajasthan.gov.in/constable',
    'emitra':      'https://emitra.rajasthan.gov.in',
    'pehchan':     'https://pehchan.raj.nic.in',
    'bhamashah':   'https://bhamashah.rajasthan.gov.in',
  };

  const url = serviceUrls[serviceId];
  if (url) {
    send('progress', `🌐 ${url} khol raha hoon...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page);
    return true;
  }

  // Try clicking the tile on dashboard
  const keywords = {
    'scholarship': ['Scholarship', 'छात्रवृत्ति', 'Devnarayan'],
    'rpsc': ['RPSC', 'Public Service'],
    'rsmssb': ['RSMSSB', 'Subordinate'],
    'reet': ['REET', 'Teacher'],
    'police': ['Police', 'पुलिस'],
    'emitra': ['E-Mitra', 'eMitra'],
  };
  const kws = keywords[serviceId] || [serviceId];
  for (const kw of kws) {
    try {
      const tile = await page.$(`text=${kw}`);
      if (tile) { await tile.click(); await page.waitForTimeout(2000); return true; }
    } catch {}
  }
  return false;
}

// ── Fill Scholarship Form ─────────────────────────────────────────
async function fillScholarshipForm(page, student) {
  send('progress', '📋 Scholarship form detect kar raha hoon...');
  await screenshot(page);

  // Common scholarship portal selectors (Rajasthan scholarship portal)
  // Try to find "Apply" or "New Application" button
  const applyBtns = [
    'a:has-text("Apply")', 'button:has-text("Apply")',
    'a:has-text("New Application")', 'a:has-text("आवेदन")',
    '.apply-btn', '#applyBtn',
  ];
  for (const sel of applyBtns) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); await page.waitForTimeout(2000); break; }
    } catch {}
  }
  await screenshot(page);

  // Fill personal details
  send('progress', '👤 Personal details fill kar raha hoon...');
  await fillInput(page, '#name, input[name="name"], input[placeholder*="Name"]', student.name);
  await fillInput(page, '#fatherName, input[name="fatherName"]', student.fatherName);
  await fillInput(page, '#motherName, input[name="motherName"]', student.motherName);
  await fillInput(page, '#dob, input[name="dob"], input[type="date"]', student.dob);
  await fillInput(page, '#mobile, input[name="mobile"]', student.mobile);
  await fillInput(page, '#email, input[name="email"], input[type="email"]', student.email);
  await fillInput(page, '#aadhaar, input[name="aadhaarNo"]', student.aadhaar);

  // Category
  const catSels = ['select#category', 'select[name="category"]', 'select[name="caste"]'];
  for (const sel of catSels) {
    const el = await page.$(sel);
    if (el) {
      await page.selectOption(sel, { label: student.category }).catch(() =>
        page.selectOption(sel, { value: student.category }).catch(() => {})
      );
      break;
    }
  }

  // Address
  await fillInput(page, '#address, textarea[name="address"]', student.address);
  await fillInput(page, '#district, input[name="district"]', student.district);
  await fillInput(page, '#pinCode, input[name="pin"]', student.pin);

  // Qualification
  send('progress', '🎓 Education details fill kar raha hoon...');
  await fillInput(page, '#college, input[name="collegeName"]', student.qualCollege);
  await fillInput(page, '#university, input[name="universityName"]', student.qualUniversity);
  await fillInput(page, '#passingYear, input[name="passingYear"]', student.qualYear);
  await fillInput(page, '#percentage, input[name="percentage"]', student.qualPercent);

  await screenshot(page);

  // Bank details needed for scholarship
  if (student.bankAccount) {
    send('progress', '🏦 Bank details fill kar raha hoon...');
    await fillInput(page, '#accountNo, input[name="accountNumber"]', student.bankAccount);
    await fillInput(page, '#ifsc, input[name="ifsc"]', student.bankIfsc);
    await fillInput(page, '#bankName, input[name="bankName"]', student.bankName);
  } else {
    send('otp', '🏦 Bank account details chahiye scholarship ke liye. Account Number type karo:');
    const acc = await waitForInput(OTP_FILE, 300000);
    send('otp', '🏦 IFSC Code type karo (e.g. SBIN0001234):');
    const ifsc = await waitForInput(OTP_FILE, 120000);
    await fillInput(page, '#accountNo, input[name="accountNumber"]', acc);
    await fillInput(page, '#ifsc, input[name="ifsc"]', ifsc);
  }

  await screenshot(page);
  send('progress', '📸 Photo upload kar raha hoon...');

  // Photo upload
  if (student.photoPath && fs.existsSync(student.photoPath)) {
    const photoInputs = await page.$$('input[type="file"][accept*="image"], input[type="file"]');
    for (const inp of photoInputs) {
      try { await inp.setInputFiles(student.photoPath); break; } catch {}
    }
  }

  // Save / Next button
  send('progress', '💾 Form save kar raha hoon...');
  const saveBtns = [
    'button:has-text("Save")', 'button:has-text("Next")',
    'button[type="submit"]', 'input[type="submit"]',
    'button:has-text("सहेजें")', 'button:has-text("अगला")',
  ];
  for (const sel of saveBtns) {
    const btn = await page.$(sel);
    if (btn) { await btn.click(); break; }
  }
  await page.waitForTimeout(2000);
  await screenshot(page);
  send('progress', '✅ Scholarship form fill ho gaya! Screenshot dekho.');
}

// ── Main runner ───────────────────────────────────────────────────
async function main() {
  const student = {
    ssoId:        process.env.SSO_ID       || '',
    ssoPass:      process.env.SSO_PASS     || '',
    name:         process.env.FULL_NAME    || '',
    fatherName:   process.env.FATHER_NAME  || '',
    motherName:   process.env.MOTHER_NAME  || '',
    mobile:       process.env.MOBILE       || '',
    email:        process.env.EMAIL        || '',
    dob:          process.env.DOB          || '',
    aadhaar:      process.env.AADHAAR      || '',
    category:     process.env.CATEGORY     || 'General',
    address:      process.env.ADDRESS      || '',
    district:     process.env.DISTRICT     || '',
    pin:          process.env.PIN          || '',
    photoPath:    process.env.PHOTO_PATH   || '',
    signPath:     process.env.SIGN_PATH    || '',
    qualDegree:   process.env.QUAL_DEGREE  || '',
    qualCollege:  process.env.QUAL_COLLEGE || '',
    qualUniversity: process.env.QUAL_UNIV  || '',
    qualYear:     process.env.QUAL_YEAR    || '',
    qualPercent:  process.env.QUAL_PERCENT || '',
    bankAccount:  process.env.BANK_ACCOUNT || '',
    bankIfsc:     process.env.BANK_IFSC    || '',
    bankName:     process.env.BANK_NAME    || '',
  };

  if (!student.ssoId || !student.ssoPass) {
    send('error', '❌ SSO ID aur Password required hai!');
    process.exit(1);
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const browser = await launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 800 },
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    // Kill existing locks
    ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
      try { fs.unlinkSync(path.join(PROFILE_DIR, f)); } catch {}
    });

    // ── Step 1: Login ─────────────────────────────────────────────
    await ssoLogin(page, student.ssoId, student.ssoPass);

    // ── Step 2: Read dashboard services ──────────────────────────
    send('progress', '📊 Dashboard se services padh raha hoon...');
    const services = await getDashboardServices(page);
    send('services', '✅ Login ho gaya! Kya karna chahte ho?', { services });

    // ── Step 3: Wait for user command ────────────────────────────
    send('progress', '⏳ Tumhara command wait kar raha hoon...');
    const command = await waitForInput(COMMAND_FILE, 600000); // 10 min
    send('progress', `👍 Command mila: "${command}"`);

    // ── Step 4: Navigate to service ──────────────────────────────
    const serviceId = command.toLowerCase().trim();
    const navigated = await navigateToService(page, serviceId);
    if (!navigated) {
      send('error', `❌ Service "${command}" nahi mila. Manually browser use karo.`);
      return;
    }

    // ── Step 5: Fill form based on service ────────────────────────
    if (serviceId === 'scholarship') {
      await fillScholarshipForm(page, student);
    } else if (['rpsc', 'rsmssb', 'reet', 'police'].includes(serviceId)) {
      // These have their own fill scripts — just navigate and show screenshot
      send('progress', `✅ ${serviceId.toUpperCase()} portal khul gaya! SSO se already logged in.`);
      await screenshot(page);
      send('progress', '👆 Ab "Exam Fill karo" button use karo ssc page pe — SSO ID already saved hai.');
    } else {
      send('progress', `🌐 ${command} service khul gayi! Screenshot dekho.`);
      await screenshot(page);
    }

    send('done', '✅ Kaam ho gaya!');

  } catch (err) {
    send('error', `❌ Error: ${err.message}`);
    await screenshot(page).catch(() => {});
    process.exit(1);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

// ── Retry wrapper ─────────────────────────────────────────────────
(async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await main();
      break;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        send('progress', `⚠️ Attempt ${attempt} fail — ${attempt * 5}s mein retry...`);
        await new Promise(r => setTimeout(r, attempt * 5000));
      } else {
        send('error', `❌ ${MAX_RETRIES} attempts ke baad bhi login fail`);
        process.exit(1);
      }
    }
  }
})();
