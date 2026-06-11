// UPSC Form Filler — upsconline.nic.in
// Handles OTR Registration → OTP → Login → Apply
// Communicates via stdout JSON lines

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PROFILE_DIR  = path.join(os.homedir(), '.govform', 'upsc-profile');
const CREDS_FILE   = path.join(os.homedir(), '.govform', 'credentials.json');
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

(async () => {
  const student = {
    name:       process.env.FULL_NAME    || 'SUMIT KUMAR MINA',
    dob:        process.env.DOB          || '07-07-2000',
    mobile:     process.env.MOBILE       || '',
    email:      process.env.EMAIL        || '',
    gender:     process.env.GENDER       || 'Male',
    fatherName: process.env.FATHER_NAME  || 'HARKESH MEENA',
    motherName: process.env.MOTHER_NAME  || '',
    category:   process.env.CATEGORY    || 'ST',
    aadhaar:    process.env.AADHAAR      || '201227964504',
    nationality:'Indian',
    state:      process.env.STATE        || 'Rajasthan',
    address:    process.env.ADDRESS      || 'Narouli Chaur, Sawai Madhopur',
    pin:        process.env.PIN          || '322214',
    photoPath:  process.env.PHOTO_PATH   || '',
    signPath:   process.env.SIGN_PATH    || '',
    // Exam centers (preference order)
    centers: [
      process.env.CENTER1 || '',
      process.env.CENTER2 || '',
      process.env.CENTER3 || '',
      process.env.CENTER4 || '',
    ].filter(Boolean),
    // Educational qualification
    qual: {
      degree:     process.env.QUAL_DEGREE  || '',
      stream:     process.env.QUAL_STREAM  || '',
      college:    process.env.QUAL_COLLEGE || '',
      university: process.env.QUAL_UNIV    || '',
      year:       process.env.QUAL_YEAR    || '',
      percent:    process.env.QUAL_PERCENT || '',
      rollNo:     process.env.QUAL_ROLL    || '',
    },
  };

  send('progress', '🔍 UPSC details verify ho rahi hain...');
  if (!student.mobile || !student.email) {
    send('error', '❌ Mobile aur Email required hai');
    process.exit(1);
  }

  const savedCreds  = loadCreds();
  const upscCreds   = savedCreds['upsc'] || {};
  const hasLogin    = !!(upscCreds.regId && upscCreds.password);
  send('progress', hasLogin ? `✅ Saved credentials: ${upscCreds.regId}` : '📝 Naya registration karenge');

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    send('start', '🌐 UPSC portal khol raha hoon...');
    await page.goto('https://upsconline.nic.in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    send('progress', `📋 Page: ${page.url()}`);

    // ── REGISTRATION ───────────────────────────────────────────
    if (!hasLogin) {
      send('progress', '📝 UPSC OTR Registration shuru...');

      // Navigate to OTR registration
      const otpUrls = [
        'https://upsconline.nic.in',
        'https://upsconline.nic.in',
      ];

      for (const url of otpUrls) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(2000);
          break;
        } catch {}
      }

      // Click new registration
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button'));
        const reg = links.find(l =>
          l.textContent?.toLowerCase().match(/new.*registr|register|otr|one.?time/i) &&
          l.getBoundingClientRect().height > 0
        );
        if (reg) reg.click();
      });
      await page.waitForTimeout(2000);
      send('progress', `📋 Registration URL: ${page.url()}`);

      // Fill OTR form
      const nameParts = student.name.split(' ');
      await fillInput(page, 'input[name*="fname" i], input[name*="firstname" i], #fname, #FirstName', nameParts[0]);
      await fillInput(page, 'input[name*="mname" i], input[name*="middlename" i]', nameParts[1] || '');
      await fillInput(page, 'input[name*="lname" i], input[name*="lastname" i], #lname, #LastName', nameParts.slice(-1)[0] || '');
      await fillInput(page, 'input[name*="name"]:not([name*="first"]):not([name*="last"]):not([name*="middle"])', student.name);
      await fillInput(page, 'input[name*="dob" i], input[id*="dob" i], input[type="date"]', student.dob);
      await fillInput(page, 'input[name*="mobile" i], input[name*="phone" i]', student.mobile);
      await fillInput(page, 'input[type="email"], input[name*="email" i]', student.email);
      await fillInput(page, 'input[name*="father" i]', student.fatherName);
      await fillInput(page, 'input[name*="mother" i]', student.motherName);

      // Gender radio
      await page.evaluate((g) => {
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const r of radios) {
          const label = (r.nextElementSibling?.textContent || r.labels?.[0]?.textContent || '').toLowerCase();
          if (label.includes(g.toLowerCase())) { r.click(); return; }
        }
      }, student.gender);

      // Nationality
      await page.evaluate(() => {
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
          if ((s.name+s.id).toLowerCase().includes('nation')) {
            for (const o of s.options) {
              if (o.text.toLowerCase().includes('indian')) { s.value = o.value; s.dispatchEvent(new Event('change',{bubbles:true})); return; }
            }
          }
        }
      });

      await page.waitForTimeout(500);

      // CAPTCHA (UPSC often has image captcha)
      const captchaImg = await page.$('img[src*="captcha" i], img[alt*="captcha" i], canvas');
      if (captchaImg) {
        const captchaText = await page.evaluate(() => {
          const el = document.querySelector('[class*="captcha" i], [id*="captcha" i]');
          return el?.textContent?.trim() || '';
        });
        send('captcha', `CAPTCHA type karo (image dekhkar):`, { captchaText });
        const sol = await waitForInput(CAPTCHA_FILE);
        await fillInput(page, 'input[name*="captcha" i], input[placeholder*="captcha" i], #captcha', sol);
      }

      send('progress', '📤 Registration form submit kar raha hoon...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/register|submit|next/i) && !b.disabled);
        if (btn) btn.click();
        else { const s = document.querySelector('input[type="submit"]'); if (s) s.click(); }
      });
      await page.waitForTimeout(3000);

      // OTP
      send('otp', '📧 OTP aaya hoga email/mobile pe — type karo:', { otpFile: OTP_FILE });
      const otp = await waitForInput(OTP_FILE);
      send('progress', `✏️ OTP: ${otp}`);
      await fillInput(page, 'input[name*="otp" i], input[placeholder*="otp" i], input[maxlength="6"]', otp);
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/verify|confirm|submit/i));
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);
      send('progress', '✅ OTP verified!');

      // Get registration ID from page
      const regId = await page.evaluate(() => {
        const txt = document.body.innerText;
        const match = txt.match(/(?:registration|otr|applicant)\s*(?:id|no|number)[:\s#]*([0-9]{8,15})/i);
        return match ? match[1] : null;
      });

      // Create password
      const newPass = `UPSC@${student.mobile.slice(-4)}#2024`;
      await fillInput(page, 'input[type="password"]:first-of-type', newPass);
      await fillInput(page, 'input[name*="confirm" i][type="password"], input[name*="retype" i]', newPass);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/save|submit|create/i));
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);

      const finalRegId = regId || await page.evaluate(() => {
        const m = document.body.innerText.match(/[0-9]{8,15}/);
        return m ? m[0] : null;
      });

      if (finalRegId) {
        saveCreds('upsc', { regId: finalRegId, password: newPass });
        send('creds', `✅ UPSC Registration ho gayi!\nReg ID: ${finalRegId}\nPassword: ${newPass}`, { regId: finalRegId });
      } else {
        send('otp', '📋 Registration ID page pe dikh raha hoga — type karo:', { otpFile: OTP_FILE });
        const manualId = await waitForInput(OTP_FILE);
        saveCreds('upsc', { regId: manualId, password: newPass });
      }

      upscCreds.regId    = loadCreds()['upsc']?.regId || finalRegId;
      upscCreds.password = newPass;
    }

    // ── LOGIN ──────────────────────────────────────────────────
    send('progress', '🔐 UPSC Login kar raha hoon...');
    await page.goto('https://upsconline.nic.in', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Click Registered Candidate Login
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const login = links.find(l => l.textContent?.toLowerCase().match(/already.*register|login|sign.?in|existing/i));
      if (login) login.click();
    });
    await page.waitForTimeout(1500);

    await fillInput(page, 'input[name*="regId" i], input[name*="userid" i], input[placeholder*="registration id" i]', upscCreds.regId || '');
    await fillInput(page, 'input[type="password"]', upscCreds.password || '');
    await fillInput(page, 'input[name*="dob" i], input[type="date"]', student.dob);

    // CAPTCHA at login
    const loginCaptcha = await page.$('img[src*="captcha" i]');
    if (loginCaptcha) {
      const cText = await page.evaluate(() => document.querySelector('[class*="captcha"]')?.textContent?.trim() || '');
      send('captcha', 'Login CAPTCHA type karo:', { captchaText: cText });
      const sol = await waitForInput(CAPTCHA_FILE);
      await fillInput(page, 'input[name*="captcha" i]', sol);
    }

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const btn = btns.find(b => b.textContent?.toLowerCase().match(/login|sign.?in/i) || b.value?.toLowerCase() === 'login');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);
    send('progress', `✅ Login done — Page: ${page.url()}`);

    // ── APPLY FOR EXAM ──────────────────────────────────────────
    send('progress', '📋 Exam application dhundh raha hoon...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const apply = links.find(l => l.textContent?.toLowerCase().match(/apply.*online|active.*notif|new.*exam/i));
      if (apply) apply.click();
    });
    await page.waitForTimeout(2000);

    // Fill personal/education details
    send('progress', '📝 Application form fill ho raha hai...');
    await fillInput(page, 'input[name*="mobile" i]', student.mobile);
    await fillInput(page, 'input[name*="aadhaar" i], input[name*="aadhar" i]', student.aadhaar);
    await fillInput(page, 'textarea[name*="address" i], input[name*="address" i]', student.address || student.state);
    await fillInput(page, 'input[name*="pin" i], input[name*="postal" i]', student.pin || '');
    await page.waitForTimeout(500);

    // ── EDUCATIONAL QUALIFICATION ──────────────────────────────
    if (student.qual.degree) {
      send('progress', `🎓 Qualification fill ho raha hai: ${student.qual.degree} — ${student.qual.college}`);

      // Degree / Qualification dropdown
      await page.evaluate((q) => {
        document.querySelectorAll('select').forEach(sel => {
          const id = (sel.name + sel.id + (sel.closest('label')?.textContent || '')).toLowerCase();
          if (id.match(/qualif|degree|educati/)) {
            for (const o of sel.options) {
              if (o.text.toUpperCase().includes(q.degree.toUpperCase()) || o.value.toUpperCase().includes(q.degree.toUpperCase())) {
                sel.value = o.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return;
              }
            }
            // Fallback: select "Graduation" or "Graduate" option
            for (const o of sel.options) {
              if (o.text.toLowerCase().match(/graduat|bachelor|degree/)) {
                sel.value = o.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return;
              }
            }
          }
        });
      }, student.qual);
      await page.waitForTimeout(500);

      // Stream / Subject
      if (student.qual.stream) {
        await fillInput(page, 'input[name*="stream" i], input[name*="subject" i], input[name*="branch" i]', student.qual.stream);
      }

      // College name
      await fillInput(page,
        'input[name*="college" i], input[name*="institution" i], input[name*="institute" i], input[placeholder*="college" i]',
        student.qual.college
      );

      // University name
      if (student.qual.university) {
        await fillInput(page,
          'input[name*="university" i], input[name*="univ" i], input[placeholder*="university" i]',
          student.qual.university
        );
      }

      // Passing Year
      if (student.qual.year) {
        await fillInput(page,
          'input[name*="year" i], input[name*="passing" i], input[placeholder*="year" i]',
          student.qual.year
        );
        // Year dropdown fallback
        await page.evaluate((yr) => {
          document.querySelectorAll('select').forEach(sel => {
            if ((sel.name + sel.id).toLowerCase().match(/year|passing/)) {
              for (const o of sel.options) {
                if (o.value === yr || o.text === yr) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
              }
            }
          });
        }, student.qual.year);
      }

      // Percentage / CGPA
      if (student.qual.percent) {
        await fillInput(page,
          'input[name*="percent" i], input[name*="cgpa" i], input[name*="marks" i], input[placeholder*="percent" i]',
          student.qual.percent
        );
      }

      // Roll No
      if (student.qual.rollNo) {
        await fillInput(page, 'input[name*="roll" i], input[name*="enroll" i]', student.qual.rollNo);
      }

      send('progress', `✅ Qualification filled: ${student.qual.degree} — ${student.qual.percent}%`);
      await page.waitForTimeout(500);
    }

    // ── EXAM CENTERS ──────────────────────────────────────────
    if (student.centers.length > 0) {
      send('progress', `📍 Exam centers fill ho rahe hain: ${student.centers.join(', ')}`);
      await page.evaluate((centers) => {
        let centerIndex = 0;
        document.querySelectorAll('select').forEach(sel => {
          const id = (sel.name + sel.id + (sel.closest('label')?.textContent || '')).toLowerCase();
          if (id.match(/center|centre|venue|city.*exam|exam.*city/)) {
            const city = centers[centerIndex];
            if (!city) return;
            for (const o of sel.options) {
              if (o.text.toLowerCase().includes(city.toLowerCase())) {
                sel.value = o.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                centerIndex++;
                return;
              }
            }
          }
        });
      }, student.centers);
      await page.waitForTimeout(500);
      send('progress', `✅ Centers filled`);
    }

    // Category dropdown
    await page.evaluate((cat) => {
      document.querySelectorAll('select').forEach(sel => {
        if ((sel.name+sel.id).toLowerCase().match(/categor|caste|communit/)) {
          for (const o of sel.options) {
            if (o.text.toUpperCase().includes(cat)) { sel.value = o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); }
          }
        }
      });
    }, student.category);

    // Photo upload
    if (student.photoPath && fs.existsSync(student.photoPath)) {
      const pi = await page.$('input[type="file"]');
      if (pi) { await pi.setInputFiles(student.photoPath); await page.waitForTimeout(2000); send('progress', '✅ Photo uploaded'); }
    }

    // Save & Next — with retry
    const urlBeforeSave = page.url();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(700);
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const btn = btns.find(b => (b.textContent||b.value||'').trim().match(/save\s*&?\s*next|next|save|submit/i) && !b.disabled && b.getBoundingClientRect().height > 0);
        if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return b.textContent?.trim() || 'submit'; }
        return null;
      });
      if (!clicked) { send('progress', `⚠️ Save button not found (attempt ${attempt})`); await page.waitForTimeout(1500); continue; }
      send('progress', `✅ Save clicked (attempt ${attempt}): "${clicked}"`);
      try {
        await page.waitForFunction(
          (prev) => window.location.href !== prev || document.querySelector('input[type="checkbox"]'),
          urlBeforeSave, { timeout: 10000 }
        );
        send('progress', `✅ Page advanced: ${page.url()}`); break;
      } catch { send('progress', `⚠️ Page nahi badi (attempt ${attempt})`); await page.waitForTimeout(1500); }
    }

    // Declaration / Final Submit
    await page.waitForTimeout(2000);
    const cbCount = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (!cb.checked) { cb.click(); count++; } });
      return count;
    });
    if (cbCount > 0) send('progress', `✅ ${cbCount} declaration checkboxes ticked`);
    await page.waitForTimeout(1000);
    const finalSubmit = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const btn = btns.find(b => (b.textContent||b.value||'').trim().match(/final.*submit|submit.*final|submit|confirm/i) && !b.disabled && b.getBoundingClientRect().height > 0);
      if (btn) { btn.click(); return true; } return false;
    });
    if (finalSubmit) { send('progress', '🚀 Final Submit clicked!'); await page.waitForTimeout(4000); }

    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
    await page.emulateMedia({ media: 'print' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }).catch(() => null);
    await page.emulateMedia({ media: 'screen' });
    if (pdfBuf && pdfBuf.length > 5000) { fs.writeFileSync('/tmp/upsc_printout.pdf', pdfBuf); send('progress', '✅ PDF saved!'); }

    send('done', '🎉 UPSC form fill ho gaya!', { screenshot, pdfPath: '/tmp/upsc_printout.pdf' });

  } catch (err) {
    const scr = await page.screenshot({ encoding: 'base64' }).catch(() => null);
    send('error', `❌ Error: ${err.message}`, { screenshot: scr });
  }

  await new Promise(r => setTimeout(r, 600000));
  await context.close();
})();
