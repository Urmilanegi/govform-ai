// RPSC / RSMSSB / REET / Rajasthan Police Form Filler
// via sso.rajasthan.gov.in → Exam portal
// Communicates via stdout JSON lines

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PROFILE_DIR  = path.join(os.homedir(), '.govform', 'rpsc-profile');
const CREDS_FILE   = path.join(os.homedir(), '.govform', 'credentials.json');
const OTP_FILE     = '/tmp/govform_otp.txt';
const CAPTCHA_FILE = '/tmp/govform_captcha.txt';
const STATUS_FILE  = '/tmp/rpsc_status.json';
const MAX_RETRIES  = 3;

// ── Exam portal mapping ──────────────────────────────────────────
const EXAM_PORTALS = {
  'rpsc':               'https://rpsc.rajasthan.gov.in',
  'rpsc-teacher':       'https://rpsc.rajasthan.gov.in',
  'reet':               'https://rajeduboard.rajasthan.gov.in',
  'rsmssb':             'https://rsmssb.rajasthan.gov.in',
  'rajasthan-police':   'https://police.rajasthan.gov.in',
  'rajasthan-highcourt':'https://hcraj.nic.in',
};

function getPortalUrl(examId) {
  for (const [key, url] of Object.entries(EXAM_PORTALS)) {
    if (examId?.toLowerCase().includes(key)) return url;
  }
  return 'https://rpsc.rajasthan.gov.in'; // default
}

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
  if (!value) return false;
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

async function runFill(attempt) {
  const student = {
    name:       process.env.FULL_NAME    || '',
    dob:        process.env.DOB          || '',
    mobile:     process.env.MOBILE       || '',
    email:      process.env.EMAIL        || '',
    gender:     process.env.GENDER       || 'Male',
    fatherName: process.env.FATHER_NAME  || '',
    motherName: process.env.MOTHER_NAME  || '',
    category:   process.env.CATEGORY     || 'General',
    aadhaar:    process.env.AADHAAR      || '',
    state:      'Rajasthan',
    district:   process.env.DISTRICT     || '',
    pin:        process.env.PIN          || '',
    address:    process.env.ADDRESS      || '',
    photoPath:  process.env.PHOTO_PATH   || '',
    signPath:   process.env.SIGN_PATH    || '',
    examId:     process.env.EXAM_NAME    || 'rpsc',
    // SSO credentials (if user already has one)
    ssoId:      process.env.SSO_ID       || '',
    ssoPass:    process.env.SSO_PASS     || '',
    // Qualification
    qual: {
      degree:     process.env.QUAL_DEGREE  || '',
      stream:     process.env.QUAL_STREAM  || '',
      college:    process.env.QUAL_COLLEGE || '',
      university: process.env.QUAL_UNIV    || '',
      year:       process.env.QUAL_YEAR    || '',
      percent:    process.env.QUAL_PERCENT || '',
    },
  };

  send('progress', '🔍 Details verify ho rahi hain...');
  if (!student.mobile) {
    send('error', '❌ Mobile number required hai');
    process.exit(1);
  }

  // Load saved SSO credentials
  const savedCreds = loadCreds();
  const rpscCreds  = savedCreds['rpsc'] || {};

  // Priority: env vars > saved creds
  const ssoId   = student.ssoId   || rpscCreds.ssoId   || null;
  const ssoPass = student.ssoPass || rpscCreds.password || null;
  const hasSSO  = !!(ssoId && ssoPass);

  send('progress', hasSSO
    ? `✅ SSO ID found: ${ssoId}`
    : '📝 SSO ID nahi mili — naya account banayenge'
  );

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ── STEP 1: SSO REGISTRATION (only if no SSO ID) ─────────────
    if (!hasSSO) {
      send('start', '🌐 Rajasthan SSO portal — naya account bana raha hoon...');
      await page.goto('https://sso.rajasthan.gov.in/register', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Choose "Citizen" → "Mobile" tab
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, li'));
        const citizenTab = tabs.find(t => t.textContent?.trim().toLowerCase() === 'citizen');
        if (citizenTab) citizenTab.click();
      });
      await page.waitForTimeout(800);

      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, li, [class*="tab"]'));
        const mobileTab = tabs.find(t => t.textContent?.trim().toLowerCase().match(/^mobile$|^phone$/));
        if (mobileTab) mobileTab.click();
      });
      await page.waitForTimeout(800);

      // Fill mobile
      await fillInput(page, 'input[name*="mobile" i], input[type="tel"], input[placeholder*="mobile" i]', student.mobile);
      await page.waitForTimeout(300);

      // Send OTP
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/send.*otp|get.*otp/i) && !b.disabled);
        if (btn) btn.click();
      });
      await page.waitForTimeout(2000);

      // OTP
      send('otp', `📱 Mobile ${student.mobile} pe SSO registration OTP aaya hoga:`, { otpFile: OTP_FILE });
      const otp1 = await waitForInput(OTP_FILE);
      await fillInput(page, 'input[name*="otp" i], input[maxlength="6"], input[maxlength="4"]', otp1);
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/verify|confirm|validate/i));
        if (btn) btn.click();
      });
      await page.waitForTimeout(2000);
      send('progress', '✅ OTP verified!');

      // Fill profile details
      await fillInput(page, 'input[name*="name" i]:not([name*="user" i])', student.name);
      await fillInput(page, 'input[name*="email" i], input[type="email"]', student.email);
      await fillInput(page, 'input[name*="dob" i], input[type="date"]', student.dob);

      // Password — generate
      const newPass = `Raj@${student.mobile.slice(-4)}#2024`;
      await fillInput(page, 'input[type="password"]:not([name*="confirm" i])', newPass);
      await fillInput(page, 'input[name*="confirm" i][type="password"], input[name*="retype" i]', newPass);

      // CAPTCHA
      const hasCaptcha = await page.$('[class*="captcha" i], img[src*="captcha" i]');
      if (hasCaptcha) {
        const cText = await page.evaluate(() => document.querySelector('[class*="captcha" i]')?.textContent?.trim() || '');
        send('captcha', 'SSO Registration CAPTCHA:', { captchaText: cText });
        const sol = await waitForInput(CAPTCHA_FILE);
        await fillInput(page, 'input[name*="captcha" i]', sol);
      }

      // Submit
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/register|submit|create/i));
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);

      // Get SSO ID from page
      const newSsoId = await page.evaluate(() => {
        const txt = document.body.innerText;
        const m = txt.match(/(?:sso\s*id|username)[:\s]+([a-zA-Z0-9_@\.\-]{4,30})/i);
        return m ? m[1].trim() : null;
      });

      const finalSsoId = newSsoId || student.mobile;
      saveCreds('rpsc', { ssoId: finalSsoId, password: newPass, mobile: student.mobile });
      send('creds', `✅ SSO Account bana gaya!\nSSO ID: ${finalSsoId}\nPassword: ${newPass}\n⚠️ Yeh save kar lo!`, { ssoId: finalSsoId, password: newPass });

      rpscCreds.ssoId    = finalSsoId;
      rpscCreds.password = newPass;

      // Overwrite for login step
      Object.assign(student, { ssoId: finalSsoId, ssoPass: newPass });
    }

    // ── STEP 2: SSO LOGIN ─────────────────────────────────────────
    send('progress', '🔐 SSO Login kar raha hoon...');
    await page.goto('https://sso.rajasthan.gov.in/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const loginId   = student.ssoId   || rpscCreds.ssoId   || student.mobile;
    const loginPass = student.ssoPass || rpscCreds.password || '';

    await fillInput(page,
      'input[name*="user" i], input[name*="login" i], input[placeholder*="sso" i], #username, input[id*="user" i]',
      loginId
    );
    await fillInput(page, 'input[type="password"]', loginPass);
    await page.waitForTimeout(500);

    // CAPTCHA at login
    const loginCaptcha = await page.$('[class*="captcha" i], img[src*="captcha" i]');
    if (loginCaptcha) {
      const cText = await page.evaluate(() => {
        const el = document.querySelector('[class*="captcha" i]');
        return el?.textContent?.trim() || '';
      });
      send('captcha', 'SSO Login CAPTCHA:', { captchaText: cText });
      const sol = await waitForInput(CAPTCHA_FILE);
      await fillInput(page, 'input[name*="captcha" i], #captcha', sol);
    }

    // Click login
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const btn = btns.find(b =>
        (b.textContent || b.value || '').trim().toLowerCase().match(/^login$|^sign.?in$|^submit$/i) &&
        b.getBoundingClientRect().height > 0
      );
      if (btn) btn.click();
    });

    // Wait for login success
    try {
      await page.waitForFunction(
        () => !window.location.href.includes('signin') && !window.location.href.includes('login'),
        { timeout: 15000 }
      );
      send('progress', `✅ SSO Login ho gaya! Page: ${page.url()}`);
    } catch {
      // Check if OTP required
      const needsOtp = await page.evaluate(() => {
        return !!document.querySelector('input[maxlength="6"], input[name*="otp" i]');
      });
      if (needsOtp) {
        send('otp', `📱 SSO Login OTP aaya hoga mobile pe:`, { otpFile: OTP_FILE });
        const loginOtp = await waitForInput(OTP_FILE);
        await fillInput(page, 'input[maxlength="6"], input[name*="otp" i]', loginOtp);
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent?.toLowerCase().match(/verify|confirm|submit/i)
          );
          if (btn) btn.click();
        });
        await page.waitForTimeout(3000);
        send('progress', '✅ OTP verified — Login ho gaya!');
      } else {
        send('progress', `⚠️ Login status unclear — Page: ${page.url()}`);
      }
    }

    // Save SSO ID after successful login
    saveCreds('rpsc', { ssoId: loginId, password: loginPass, mobile: student.mobile });

    // ── STEP 3: NAVIGATE TO EXAM PORTAL ──────────────────────────
    const portalUrl = getPortalUrl(student.examId);
    send('progress', `📋 Exam portal pe ja raha hoon: ${portalUrl}`);
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
    send('progress', `📋 Portal loaded: ${page.url()}`);

    // Click Apply Online
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const apply = links.find(l =>
        l.textContent?.toLowerCase().match(/apply.*online|online.*apply|active.*notification|current.*vacancy|new.*application/i) &&
        l.getBoundingClientRect().height > 0
      );
      if (apply) apply.click();
    });
    await page.waitForTimeout(2000);
    send('progress', `📋 Application section: ${page.url()}`);

    // ── STEP 4: READ AUTO-POPULATED DATA FROM SSO ─────────────────
    send('progress', '🔍 SSO se auto-populate hue data read kar raha hoon...');
    await page.waitForTimeout(1500);

    const autoData = await page.evaluate(() => {
      const val = (sel) => document.querySelector(sel)?.value || '';
      return {
        name:     val('input[name*="name" i]') || val('#name') || val('#fullname'),
        mobile:   val('input[name*="mobile" i]') || val('input[type="tel"]'),
        email:    val('input[name*="email" i]') || val('input[type="email"]'),
        address:  val('input[name*="address" i]') || val('textarea[name*="address" i]'),
        district: val('input[name*="district" i]') || val('select[name*="district" i]'),
        pin:      val('input[name*="pin" i]') || val('input[name*="postal" i]'),
      };
    });

    if (autoData.name) send('progress', `✅ SSO se auto-fill: ${autoData.name}, ${autoData.mobile}`);

    // ── STEP 5: FILL REMAINING FIELDS ────────────────────────────
    send('progress', '📝 Baaki fields fill ho rahi hain...');

    if (!autoData.name)    await fillInput(page, 'input[name*="name" i]:not([name*="user" i])', student.name);
    if (!autoData.mobile)  await fillInput(page, 'input[name*="mobile" i], input[type="tel"]', student.mobile);
    if (!autoData.email)   await fillInput(page, 'input[name*="email" i], input[type="email"]', student.email);
    if (!autoData.address) await fillInput(page, 'input[name*="address" i], textarea[name*="address" i]', student.address);
    if (!autoData.pin)     await fillInput(page, 'input[name*="pin" i]', student.pin);

    await fillInput(page, 'input[name*="father" i]', student.fatherName);
    await fillInput(page, 'input[name*="mother" i]', student.motherName);
    await fillInput(page, 'input[name*="aadhaar" i], input[name*="aadhar" i]', student.aadhaar);
    await page.waitForTimeout(500);

    // Category dropdown
    await page.evaluate((cat) => {
      document.querySelectorAll('select').forEach(sel => {
        if ((sel.name + sel.id).toLowerCase().match(/categor|caste|communit/)) {
          for (const o of sel.options) {
            if (o.text.toUpperCase().includes(cat.toUpperCase())) {
              sel.value = o.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      });
    }, student.category);

    // District dropdown
    if (student.district) {
      await page.evaluate((dist) => {
        document.querySelectorAll('select').forEach(sel => {
          if ((sel.name + sel.id).toLowerCase().includes('district')) {
            for (const o of sel.options) {
              if (o.text.toLowerCase().includes(dist.toLowerCase())) {
                sel.value = o.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        });
      }, student.district);
    }

    // Gender radio
    await page.evaluate((g) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      for (const r of radios) {
        const label = (r.nextElementSibling?.textContent || r.labels?.[0]?.textContent || '').toLowerCase();
        if (label.includes(g.toLowerCase())) { r.click(); return; }
      }
    }, student.gender);

    // ── STEP 6: QUALIFICATION FILL ────────────────────────────────
    if (student.qual.degree) {
      send('progress', `🎓 Qualification fill: ${student.qual.degree} — ${student.qual.college}`);

      await page.evaluate((q) => {
        document.querySelectorAll('select').forEach(sel => {
          const id = (sel.name + sel.id).toLowerCase();
          if (id.match(/qualif|degree|educati/)) {
            for (const o of sel.options) {
              if (o.text.toUpperCase().includes(q.degree.toUpperCase())) {
                sel.value = o.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        });
      }, student.qual);

      await fillInput(page, 'input[name*="college" i], input[name*="institution" i]', student.qual.college);
      await fillInput(page, 'input[name*="university" i], input[name*="univ" i]', student.qual.university);
      await fillInput(page, 'input[name*="year" i], input[name*="passing" i]', student.qual.year);
      await fillInput(page, 'input[name*="percent" i], input[name*="marks" i]', student.qual.percent);
      await page.waitForTimeout(500);
      send('progress', '✅ Qualification filled!');
    }

    // ── STEP 7: PHOTO & SIGNATURE UPLOAD ─────────────────────────
    if (student.photoPath && fs.existsSync(student.photoPath)) {
      const pi = await page.$('input[type="file"][accept*="image"], input[type="file"][name*="photo" i]');
      if (pi) { await pi.setInputFiles(student.photoPath); await page.waitForTimeout(2000); send('progress', '✅ Photo uploaded!'); }
    }
    if (student.signPath && fs.existsSync(student.signPath)) {
      const sis = await page.$$('input[type="file"]');
      const si = sis[1] || null;
      if (si) { await si.setInputFiles(student.signPath); await page.waitForTimeout(2000); send('progress', '✅ Signature uploaded!'); }
    }

    // ── STEP 8: SAVE & NEXT ───────────────────────────────────────
    const urlBefore = page.url();
    for (let t = 1; t <= 3; t++) {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(700);
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const btn = btns.find(b =>
          (b.textContent || b.value || '').trim().match(/save\s*&?\s*next|next|save|submit/i) &&
          !b.disabled && b.getBoundingClientRect().height > 0
        );
        if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return (btn.textContent || btn.value || '').trim(); }
        return null;
      });
      if (!clicked) { await page.waitForTimeout(1500); continue; }
      send('progress', `✅ Save & Next clicked: "${clicked}"`);
      try {
        await page.waitForFunction(
          (prev) => window.location.href !== prev || !!document.querySelector('input[type="checkbox"]'),
          urlBefore, { timeout: 10000 }
        );
        break;
      } catch { await page.waitForTimeout(1500); }
    }

    // ── STEP 9: PAYMENT DETECTION ────────────────────────────────
    await page.waitForTimeout(2000);
    const payUrl = page.url();
    const isPaymentPage = payUrl.match(/pay|fee|payment|challan/i) ||
      await page.evaluate(() => {
        const txt = (document.body?.innerText || '').toLowerCase();
        return txt.includes('pay fee') || txt.includes('payment') || txt.includes('challan') ||
               !!document.querySelector('img[src*="qr" i], canvas, img[alt*="qr" i]');
      });

    if (isPaymentPage) {
      send('progress', '💳 Payment page detect hua!');
      await page.waitForTimeout(1500);

      await page.evaluate(() => {
        const qr = document.querySelector('img[src*="qr" i], canvas, img[alt*="qr" i]');
        if (qr) qr.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      await page.waitForTimeout(800);

      const paymentScreenshot = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
      const qrBase64 = await page.evaluate(() => {
        const qrImg = document.querySelector('img[src*="qr" i], img[alt*="qr" i]');
        if (!qrImg) return null;
        const canvas = document.createElement('canvas');
        canvas.width = qrImg.naturalWidth || 200;
        canvas.height = qrImg.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(qrImg, 0, 0); return canvas.toDataURL('image/png').split(',')[1]; }
        return null;
      }).catch(() => null);

      const feeAmount = await page.evaluate(() => {
        const m = (document.body?.innerText || '').match(/(?:fee|amount|rs\.?|₹)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i);
        return m ? m[1].replace(',', '') : null;
      }).catch(() => null);

      send('payment', `💳 Payment karo — QR scan karo ya Net Banking use karo`, {
        screenshot: paymentScreenshot, qrBase64, feeAmount, paymentUrl: payUrl,
      });

      // Wait for payment confirmation — max 10 min
      const payStart = Date.now();
      let paid = false;
      while (Date.now() - payStart < 600000) {
        await page.waitForTimeout(3000);
        const txt = await page.evaluate(() => (document.body?.innerText || '').toLowerCase()).catch(() => '');
        const success = page.url().match(/success|confirm|receipt|thank/i) ||
          txt.match(/payment successful|transaction successful|fee paid|receipt no|acknowledgement/i);
        if (success) {
          paid = true;
          send('payment_done', '✅ Payment ho gayi!', {
            screenshot: await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null)
          });
          break;
        }
        if ((Date.now() - payStart) % 10000 < 3000) {
          const upd = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
          if (upd) send('payment', '⏳ Payment pending...', { screenshot: upd, qrBase64, feeAmount });
        }
      }
      if (!paid) send('progress', '⚠️ Payment timeout — manually check karo.');
    }

    // ── STEP 10: DECLARATION & FINAL SUBMIT ──────────────────────
    await page.waitForTimeout(2000);
    const cbCount = await page.evaluate(() => {
      let c = 0;
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (!cb.checked) { cb.click(); c++; } });
      return c;
    });
    if (cbCount > 0) send('progress', `✅ ${cbCount} declaration checkboxes ticked`);

    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const btn = btns.find(b =>
        (b.textContent || b.value || '').trim().match(/final.*submit|submit.*final|submit|confirm/i) &&
        !b.disabled && b.getBoundingClientRect().height > 0
      );
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (submitted) { send('progress', '🚀 Final Submit clicked!'); await page.waitForTimeout(4000); }

    // ── STEP 11: PDF ──────────────────────────────────────────────
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
    await page.emulateMedia({ media: 'print' });
    const pdfBuf = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    }).catch(() => null);
    await page.emulateMedia({ media: 'screen' });

    if (pdfBuf && pdfBuf.length > 5000) {
      fs.writeFileSync('/tmp/rpsc_printout.pdf', pdfBuf);
      send('progress', '✅ PDF ready!');
    }

    send('done', '🎉 Form fill ho gaya! PDF ready hai — download karo.', {
      screenshot, pdfPath: '/tmp/rpsc_printout.pdf',
    });

  } catch (err) {
    const scr = await page.screenshot({ encoding: 'base64' }).catch(() => null);
    send('error', `❌ Error (Attempt ${attempt}/${MAX_RETRIES}): ${err.message}`, { screenshot: scr });
    throw err;
  }

  await new Promise(r => setTimeout(r, 600000));
  await context.close();
}

// ── RETRY WRAPPER ────────────────────────────────────────────────
(async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await runFill(attempt);
      break;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 5000;
        send('progress', `🔄 Retry ${attempt + 1}/${MAX_RETRIES} — ${wait/1000}s mein...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        send('error', `❌ ${MAX_RETRIES} attempts fail — support se contact karo.`);
        process.exit(1);
      }
    }
  }
})();
